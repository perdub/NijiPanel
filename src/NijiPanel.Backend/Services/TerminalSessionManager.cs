using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Renci.SshNet;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public class TerminalSession : IDisposable
{
    public string Id { get; }
    public string HostId { get; }
    public ShellStream Shell { get; }
    public DateTime LastActive { get; set; } = DateTime.UtcNow;
    public WebSocket? ActiveSocket { get; set; }

    private readonly MemoryStream _scrollback = new();
    private readonly object _lock = new();
    private readonly CancellationTokenSource _cts = new();
    private const int MaxScrollbackBytes = 256 * 1024; // 256 KB ring buffer

    public TerminalSession(string id, string hostId, ShellStream shell)
    {
        Id = id;
        HostId = hostId;
        Shell = shell;
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
        try { _scrollback.Dispose(); } catch { }
    }
}

public interface ITerminalSessionManager
{
    TerminalSession GetOrCreateSession(HostEntity host, string? sessionId, uint cols, uint rows, string? containerId = null);
    TerminalSession? GetSession(string sessionId);
    void CloseSession(string sessionId);
    Task HandleWebSocketAsync(WebSocket webSocket, HostEntity host, string? sessionId, uint cols, uint rows, string? containerId = null);
}

public class TerminalSessionManager : ITerminalSessionManager
{
    private readonly ISshConnectionManager _sshManager;
    private readonly ILogger<TerminalSessionManager> _logger;
    private readonly ConcurrentDictionary<string, TerminalSession> _sessions = new();

    public TerminalSessionManager(
        ISshConnectionManager sshManager,
        ILogger<TerminalSessionManager> logger)
    {
        _sshManager = sshManager;
        _logger = logger;

        // Cleanup stale sessions after 30 minutes of inactivity
        Task.Run(async () =>
        {
            while (true)
            {
                await Task.Delay(TimeSpan.FromMinutes(5));
                var now = DateTime.UtcNow;
                foreach (var (id, session) in _sessions)
                {
                    if (now - session.LastActive > TimeSpan.FromMinutes(30))
                    {
                        CloseSession(id);
                    }
                }
            }
        });
    }

    public TerminalSession GetOrCreateSession(HostEntity host, string? sessionId, uint cols, uint rows, string? containerId = null)
    {
        if (!string.IsNullOrEmpty(sessionId) && _sessions.TryGetValue(sessionId, out var existing))
        {
            existing.Resize(cols, rows);
            return existing;
        }

        var newId = string.IsNullOrEmpty(sessionId)
            ? (!string.IsNullOrEmpty(containerId)
                ? $"exec-{containerId[..Math.Min(12, containerId.Length)]}-{Guid.NewGuid():N[..6]}"
                : Guid.NewGuid().ToString("N"))
            : sessionId;
        var client = _sshManager.GetSshClient(host);

        var termCols = cols > 0 ? cols : 80;
        var termRows = rows > 0 ? rows : 24;

        var shell = client.CreateShellStream("xterm-256color", termCols, termRows, 800, 600, 16384);
        var session = new TerminalSession(newId, host.Id, shell);
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

    public async Task HandleWebSocketAsync(WebSocket webSocket, HostEntity host, string? sessionId, uint cols, uint rows, string? containerId = null)
    {
        var session = GetOrCreateSession(host, sessionId, cols, rows, containerId);
        session.AttachSocket(webSocket);

        try
        {
            // Send session info handshake
            var handshake = JsonSerializer.Serialize(new
            {
                type = "session_info",
                sessionId = session.Id,
                hostId = host.Id,
                hostName = host.Name
            });
            await webSocket.SendAsync(
                new ArraySegment<byte>(Encoding.UTF8.GetBytes(handshake)),
                WebSocketMessageType.Text,
                true,
                CancellationToken.None);

            // Flush replay buffer to client so user immediately sees previous screen!
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
                    // Check if JSON command (e.g. resize)
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

                    // Otherwise regular terminal user input keystrokes
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
