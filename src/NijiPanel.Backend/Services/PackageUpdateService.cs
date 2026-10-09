using System.Text.RegularExpressions;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface IPackageUpdateService
{
    Task<PackageUpdateCheckResult> CheckUpdatesAsync(string hostId);
    Task<PackageUpgradeResult> RunUpgradeAsync(string hostId);
}

public class PackageUpdateService : IPackageUpdateService
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ILogger<PackageUpdateService> _logger;

    public PackageUpdateService(
        IHostService hostService,
        ISshConnectionManager sshManager,
        ICommandRegistry cmdRegistry,
        ILogger<PackageUpdateService> logger)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _cmdRegistry = cmdRegistry;
        _logger = logger;
    }

    public async Task<PackageUpdateCheckResult> CheckUpdatesAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var checkScript = _cmdRegistry.GetCommand("Packages.CheckUpdates");
        var timeout = _cmdRegistry.GetTimeout("Packages.CheckUpdates", 60);
        var res = await _sshManager.RunCommandAsync(host, checkScript, timeoutSeconds: timeout);
        var raw = (res.Output ?? "").Trim();

        var pm = "unknown";
        var packages = new List<string>();
        int totalUpdates = 0;
        int securityUpdates = 0;
        string summary = "No updates found";

        if (raw.Contains("---PM:apt---"))
        {
            pm = "apt";
            var content = raw.Substring(raw.IndexOf("---PM:apt---", StringComparison.Ordinal) + 12).Trim();

            // Find Inst lines: "Inst package [current] (new Ubuntu:...)"
            var instMatches = Regex.Matches(content, @"^Inst\s+([a-zA-Z0-9_\-\.\+]+)", RegexOptions.Multiline);
            foreach (Match m in instMatches)
            {
                if (m.Groups.Count > 1)
                {
                    packages.Add(m.Groups[1].Value);
                }
            }

            // Check security lines
            var secMatches = Regex.Matches(content, @"^Inst\s+.*?(security|Security)", RegexOptions.Multiline);
            securityUpdates = secMatches.Count;

            // Summary line
            var sumMatch = Regex.Match(content, @"(\d+)\s+upgraded,\s+(\d+)\s+newly installed,\s+(\d+)\s+to remove");
            if (sumMatch.Success)
            {
                int.TryParse(sumMatch.Groups[1].Value, out var upgraded);
                int.TryParse(sumMatch.Groups[2].Value, out var newlyInstalled);
                totalUpdates = upgraded + newlyInstalled;
                summary = sumMatch.Value;
            }
            else
            {
                totalUpdates = packages.Count;
                summary = $"{totalUpdates} packages can be updated";
            }
        }
        else if (raw.Contains("---PM:dnf---") || raw.Contains("---PM:yum---"))
        {
            pm = raw.Contains("---PM:dnf---") ? "dnf" : "yum";
            var tag = $"---PM:{pm}---";
            var content = raw.Substring(raw.IndexOf(tag, StringComparison.Ordinal) + tag.Length).Trim();

            var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var l in lines)
            {
                if (l.StartsWith("Loaded plugins") || l.StartsWith("Last metadata") || l.StartsWith("Obsoleting Packages"))
                    continue;

                var parts = Regex.Split(l, @"\s+");
                if (parts.Length >= 2 && parts[0].Contains('.'))
                {
                    packages.Add(parts[0]);
                }
            }
            totalUpdates = packages.Count;
            summary = $"{totalUpdates} packages available for upgrade via {pm}";
        }
        else if (raw.Contains("---PM:pacman---"))
        {
            pm = "pacman";
            var content = raw.Substring(raw.IndexOf("---PM:pacman---", StringComparison.Ordinal) + 15).Trim();
            var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var l in lines)
            {
                var parts = l.Split(' ');
                if (parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0]))
                {
                    packages.Add(parts[0]);
                }
            }
            totalUpdates = packages.Count;
            summary = $"{totalUpdates} packages available for upgrade via pacman";
        }
        else if (raw.Contains("---PM:apk---"))
        {
            pm = "apk";
            var content = raw.Substring(raw.IndexOf("---PM:apk---", StringComparison.Ordinal) + 12).Trim();
            var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var l in lines)
            {
                var parts = l.Split(' ');
                if (parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0]))
                {
                    packages.Add(parts[0]);
                }
            }
            totalUpdates = packages.Count;
            summary = $"{totalUpdates} packages available for upgrade via apk";
        }

        return new PackageUpdateCheckResult(
            pm,
            totalUpdates,
            securityUpdates,
            packages.Distinct().ToList(),
            summary,
            raw
        );
    }

    public async Task<PackageUpgradeResult> RunUpgradeAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var upgradeScript = _cmdRegistry.GetCommand("Packages.UpgradeAll");
        var timeout = _cmdRegistry.GetTimeout("Packages.UpgradeAll", 360);

        _logger.LogInformation("Starting package upgrade on host {HostId}", hostId);
        var res = await _sshManager.RunCommandAsync(host, upgradeScript, timeoutSeconds: timeout);

        var success = res.ExitCode == 0;
        return new PackageUpgradeResult(
            success,
            res.ExitCode,
            res.Output ?? "",
            res.Error ?? ""
        );
    }
}
