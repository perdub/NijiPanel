using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}/files")]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly ISftpService _sftpService;

    public FilesController(IHostService hostService, ISftpService sftpService)
    {
        _hostService = hostService;
        _sftpService = sftpService;
    }

    private async Task<HostEntity?> GetHostOrNotFoundAsync(string hostId)
    {
        return await _hostService.GetHostEntityAsync(hostId);
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
}
