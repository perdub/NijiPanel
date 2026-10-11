using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.DependencyInjection;
using Renci.SshNet;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public class HostTerminalSessionInfo
{
    public string SessionName { get; set; } = string.Empty;
    public int TabIndex { get; set; }
    public string Path { get; set; } = "~";
    public bool IsAttached { get; set; }
}

public class TerminalSession : IDisposable
{
    public string Id { get; }
    public string HostId { get; }
    public ShellStream Shell { get; }
    public SshClient? DedicatedClient { get; }
    public string? TmuxName { get; }
    public int TabIndex { get; }
    public string CurrentPath { get; private set; } = "~";
    public DateTime LastActive { get; set; } = DateTime.UtcNow;
    public WebSocket? ActiveSocket { get; set; }

    private readonly MemoryStream _scrollback = new();
    private readonly object _lock = new();
    private readonly CancellationTokenSource _cts = new();
    private const int MaxScrollbackBytes = 256 * 1024; // 256 KB ring buffer
    private volatile bool _pathCheckPending = false;

    public TerminalSession(
        string id,
        string hostId,
        ShellStream shell,
        SshClient? dedicatedClient = null,
        string? tmuxName = null,
        int tabIndex = 1,
        string? initialPath = null)
    {
        Id = id;
        HostId = hostId;
        Shell = shell;
        DedicatedClient = dedicatedClient;
        TmuxName = tmuxName;
        TabIndex = tabIndex;
        if (!string.IsNullOrWhiteSpace(initialPath))
        {
            CurrentPath = initialPath;
        }
    }

