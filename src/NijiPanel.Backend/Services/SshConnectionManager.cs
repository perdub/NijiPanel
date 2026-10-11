using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Renci.SshNet;
using Renci.SshNet.Common;
using NijiPanel.Backend.Models;
using SshConnInfo = Renci.SshNet.ConnectionInfo;

namespace NijiPanel.Backend.Services;

public interface ISshConnectionManager
{
    SshClient GetSshClient(HostEntity host);
    SshClient CreateDedicatedSshClient(HostEntity host);
    SftpClient GetSftpClient(HostEntity host);
    SftpClient CreateDedicatedSftpClient(HostEntity host);
    Task<(int ExitCode, string Output, string Error)> RunCommandAsync(HostEntity host, string command, int timeoutSeconds = 30);
    Task<(bool Success, string? Error)> TestConnectionAsync(HostEntity host);
    Task<ConnectionDiagnosticResult> DiagnoseConnectionAsync(HostEntity host);
    Task<HostSystemStats> GetHostStatsAsync(HostEntity host);
    void InvalidateHost(string hostId);
    bool IsConnected(string hostId);
}

public record HostSystemStats(
    bool IsOnline,
    string? OsInfo,
    string? Uptime,
    string? MemoryUsage,
    string? DiskUsage,
    string? CpuUsage,
    string? NetworkUsage,
    string? LoadAverage,
    int? CpuPercent,
    int? MemoryPercent,
    int? DiskPercent,
    string? DockerVersion,
    string? Error = null
);

public class SshConnectionManager : ISshConnectionManager, IDisposable
{
    private readonly ISettingsService _settingsService;
    private readonly IEncryptionService _encryptionService;
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ICacheService _cacheService;
    private readonly ConcurrentDictionary<string, SshClient> _sshClients = new();
    private readonly ConcurrentDictionary<string, SftpClient> _sftpClients = new();
    private readonly ILogger<SshConnectionManager> _logger;
    private readonly IConnectionLogService _logService;

