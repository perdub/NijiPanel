using System.Collections.Concurrent;
using Microsoft.Extensions.DependencyInjection;
using Renci.SshNet;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface ITunnelService
{
    Task<List<SshTunnelDto>> GetTunnelsAsync(string hostId);
    Task<SshTunnelDto> CreateTunnelAsync(string hostId, CreateSshTunnelRequest request);
    Task<bool> DeleteTunnelAsync(string tunnelId, string? hostId = null);
    Task<(bool Success, string? Error)> StartTunnelAsync(string tunnelId, string? hostId = null);
    Task<bool> StopTunnelAsync(string tunnelId, string? hostId = null);
}

public class TunnelService : ITunnelService
{
    private readonly DatabaseContext _dbContext;
    private readonly ISshConnectionManager _sshManager;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<string, ForwardedPortLocal> _activePorts = new();

    public TunnelService(
        DatabaseContext dbContext,
        ISshConnectionManager sshManager,
        IServiceScopeFactory scopeFactory)
    {
        _dbContext = dbContext;
        _sshManager = sshManager;
        _scopeFactory = scopeFactory;
    }

    public async Task<List<SshTunnelDto>> GetTunnelsAsync(string hostId)
    {
        var list = new List<SshTunnelDto>();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, host_id, name, local_port, remote_host, remote_port, is_active FROM ssh_tunnels WHERE host_id = $hostId ORDER BY name ASC;";
        cmd.Parameters.AddWithValue("$hostId", hostId);

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var id = reader.GetString(0);
            var isRunning = _activePorts.ContainsKey(id);
            list.Add(new SshTunnelDto(
                id,
                reader.GetString(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetString(4),
                reader.GetInt32(5),
                isRunning
            ));
        }

        return list;
    }

    public async Task<SshTunnelDto> CreateTunnelAsync(string hostId, CreateSshTunnelRequest request)
    {
        var id = Guid.NewGuid().ToString();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO ssh_tunnels (id, host_id, name, local_port, remote_host, remote_port, is_active)
            VALUES ($id, $hostId, $name, $localPort, $remoteHost, $remotePort, 0);
        ";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$hostId", hostId);
        cmd.Parameters.AddWithValue("$name", request.Name.Trim());
        cmd.Parameters.AddWithValue("$localPort", request.LocalPort);
        cmd.Parameters.AddWithValue("$remoteHost", string.IsNullOrWhiteSpace(request.RemoteHost) ? "127.0.0.1" : request.RemoteHost.Trim());
        cmd.Parameters.AddWithValue("$remotePort", request.RemotePort);
        cmd.ExecuteNonQuery();

        return new SshTunnelDto(id, hostId, request.Name, request.LocalPort, request.RemoteHost, request.RemotePort, false);
    }

    public async Task<bool> DeleteTunnelAsync(string tunnelId, string? hostId = null)
    {
        await StopTunnelAsync(tunnelId, hostId);

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        if (!string.IsNullOrEmpty(hostId))
        {
            cmd.CommandText = "DELETE FROM ssh_tunnels WHERE id = $id AND host_id = $hostId;";
            cmd.Parameters.AddWithValue("$hostId", hostId);
        }
        else
        {
            cmd.CommandText = "DELETE FROM ssh_tunnels WHERE id = $id;";
        }
        cmd.Parameters.AddWithValue("$id", tunnelId);
        return cmd.ExecuteNonQuery() > 0;
    }

    public async Task<(bool Success, string? Error)> StartTunnelAsync(string tunnelId, string? hostId = null)
    {
        if (_activePorts.ContainsKey(tunnelId)) return (true, null);

        SshTunnelEntity? entity = null;
        using (var conn = _dbContext.CreateConnection())
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT id, host_id, name, local_port, remote_host, remote_port, is_active FROM ssh_tunnels WHERE id = $id LIMIT 1;";
            cmd.Parameters.AddWithValue("$id", tunnelId);
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                entity = new SshTunnelEntity
                {
                    Id = reader.GetString(0),
                    HostId = reader.GetString(1),
                    Name = reader.GetString(2),
                    LocalPort = reader.GetInt32(3),
                    RemoteHost = reader.GetString(4),
                    RemotePort = reader.GetInt32(5)
                };
            }
        }

        if (entity == null) return (false, "Tunnel not found");
        if (!string.IsNullOrEmpty(hostId) && entity.HostId != hostId) return (false, "Tunnel does not belong to specified host");

        HostEntity? host;
        using (var scope = _scopeFactory.CreateScope())
        {
            var hostService = scope.ServiceProvider.GetRequiredService<IHostService>();
            host = await hostService.GetHostEntityAsync(entity.HostId);
        }
        if (host == null) return (false, "Host not found");

        try
        {
            var sshClient = _sshManager.GetSshClient(host);
            var portForward = new ForwardedPortLocal(
                "0.0.0.0",
                (uint)entity.LocalPort,
                entity.RemoteHost,
                (uint)entity.RemotePort);

            sshClient.AddForwardedPort(portForward);
            portForward.Start();
            _activePorts[tunnelId] = portForward;

            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public Task<bool> StopTunnelAsync(string tunnelId, string? hostId = null)
    {
        if (!string.IsNullOrEmpty(hostId))
        {
            using var conn = _dbContext.CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT host_id FROM ssh_tunnels WHERE id = $id LIMIT 1;";
            cmd.Parameters.AddWithValue("$id", tunnelId);
            var actualHostId = Convert.ToString(cmd.ExecuteScalar());
            if (actualHostId != null && actualHostId != hostId) return Task.FromResult(false);
        }

        if (_activePorts.TryRemove(tunnelId, out var portForward))
        {
            try
            {
                portForward.Stop();
                portForward.Dispose();
            }
            catch { }
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }
}
