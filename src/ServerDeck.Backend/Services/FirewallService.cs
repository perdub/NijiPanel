using System.Text.RegularExpressions;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface IFirewallService
{
    Task<FirewallStatusDto> GetRulesAsync(HostEntity host);
    Task<FirewallOperationResult> AddRuleAsync(HostEntity host, CreateFirewallRuleRequest request);
    Task<FirewallOperationResult> DeleteRuleAsync(HostEntity host, int ruleNumber);
    Task<Fail2banStatusDto> GetFail2banStatusAsync(HostEntity host);
    Task<FirewallOperationResult> UnbanIpAsync(HostEntity host, string ip, string? jail = null);
}

public class FirewallService : IFirewallService
{
    private readonly ISshConnectionManager _sshManager;
    private readonly ILogger<FirewallService> _logger;

    public FirewallService(ISshConnectionManager sshManager, ILogger<FirewallService> logger)
    {
        _sshManager = sshManager;
        _logger = logger;
    }

    public async Task<FirewallStatusDto> GetRulesAsync(HostEntity host)
    {
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, "ufw status numbered 2>&1", timeoutSeconds: 15);
        var rules = new List<FirewallRuleDto>();
        bool isActive = false;
        string statusText = "inactive";
        string backend = "ufw";

        if (output.Contains("Status: active", StringComparison.OrdinalIgnoreCase))
        {
            isActive = true;
            statusText = "active";
            rules = ParseUfwRules(output);
        }
        else if (output.Contains("Status: inactive", StringComparison.OrdinalIgnoreCase))
        {
            isActive = false;
            statusText = "inactive";
        }
        else
        {
            // Fallback: check iptables
            backend = "iptables";
            var (iptExit, iptOut, _) = await _sshManager.RunCommandAsync(host, "iptables -L INPUT -n --line-numbers 2>&1", timeoutSeconds: 10);
            if (iptExit == 0 && !string.IsNullOrEmpty(iptOut))
            {
                isActive = true;
                statusText = "iptables active";
                rules = ParseIptablesRules(iptOut);
            }
            else
            {
                statusText = string.IsNullOrEmpty(error) ? "Firewall not configured" : error;
            }
        }

