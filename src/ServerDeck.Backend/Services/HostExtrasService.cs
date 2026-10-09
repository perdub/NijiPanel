using System.Text.RegularExpressions;
using ServerDeck.Backend.Data;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface IHostExtrasService
{
    Task<List<HostPortDto>> GetPortsAsync(string hostId);
    Task<HostPortDto> AddPortAsync(string hostId, CreateHostPortRequest request);
    Task<bool> DeletePortAsync(string portId);

    Task<HostNoteDto?> GetNoteAsync(string hostId);
    Task<HostNoteDto> SaveNoteAsync(string hostId, SaveHostNoteRequest request);

    Task<List<LiveSocketDto>> GetLiveSocketsAsync(string hostId);
}

public class HostExtrasService : IHostExtrasService
{
    private readonly DatabaseContext _dbContext;
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly ICommandRegistry _cmdRegistry;

    public HostExtrasService(
        DatabaseContext dbContext,
        IHostService hostService,
        ISshConnectionManager sshManager,
        ICommandRegistry cmdRegistry)
    {
        _dbContext = dbContext;
        _hostService = hostService;
        _sshManager = sshManager;
        _cmdRegistry = cmdRegistry;
    }

    public async Task<List<HostPortDto>> GetPortsAsync(string hostId)
    {
        var list = new List<HostPortDto>();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, host_id, port, protocol, service_name, description FROM host_ports WHERE host_id = $hostId ORDER BY port ASC;";
        cmd.Parameters.AddWithValue("$hostId", hostId);

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new HostPortDto(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetInt32(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5)
            ));
        }

        return list;
    }

    public async Task<HostPortDto> AddPortAsync(string hostId, CreateHostPortRequest request)
    {
        var id = Guid.NewGuid().ToString();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO host_ports (id, host_id, port, protocol, service_name, description)
            VALUES ($id, $hostId, $port, $proto, $service, $desc);
        ";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$hostId", hostId);
        cmd.Parameters.AddWithValue("$port", request.Port);
        cmd.Parameters.AddWithValue("$proto", string.IsNullOrWhiteSpace(request.Protocol) ? "tcp" : request.Protocol.Trim());
        cmd.Parameters.AddWithValue("$service", request.ServiceName.Trim());
        cmd.Parameters.AddWithValue("$desc", (object?)request.Description ?? DBNull.Value);
        cmd.ExecuteNonQuery();

        return new HostPortDto(id, hostId, request.Port, request.Protocol, request.ServiceName, request.Description);
    }

    public async Task<bool> DeletePortAsync(string portId)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM host_ports WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", portId);
        return cmd.ExecuteNonQuery() > 0;
    }

    public async Task<HostNoteDto?> GetNoteAsync(string hostId)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, host_id, title, content, updated_at FROM host_notes WHERE host_id = $hostId LIMIT 1;";
        cmd.Parameters.AddWithValue("$hostId", hostId);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;

        return new HostNoteDto(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            DateTime.Parse(reader.GetString(4))
        );
    }

    public async Task<HostNoteDto> SaveNoteAsync(string hostId, SaveHostNoteRequest request)
    {
        var now = DateTime.UtcNow;
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO host_notes (id, host_id, title, content, updated_at)
            VALUES ($id, $hostId, $title, $content, $updated_at)
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at;
        ";

        var existing = await GetNoteAsync(hostId);
        var id = existing?.Id ?? Guid.NewGuid().ToString();

        cmd.CommandText = existing == null
            ? "INSERT INTO host_notes (id, host_id, title, content, updated_at) VALUES ($id, $hostId, $title, $content, $updated_at);"
            : "UPDATE host_notes SET title = $title, content = $content, updated_at = $updated_at WHERE host_id = $hostId;";

        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$hostId", hostId);
        cmd.Parameters.AddWithValue("$title", request.Title ?? "Notes");
        cmd.Parameters.AddWithValue("$content", request.Content ?? "");
        cmd.Parameters.AddWithValue("$updated_at", now.ToString("o"));
        cmd.ExecuteNonQuery();

        return new HostNoteDto(id, hostId, request.Title ?? "Notes", request.Content ?? "", now);
    }

    public async Task<List<LiveSocketDto>> GetLiveSocketsAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cmd = _cmdRegistry.GetCommand("System.LiveSockets");
        var timeout = _cmdRegistry.GetTimeout("System.LiveSockets", 15);
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
        var output = res.Output ?? "";

        var list = new List<LiveSocketDto>();
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var line in lines)
        {
            if (line.StartsWith("Netid") || line.StartsWith("State")) continue;

            var parts = Regex.Split(line, @"\s+");
            if (parts.Length < 5) continue;

            var protoRaw = parts[0].ToLowerInvariant();
            if (!protoRaw.StartsWith("tcp") && !protoRaw.StartsWith("udp")) continue;

            var proto = protoRaw.StartsWith("tcp") ? "TCP" : "UDP";
            var state = parts[1];
            var localEndpoint = parts[4];

            var lastColon = localEndpoint.LastIndexOf(':');
            if (lastColon <= 0) continue;

            var addr = localEndpoint[..lastColon].Trim('[', ']');
            var portStr = localEndpoint[(lastColon + 1)..];

            if (!int.TryParse(portStr, out var port)) continue;

            // Extract process name & pid if available
            string? procName = null;
            int? pid = null;

            var m = Regex.Match(line, @"""([^""]+)"",pid=(\d+)");
            if (m.Success)
            {
                procName = m.Groups[1].Value;
                if (int.TryParse(m.Groups[2].Value, out var parsedPid))
                {
                    pid = parsedPid;
                }
            }

            list.Add(new LiveSocketDto(
                proto,
                state,
                addr,
                port,
                procName,
                pid,
                line
            ));
        }

        return list
            .OrderBy(s => s.Port)
            .ThenBy(s => s.Protocol)
            .ToList();
    }
}