    public void StartReading(ILogger logger)
    {
        Task.Run(async () =>
        {
            var buffer = new byte[4096];
            try
            {
                while (!_cts.Token.IsCancellationRequested && Shell.CanRead)
                {
                    int bytesRead = await Shell.ReadAsync(buffer, 0, buffer.Length, _cts.Token);
                    if (bytesRead <= 0) break;

                    LastActive = DateTime.UtcNow;
                    var chunk = buffer[..bytesRead];

                    WebSocket? socket;
                    lock (_lock)
                    {
                        // Append to scrollback
                        if (_scrollback.Length + bytesRead > MaxScrollbackBytes)
                        {
                            var currentBytes = _scrollback.ToArray();
                            _scrollback.SetLength(0);
                            int keep = Math.Max(0, currentBytes.Length - (MaxScrollbackBytes / 2));
                            _scrollback.Write(currentBytes, keep, currentBytes.Length - keep);
                        }
                        _scrollback.Write(chunk, 0, bytesRead);
                        socket = ActiveSocket;
                    }

                    // Forward to active client if connected
                    if (socket != null && socket.State == WebSocketState.Open)
                    {
                        try
                        {
                            await socket.SendAsync(
                                new ArraySegment<byte>(chunk),
                                WebSocketMessageType.Text,
                                true,
                                CancellationToken.None);
                        }
                        catch
                        {
                            // Socket send error; client probably went to sleep
                        }
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Terminal session {SessionId} read loop ended", Id);
            }
        });
    }

    public void StartPathTracking(HostEntity host, ISshConnectionManager sshManager, ILogger logger)
    {
        if (string.IsNullOrEmpty(TmuxName)) return;

        Task.Run(async () =>
        {
            // Initial delay to let the shell initialize and attach to tmux
            await Task.Delay(1200, _cts.Token).ConfigureAwait(false);

            while (!_cts.Token.IsCancellationRequested)
            {
                try
                {
                    var (exitCode, output, _) = await sshManager.RunCommandAsync(
                        host,
                        $"tmux display-message -p -t \"{TmuxName}\" '#{{pane_current_path}}' 2>/dev/null",
                        timeoutSeconds: 3);

                    if (exitCode == 0 && !string.IsNullOrWhiteSpace(output))
                    {
                        var trimmed = output.Trim();
                        if (trimmed != CurrentPath)
                        {
                            CurrentPath = trimmed;
                            await BroadcastCwdAsync();
                        }
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Ignore transient SSH errors during path polling
                }

                _pathCheckPending = false;

                // Wait 2.5 seconds or until user presses enter
                for (int i = 0; i < 25; i++)
                {
                    if (_cts.Token.IsCancellationRequested) break;
                    if (_pathCheckPending)
                    {
                        // Enter was pressed, wait brief 350ms for cd to execute then query path immediately
                        await Task.Delay(350, _cts.Token).ConfigureAwait(false);
                        break;
                    }
                    await Task.Delay(100, _cts.Token).ConfigureAwait(false);
                }
            }
        }, _cts.Token);
    }

    public async Task BroadcastCwdAsync()
    {
        WebSocket? socket;
        lock (_lock)
        {
            socket = ActiveSocket;
        }

        if (socket != null && socket.State == WebSocketState.Open)
        {
            try
            {
                var msg = JsonSerializer.Serialize(new
                {
                    type = "cwd",
                    sessionId = Id,
                    path = CurrentPath,
                    tmuxSession = TmuxName,
                    tabIndex = TabIndex
                });
                await socket.SendAsync(
                    new ArraySegment<byte>(Encoding.UTF8.GetBytes(msg)),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None);
            }
            catch { }
        }
    }

    public byte[] GetScrollback()
    {
        lock (_lock)
        {
            return _scrollback.ToArray();
        }
    }

    public void AttachSocket(WebSocket socket)
    {
        lock (_lock)
        {
            ActiveSocket = socket;
            LastActive = DateTime.UtcNow;
        }
    }

    public void DetachSocket()
    {
        lock (_lock)
        {
            ActiveSocket = null;
            LastActive = DateTime.UtcNow;
        }
    }

    public void WriteInput(byte[] data)
    {
        LastActive = DateTime.UtcNow;

        // Check if Enter key was sent (\r or \n) to trigger path tracking
        for (int i = 0; i < data.Length; i++)
        {
            if (data[i] == 13 || data[i] == 10)
            {
                _pathCheckPending = true;
                break;
            }
        }

        Shell.Write(data, 0, data.Length);
        Shell.Flush();
    }

    public void Resize(uint cols, uint rows)
    {
        if (cols == 0 || rows == 0) return;
        try
        {
            var channelField = typeof(ShellStream).GetField("_channel", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            var channel = channelField?.GetValue(Shell);
            if (channel != null)
            {
                var method = channel.GetType().GetMethod("SendWindowChangeRequest", new[] { typeof(uint), typeof(uint), typeof(uint), typeof(uint) });
                method?.Invoke(channel, new object[] { cols, rows, 0u, 0u });
            }
        }
        catch { }
    }

    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
        try { Shell.Dispose(); } catch { }
        try { DedicatedClient?.Dispose(); } catch { }
        try { _scrollback.Dispose(); } catch { }
    }
}

public interface ITerminalSessionManager
{
    TerminalSession GetOrCreateSession(
        HostEntity host,
        string? sessionId,
        uint cols,
        uint rows,
        string? containerId = null,
        int? tabIndex = null,
        string? initialDir = null);

    TerminalSession? GetSession(string sessionId);
    void CloseSession(string sessionId);
    Task CloseSessionAsync(string sessionId, bool killHostSession = false);
    Task<List<HostTerminalSessionInfo>> GetHostSessionsAsync(HostEntity host);
    Task HandleWebSocketAsync(
        WebSocket webSocket,
        HostEntity host,
        string? sessionId,
        uint cols,
        uint rows,
        string? containerId = null,
        int? tabIndex = null,
        string? initialDir = null);
}

public class TerminalSessionManager : ITerminalSessionManager
{
    private readonly ISshConnectionManager _sshManager;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TerminalSessionManager> _logger;
    private readonly ConcurrentDictionary<string, TerminalSession> _sessions = new();

    public TerminalSessionManager(
        ISshConnectionManager sshManager,
        IServiceScopeFactory scopeFactory,
        ILogger<TerminalSessionManager> logger)
    {
        _sshManager = sshManager;
        _scopeFactory = scopeFactory;
        _logger = logger;

        // Cleanup stale in-memory sessions after 60 minutes of inactivity
        Task.Run(async () =>
        {
            while (true)
            {
                await Task.Delay(TimeSpan.FromMinutes(10));
                var now = DateTime.UtcNow;
                foreach (var (id, session) in _sessions)
                {
                    if (now - session.LastActive > TimeSpan.FromMinutes(60))
                    {
                        CloseSession(id);
                    }
                }
            }
        });
    }

    public TerminalSession GetOrCreateSession(
        HostEntity host,
        string? sessionId,
        uint cols,
        uint rows,
        string? containerId = null,
        int? tabIndex = null,
        string? initialDir = null)
    {
        if (!string.IsNullOrEmpty(sessionId) && _sessions.TryGetValue(sessionId, out var existing))
        {
            if (existing.HostId == host.Id && existing.Shell.CanRead && (existing.DedicatedClient == null || existing.DedicatedClient.IsConnected))
            {
                existing.Resize(cols, rows);
                return existing;
            }

            if (existing.HostId != host.Id)
            {
                _logger.LogWarning("Requested terminal sessionId '{SessionId}' belongs to host '{ExistingHostId}', not '{RequestedHostId}'. Regenerating new session ID.",
                    sessionId, existing.HostId, host.Id);
                sessionId = null;
            }
            else
            {
                // If the shell stream or dedicated SSH client ended, remove stale session and re-create fresh!
                _sessions.TryRemove(sessionId, out _);
                existing.Dispose();
            }
        }

        // Determine tab index
        int resolvedTabIndex = tabIndex ?? 1;
        if (!tabIndex.HasValue && !string.IsNullOrEmpty(sessionId))
        {
            var match = Regex.Match(sessionId, @"-(\d+)$");
            if (match.Success && int.TryParse(match.Groups[1].Value, out var parsedIndex))
            {
                resolvedTabIndex = parsedIndex;
            }
        }

        var newId = string.IsNullOrEmpty(sessionId)
            ? (!string.IsNullOrEmpty(containerId)
                ? $"exec-{containerId[..Math.Min(12, containerId.Length)]}-{Guid.NewGuid():N[..6]}"
                : $"sess-{host.Id}-{resolvedTabIndex}")
            : sessionId;

        var tmuxName = $"niji-{resolvedTabIndex}";

        var termCols = cols > 0 ? cols : 80;
        var termRows = rows > 0 ? rows : 24;

        // Dedicated SSH connection for each terminal session to avoid multiplexing conflicts
        var dedicatedClient = _sshManager.CreateDedicatedSshClient(host);
        var shell = dedicatedClient.CreateShellStream("xterm-256color", termCols, termRows, 800, 600, 16384);

        var session = new TerminalSession(
            newId,
            host.Id,
            shell,
            dedicatedClient,
            tmuxName: string.IsNullOrEmpty(containerId) ? tmuxName : null,
            tabIndex: resolvedTabIndex,
            initialPath: initialDir);

        session.StartReading(_logger);

        // If running in container exec mode, immediately attach docker exec to shell stream
        if (!string.IsNullOrWhiteSpace(containerId))
        {
            try
            {
                var cleanId = SanitizeContainerId(containerId);
                var execCmd = $"exec docker exec -it {cleanId} sh -c \"([ -f /bin/bash ] || [ -f /usr/bin/bash ]) && exec bash || exec sh\"\n";
                shell.Write(Encoding.UTF8.GetBytes(execCmd));
                shell.Flush();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to exec into container {ContainerId}", containerId);
            }
        }
        else
        {
            // Host terminal: launch or attach to persistent host-side tmux session!
            var safeDir = !string.IsNullOrWhiteSpace(initialDir) && initialDir != "~"
                ? initialDir.Replace("\"", "\\\"")
                : "$HOME";

            var tmuxBootstrapCmd =
                $" [ -n \"$BASH_VERSION\" ] && set +o history 2>/dev/null; " +
                $"if command -v tmux >/dev/null 2>&1; then " +
                $"export TERM=xterm-256color; " +
                $"tmux set-option -g status off 2>/dev/null || true; " +
                $"tmux set-option -g history-limit 50000 2>/dev/null || true; " +
                $"if [ -d \"{safeDir}\" ]; then TARGET_DIR=\"{safeDir}\"; else TARGET_DIR=\"$HOME\"; fi; " +
                $"[ -d \"$TARGET_DIR\" ] || TARGET_DIR=\"~\"; " +
                $"exec tmux new-session -A -s \"{tmuxName}\" -c \"$TARGET_DIR\"; " +
                $"else " +
                $"cd \"{safeDir}\" 2>/dev/null || cd \"$HOME\" 2>/dev/null || cd ~ 2>/dev/null; " +
                $"exec bash -l 2>/dev/null || exec bash 2>/dev/null || exec sh; " +
                $"fi\n";

            shell.Write(Encoding.UTF8.GetBytes(tmuxBootstrapCmd));
            shell.Flush();

            session.StartPathTracking(host, _sshManager, _logger);
        }

        _sessions[newId] = session;
        return session;
    }

    private static string SanitizeContainerId(string id)
    {
        var clean = id.Trim();
        foreach (var c in clean)
        {
            if (!char.IsLetterOrDigit(c) && c != '-' && c != '_' && c != '.')
            {
                throw new ArgumentException("Invalid container identifier");
            }
        }
        return clean;
    }

    public TerminalSession? GetSession(string sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return session;
    }

    public void CloseSession(string sessionId)
    {
        if (_sessions.TryRemove(sessionId, out var session))
        {
            session.Dispose();
        }
    }

    public async Task CloseSessionAsync(string sessionId, bool killHostSession = false)
    {
        if (_sessions.TryRemove(sessionId, out var session))
        {
            var tmux = session.TmuxName;
            var hostId = session.HostId;
            session.Dispose();

            if (killHostSession && !string.IsNullOrEmpty(tmux))
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var hostService = scope.ServiceProvider.GetRequiredService<IHostService>();
                    var host = await hostService.GetHostEntityAsync(hostId);
                    if (host != null)
                    {
                        await _sshManager.RunCommandAsync(host, $"tmux kill-session -t \"{tmux}\" 2>/dev/null", timeoutSeconds: 3);
                    }
                }
                catch { }
            }
        }
    }

    public async Task<List<HostTerminalSessionInfo>> GetHostSessionsAsync(HostEntity host)
    {
        var result = new List<HostTerminalSessionInfo>();
        try
        {
            var (exitCode, output, _) = await _sshManager.RunCommandAsync(
                host,
                "tmux list-sessions -F \"#{session_name}|#{session_windows}|#{session_attached}\" 2>/dev/null",
                timeoutSeconds: 4);

            if (exitCode == 0 && !string.IsNullOrWhiteSpace(output))
            {
                var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines)
                {
                    var parts = line.Split('|');
                    if (parts.Length >= 1)
                    {
                        var name = parts[0].Trim();
                        var isAttached = parts.Length >= 3 && parts[2].Trim() != "0";

                        // Get path of session
                        var (_, pathOut, _) = await _sshManager.RunCommandAsync(
                            host,
                            $"tmux display-message -p -t \"{name}\" '#{{pane_current_path}}' 2>/dev/null",
                            timeoutSeconds: 2);

                        var match = Regex.Match(name, @"-(\d+)$");
                        int tabIdx = match.Success && int.TryParse(match.Groups[1].Value, out var parsed) ? parsed : 1;

                        result.Add(new HostTerminalSessionInfo
                        {
                            SessionName = name,
                            TabIndex = tabIdx,
                            Path = !string.IsNullOrWhiteSpace(pathOut) ? pathOut.Trim() : "~",
                            IsAttached = isAttached
                        });
                    }
                }
            }
        }
        catch { }

        return result;
    }