        return new FirewallStatusDto(isActive, statusText, backend, rules);
    }

    public async Task<FirewallOperationResult> AddRuleAsync(HostEntity host, CreateFirewallRuleRequest request)
    {
        var action = request.Action.ToLowerInvariant() switch
        {
            "deny" => "deny",
            "reject" => "reject",
            _ => "allow"
        };

        var proto = request.Protocol.ToLowerInvariant();
        if (proto != "tcp" && proto != "udp" && proto != "any")
        {
            proto = "tcp";
        }

        string cmd;
        var cleanPort = request.Port.Trim().Replace(";", "").Replace("&", "").Replace("|", "");
        var cleanFrom = request.From?.Trim().Replace(";", "").Replace("&", "").Replace("|", "");

        if (!string.IsNullOrWhiteSpace(cleanFrom) && !cleanFrom.Equals("Anywhere", StringComparison.OrdinalIgnoreCase))
        {
            cmd = proto == "any"
                ? $"ufw {action} from {cleanFrom} to any port {cleanPort}"
                : $"ufw {action} from {cleanFrom} to any port {cleanPort} proto {proto}";
        }
        else
        {
            cmd = proto == "any"
                ? $"ufw {action} {cleanPort}"
                : $"ufw {action} {cleanPort}/{proto}";
        }

        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 15);
        if (exitCode != 0)
        {
            return new FirewallOperationResult(false, $"Failed to add rule: {error}", output);
        }

        return new FirewallOperationResult(true, "Firewall rule added successfully", output);
    }

    public async Task<FirewallOperationResult> DeleteRuleAsync(HostEntity host, int ruleNumber)
    {
        if (ruleNumber <= 0)
        {
            return new FirewallOperationResult(false, "Invalid rule number");
        }

        var cmd = $"echo \"y\" | ufw delete {ruleNumber}";
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 15);
        if (exitCode != 0)
        {
            return new FirewallOperationResult(false, $"Failed to delete rule: {error}", output);
        }

        return new FirewallOperationResult(true, $"Rule #{ruleNumber} deleted successfully", output);
    }

    public async Task<Fail2banStatusDto> GetFail2banStatusAsync(HostEntity host)
    {
        const string checkScript = @"
if command -v fail2ban-client >/dev/null 2>&1; then
    echo '===STATUS==='
    fail2ban-client status 2>&1
    echo '===SSHD==='
    fail2ban-client status sshd 2>&1
else
    echo 'NOT_INSTALLED'
fi
";
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, checkScript, timeoutSeconds: 15);
        if (output.Contains("NOT_INSTALLED"))
        {
            return new Fail2banStatusDto(false, false, new List<string>(), new List<string>(), 0, 0);
        }

        bool isRunning = output.Contains("Number of jail") || output.Contains("Jail list");
        var jails = new List<string>();
        var bannedIps = new List<string>();
        int currentlyBanned = 0;
        int totalBanned = 0;

        // Parse Jails: e.g. "Jail list: sshd, nginx"
        var jailMatch = Regex.Match(output, @"Jail list:\s*([^\r\n]+)", RegexOptions.IgnoreCase);
        if (jailMatch.Success)
        {
            var rawList = jailMatch.Groups[1].Value;
            foreach (var j in rawList.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!string.IsNullOrWhiteSpace(j) && !jails.Contains(j))
                {
                    jails.Add(j);
                }
            }
        }
        if (jails.Count == 0 && output.Contains("Status for the jail: sshd"))
        {
            jails.Add("sshd");
        }

        // Parse currently banned: "Currently banned: 3"
        var currMatch = Regex.Match(output, @"Currently banned:\s*(\d+)", RegexOptions.IgnoreCase);
        if (currMatch.Success && int.TryParse(currMatch.Groups[1].Value, out var cb))
        {
            currentlyBanned = cb;
        }

        // Parse total banned: "Total banned: 15"
        var totalMatch = Regex.Match(output, @"Total banned:\s*(\d+)", RegexOptions.IgnoreCase);
        if (totalMatch.Success && int.TryParse(totalMatch.Groups[1].Value, out var tb))
        {
            totalBanned = tb;
        }

        // Parse Banned IP list: "Banned IP list: 1.2.3.4 5.6.7.8"
        var ipMatch = Regex.Match(output, @"Banned IP list:\s*([^\r\n]+)", RegexOptions.IgnoreCase);
        if (ipMatch.Success)
        {
            var ipListStr = ipMatch.Groups[1].Value.Trim();
            if (!string.IsNullOrEmpty(ipListStr))
            {
                var ips = ipListStr.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var ip in ips)
                {
                    if (!bannedIps.Contains(ip))
                    {
                        bannedIps.Add(ip);
                    }
                }
            }
        }

        return new Fail2banStatusDto(true, isRunning, jails, bannedIps, currentlyBanned, totalBanned);
    }

    public async Task<FirewallOperationResult> UnbanIpAsync(HostEntity host, string ip, string? jail = null)
    {
        var cleanIp = ip.Trim().Replace(";", "").Replace("&", "").Replace("|", "");
        var targetJail = string.IsNullOrWhiteSpace(jail) ? "sshd" : jail.Trim().Replace(";", "").Replace("&", "");

        var cmd = $"fail2ban-client set {targetJail} unbanip {cleanIp}";
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 15);

        if (exitCode != 0)
        {
            // Also try unban all jails as fallback
            var fallbackCmd = $"fail2ban-client unban {cleanIp} 2>&1";
            var (fbExit, fbOut, fbErr) = await _sshManager.RunCommandAsync(host, fallbackCmd, timeoutSeconds: 10);
            if (fbExit != 0)
            {
                return new FirewallOperationResult(false, $"Failed to unban {cleanIp}: {error} {fbErr}", output);
            }
            return new FirewallOperationResult(true, $"Successfully unbanned IP {cleanIp}", fbOut);
        }

        return new FirewallOperationResult(true, $"Successfully unbanned IP {cleanIp} from {targetJail}", output);
    }

    private static List<FirewallRuleDto> ParseUfwRules(string output)
    {
        var list = new List<FirewallRuleDto>();
        var lines = output.Split('\n');

        foreach (var line in lines)
        {
            var match = Regex.Match(line, @"^\s*\[\s*(\d+)\]\s+([^\s]+(?:\s+\([^\)]+\))?)\s+(ALLOW|DENY|REJECT|LIMIT)(?:\s+(IN|OUT))?\s+(.*)$", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                int num = int.Parse(match.Groups[1].Value);
                string to = match.Groups[2].Value.Trim();
                string action = match.Groups[3].Value.Trim();
                string direction = match.Groups[4].Success ? match.Groups[4].Value.Trim() : "IN";
                string from = match.Groups[5].Value.Trim();

                string proto = "any";
                if (to.Contains("/tcp")) proto = "tcp";
                else if (to.Contains("/udp")) proto = "udp";

                list.Add(new FirewallRuleDto(num, action, from, to, proto, direction));
            }
        }

        return list;
    }

    private static List<FirewallRuleDto> ParseIptablesRules(string output)
    {
        var list = new List<FirewallRuleDto>();
        var lines = output.Split('\n');
        foreach (var line in lines)
        {
            // Format: num target prot opt source destination
            var match = Regex.Match(line, @"^\s*(\d+)\s+([A-Z]+)\s+([a-z0-9]+)\s+[^\s]+\s+([^\s]+)\s+([^\s]+)", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                int num = int.Parse(match.Groups[1].Value);
                string target = match.Groups[2].Value.Trim();
                string proto = match.Groups[3].Value.Trim();
                string src = match.Groups[4].Value.Trim();
                string dest = match.Groups[5].Value.Trim();

                list.Add(new FirewallRuleDto(num, target, src, dest, proto, "IN"));
            }
        }
        return list;
    }
}
