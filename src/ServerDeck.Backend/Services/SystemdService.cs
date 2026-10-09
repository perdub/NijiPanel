using System.Text.Json;
using System.Text.RegularExpressions;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface ISystemdService
{
    Task<List<SystemdServiceDto>> GetServicesAsync(string hostId);
    Task<SystemdActionResult> ExecuteActionAsync(string hostId, string unitName, string action);
    Task<string> GetLogsAsync(string hostId, string unitName, int lines = 100, string? priority = null);
}

public class SystemdService : ISystemdService
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly ILogger<SystemdService> _logger;

    private static readonly HashSet<string> AllowedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "start", "stop", "restart", "enable", "disable", "reload", "mask", "unmask"
    };

    private static readonly HashSet<string> AllowedPriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"
    };

    public SystemdService(
        IHostService hostService,
        ISshConnectionManager sshManager,
        ILogger<SystemdService> logger)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _logger = logger;
    }

    public async Task<List<SystemdServiceDto>> GetServicesAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        // Try JSON output first (systemd >= 240)
        var jsonCmd = "systemctl list-units --type=service --all --no-pager --output=json 2>/dev/null";
        var res = await _sshManager.RunCommandAsync(host, jsonCmd, timeoutSeconds: 20);

        var list = new List<SystemdServiceDto>();

        if (res.ExitCode == 0 && !string.IsNullOrWhiteSpace(res.Output) && res.Output.TrimStart().StartsWith("["))
        {
            try
            {
                using var doc = JsonDocument.Parse(res.Output);
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var unit = el.TryGetProperty("unit", out var u) ? u.GetString() ?? "" : "";
                    var load = el.TryGetProperty("load", out var l) ? l.GetString() ?? "" : "";
                    var active = el.TryGetProperty("active", out var a) ? a.GetString() ?? "" : "";
                    var sub = el.TryGetProperty("sub", out var s) ? s.GetString() ?? "" : "";
                    var desc = el.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";

                    if (!string.IsNullOrWhiteSpace(unit))
                    {
                        list.Add(new SystemdServiceDto(unit, load, active, sub, desc));
                    }
                }

                if (list.Count > 0)
                {
                    return OrderServices(list);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse systemctl JSON output, falling back to plain text");
            }
        }

        // Fallback to plain text parsing
        var plainCmd = "systemctl list-units --type=service --all --no-pager --plain --no-legend";
        var plainRes = await _sshManager.RunCommandAsync(host, plainCmd, timeoutSeconds: 20);
        var lines = (plainRes.Output ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var line in lines)
        {
            // format: unit load active sub description...
            var trimmed = line.TrimStart('*', ' ');
            var parts = Regex.Split(trimmed, @"\s+");
            if (parts.Length < 4) continue;

            var unit = parts[0];
            if (!unit.EndsWith(".service", StringComparison.OrdinalIgnoreCase)) continue;

            var load = parts[1];
            var active = parts[2];
            var sub = parts[3];
            var desc = parts.Length > 4 ? string.Join(" ", parts.Skip(4)) : "";

            list.Add(new SystemdServiceDto(unit, load, active, sub, desc));
        }

        return OrderServices(list);
    }

    private static List<SystemdServiceDto> OrderServices(List<SystemdServiceDto> list)
    {
        return list
            .OrderByDescending(s => s.Active.Equals("failed", StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(s => s.Active.Equals("active", StringComparison.OrdinalIgnoreCase) && s.Sub.Equals("running", StringComparison.OrdinalIgnoreCase))
            .ThenBy(s => s.Unit)
            .ToList();
    }

    public async Task<SystemdActionResult> ExecuteActionAsync(string hostId, string unitName, string action)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanAction = action.Trim().ToLowerInvariant();
        if (!AllowedActions.Contains(cleanAction))
        {
            throw new ArgumentException($"Invalid systemd action '{action}'. Allowed: {string.Join(", ", AllowedActions)}");
        }

        var cleanUnit = SanitizeUnitName(unitName);
        var cmd = $"systemctl {cleanAction} {cleanUnit} 2>&1";
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 30);

        var output = (res.Output + "\n" + res.Error).Trim();
        var success = res.ExitCode == 0;

        return new SystemdActionResult(
            success,
            cleanUnit,
            cleanAction,
            output,
            success ? null : output
        );
    }

    public async Task<string> GetLogsAsync(string hostId, string unitName, int lines = 100, string? priority = null)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanUnit = SanitizeUnitName(unitName);
        var cleanLines = Math.Clamp(lines, 1, 1000);

        var priorityFlag = "";
        if (!string.IsNullOrWhiteSpace(priority) && AllowedPriorities.Contains(priority.Trim().ToLowerInvariant()))
        {
            priorityFlag = $"-p {priority.Trim().ToLowerInvariant()}";
        }

        var cmd = $"journalctl -u {cleanUnit} -n {cleanLines} --no-pager {priorityFlag}".Trim();
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 25);

        var output = res.Output ?? "";
        if (string.IsNullOrWhiteSpace(output) && !string.IsNullOrWhiteSpace(res.Error))
        {
            output = res.Error;
        }

        return string.IsNullOrWhiteSpace(output) ? $"No journal logs found for {cleanUnit}." : output;
    }

    private static string SanitizeUnitName(string unitName)
    {
        var trimmed = unitName.Trim();
        if (!Regex.IsMatch(trimmed, @"^[a-zA-Z0-9_\-@\.]+$"))
        {
            throw new ArgumentException($"Invalid systemd unit name '{unitName}'");
        }
        if (!trimmed.Contains('.'))
        {
            trimmed += ".service";
        }
        return trimmed;
    }
}
