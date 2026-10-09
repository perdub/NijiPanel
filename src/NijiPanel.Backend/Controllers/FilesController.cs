using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}/files")]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly ISftpService _sftpService;
    private readonly ISshConnectionManager _sshManager;
    private readonly ICommandRegistry _cmdRegistry;

    public FilesController(
        IHostService hostService,
        ISftpService sftpService,
        ISshConnectionManager sshManager,
        ICommandRegistry cmdRegistry)
    {
        _hostService = hostService;
        _sftpService = sftpService;
        _sshManager = sshManager;
        _cmdRegistry = cmdRegistry;
    }

    private async Task<HostEntity?> GetHostOrNotFoundAsync(string hostId)
    {
        return await _hostService.GetHostEntityAsync(hostId);
    }

    private static string EscapeBashArg(string arg)
    {
        return "'" + arg.Replace("'", "'\\''") + "'";
    }

    [HttpGet("list")]
    public async Task<ActionResult<DirectoryListingDto>> ListDirectory(string hostId, [FromQuery] string path = "/")
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var res = await _sftpService.ListDirectoryAsync(host, path);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("read")]
    public async Task<ActionResult<FileContentDto>> ReadFile(string hostId, [FromQuery] string path)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        if (string.IsNullOrWhiteSpace(path)) return BadRequest(new { error = "Path is required" });

        try
        {
            var res = await _sftpService.ReadFileAsync(host, path);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("write")]
    public async Task<ActionResult> WriteFile(string hostId, [FromBody] SaveFileRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            await _sftpService.WriteFileAsync(host, request.Path, request.Content);
            return Ok(new { success = true, path = request.Path });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("create-folder")]
    public async Task<ActionResult> CreateFolder(string hostId, [FromBody] CreateEntryRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            await _sftpService.CreateDirectoryAsync(host, request.Path);
            return Ok(new { success = true, path = request.Path });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("create-file")]
    public async Task<ActionResult> CreateFile(string hostId, [FromBody] CreateEntryRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            await _sftpService.CreateFileAsync(host, request.Path);
            return Ok(new { success = true, path = request.Path });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete]
    public async Task<ActionResult> DeleteEntry(string hostId, [FromQuery] string path)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            await _sftpService.DeleteAsync(host, path);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("rename")]
    public async Task<ActionResult> RenameEntry(string hostId, [FromBody] RenameEntryRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            await _sftpService.RenameAsync(host, request.OldPath, request.NewPath);
            return Ok(new { success = true, newPath = request.NewPath });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("stream")]
    public async Task<IActionResult> StreamFile(string hostId, [FromQuery] string path, [FromQuery] bool download = false)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var (stream, contentType, fileName) = await _sftpService.OpenReadStreamAsync(host, path);
            if (download)
            {
                return File(stream, "application/octet-stream", fileName);
            }
            return File(stream, contentType);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("upload")]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100MB limit
    public async Task<ActionResult> UploadFile(string hostId, [FromQuery] string targetDir, IFormFile file)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "File is empty" });
        }

        try
        {
            var destination = Path.Combine(targetDir.Replace('\\', '/'), file.FileName).Replace('\\', '/');
            using var stream = file.OpenReadStream();
            await _sftpService.UploadAsync(host, destination, stream);
            return Ok(new { success = true, path = destination, size = file.Length });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("direct-transfer")]
    public async Task<ActionResult<DirectTransferResponse>> DirectTransfer(
        string hostId,
        [FromBody] DirectTransferRequest request,
        [FromServices] IDirectTransferService transferService)
    {
        var res = await transferService.TransferDirectAsync(request with { SourceHostId = hostId });
        return Ok(res);
    }

    [HttpGet("disk-usage")]
    public async Task<ActionResult<DiskUsageResultDto>> GetDiskUsage(
        string hostId,
        [FromQuery] string path = "/",
        [FromQuery] string? exclude = "/proc,/sys,/mnt,/dev",
        [FromQuery] int depth = 1)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        var normalizedPath = string.IsNullOrWhiteSpace(path) ? "/" : path.Trim();
        if (!normalizedPath.StartsWith('/')) normalizedPath = "/" + normalizedPath;
        if (normalizedPath.Length > 1 && normalizedPath.EndsWith('/')) normalizedPath = normalizedPath.TrimEnd('/');

        var clampedDepth = Math.Clamp(depth, 1, 2);

        var excludeSb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(exclude))
        {
            var items = exclude.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var item in items)
            {
                excludeSb.Append($" --exclude={EscapeBashArg(item)}");
            }
        }

        // du command with -k (KiB), specified depth, excludes, and path
        var cmd = _cmdRegistry.GetCommand("Files.DiskUsage", new
        {
            depth = clampedDepth,
            excludes = excludeSb.ToString(),
            path = EscapeBashArg(normalizedPath)
        });
        var timeout = _cmdRegistry.GetTimeout("Files.DiskUsage", 45);

        try
        {
            var result = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
            var lines = result.Output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

            var rawItems = new List<(long sizeKb, string entryPath)>();
            long? totalSizeKb = null;

            foreach (var line in lines)
            {
                var tabIdx = line.IndexOf('\t');
                if (tabIdx <= 0) continue;

                var sizeStr = line[..tabIdx].Trim();
                var entryPath = line[(tabIdx + 1)..].Trim();

                if (!long.TryParse(sizeStr, out var sizeKb)) continue;

                // Normalize entry path
                if (entryPath.Length > 1 && entryPath.EndsWith('/'))
                {
                    entryPath = entryPath.TrimEnd('/');
                }

                if (string.Equals(entryPath, normalizedPath, StringComparison.OrdinalIgnoreCase))
                {
                    totalSizeKb = sizeKb;
                }
                else
                {
                    rawItems.Add((sizeKb, entryPath));
                }
            }

            // Fallback total size to sum of subdirectories if not directly parsed
            var totalBytes = (totalSizeKb ?? (rawItems.Count > 0 ? rawItems.Sum(r => r.sizeKb) : 0L)) * 1024L;

            var itemsList = new List<DiskUsageItemDto>();
            foreach (var (sizeKb, entryPath) in rawItems)
            {
                var sizeBytes = sizeKb * 1024L;
                var name = Path.GetFileName(entryPath);
                if (string.IsNullOrEmpty(name)) name = entryPath;

                var percent = totalBytes > 0 ? Math.Round((double)sizeBytes / totalBytes * 100, 1) : 0;
                
                var pathSegments = entryPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                var rootSegments = normalizedPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                var itemDepth = Math.Max(1, pathSegments.Length - rootSegments.Length);

                itemsList.Add(new DiskUsageItemDto(entryPath, name, sizeBytes, percent, itemDepth));
            }

            // Sort by size descending
            itemsList.Sort((a, b) => b.SizeBytes.CompareTo(a.SizeBytes));

            return Ok(new DiskUsageResultDto(normalizedPath, totalBytes, itemsList));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Failed to calculate disk usage: {ex.Message}" });
        }
    }

    [HttpPost("archive")]
    public async Task<ActionResult> ArchiveFiles(string hostId, [FromBody] ArchiveFilesRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { error = "At least one item must be selected for compression" });
        }

        var dirPath = string.IsNullOrWhiteSpace(request.Path) ? "/" : request.Path.Trim();
        var format = (request.Format ?? "zip").ToLowerInvariant();
        var archiveName = string.IsNullOrWhiteSpace(request.ArchiveName) ? "archive" : request.ArchiveName.Trim();

        if (format == "zip")
        {
            if (!archiveName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                archiveName += ".zip";
            }
        }
        else if (format == "tar.gz")
        {
            if (!archiveName.EndsWith(".tar.gz", StringComparison.OrdinalIgnoreCase) &&
                !archiveName.EndsWith(".tgz", StringComparison.OrdinalIgnoreCase))
            {
                archiveName += ".tar.gz";
            }
        }
        else
        {
            return BadRequest(new { error = "Unsupported format. Use 'zip' or 'tar.gz'." });
        }

        var itemsEscaped = string.Join(" ", request.Items.Select(EscapeBashArg));
        string cmd;
        int timeout;

        if (format == "zip")
        {
            cmd = _cmdRegistry.GetCommand("Files.ArchiveZip", new { dirPath = EscapeBashArg(dirPath), archiveName = EscapeBashArg(archiveName), items = itemsEscaped });
            timeout = _cmdRegistry.GetTimeout("Files.ArchiveZip", 120);
        }
        else
        {
            cmd = _cmdRegistry.GetCommand("Files.ArchiveTar", new { dirPath = EscapeBashArg(dirPath), archiveName = EscapeBashArg(archiveName), items = itemsEscaped });
            timeout = _cmdRegistry.GetTimeout("Files.ArchiveTar", 120);
        }

        try
        {
            var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
            if (exitCode != 0)
            {
                if (error.Contains("zip: command not found") || error.Contains("zip: not found"))
                {
                    return BadRequest(new { error = "The 'zip' command is not installed on the server. Please install it (e.g. 'apt install zip') or use 'tar.gz' format." });
                }
                return BadRequest(new { error = !string.IsNullOrWhiteSpace(error) ? error.Trim() : output.Trim() });
            }

            var archivePath = dirPath == "/" ? $"/{archiveName}" : $"{dirPath}/{archiveName}";
            return Ok(new { success = true, archivePath });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Archiving failed: {ex.Message}" });
        }
    }

    [HttpPost("extract")]
    public async Task<ActionResult> ExtractArchive(string hostId, [FromBody] ExtractArchiveRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        if (string.IsNullOrWhiteSpace(request.ArchivePath))
        {
            return BadRequest(new { error = "ArchivePath is required" });
        }

        var destPath = string.IsNullOrWhiteSpace(request.DestinationPath) ? "/" : request.DestinationPath.Trim();
        var fileName = Path.GetFileName(request.ArchivePath).ToLowerInvariant();

        string cmd;
        int timeout;
        if (fileName.EndsWith(".zip"))
        {
            cmd = _cmdRegistry.GetCommand("Files.ExtractZip", new { destPath = EscapeBashArg(destPath), archivePath = EscapeBashArg(request.ArchivePath) });
            timeout = _cmdRegistry.GetTimeout("Files.ExtractZip", 120);
        }
        else if (fileName.EndsWith(".tar.gz") || fileName.EndsWith(".tgz"))
        {
            cmd = _cmdRegistry.GetCommand("Files.ExtractTarGz", new { destPath = EscapeBashArg(destPath), archivePath = EscapeBashArg(request.ArchivePath) });
            timeout = _cmdRegistry.GetTimeout("Files.ExtractTarGz", 120);
        }
        else if (fileName.EndsWith(".tar.bz2") || fileName.EndsWith(".tbz2"))
        {
            cmd = _cmdRegistry.GetCommand("Files.ExtractTarBz2", new { destPath = EscapeBashArg(destPath), archivePath = EscapeBashArg(request.ArchivePath) });
            timeout = _cmdRegistry.GetTimeout("Files.ExtractTarBz2", 120);
        }
        else if (fileName.EndsWith(".tar"))
        {
            cmd = _cmdRegistry.GetCommand("Files.ExtractTar", new { destPath = EscapeBashArg(destPath), archivePath = EscapeBashArg(request.ArchivePath) });
            timeout = _cmdRegistry.GetTimeout("Files.ExtractTar", 120);
        }
        else
        {
            return BadRequest(new { error = "Unsupported archive format. Supported formats: .zip, .tar.gz, .tgz, .tar, .tar.bz2" });
        }

        try
        {
            var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
            if (exitCode != 0)
            {
                if (error.Contains("unzip: command not found") || error.Contains("unzip: not found"))
                {
                    return BadRequest(new { error = "The 'unzip' utility is not installed on the remote server. Please install it (e.g. 'apt install unzip')." });
                }
                return BadRequest(new { error = !string.IsNullOrWhiteSpace(error) ? error.Trim() : output.Trim() });
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Extraction failed: {ex.Message}" });
        }
    }
}
