using System.Collections.Concurrent;
using System.Text;
using Renci.SshNet;
using Renci.SshNet.Common;
using ServerDeck.Backend.Models;
using SshConnInfo = Renci.SshNet.ConnectionInfo;

namespace ServerDeck.Backend.Services;

public interface ISshConnectionManager
{
    SshClient GetSshClient(HostEntity host);
    SftpClient GetSftpClient(HostEntity host);
    Task<(int ExitCode, string Output, string Error)> RunCommandAsync(HostEntity host, string command, int timeoutSeconds = 30);
    Task<(bool Success, string? Error)> TestConnectionAsync(HostEntity host);
    Task<HostSystemStats> GetHostStatsAsync(HostEntity host);
    void InvalidateHost(string hostId);
}

public record HostSystemStats(
    bool IsOnline,
    string? OsInfo,
    string? Uptime,
    string? MemoryUsage,
    string? DiskUsage,
    string? CpuUsage,
    string? DockerVersion,
    string? Error = null
);

public class SshConnectionManager : ISshConnectionManager, IDisposable
{
    private readonly ISettingsService _settingsService;
    private readonly IEncryptionService _encryptionService;
    private readonly ConcurrentDictionary<string, SshClient> _sshClients = new();
    private readonly ConcurrentDictionary<string, SftpClient> _sftpClients = new();
    private readonly ILogger<SshConnectionManager> _logger;

