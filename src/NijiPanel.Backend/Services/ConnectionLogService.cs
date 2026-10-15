using System.Collections.Concurrent;

namespace NijiPanel.Backend.Services;

public record ConnectionLogEntry(
    string Id,
    string HostId,
    string HostName,
    string Level, // "INFO", "WARN", "ERROR", "SUCCESS"
    string Event, // "DNS_RESOLVE", "TCP_SOCKET", "SSH_AUTH", "SHELL_EXEC", "STATS_PROBE", "TERMINAL_CONNECT", "DISCONNECT"
    string Message,
    string? Details,
    DateTime Timestamp
);

public record DiagnosticStep(
    string Name,
    string Status, // "passed", "failed", "warning", "skipped"
    string Message,
    long DurationMs
);

public record ConnectionDiagnosticResult(
    bool Success,
    long LatencyMs,
    string? HostAddress,
    List<DiagnosticStep> Steps,
    string? ServerBanner,
    string? Error,
    string? Suggestion,
    DateTime Timestamp
);

public interface IConnectionLogService
{
    void Log(string hostId, string hostName, string level, string eventName, string message, string? details = null);
    List<ConnectionLogEntry> GetLogs(string? hostId = null, int limit = 100);
    string? GetLastError(string hostId);
    void ClearLogs(string? hostId = null);
}

public class ConnectionLogService : IConnectionLogService
{
    private const int MaxLogCapacity = 500;
    private const int MaxHostLogCapacity = 100;
    private readonly ConcurrentQueue<ConnectionLogEntry> _allLogs = new();
    private readonly ConcurrentDictionary<string, ConcurrentQueue<ConnectionLogEntry>> _hostLogs = new();
    private readonly ConcurrentDictionary<string, string> _lastErrors = new();

    public void Log(string hostId, string hostName, string level, string eventName, string message, string? details = null)
    {
        var entry = new ConnectionLogEntry(
            Id: Guid.NewGuid().ToString("N")[..8],
            HostId: hostId,
            HostName: hostName,
            Level: level.ToUpperInvariant(),
            Event: eventName.ToUpperInvariant(),
            Message: message,
            Details: details,
            Timestamp: DateTime.UtcNow
        );

        if (entry.Level == "ERROR")
        {
            _lastErrors[hostId] = message;
        }
        else if (entry.Level == "SUCCESS" && eventName == "SSH_AUTH")
        {
            _lastErrors.TryRemove(hostId, out _);
        }

        _allLogs.Enqueue(entry);
        while (_allLogs.Count > MaxLogCapacity && _allLogs.TryDequeue(out _)) { }

        if (!string.IsNullOrEmpty(hostId))
        {
            var hostQueue = _hostLogs.GetOrAdd(hostId, _ => new ConcurrentQueue<ConnectionLogEntry>());
            hostQueue.Enqueue(entry);
            while (hostQueue.Count > MaxHostLogCapacity && hostQueue.TryDequeue(out _)) { }
        }
    }

    public List<ConnectionLogEntry> GetLogs(string? hostId = null, int limit = 100)
    {
        var clampedLimit = Math.Clamp(limit, 1, 300);
        if (!string.IsNullOrEmpty(hostId))
        {
            if (_hostLogs.TryGetValue(hostId, out var hostQueue))
            {
                return hostQueue.Reverse().Take(clampedLimit).ToList();
            }
            return new List<ConnectionLogEntry>();
        }

        return _allLogs.Reverse().Take(clampedLimit).ToList();
    }

    public string? GetLastError(string hostId)
    {
        _lastErrors.TryGetValue(hostId, out var err);
        return err;
    }

    public void ClearLogs(string? hostId = null)
    {
        if (string.IsNullOrEmpty(hostId))
        {
            while (_allLogs.TryDequeue(out _)) { }
            _hostLogs.Clear();
            _lastErrors.Clear();
        }
        else
        {
            if (_hostLogs.TryRemove(hostId, out var q))
            {
                while (q.TryDequeue(out _)) { }
            }
            _lastErrors.TryRemove(hostId, out _);
        }
    }
}
