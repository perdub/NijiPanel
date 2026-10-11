using System.Text;
using Renci.SshNet.Sftp;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface ISftpService
{
    Task<DirectoryListingDto> ListDirectoryAsync(HostEntity host, string path);
    Task<FileContentDto> ReadFileAsync(HostEntity host, string path);
    Task WriteFileAsync(HostEntity host, string path, string content);
    Task CreateDirectoryAsync(HostEntity host, string path);
    Task CreateFileAsync(HostEntity host, string path);
    Task DeleteAsync(HostEntity host, string path);
    Task RenameAsync(HostEntity host, string oldPath, string newPath);
    Task<(Stream Stream, string ContentType, string FileName)> OpenReadStreamAsync(HostEntity host, string path);
    Task UploadAsync(HostEntity host, string path, Stream contentStream);
}

public class SftpService : ISftpService
{
    private readonly ISshConnectionManager _sshManager;

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"
    };

    private static readonly HashSet<string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".opus", ".webm"
    };

    private static readonly HashSet<string> TextExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".json", ".yml", ".yaml", ".conf", ".cfg", ".ini", ".env",
        ".sh", ".bash", ".zsh", ".py", ".js", ".ts", ".jsx", ".tsx",
        ".html", ".htm", ".css", ".scss", ".md", ".toml", ".xml", ".log",
        ".sql", ".dockerfile", ".service", ".rules", ".properties", ".lock"
    };

    public SftpService(ISshConnectionManager sshManager)
    {
        _sshManager = sshManager;
    }

    private static string NormalizePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "/";
        var norm = path.Replace('\\', '/').Trim();
        if (!norm.StartsWith('/')) norm = "/" + norm;
        while (norm.Contains("//")) norm = norm.Replace("//", "/");
        if (norm.Length > 1 && norm.EndsWith('/')) norm = norm[..^1];
        return norm;
    }

    public async Task<DirectoryListingDto> ListDirectoryAsync(HostEntity host, string path)
    {
        var targetPath = NormalizePath(path);

        return await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            var entries = sftp.ListDirectory(targetPath);

            var items = new List<FileItemDto>();
            foreach (var entry in entries)
            {
                if (entry.Name == "." || entry.Name == "..") continue;

                var ext = Path.GetExtension(entry.Name);
                var isImage = ImageExtensions.Contains(ext);
                var isAudio = AudioExtensions.Contains(ext);
                var isText = TextExtensions.Contains(ext) || (!entry.IsDirectory && !isImage && !isAudio && entry.Length < 2 * 1024 * 1024);

                var perms = entry.Attributes != null
                    ? ConvertPermissions(entry.Attributes)
                    : "-rw-r--r--";

                items.Add(new FileItemDto(
                    entry.Name,
                    entry.FullName,
                    entry.IsDirectory,
                    entry.Length,
                    entry.LastWriteTimeUtc,
                    perms,
                    entry.UserId.ToString(),
                    entry.GroupId.ToString(),
                    ext,
                    isText,
                    isImage,
                    isAudio
                ));
            }

            // Sort: directories first, then files alphabetically
            items = items
                .OrderByDescending(x => x.IsDirectory)
                .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            string? parentPath = null;
            if (targetPath != "/")
            {
                var lastSlash = targetPath.LastIndexOf('/');
                parentPath = lastSlash <= 0 ? "/" : targetPath[..lastSlash];
            }

            return new DirectoryListingDto(targetPath, parentPath, items);
        });
    }

    public async Task<FileContentDto> ReadFileAsync(HostEntity host, string path)
    {
        var targetPath = NormalizePath(path);

        return await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            var attrs = sftp.GetAttributes(targetPath);

            if (attrs.Size > 10 * 1024 * 1024)
            {
                throw new InvalidOperationException("File is too large to open in text editor (> 10MB). Use download instead.");
            }

            using var stream = sftp.OpenRead(targetPath);
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var content = reader.ReadToEnd();

            return new FileContentDto(
                targetPath,
                content,
                attrs.Size,
                Path.GetExtension(targetPath)
            );
        });
    }

    public async Task WriteFileAsync(HostEntity host, string path, string content)
    {
        var targetPath = NormalizePath(path);

        await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            var bytes = Encoding.UTF8.GetBytes(content);

            using var ms = new MemoryStream(bytes);
            using var file = sftp.Create(targetPath);
            ms.CopyTo(file);
        });
    }

    public async Task CreateDirectoryAsync(HostEntity host, string path)
    {
        var targetPath = NormalizePath(path);
        await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            sftp.CreateDirectory(targetPath);
        });
    }

    public async Task CreateFileAsync(HostEntity host, string path)
    {
        var targetPath = NormalizePath(path);
        await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            using var file = sftp.Create(targetPath);
        });
    }

    public async Task DeleteAsync(HostEntity host, string path)
    {
        var targetPath = NormalizePath(path);
        await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            var attrs = sftp.GetAttributes(targetPath);
            if (attrs.IsDirectory)
            {
                // Delete directory and contents
                DeleteDirectoryRecursive(sftp, targetPath);
            }
            else
            {
                sftp.DeleteFile(targetPath);
            }
        });
    }

    private static void DeleteDirectoryRecursive(Renci.SshNet.SftpClient sftp, string path)
    {
        var files = sftp.ListDirectory(path);
        foreach (var file in files)
        {
            if (file.Name == "." || file.Name == "..") continue;
            if (file.IsDirectory)
            {
                DeleteDirectoryRecursive(sftp, file.FullName);
            }
            else
            {
                sftp.DeleteFile(file.FullName);
            }
        }
        sftp.DeleteDirectory(path);
    }

    public async Task RenameAsync(HostEntity host, string oldPath, string newPath)
    {
        var from = NormalizePath(oldPath);
        var to = NormalizePath(newPath);
        await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            sftp.RenameFile(from, to);
        });
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> OpenReadStreamAsync(HostEntity host, string path)
    {
        var targetPath = NormalizePath(path);
        return await Task.Run(() =>
        {
            var sftp = _sshManager.CreateDedicatedSftpClient(host);
            try
            {
                var sftpStream = sftp.OpenRead(targetPath);
                var ext = Path.GetExtension(targetPath).ToLowerInvariant();
                var contentType = ext switch
                {
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".gif" => "image/gif",
                    ".svg" => "image/svg+xml",
                    ".webp" => "image/webp",
                    ".bmp" => "image/bmp",
                    ".ico" => "image/x-icon",
                    ".mp3" => "audio/mpeg",
                    ".wav" => "audio/wav",
                    ".ogg" => "audio/ogg",
                    ".flac" => "audio/flac",
                    ".aac" => "audio/aac",
                    ".m4a" => "audio/mp4",
                    ".txt" or ".log" => "text/plain; charset=utf-8",
                    ".json" => "application/json",
                    ".yml" or ".yaml" => "text/yaml",
                    ".xml" => "application/xml",
                    ".pdf" => "application/pdf",
                    _ => "application/octet-stream"
                };

                var fileName = Path.GetFileName(targetPath);
                if (string.IsNullOrWhiteSpace(fileName))
                {
                    fileName = "download";
                }

                var dedicatedStream = new DedicatedSftpStream(sftp, sftpStream);
                return ((Stream)dedicatedStream, contentType, fileName);
            }
            catch
            {
                try { sftp.Dispose(); } catch { }
                throw;
            }
        });
    }

    public async Task UploadAsync(HostEntity host, string path, Stream contentStream)
    {
        var targetPath = NormalizePath(path);
        await Task.Run(() =>
        {
            var sftp = _sshManager.GetSftpClient(host);
            using var file = sftp.Create(targetPath);
            contentStream.CopyTo(file);
        });
    }

    private static string ConvertPermissions(SftpFileAttributes attr)
    {
        var sb = new StringBuilder(10);
        sb.Append(attr.IsDirectory ? 'd' : (attr.IsSymbolicLink ? 'l' : '-'));
        sb.Append(attr.OwnerCanRead ? 'r' : '-');
        sb.Append(attr.OwnerCanWrite ? 'w' : '-');
        sb.Append(attr.OwnerCanExecute ? 'x' : '-');
        sb.Append(attr.GroupCanRead ? 'r' : '-');
        sb.Append(attr.GroupCanWrite ? 'w' : '-');
        sb.Append(attr.GroupCanExecute ? 'x' : '-');
        sb.Append(attr.OthersCanRead ? 'r' : '-');
        sb.Append(attr.OthersCanWrite ? 'w' : '-');
        sb.Append(attr.OthersCanExecute ? 'x' : '-');
        return sb.ToString();
    }
}
