using System.Text.Json;
using System.Text.RegularExpressions;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

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
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ICacheService _cacheService;
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
        ICommandRegistry cmdRegistry,
        ICacheService cacheService,
        ILogger<SystemdService> logger)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _cmdRegistry = cmdRegistry;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<List<SystemdServiceDto>> GetServicesAsync(string hostId)
    {
        return await _cacheService.GetOrCreateAsync(
            $"systemd_services_{hostId}",
            () => FetchServicesInternalAsync(hostId),
            TimeSpan.FromSeconds(5)
        );
    }

    private async Task<List<SystemdServiceDto>> FetchServicesInternalAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        // Try JSON output first (systemd >= 240)
        var jsonCmd = _cmdRegistry.GetCommand("Systemd.ListUnitsJson");
        var jsonTimeout = _cmdRegistry.GetTimeout("Systemd.ListUnitsJson", 20);
        var res = await _sshManager.RunCommandAsync(host, jsonCmd, timeoutSeconds: jsonTimeout);

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
        var plainCmd = _cmdRegistry.GetCommand("Systemd.ListUnitsPlain");
        var plainTimeout = _cmdRegistry.GetTimeout("Systemd.ListUnitsPlain", 20);
        var plainRes = await _sshManager.RunCommandAsync(host, plainCmd, timeoutSeconds: plainTimeout);
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
        var cmd = _cmdRegistry.GetCommand("Systemd.ServiceAction", new { action = cleanAction, unitName = cleanUnit });
        var timeout = _cmdRegistry.GetTimeout("Systemd.ServiceAction", 30);
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);

        var output = (res.Output + "\n" + res.Error).Trim();
        var success = res.ExitCode == 0;
        _cacheService.Remove($"systemd_services_{hostId}");

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

        var cmd = _cmdRegistry.GetCommand("Systemd.ServiceLogs", new { unitName = cleanUnit, lines = cleanLines, priorityFlag });
        var logTimeout = _cmdRegistry.GetTimeout("Systemd.ServiceLogs", 25);
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: logTimeout);

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
