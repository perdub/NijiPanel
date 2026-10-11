using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Renci.SshNet;

namespace NijiPanel.Backend.Services;

public class DedicatedSftpStream : Stream
{
    private readonly SftpClient _client;
    private readonly Stream _stream;
    private bool _disposed;

    public DedicatedSftpStream(SftpClient client, Stream stream)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _stream = stream ?? throw new ArgumentNullException(nameof(stream));
    }

    public override bool CanRead => !_disposed && _stream.CanRead;
    public override bool CanSeek => !_disposed && _stream.CanSeek;
    public override bool CanWrite => false;

    public override long Length => _stream.Length;

    public override long Position
    {
        get => _stream.Position;
        set => _stream.Position = value;
    }

    public override void Flush() => _stream.Flush();

    public override int Read(byte[] buffer, int offset, int count) => _stream.Read(buffer, offset, count);

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        => _stream.ReadAsync(buffer, offset, count, cancellationToken);

    public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        => _stream.ReadAsync(buffer, cancellationToken);

    public override long Seek(long offset, SeekOrigin origin) => _stream.Seek(offset, origin);

    public override void SetLength(long value) => throw new NotSupportedException();

    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            _disposed = true;
            if (disposing)
            {
                try { _stream.Dispose(); } catch { }
                try
                {
                    if (_client.IsConnected) _client.Disconnect();
                    _client.Dispose();
                }
                catch { }
            }
        }
        base.Dispose(disposing);
    }

    public override async ValueTask DisposeAsync()
    {
        if (!_disposed)
        {
            _disposed = true;
            try { await _stream.DisposeAsync(); } catch { }
            try
            {
                if (_client.IsConnected) _client.Disconnect();
                _client.Dispose();
            }
            catch { }
        }
        await base.DisposeAsync();
    }
}