    public SshConnectionManager(
        ISettingsService settingsService,
        IEncryptionService encryptionService,
        ICommandRegistry cmdRegistry,
        ICacheService cacheService,
        ILogger<SshConnectionManager> logger,
        IConnectionLogService logService)
    {
        _settingsService = settingsService;
        _encryptionService = encryptionService;
        _cmdRegistry = cmdRegistry;
        _cacheService = cacheService;
        _logger = logger;
        _logService = logService;
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

            var kbdAuth = new KeyboardInteractiveAuthenticationMethod(host.Username);
            kbdAuth.AuthenticationPrompt += (_, e) =>
            {
                foreach (var prompt in e.Prompts)
                {
                    if (prompt.Request.IndexOf("password", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        prompt.Response = pass;
                    }
                }
            };
            authMethods.Add(kbdAuth);
        }
        else if (host.AuthType.Equals("key", StringComparison.OrdinalIgnoreCase))
        {
            var keyContent = !string.IsNullOrEmpty(host.CredentialEncrypted)
                ? _encryptionService.Decrypt(host.CredentialEncrypted)
                : "";
            var passphrase = !string.IsNullOrEmpty(host.PassphraseEncrypted)
                ? _encryptionService.Decrypt(host.PassphraseEncrypted)
                : null;

            if (!string.IsNullOrWhiteSpace(keyContent))
            {
                using var keyStream = new MemoryStream(Encoding.UTF8.GetBytes(keyContent));
                var keyFile = string.IsNullOrEmpty(passphrase)
                    ? new PrivateKeyFile(keyStream)
                    : new PrivateKeyFile(keyStream, passphrase);
                authMethods.Add(new PrivateKeyAuthenticationMethod(host.Username, keyFile));
            }
        }
        else // default: "global_key"
        {
            var globalKeyPem = _settingsService.GetMasterPrivateKey();
            if (!string.IsNullOrWhiteSpace(globalKeyPem))
            {
                using var keyStream = new MemoryStream(Encoding.UTF8.GetBytes(globalKeyPem));
                var keyFile = new PrivateKeyFile(keyStream);
                authMethods.Add(new PrivateKeyAuthenticationMethod(host.Username, keyFile));
            }
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

        try
        {
            var connInfo = CreateConnectionInfo(host);
            var client = new SshClient(connInfo);
            client.KeepAliveInterval = TimeSpan.FromSeconds(15);
            client.Connect();
            _sshClients[host.Id] = client;
            _logService.Log(host.Id, host.Name, "SUCCESS", "SSH_AUTH", $"SSH connected to {host.Host}:{host.Port} as {host.Username}");
            return client;
        }
        catch (Exception ex)
        {
            _logService.Log(host.Id, host.Name, "ERROR", "SSH_CONNECT", $"Connection failed to {host.Host}:{host.Port} - {ex.Message}");
            throw;
        }
    }

    public SshClient CreateDedicatedSshClient(HostEntity host)
    {
        try
        {
            var connInfo = CreateConnectionInfo(host);
            var client = new SshClient(connInfo);
            client.KeepAliveInterval = TimeSpan.FromSeconds(15);
            client.Connect();
            _logService.Log(host.Id, host.Name, "INFO", "SSH_AUTH", $"Dedicated SSH session connected to {host.Host}:{host.Port}");
            return client;
        }
        catch (Exception ex)
        {
            _logService.Log(host.Id, host.Name, "ERROR", "SSH_CONNECT", $"Dedicated session failed to {host.Host}:{host.Port} - {ex.Message}");
            throw;
        }
    }

    public SftpClient CreateDedicatedSftpClient(HostEntity host)
    {
        try
        {
            var connInfo = CreateConnectionInfo(host);
            var client = new SftpClient(connInfo);
            client.KeepAliveInterval = TimeSpan.FromSeconds(15);
            client.Connect();
            return client;
        }
        catch (Exception ex)
        {
            _logService.Log(host.Id, host.Name, "ERROR", "SFTP_CONNECT", $"Dedicated SFTP session failed - {ex.Message}");
            throw;
        }
    }

    public SftpClient GetSftpClient(HostEntity host)
    {
        if (_sftpClients.TryGetValue(host.Id, out var existing))
        {
            if (existing.IsConnected) return existing;
            existing.Dispose();
            _sftpClients.TryRemove(host.Id, out _);
        }

        try
        {
            var connInfo = CreateConnectionInfo(host);
            var client = new SftpClient(connInfo);
            client.KeepAliveInterval = TimeSpan.FromSeconds(15);
            client.Connect();
            _sftpClients[host.Id] = client;
            _logService.Log(host.Id, host.Name, "INFO", "SFTP_CONNECT", $"SFTP subsystem connected ({host.Host}:{host.Port})");
            return client;
        }
        catch (Exception ex)
        {
            _logService.Log(host.Id, host.Name, "ERROR", "SFTP_CONNECT", $"SFTP subsystem connection failed - {ex.Message}");
            throw;
        }
    }

    public async Task<(int ExitCode, string Output, string Error)> RunCommandAsync(HostEntity host, string command, int timeoutSeconds = 30)
    {
        return await Task.Run(() =>
        {
            try
            {
                var client = GetSshClient(host);
                using var cmd = client.CreateCommand(command);
                cmd.CommandTimeout = TimeSpan.FromSeconds(timeoutSeconds);
                var output = cmd.Execute();
                return (cmd.ExitStatus ?? 0, output ?? "", cmd.Error ?? "");
            }
            catch (Exception ex)
            {
                _logService.Log(host.Id, host.Name, "ERROR", "COMMAND_EXEC", $"Command execution failed: {ex.Message}");
                throw;
            }
        });
    }

    public async Task<(bool Success, string? Error)> TestConnectionAsync(HostEntity host)
    {
        return await Task.Run<(bool Success, string? Error)>(() =>
        {
            try
            {
                _logService.Log(host.Id, host.Name, "INFO", "TEST_CONNECT", $"Testing connection to {host.Host}:{host.Port} (User: {host.Username}, Auth: {host.AuthType})");
                var connInfo = CreateConnectionInfo(host);
                using var client = new SshClient(connInfo);
                client.Connect();
                var isConnected = client.IsConnected;
                client.Disconnect();
                if (isConnected)
                {
                    _logService.Log(host.Id, host.Name, "SUCCESS", "TEST_CONNECT", "Connection test succeeded");
                    return (true, null);
                }
                _logService.Log(host.Id, host.Name, "ERROR", "TEST_CONNECT", "Client disconnected without error");
                return (false, "Failed to connect");
            }
            catch (Exception ex)
            {
                _logService.Log(host.Id, host.Name, "ERROR", "TEST_CONNECT", $"Connection test error: {ex.Message}");
                return (false, ex.Message);
            }
        });
    }

    public async Task<ConnectionDiagnosticResult> DiagnoseConnectionAsync(HostEntity host)
    {
        var swTotal = Stopwatch.StartNew();
        var steps = new List<DiagnosticStep>();
        string? serverBanner = null;
        string? hostAddress = null;

        _logService.Log(host.Id, host.Name, "INFO", "DIAGNOSE_START", $"Starting comprehensive connection diagnostics for {host.Name} ({host.Host}:{host.Port})");

        // Step 1: DNS & IP Resolution
        var swStep = Stopwatch.StartNew();
        try
        {
            var ips = await Dns.GetHostAddressesAsync(host.Host);
            swStep.Stop();
            if (ips == null || ips.Length == 0)
            {
                steps.Add(new DiagnosticStep("DNS Resolution", "failed", $"Could not resolve hostname '{host.Host}'", swStep.ElapsedMilliseconds));
                _logService.Log(host.Id, host.Name, "ERROR", "DNS_RESOLVE", $"DNS lookup returned 0 addresses for '{host.Host}'");
                return new ConnectionDiagnosticResult(false, swTotal.ElapsedMilliseconds, null, steps, null, $"DNS lookup failed for '{host.Host}'", "Check hostname spelling or nameserver settings.", DateTime.UtcNow);
            }
            hostAddress = ips[0].ToString();
            steps.Add(new DiagnosticStep("DNS Resolution", "passed", $"Resolved '{host.Host}' to {hostAddress}", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "INFO", "DNS_RESOLVE", $"Resolved '{host.Host}' to {hostAddress}");
        }
        catch (Exception ex)
        {
            swStep.Stop();
            steps.Add(new DiagnosticStep("DNS Resolution", "failed", $"DNS resolution error: {ex.Message}", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "ERROR", "DNS_RESOLVE", ex.Message);
            return new ConnectionDiagnosticResult(false, swTotal.ElapsedMilliseconds, null, steps, null, $"DNS lookup error: {ex.Message}", "Verify server hostname or IP address in Host settings.", DateTime.UtcNow);
        }

        // Step 2: TCP Socket Reachability
        swStep.Restart();
        try
        {
            using var tcp = new TcpClient();
            var connectTask = tcp.ConnectAsync(host.Host, host.Port);
            var timeoutTask = Task.Delay(TimeSpan.FromSeconds(6));
            var completed = await Task.WhenAny(connectTask, timeoutTask);
            swStep.Stop();

            if (completed == timeoutTask || !tcp.Connected)
            {
                steps.Add(new DiagnosticStep("TCP Socket Reachability", "failed", $"Connection to {host.Host}:{host.Port} timed out (6s)", swStep.ElapsedMilliseconds));
                _logService.Log(host.Id, host.Name, "ERROR", "TCP_SOCKET", $"Connection to {host.Host}:{host.Port} timed out");
                return new ConnectionDiagnosticResult(false, swTotal.ElapsedMilliseconds, hostAddress, steps, null, $"TCP port {host.Port} is unreachable or timed out", $"Check if SSH server (sshd) is running and port {host.Port} is allowed in firewall (ufw/iptables/cloud security group).", DateTime.UtcNow);
            }
            steps.Add(new DiagnosticStep("TCP Socket Reachability", "passed", $"Connected to {host.Host}:{host.Port} in {swStep.ElapsedMilliseconds} ms", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "INFO", "TCP_SOCKET", $"Port {host.Port} open and reachable ({swStep.ElapsedMilliseconds} ms)");
        }
        catch (Exception ex)
        {
            swStep.Stop();
            steps.Add(new DiagnosticStep("TCP Socket Reachability", "failed", $"TCP socket connection refused: {ex.Message}", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "ERROR", "TCP_SOCKET", ex.Message);
            return new ConnectionDiagnosticResult(false, swTotal.ElapsedMilliseconds, hostAddress, steps, null, ex.Message, $"Connection refused on port {host.Port}. Ensure SSH daemon is active on remote server.", DateTime.UtcNow);
        }

        // Step 3: SSH Configuration Validation
        swStep.Restart();
        Renci.SshNet.ConnectionInfo connInfo;
        try
        {
            connInfo = CreateConnectionInfo(host);
            connInfo.Timeout = TimeSpan.FromSeconds(10);
            swStep.Stop();
            steps.Add(new DiagnosticStep("SSH Configuration", "passed", $"Auth strategy configured: {host.AuthType} (User: {host.Username})", swStep.ElapsedMilliseconds));
        }
        catch (Exception ex)
        {
            swStep.Stop();
            steps.Add(new DiagnosticStep("SSH Configuration", "failed", $"Invalid credentials or key syntax: {ex.Message}", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "ERROR", "SSH_CONFIG", ex.Message);
            return new ConnectionDiagnosticResult(false, swTotal.ElapsedMilliseconds, hostAddress, steps, null, ex.Message, "Verify that private key / password format is correct.", DateTime.UtcNow);
        }

        // Step 4: SSH Authentication
        swStep.Restart();
        SshClient? client = null;
        try
        {
            client = new SshClient(connInfo);
            client.Connect();
            serverBanner = client.ConnectionInfo.ServerVersion;
            swStep.Stop();
            steps.Add(new DiagnosticStep("SSH Authentication", "passed", $"Authenticated successfully as '{host.Username}'. Remote banner: {serverBanner}", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "SUCCESS", "SSH_AUTH", $"Authenticated successfully as '{host.Username}' ({serverBanner})");
        }
        catch (Exception ex)
        {
            swStep.Stop();
            steps.Add(new DiagnosticStep("SSH Authentication", "failed", $"Authentication rejected: {ex.Message}", swStep.ElapsedMilliseconds));
            _logService.Log(host.Id, host.Name, "ERROR", "SSH_AUTH", ex.Message);

            var hint = host.AuthType switch
            {
                "global_key" => "Ensure NijiPanel Master Public Key is appended to ~/.ssh/authorized_keys on the host. Use 'Quick One-liner' in Hosts menu.",
                "key" => "Check that private key is valid, matches remote ~/.ssh/authorized_keys, and passphrase (if set) is correct.",
                "password" => "Verify username & password. Ensure sshd_config on the host allows password authentication (PasswordAuthentication yes).",
                _ => "Check user credentials."
            };
            return new ConnectionDiagnosticResult(false, swTotal.ElapsedMilliseconds, hostAddress, steps, serverBanner, ex.Message, hint, DateTime.UtcNow);
        }

        // Step 5: Shell & Command Execution Probe
        swStep.Restart();
        try
        {
            using var cmd = client.CreateCommand("echo '__nijipanel_diag_ok__'");
            cmd.CommandTimeout = TimeSpan.FromSeconds(5);
            var res = cmd.Execute();
            swStep.Stop();
            if (cmd.ExitStatus == 0 && res.Contains("__nijipanel_diag_ok__"))
            {
                steps.Add(new DiagnosticStep("Shell Execution", "passed", "Host executed command successfully", swStep.ElapsedMilliseconds));
            }
            else
            {
                steps.Add(new DiagnosticStep("Shell Execution", "warning", $"Command exited with code {cmd.ExitStatus}: {cmd.Error}", swStep.ElapsedMilliseconds));
            }
        }
        catch (Exception ex)
        {
            swStep.Stop();
            steps.Add(new DiagnosticStep("Shell Execution", "warning", $"Command probe failed: {ex.Message}", swStep.ElapsedMilliseconds));
        }

        // Step 6: Terminal & Session Prerequisite Check
        swStep.Restart();
        try
        {
            using var cmd = client.CreateCommand("tmux -V 2>/dev/null || echo 'no_tmux'");
            cmd.CommandTimeout = TimeSpan.FromSeconds(4);
            var tmuxOut = cmd.Execute()?.Trim() ?? "";
            swStep.Stop();
            if (tmuxOut.Contains("tmux"))
            {
                steps.Add(new DiagnosticStep("Terminal Session Persistence", "passed", $"Found {tmuxOut} (persistent tmux sessions enabled)", swStep.ElapsedMilliseconds));
            }
            else
            {
                steps.Add(new DiagnosticStep("Terminal Session Persistence", "warning", "tmux is not installed on host. Install tmux for persistent background terminal tabs.", swStep.ElapsedMilliseconds));
            }
        }
        catch
        {
            steps.Add(new DiagnosticStep("Terminal Session Persistence", "skipped", "Could not check tmux version", swStep.ElapsedMilliseconds));
        }
        finally
        {
            try { client.Disconnect(); client.Dispose(); } catch { }
        }

        swTotal.Stop();
        _logService.Log(host.Id, host.Name, "SUCCESS", "DIAGNOSE_COMPLETE", $"Diagnostics passed in {swTotal.ElapsedMilliseconds} ms");

        return new ConnectionDiagnosticResult(
            true,
            swTotal.ElapsedMilliseconds,
            hostAddress,
            steps,
            serverBanner,
            null,
            "All connection tests passed. Host is ready for monitoring, terminal, and management.",
            DateTime.UtcNow
        );
    }

    public async Task<HostSystemStats> GetHostStatsAsync(HostEntity host)
    {
        var cacheKey = $"host_stats_{host.Id}";
        return await _cacheService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                var stats = await FetchHostStatsInternalAsync(host);
                if (!stats.IsOnline)
                {
                    _cacheService.Remove(cacheKey);
                }
                return stats;
            },
            TimeSpan.FromSeconds(5)
        );
    }

    private async Task<HostSystemStats> FetchHostStatsInternalAsync(HostEntity host)
    {
        try
        {
            var query = _cmdRegistry.GetCommand("System.StatsProbe");
            var timeout = _cmdRegistry.GetTimeout("System.StatsProbe", 10);
            var result = await RunCommandAsync(host, query, timeoutSeconds: timeout);

            if (result.ExitCode != 0 && string.IsNullOrEmpty(result.Output))
            {
                return new HostSystemStats(false, null, null, null, null, null, null, null, null, null, null, null, result.Error);
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
            var load = ExtractSection("LOAD");
            var memRaw = ExtractSection("MEM");
            var diskRaw = ExtractSection("DISK");
            var net = ExtractSection("NET");
            var cpuRaw = ExtractSection("CPU");
            var docker = ExtractSection("DOCKER");

            int? cpuPercent = int.TryParse(cpuRaw, out var cp) ? cp : null;
            string cpuUsage = cpuPercent.HasValue ? $"{cpuPercent}%" : "0%";

            // Parse MEM: used|total|formatted
            string memUsage = memRaw;
            int? memPercent = null;
            if (memRaw.Contains('|'))
            {
                var parts = memRaw.Split('|');
                if (parts.Length >= 3 && int.TryParse(parts[0], out var u) && int.TryParse(parts[1], out var t) && t > 0)
                {
                    memPercent = (int)Math.Round((double)u * 100 / t);
                    memUsage = parts[2];
                }
            }

            // Parse DISK: used|total|formatted
            string diskUsage = diskRaw;
            int? diskPercent = null;
            if (diskRaw.Contains('|'))
            {
                var parts = diskRaw.Split('|');
                if (parts.Length >= 3 && int.TryParse(parts[0], out var du) && int.TryParse(parts[1], out var dt) && dt > 0)
                {
                    diskPercent = (int)Math.Round((double)du * 100 / dt);
                    diskUsage = parts[2];
                }
            }

            return new HostSystemStats(
                true,
                os,
                uptime,
                memUsage,
                diskUsage,
                cpuUsage,
                string.IsNullOrEmpty(net) ? "N/A" : net,
                string.IsNullOrEmpty(load) ? "N/A" : load,
                cpuPercent,
                memPercent,
                diskPercent,
                docker
            );
        }
        catch (Exception ex)
        {
            return new HostSystemStats(false, null, null, null, null, null, null, null, null, null, null, null, ex.Message);
        }
    }

    public void InvalidateHost(string hostId)
    {
        _cacheService.Remove($"host_stats_{hostId}");
        _cacheService.RemoveByPrefix($"host_{hostId}");
        _cacheService.RemoveByPrefix($"docker_{hostId}");
        _cacheService.RemoveByPrefix($"systemd_{hostId}");
        _cacheService.RemoveByPrefix($"pkg_{hostId}");
        _cacheService.RemoveByPrefix($"firewall_{hostId}");
        _cacheService.RemoveByPrefix($"linux_users_{hostId}");

        if (_sshClients.TryRemove(hostId, out var ssh))
        {
            try { ssh.Dispose(); } catch { }
        }
        if (_sftpClients.TryRemove(hostId, out var sftp))
        {
            try { sftp.Dispose(); } catch { }
        }
    }

    public bool IsConnected(string hostId)
    {
        return _sshClients.TryGetValue(hostId, out var client) && client.IsConnected;
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
