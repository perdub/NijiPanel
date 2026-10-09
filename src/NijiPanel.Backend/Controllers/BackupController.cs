using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BackupController : ControllerBase
{
    private readonly IBackupService _backupService;

    public BackupController(IBackupService backupService)
    {
        _backupService = backupService;
    }

    [HttpPost("export")]
    public async Task<IActionResult> ExportFile([FromBody] ExportRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Passphrase))
        {
            return BadRequest(new { error = "Passphrase is required" });
        }

        try
        {
            var encryptedJson = await _backupService.ExportEncryptedBackupAsync(request.Passphrase);
            var bytes = Encoding.UTF8.GetBytes(encryptedJson);
            var filename = $"serverdeck-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.deck";
            return File(bytes, "application/octet-stream", filename);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("import")]
    public async Task<ActionResult> ImportFile([FromForm] IFormFile file, [FromForm] string passphrase)
    {
        if (file == null || file.Length == 0 || string.IsNullOrWhiteSpace(passphrase))
        {
            return BadRequest(new { error = "File and passphrase are required" });
        }

        try
        {
            using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8);
            var content = await reader.ReadToEndAsync();
            var count = await _backupService.ImportEncryptedBackupAsync(content, passphrase);
            return Ok(new { success = true, importedHosts = count });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("cloud/export")]
    public async Task<ActionResult<CloudExportResponse>> ExportToCloud([FromBody] CloudExportRequest? request)
    {
        try
        {
            var res = await _backupService.ExportToCloudAsync(request?.CustomPassphrase);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("cloud/import")]
    public async Task<ActionResult> ImportFromCloud([FromBody] CloudImportRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ShareCodeOrUrl) || string.IsNullOrWhiteSpace(request.Passphrase))
        {
            return BadRequest(new { error = "Share code and passphrase are required" });
        }

        try
        {
            var count = await _backupService.ImportFromCloudAsync(request);
            return Ok(new { success = true, importedHosts = count });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public record ExportRequest(string Passphrase);
public record CloudExportRequest(string? CustomPassphrase);
