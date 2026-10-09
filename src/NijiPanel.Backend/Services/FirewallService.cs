using System.Text.RegularExpressions;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

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
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ILogger<FirewallService> _logger;

    public FirewallService(
        ISshConnectionManager sshManager,
        ICommandRegistry cmdRegistry,
        ILogger<FirewallService> logger)
    {
        _sshManager = sshManager;
        _cmdRegistry = cmdRegistry;
        _logger = logger;
    }

    public async Task<FirewallStatusDto> GetRulesAsync(HostEntity host)
    {
        var ufwCmd = _cmdRegistry.GetCommand("Firewall.UfwStatus");
        var ufwTimeout = _cmdRegistry.GetTimeout("Firewall.UfwStatus", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, ufwCmd, timeoutSeconds: ufwTimeout);
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
            var iptCmd = _cmdRegistry.GetCommand("Firewall.IptablesStatus");
            var iptTimeout = _cmdRegistry.GetTimeout("Firewall.IptablesStatus", 10);
            var (iptExit, iptOut, _) = await _sshManager.RunCommandAsync(host, iptCmd, timeoutSeconds: iptTimeout);
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

        string ruleSpec;
        var cleanPort = request.Port.Trim().Replace(";", "").Replace("&", "").Replace("|", "");
        var cleanFrom = request.From?.Trim().Replace(";", "").Replace("&", "").Replace("|", "");

        if (!string.IsNullOrWhiteSpace(cleanFrom) && !cleanFrom.Equals("Anywhere", StringComparison.OrdinalIgnoreCase))
        {
            ruleSpec = proto == "any"
                ? $"{action} from {cleanFrom} to any port {cleanPort}"
                : $"{action} from {cleanFrom} to any port {cleanPort} proto {proto}";
        }
        else
        {
            ruleSpec = proto == "any"
                ? $"{action} {cleanPort}"
                : $"{action} {cleanPort}/{proto}";
        }

        var cmd = _cmdRegistry.GetCommand("Firewall.UfwAddRule", new { ruleCommand = ruleSpec });
        var timeout = _cmdRegistry.GetTimeout("Firewall.UfwAddRule", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
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

        var cmd = _cmdRegistry.GetCommand("Firewall.UfwDeleteRule", new { ruleNumber });
        var timeout = _cmdRegistry.GetTimeout("Firewall.UfwDeleteRule", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
        if (exitCode != 0)
        {
            return new FirewallOperationResult(false, $"Failed to delete rule: {error}", output);
        }

        return new FirewallOperationResult(true, $"Rule #{ruleNumber} deleted successfully", output);
    }

    public async Task<Fail2banStatusDto> GetFail2banStatusAsync(HostEntity host)
    {
        var checkScript = _cmdRegistry.GetCommand("Firewall.Fail2banStatus");
        var timeout = _cmdRegistry.GetTimeout("Firewall.Fail2banStatus", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, checkScript, timeoutSeconds: timeout);
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

        var cmd = _cmdRegistry.GetCommand("Firewall.Fail2banUnban", new { jail = targetJail, ip = cleanIp });
        var timeout = _cmdRegistry.GetTimeout("Firewall.Fail2banUnban", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);

        if (exitCode != 0)
        {
            // Also try unban all jails as fallback
            var fallbackCmd = _cmdRegistry.GetCommand("Firewall.Fail2banUnbanFallback", new { ip = cleanIp });
            var fbTimeout = _cmdRegistry.GetTimeout("Firewall.Fail2banUnbanFallback", 10);
            var (fbExit, fbOut, fbErr) = await _sshManager.RunCommandAsync(host, fallbackCmd, timeoutSeconds: fbTimeout);
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
