using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpGet("status")]
    public ActionResult<AuthStatusResponse> GetStatus()
    {
        var isSetup = _authService.IsSetup();
        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var username = User.Identity?.Name;
        return Ok(new AuthStatusResponse(isSetup, isAuthenticated, username));
    }

    [HttpPost("setup")]
    public ActionResult<AuthResponse> Setup([FromBody] SetupRequest request)
    {
        try
        {
            var res = _authService.Setup(request.Username, request.Password);
            return Ok(res);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    public ActionResult<AuthResponse> Login([FromBody] LoginRequest request)
    {
        var res = _authService.Login(request.Username, request.Password);
        if (res == null)
        {
            return Unauthorized(new { error = "Invalid username or password" });
        }
        return Ok(res);
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult GetCurrentUser()
    {
        return Ok(new
        {
            username = User.Identity?.Name,
            id = User.FindFirstValue(ClaimTypes.NameIdentifier)
        });
    }

    [Authorize]
    [HttpPost("change-password")]
    public ActionResult ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username)) return Unauthorized();

        var success = _authService.ChangePassword(username, request.CurrentPassword, request.NewPassword);
        if (!success)
        {
            return BadRequest(new { error = "Current password is incorrect" });
        }

        return Ok(new { success = true, message = "Password changed successfully" });
    }
}
