using System.Buffers;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Renci.SshNet;
using Renci.SshNet.Common;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public class HostTerminalSessionInfo
{
    public string SessionName { get; set; } = string.Empty;
    public int TabIndex { get; set; }
    public string Path { get; set; } = "~";
    public bool IsAttached { get; set; }
}

public sealed class TerminalSession : IAsyncDisposable
{
    public string Id { get; }
    public string HostId { get; }
    public uint Cols { get; private set; }
    public uint Rows { get; private set; }
    public int TabIndex { get; }
    public string CurrentPath { get; private set; } = "~";
    public DateTime LastActive { get; private set; } = DateTime.UtcNow;

    private readonly SshClient _sshClient;
    private readonly ShellStream _shellStream;
    private readonly ILogger _logger;
    private readonly Lock _scrollbackLock = new();
    private readonly Queue<byte[]> _scrollbackChunks = new();
    private int _scrollbackTotalBytes;
    private const int MaxScrollbackBytes = 256 * 1024; // 256 KB ring buffer

    private readonly ConcurrentDictionary<Guid, Channel<byte[]>> _subscribers = new();
    private readonly CancellationTokenSource _cts = new();

    public TerminalSession(
        string id,
        string hostId,
        SshClient sshClient,
        uint cols,
        uint rows,
        int tabIndex,
        string? initialDir,
        string? containerId,
        ILogger logger)
    {
        Id = id;
        HostId = hostId;
        _sshClient = sshClient;
        Cols = cols > 0 ? cols : 80;
        Rows = rows > 0 ? rows : 24;
        TabIndex = tabIndex;
        _logger = logger;

        if (!string.IsNullOrWhiteSpace(initialDir))
        {
            CurrentPath = initialDir;
        }

        var terminalModes = new Dictionary<TerminalModes, uint>
        {
            [TerminalModes.ECHO] = 1,
            [TerminalModes.ICANON] = 1,
            [TerminalModes.ISIG] = 1
        };

        if (!string.IsNullOrWhiteSpace(containerId))
        {
            // Container interactive exec: attach directly into container PTY via SSH
            var cleanContainer = SanitizeContainerId(containerId);
            _shellStream = _sshClient.CreateShellStream(
                "xterm-256color",
                Cols,
                Rows,
                0,
                0,
                32768,
                terminalModes);

            var execCmd = $"exec docker exec -it {cleanContainer} sh -c \"([ -f /bin/bash ] || [ -f /usr/bin/bash ]) && exec bash || exec sh\"\n";
            _shellStream.Write(Encoding.UTF8.GetBytes(execCmd));
            _shellStream.Flush();
        }
        else
        {
            // Host direct PTY shell without tmux wrapper
            _shellStream = _sshClient.CreateShellStream(
                "xterm-256color",
                Cols,
                Rows,
                0,
                0,
                32768,
                terminalModes);

            if (!string.IsNullOrWhiteSpace(initialDir) && initialDir != "~")
            {
                var escapedDir = initialDir.Replace("'", "'\\''");
                var initCmd = $" HISTCONTROL=ignorespace cd '{escapedDir}' 2>/dev/null && clear\n";
                _shellStream.Write(Encoding.UTF8.GetBytes(initCmd));
                _shellStream.Flush();
            }
        }

        _shellStream.DataReceived += OnShellDataReceived;
    }

    private void OnShellDataReceived(object? sender, ShellDataEventArgs e)
    {
        if (e.Data == null || e.Data.Length == 0) return;
        LastActive = DateTime.UtcNow;

        // Binary protocol: 0x00 prefix for standard stdout/stderr stream data
        var frame = new byte[e.Data.Length + 1];
        frame[0] = 0x00;
        Buffer.BlockCopy(e.Data, 0, frame, 1, e.Data.Length);

        lock (_scrollbackLock)
        {
            var chunk = (byte[])e.Data.Clone();
            _scrollbackChunks.Enqueue(chunk);
            _scrollbackTotalBytes += chunk.Length;

            while (_scrollbackTotalBytes > MaxScrollbackBytes && _scrollbackChunks.TryDequeue(out var old))
            {
                _scrollbackTotalBytes -= old.Length;
            }
        }

        foreach (var sub in _subscribers.Values)
        {
            sub.Writer.TryWrite(frame);
        }
    }

    public void Resize(uint cols, uint rows)
    {
        if (cols == 0 || rows == 0 || (cols == Cols && rows == Rows)) return;
        Cols = cols;
        Rows = rows;
        try
        {
            _shellStream.ChangeWindowSize(cols, rows, 0, 0);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to resize terminal session {SessionId}", Id);
        }
    }

    public void WriteStdin(ReadOnlySpan<byte> data)
    {
        LastActive = DateTime.UtcNow;
        _shellStream.Write(data);
        _shellStream.Flush();
    }

    public byte[] GetScrollbackSnapshot()
    {
        lock (_scrollbackLock)
        {
            if (_scrollbackTotalBytes == 0) return [];
            // Binary protocol: 0x02 prefix indicates scrollback replay
            var result = new byte[_scrollbackTotalBytes + 1];
            result[0] = 0x02;
            int offset = 1;
            foreach (var chunk in _scrollbackChunks)
            {
                Buffer.BlockCopy(chunk, 0, result, offset, chunk.Length);
                offset += chunk.Length;
            }
            return result;
        }
    }

    public (Guid SubId, ChannelReader<byte[]> Reader) Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<byte[]>(new BoundedChannelOptions(512)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
        _subscribers[id] = channel;
        return (id, channel.Reader);
    }