    public SshConnectionManager(
        ISettingsService settingsService,
        IEncryptionService encryptionService,
        ILogger<SshConnectionManager> logger)
    {
        _settingsService = settingsService;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    public Renci.SshNet.ConnectionInfo CreateConnectionInfo(HostEntity host)
    {
        var authMethods = new List<AuthenticationMethod>();

        if (host.AuthType.Equals("password", StringComparison.OrdinalIgnoreCase))
        {
            var pass = !string.IsNullOrEmpty(host.CredentialEncrypted)
                ? _encryptionService.Decrypt(host.CredentialEncrypted)
                : "";
            authMethods.Add(new PasswordAuthenticationMethod(host.Username, pass));
        }
        else if (host.AuthType.Equals("key", StringComparison.OrdinalIgnoreCase))
        {
            var keyContent = !string.IsNullOrEmpty(host.CredentialEncrypted)
                ? _encryptionService.Decrypt(host.CredentialEncrypted)
                : "";
            var passphrase = !string.IsNullOrEmpty(host.PassphraseEncrypted)
                ? _encryptionService.Decrypt(host.PassphraseEncrypted)
                : null;

            using var keyStream = new MemoryStream(Encoding.UTF8.GetBytes(keyContent));
            var keyFile = string.IsNullOrEmpty(passphrase)
                ? new PrivateKeyFile(keyStream)
                : new PrivateKeyFile(keyStream, passphrase);
            authMethods.Add(new PrivateKeyAuthenticationMethod(host.Username, keyFile));
        }
        else // default: "global_key"
        {
            var globalKeyPem = _settingsService.GetMasterPrivateKey();
            using var keyStream = new MemoryStream(Encoding.UTF8.GetBytes(globalKeyPem));
            var keyFile = new PrivateKeyFile(keyStream);
            authMethods.Add(new PrivateKeyAuthenticationMethod(host.Username, keyFile));
        }

        return new SshConnInfo(host.Host, host.Port, host.Username, authMethods.ToArray())
        {
            Timeout = TimeSpan.FromSeconds(15)
        };
    }

    public SshClient GetSshClient(HostEntity host)
    {
        if (_sshClients.TryGetValue(host.Id, out var existing))
        {
            if (existing.IsConnected) return existing;
            existing.Dispose();
            _sshClients.TryRemove(host.Id, out _);
        }

        var connInfo = CreateConnectionInfo(host);
        var client = new SshClient(connInfo);
        client.Connect();
        _sshClients[host.Id] = client;
        return client;
    }

    public SftpClient GetSftpClient(HostEntity host)
    {
        if (_sftpClients.TryGetValue(host.Id, out var existing))
        {
            if (existing.IsConnected) return existing;
            existing.Dispose();
            _sftpClients.TryRemove(host.Id, out _);
        }

        var connInfo = CreateConnectionInfo(host);
        var client = new SftpClient(connInfo);
        client.Connect();
        _sftpClients[host.Id] = client;
        return client;
    }

    public async Task<(int ExitCode, string Output, string Error)> RunCommandAsync(HostEntity host, string command, int timeoutSeconds = 30)
    {
        return await Task.Run(() =>
        {
            var client = GetSshClient(host);
            using var cmd = client.CreateCommand(command);
            cmd.CommandTimeout = TimeSpan.FromSeconds(timeoutSeconds);
            var output = cmd.Execute();
            return (cmd.ExitStatus ?? 0, output ?? "", cmd.Error ?? "");
        });
    }

    public async Task<(bool Success, string? Error)> TestConnectionAsync(HostEntity host)
    {
        return await Task.Run(() =>
        {
            try
            {
                var connInfo = CreateConnectionInfo(host);
                using var client = new SshClient(connInfo);
                client.Connect();
                var isConnected = client.IsConnected;
                client.Disconnect();
                return (isConnected, isConnected ? null : "Failed to connect");
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        });
    }

    public async Task<HostSystemStats> GetHostStatsAsync(HostEntity host)
    {
        try
        {
            // Combined fast bash query with delimiters
            const string query = @"
echo '---OS---'
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo ""$PRETTY_NAME""
else
  uname -srm
fi
echo '---UPTIME---'
uptime -p 2>/dev/null || uptime | awk '{print $3,$4}'
echo '---MEM---'
free -m 2>/dev/null | awk 'NR==2{printf ""%.1f / %.1f GB (%.0f%%)"", $3/1024, $2/1024, ($2>0 ? $3*100/$2 : 0)}'
echo ''
echo '---DISK---'
df -h / 2>/dev/null | awk 'NR==2{print $3 "" / "" $2 "" ("" $5 "")""}'
echo '---DOCKER---'
docker --version 2>/dev/null || echo 'Not installed'
echo '---CPU---'
top -bn1 2>/dev/null | grep ""Cpu(s)"" | sed ""s/.*, *\([0-9.]*\)%* id.*/\1/"" | awk '{print 100 - $1""%""}' || echo ''
";
            var result = await RunCommandAsync(host, query, timeoutSeconds: 10);
            if (result.ExitCode != 0 && string.IsNullOrEmpty(result.Output))
            {
                return new HostSystemStats(false, null, null, null, null, null, null, result.Error);
            }

            var text = result.Output;
            string ExtractSection(string tag)
            {
                var startIdx = text.IndexOf($"---{tag}---", StringComparison.Ordinal);
                if (startIdx == -1) return "";
                startIdx += tag.Length + 7;
                var endIdx = text.IndexOf("---", startIdx, StringComparison.Ordinal);
                var content = endIdx == -1 ? text[startIdx..] : text[startIdx..endIdx];
                return content.Trim();
            }

            var os = ExtractSection("OS");
            var uptime = ExtractSection("UPTIME");
            var mem = ExtractSection("MEM");
            var disk = ExtractSection("DISK");
            var docker = ExtractSection("DOCKER");
            var cpu = ExtractSection("CPU");

            return new HostSystemStats(true, os, uptime, mem, disk, string.IsNullOrEmpty(cpu) ? "N/A" : cpu, docker);
        }
        catch (Exception ex)
        {
            return new HostSystemStats(false, null, null, null, null, null, null, ex.Message);
        }
    }

    public void InvalidateHost(string hostId)
    {
        if (_sshClients.TryRemove(hostId, out var ssh))
        {
            try { ssh.Dispose(); } catch { }
        }
        if (_sftpClients.TryRemove(hostId, out var sftp))
        {
            try { sftp.Dispose(); } catch { }
        }
    }

    public void Dispose()
    {
        foreach (var client in _sshClients.Values)
        {
            try { client.Dispose(); } catch { }
        }
        foreach (var client in _sftpClients.Values)
        {
            try { client.Dispose(); } catch { }
        }
        _sshClients.Clear();
        _sftpClients.Clear();
    }
}
