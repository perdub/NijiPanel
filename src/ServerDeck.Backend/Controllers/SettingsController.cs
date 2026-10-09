using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;

    public SettingsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("master-key")]
    public ActionResult<MasterKeyDto> GetMasterKey()
    {
        return Ok(_settingsService.GetMasterKey());
    }

    [HttpPost("master-key/regenerate")]
    public ActionResult<MasterKeyDto> RegenerateMasterKey([FromQuery] int bits = 4096)
    {
        if (bits < 2048 || bits > 8192) bits = 4096;
        var key = _settingsService.RegenerateMasterKey(bits);
        return Ok(key);
    }

    [HttpGet("bootstrap-script")]
    public ActionResult<object> GetBootstrapScript()
    {
        var script = _settingsService.GetSetting("host_provision_bootstrap_script") ?? "";
        var enabled = _settingsService.GetSetting("host_provision_bootstrap_enabled") == "true";
        return Ok(new { script, enabled });
    }

    [HttpPost("bootstrap-script")]
    public ActionResult<object> SetBootstrapScript([FromBody] BootstrapScriptRequest request)
    {
        _settingsService.SetSetting("host_provision_bootstrap_script", request.Script ?? "");
        _settingsService.SetSetting("host_provision_bootstrap_enabled", request.Enabled ? "true" : "false");
        return Ok(new { success = true });
    }
}

public record BootstrapScriptRequest(string? Script, bool Enabled);
