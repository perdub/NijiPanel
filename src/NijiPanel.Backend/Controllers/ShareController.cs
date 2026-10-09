using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

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
    [HttpPost("api/share")]
    public async Task<ActionResult<SharedFileDto>> CreateShareLinkRoot([FromBody] CreateShareLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HostId))
        {
            return BadRequest(new { error = "HostId is required" });
        }
        if (string.IsNullOrWhiteSpace(request.FilePath))
        {
            return BadRequest(new { error = "FilePath is required" });
        }

        try
        {
            var res = await _shareService.CreateShareLinkAsync(
                request.HostId,
                request.FilePath,
                request.ExpireHours,
                request.ExpireDays,
                request.MaxDownloads,
                request.Password
            );
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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
                request.ExpireHours,
                request.ExpireDays,
                request.MaxDownloads,
                request.Password
            );
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("api/share/host/{hostId}")]
    public async Task<ActionResult<List<SharedFileDto>>> ListSharesByHost(string hostId)
    {
        var list = await _shareService.ListSharedFilesAsync(hostId);
        return Ok(list);
    }

    [Authorize]
    [HttpGet("api/hosts/{hostId}/files/shares")]
    public async Task<ActionResult<List<SharedFileDto>>> ListShares(string hostId)
    {
        var list = await _shareService.ListSharedFilesAsync(hostId);
        return Ok(list);
    }

    [Authorize]
    [HttpDelete("api/share/{id}")]
    public async Task<ActionResult> RevokeShareById(string id)
    {
        var success = await _shareService.RevokeShareLinkAsync(id);
        return Ok(new { success });
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
    public async Task<IActionResult> DownloadSharedFile(
        string token,
        [FromQuery] string? password = null,
        [FromHeader(Name = "X-Share-Password")] string? headerPassword = null)
    {
        var effectivePassword = password ?? headerPassword;
        var validation = await _shareService.ValidateAndRecordDownloadAsync(token, effectivePassword);

        var acceptsHtml = Request.Headers.Accept.ToString().Contains("text/html");

        switch (validation.Status)
        {
            case ShareValidationStatus.PasswordRequired:
                if (acceptsHtml)
                {
                    return Content(RenderPasswordPromptHtml(token, false), "text/html", Encoding.UTF8);
                }
                return Unauthorized(new { error = "Password is required to access this file." });

            case ShareValidationStatus.InvalidPassword:
                if (acceptsHtml)
                {
                    return Content(RenderPasswordPromptHtml(token, true), "text/html", Encoding.UTF8);
                }
                return Unauthorized(new { error = "Invalid password." });

            case ShareValidationStatus.Expired:
                return NotFound(new { error = "This download link has expired." });

            case ShareValidationStatus.LimitReached:
                return NotFound(new { error = "The download limit for this link has been reached." });

            case ShareValidationStatus.NotFound:
                return NotFound(new { error = "Link not found or has been revoked." });

            case ShareValidationStatus.Ok:
                break;
        }

        var host = validation.Host!;
        var filePath = validation.FilePath!;
        var fileName = validation.FileName!;

        try
        {
            var (stream, contentType, _) = await _sftpService.OpenReadStreamAsync(host, filePath);
            return File(stream, contentType, fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Error reading file from remote host: {ex.Message}" });
        }
    }

    private static string RenderPasswordPromptHtml(string token, bool isInvalid)
    {
        var encodedToken = WebUtility.HtmlEncode(token);
        var errorMessageHtml = isInvalid
            ? "<div class=\"error-banner\">Incorrect password. Please try again.</div>"
            : "";

        return $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""utf-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Password Protected Download - NijiPanel</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0d0e12;
      color: #f4f4f4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'JetBrains Mono', monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }}
    .card {{
      background: #16171d;
      border: 1px solid #282a36;
      border-radius: 1rem;
      padding: 2.25rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      text-align: center;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 700;
      color: #ff7700;
      background: rgba(255, 119, 0, 0.12);
      border: 1px solid rgba(255, 119, 0, 0.3);
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      margin-bottom: 1.25rem;
    }}
    .icon {{
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
      user-select: none;
    }}
    h1 {{
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.35rem;
      color: #fff;
    }}
    p {{
      font-size: 0.85rem;
      color: #8d8d8d;
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }}
    .error-banner {{
      color: #ff6b6b;
      font-size: 0.8rem;
      margin-bottom: 1.25rem;
      background: rgba(255, 107, 107, 0.12);
      padding: 0.65rem;
      border-radius: 0.5rem;
      border: 1px solid rgba(255, 107, 107, 0.25);
    }}
    form {{
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }}
    input {{
      width: 100%;
      background: #20222a;
      border: 1px solid #353744;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s;
    }}
    input:focus {{
      border-color: #ff7700;
    }}
    button {{
      width: 100%;
      background: #ff7700;
      color: #0d0e12;
      font-weight: 700;
      border: none;
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.15s;
    }}
    button:hover {{
      background: #ff8c1a;
    }}
    .footer {{
      margin-top: 1.5rem;
      font-size: 0.7rem;
      color: #555;
    }}
  </style>
</head>
<body>
  <div class=""card"">
    <div class=""badge"">🔒 Protected Share</div>
    <div class=""icon"">🔐</div>
    <h1>Password Required</h1>
    <p>This file is protected by a password. Please enter the password to download.</p>
    {errorMessageHtml}
    <form method=""GET"" action=""/d/{encodedToken}"">
      <input type=""password"" name=""password"" placeholder=""Enter download password"" autofocus required />
      <button type=""submit"">Unlock & Download File</button>
    </form>
    <div class=""footer"">Powered by NijiPanel • Secure SFTP Storage</div>
  </div>
</body>
</html>";
    }
}
