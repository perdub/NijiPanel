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
    private readonly object _lock = new();
    private readonly LinkedList<ConnectionLogEntry> _logs = new();
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

        lock (_lock)
        {
            _logs.AddFirst(entry);
            if (_logs.Count > MaxLogCapacity)
            {
                _logs.RemoveLast();
            }
        }
    }

    public List<ConnectionLogEntry> GetLogs(string? hostId = null, int limit = 100)
    {
        lock (_lock)
        {
            var query = _logs.AsEnumerable();
            if (!string.IsNullOrEmpty(hostId))
            {
                query = query.Where(l => l.HostId == hostId);
            }
            return query.Take(Math.Clamp(limit, 1, 300)).ToList();
        }
    }

    public string? GetLastError(string hostId)
    {
        _lastErrors.TryGetValue(hostId, out var err);
        return err;
    }

    public void ClearLogs(string? hostId = null)
    {
        lock (_lock)
        {
            if (string.IsNullOrEmpty(hostId))
            {
                _logs.Clear();
                _lastErrors.Clear();
            }
            else
            {
                var node = _logs.First;
                while (node != null)
                {
                    var next = node.Next;
                    if (node.Value.HostId == hostId)
                    {
                        _logs.Remove(node);
                    }
                    node = next;
                }
                _lastErrors.TryRemove(hostId, out _);
            }
        }
    }
}
