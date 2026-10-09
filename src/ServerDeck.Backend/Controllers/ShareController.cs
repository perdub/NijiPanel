using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
public class ShareController : ControllerBase
{
    private readonly IFileShareService _shareService;
    private readonly ISftpService _sftpService;

    public ShareController(IFileShareService shareService, ISftpService sftpService)
    {
        _shareService = shareService;
        _sftpService = sftpService;
    }

    [Authorize]
    [HttpPost("api/hosts/{hostId}/files/share")]
    public async Task<ActionResult<SharedFileDto>> CreateShareLink(
        string hostId,
        [FromBody] CreateShareLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FilePath))
        {
            return BadRequest(new { error = "FilePath is required" });
        }

        try
        {
            var res = await _shareService.CreateShareLinkAsync(
                hostId,
                request.FilePath,
                request.ExpireDays,
                request.MaxDownloads
            );
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("api/hosts/{hostId}/files/shares")]
    public async Task<ActionResult<List<SharedFileDto>>> ListShares(string hostId)
    {
        var list = await _shareService.ListSharedFilesAsync(hostId);
        return Ok(list);
    }

    [Authorize]
    [HttpDelete("api/shares/{token}")]
    public async Task<ActionResult> RevokeShare(string token)
    {
        var success = await _shareService.RevokeShareLinkAsync(token);
        return Ok(new { success });
    }

    // Public download endpoint - zero authentication required!
    [AllowAnonymous]
    [HttpGet("d/{token}")]
    public async Task<IActionResult> DownloadSharedFile(string token)
    {
        var validated = await _shareService.ValidateAndRecordDownloadAsync(token);
        if (validated == null)
        {
            return NotFound(new { error = "Ссылка не найдена, истек срок действия или исчерпан лимит скачиваний." });
        }

        var (host, filePath, fileName) = validated.Value;

        try
        {
            var (stream, contentType, _) = await _sftpService.OpenReadStreamAsync(host, filePath);
            return File(stream, contentType, fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Ошибка чтения файла с сервера: {ex.Message}" });
        }
    }
}
