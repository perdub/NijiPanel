using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/auth/[controller]")]
public class PasskeyController : ControllerBase
{
    private readonly IPasskeyService _passkeyService;

    public PasskeyController(IPasskeyService passkeyService)
    {
        _passkeyService = passkeyService;
    }

    [Authorize]
    [HttpPost("register/challenge")]
    public ActionResult<PasskeyRegisterChallengeResponse> RegisterChallenge()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var username = User.Identity?.Name ?? "admin";
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var rpId = Request.Host.Host;
        var response = _passkeyService.CreateRegisterChallenge(userId, username, rpId);
        return Ok(response);
    }

    [Authorize]
    [HttpPost("register/verify")]
    public async Task<ActionResult<PasskeyDto>> RegisterVerify([FromBody] PasskeyRegisterVerifyRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        try
        {
            var result = await _passkeyService.VerifyAndRegisterPasskeyAsync(userId, request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("login/challenge")]
    public ActionResult<PasskeyLoginChallengeResponse> LoginChallenge()
    {
        var rpId = Request.Host.Host;
        var response = _passkeyService.CreateLoginChallenge(rpId);
        return Ok(response);
    }

    [HttpPost("login/verify")]
    public async Task<ActionResult<AuthResponse>> LoginVerify([FromBody] PasskeyLoginVerifyRequest request)
    {
        try
        {
            var response = await _passkeyService.VerifyAndLoginPasskeyAsync(request);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("list")]
    public async Task<ActionResult<List<PasskeyDto>>> ListPasskeys()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var passkeys = await _passkeyService.GetUserPasskeysAsync(userId);
        return Ok(passkeys);
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePasskey(string id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var success = await _passkeyService.DeletePasskeyAsync(userId, id);
        return Ok(new { success });
    }
}