    public async Task HandleWebSocketAsync(
        WebSocket webSocket,
        HostEntity host,
        string? sessionId,
        uint cols,
        uint rows,
        string? containerId = null,
        int? tabIndex = null,
        string? initialDir = null)
    {
        TerminalSession session;
        try
        {
            session = GetOrCreateSession(host, sessionId, cols, rows, containerId, tabIndex, initialDir);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create terminal session for host {HostName} ({HostId})", host.Name, host.Id);
            var errText = $"\r\n\x1b[1;31m[NijiPanel] Failed to connect to SSH host '{host.Name}' ({host.Host}:{host.Port})\x1b[0m\r\n" +
                          $"\x1b[33mError: {ex.Message}\x1b[0m\r\n" +
                          $"\x1b[90mCheck credentials, auth type, or network connectivity in Host Settings.\x1b[0m\r\n\r\n";
            try
            {
                if (webSocket.State == WebSocketState.Open)
                {
                    await webSocket.SendAsync(
                        new ArraySegment<byte>(Encoding.UTF8.GetBytes(errText)),
                        WebSocketMessageType.Text,
                        true,
                        CancellationToken.None);
                    await Task.Delay(500);
                    await webSocket.CloseAsync(WebSocketCloseStatus.InternalServerError, ex.Message, CancellationToken.None);
                }
            }
            catch { }
            return;
        }

        session.AttachSocket(webSocket);

        try
        {
            // Send session info handshake with real-time path and tmux session name
            var handshake = JsonSerializer.Serialize(new
            {
                type = "session_info",
                sessionId = session.Id,
                hostId = host.Id,
                hostName = host.Name,
                tmuxSession = session.TmuxName,
                path = session.CurrentPath,
                tabIndex = session.TabIndex
            });
            await webSocket.SendAsync(
                new ArraySegment<byte>(Encoding.UTF8.GetBytes(handshake)),
                WebSocketMessageType.Text,
                true,
                CancellationToken.None);

            // Flush replay buffer to client so user immediately sees previous screen
            var scrollback = session.GetScrollback();
            if (scrollback.Length > 0)
            {
                await webSocket.SendAsync(
                    new ArraySegment<byte>(scrollback),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None);
            }

            var receiveBuffer = new byte[4096];
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(receiveBuffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                if (result.Count > 0)
                {
                    // Check if JSON command (e.g. resize, request_cwd)
                    var text = Encoding.UTF8.GetString(receiveBuffer, 0, result.Count);
                    if (text.StartsWith("{\"type\":\"resize\"") || text.StartsWith("{\"type\": \"resize\""))
                    {
                        try
                        {
                            using var doc = JsonDocument.Parse(text);
                            var root = doc.RootElement;
                            if (root.TryGetProperty("cols", out var c) && root.TryGetProperty("rows", out var r))
                            {
                                session.Resize((uint)c.GetInt32(), (uint)r.GetInt32());
                                continue;
                            }
                        }
                        catch { }
                    }
                    else if (text.StartsWith("{\"type\":\"request_cwd\"") || text.StartsWith("{\"type\": \"request_cwd\""))
                    {
                        await session.BroadcastCwdAsync();
                        continue;
                    }

                    // Regular terminal keystrokes
                    var inputBytes = receiveBuffer[..result.Count];
                    session.WriteInput(inputBytes);
                }
            }
        }
        catch (WebSocketException)
        {
            // Normal when mobile browser backgrounds or client disconnects
        }
        finally
        {
            session.DetachSocket();
            if (webSocket.State == WebSocketState.Open || webSocket.State == WebSocketState.CloseReceived)
            {
                try
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Session detached", CancellationToken.None);
                }
                catch { }
            }
        }
    }
}
