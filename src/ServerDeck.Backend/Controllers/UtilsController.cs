using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UtilsController : ControllerBase
{
    private readonly IUtilsService _utilsService;
    private readonly ISettingsService _settingsService;

    public UtilsController(IUtilsService utilsService, ISettingsService settingsService)
    {
        _utilsService = utilsService;
        _settingsService = settingsService;
    }

    [HttpPost("generate-password")]
    public ActionResult GeneratePassword([FromBody] PasswordGenerateRequest request)
    {
        var pass = _utilsService.GeneratePassword(
            request.Length,
            request.IncludeSymbols,
            request.IncludeNumbers,
            request.IncludeUppercase);
        return Ok(new { password = pass });
    }

    [HttpPost("generate-ssh-key")]
    public ActionResult<SshKeyGenerateResponse> GenerateSshKey([FromBody] SshKeyGenerateRequest request)
    {
        var key = _utilsService.GenerateSshKey(request.Type, request.Bits, request.Comment ?? "serverdeck-key");
        return Ok(key);
    }

    [HttpGet("setup-command")]
    public ActionResult GetOneLinerSetupCommand([FromQuery] string? customPublicKey = null)
    {
        var pub = string.IsNullOrWhiteSpace(customPublicKey)
            ? _settingsService.GetMasterKey().PublicKey
            : customPublicKey;

        var cmd = _utilsService.GenerateOneLinerSetupCommand(pub);
        return Ok(new { command = cmd, publicKey = pub });
    }
}