    public void Unsubscribe(Guid subId)
    {
        if (_subscribers.TryRemove(subId, out var ch))
        {
            ch.Writer.TryComplete();
        }
    }

    public void UpdatePath(string newPath)
    {
        if (!string.IsNullOrWhiteSpace(newPath) && newPath != CurrentPath)
        {
            CurrentPath = newPath.Trim();
        }
    }

    public bool IsAlive => _shellStream.CanRead && _sshClient.IsConnected;

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        _shellStream.DataReceived -= OnShellDataReceived;

        foreach (var sub in _subscribers.Values)
        {
            sub.Writer.TryComplete();
        }
        _subscribers.Clear();

        try { await _shellStream.DisposeAsync(); } catch { }
        try { _sshClient.Dispose(); } catch { }
        _cts.Dispose();
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
    private readonly ILogger<TerminalSessionManager> _logger;
    private readonly ConcurrentDictionary<string, TerminalSession> _sessions = new();

    public TerminalSessionManager(
        ISshConnectionManager sshManager,
        ILogger<TerminalSessionManager> logger)
    {
        _sshManager = sshManager;
        _logger = logger;

        // Cleanup idle sessions after 60 minutes of inactivity
        Task.Run(async () =>
        {
            while (true)
            {
                await Task.Delay(TimeSpan.FromMinutes(10));
                var now = DateTime.UtcNow;
                foreach (var (id, session) in _sessions)
                {
                    if (now - session.LastActive > TimeSpan.FromMinutes(60) || !session.IsAlive)
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
            if (existing.HostId == host.Id && existing.IsAlive)
            {
                existing.Resize(cols, rows);
                return existing;
            }

            _sessions.TryRemove(sessionId, out _);
            _ = existing.DisposeAsync();
        }

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

        var dedicatedClient = _sshManager.CreateDedicatedSshClient(host);

        var session = new TerminalSession(
            newId,
            host.Id,
            dedicatedClient,
            cols,
            rows,
            resolvedTabIndex,
            initialDir,
            containerId,
            _logger);

        _sessions[newId] = session;
        return session;
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
            _ = session.DisposeAsync();
        }
    }

    public async Task CloseSessionAsync(string sessionId, bool killHostSession = false)
    {
        if (_sessions.TryRemove(sessionId, out var session))
        {
            await session.DisposeAsync();
        }
    }

    public Task<List<HostTerminalSessionInfo>> GetHostSessionsAsync(HostEntity host)
    {
        var result = new List<HostTerminalSessionInfo>();
        foreach (var session in _sessions.Values)
        {
            if (session.HostId == host.Id && session.IsAlive)
            {
                result.Add(new HostTerminalSessionInfo
                {
                    SessionName = session.Id,
                    TabIndex = session.TabIndex,
                    Path = session.CurrentPath,
                    IsAttached = true
                });
            }
        }
        return Task.FromResult(result);
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

        var (subId, reader) = session.Subscribe();
        using var linkedCts = new CancellationTokenSource();

        // Background worker: stream chunks from session Channel to WebSocket
        var sendTask = Task.Run(async () =>
        {
            try
            {
                // Send replay scrollback first if available
                var scrollback = session.GetScrollbackSnapshot();
                if (scrollback.Length > 0 && webSocket.State == WebSocketState.Open)
                {
                    await webSocket.SendAsync(
                        new ArraySegment<byte>(scrollback),
                        WebSocketMessageType.Binary,
                        true,
                        linkedCts.Token);
                }

                await foreach (var frame in reader.ReadAllAsync(linkedCts.Token))
                {
                    if (webSocket.State != WebSocketState.Open) break;
                    await webSocket.SendAsync(
                        new ArraySegment<byte>(frame),
                        WebSocketMessageType.Binary,
                        true,
                        linkedCts.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "WebSocket sender error in session {SessionId}", session.Id);
            }
        }, linkedCts.Token);

        // Receive loop: read incoming client input / resize packets
        var receiveBuffer = ArrayPool<byte>.Shared.Rent(16384);
        try
        {
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(receiveBuffer), linkedCts.Token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                if (result.Count > 0)
                {
                    var span = receiveBuffer.AsSpan(0, result.Count);

                    if (result.MessageType == WebSocketMessageType.Binary)
                    {
                        var packetType = span[0];
                        var payload = span[1..];

                        switch (packetType)
                        {
                            case 0x00: // Keystrokes stdin data
                                session.WriteStdin(payload);
                                break;

                            case 0x01: // Resize: 4 bytes (UInt16 cols, UInt16 rows) in Big-Endian
                                if (payload.Length >= 4)
                                {
                                    uint c = (uint)((payload[0] << 8) | payload[1]);
                                    uint r = (uint)((payload[2] << 8) | payload[3]);
                                    session.Resize(c, r);
                                }
                                break;
                        }
                    }
                    else if (result.MessageType == WebSocketMessageType.Text)
                    {
                        // Backward compatibility for text / JSON messages
                        var text = Encoding.UTF8.GetString(span);
                        if (text.StartsWith('{') && text.Contains("\"resize\""))
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
                        session.WriteStdin(span);
                    }
                }
            }
        }
        catch (WebSocketException) { }
        catch (OperationCanceledException) { }
        finally
        {
            ArrayPool<byte>.Shared.Return(receiveBuffer);
            session.Unsubscribe(subId);
            linkedCts.Cancel();
            try { await sendTask; } catch { }

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
