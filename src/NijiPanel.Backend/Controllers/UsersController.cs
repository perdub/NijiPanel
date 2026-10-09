using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/hosts/{hostId}/users")]
public class UsersController : ControllerBase
{
    private readonly ILinuxUserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(ILinuxUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<LinuxUserDto>>> GetUsers(string hostId)
    {
        try
        {
            var users = await _userService.GetUsersAsync(hostId);
            return Ok(users);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get users for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<LinuxUserActionResult>> CreateUser(
        string hostId,
        [FromBody] CreateLinuxUserRequest request)
    {
        try
        {
            var result = await _userService.CreateUserAsync(hostId, request);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create user on host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{username}/lock")]
    public async Task<ActionResult<LinuxUserActionResult>> LockUser(string hostId, string username)
    {
        try
        {
            var result = await _userService.LockUserAsync(hostId, username);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to lock user {Username} on host {HostId}", username, hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{username}/unlock")]
    public async Task<ActionResult<LinuxUserActionResult>> UnlockUser(string hostId, string username)
    {
        try
        {
            var result = await _userService.UnlockUserAsync(hostId, username);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to unlock user {Username} on host {HostId}", username, hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{username}/toggle-sudo")]
    public async Task<ActionResult<LinuxUserActionResult>> ToggleSudo(string hostId, string username)
    {
        try
        {
            var result = await _userService.ToggleSudoAsync(hostId, username);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to toggle sudo for user {Username} on host {HostId}", username, hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{username}")]
    public async Task<ActionResult<LinuxUserActionResult>> DeleteUser(
        string hostId,
        string username,
        [FromQuery] bool removeHome = true)
    {
        try
        {
            var result = await _userService.DeleteUserAsync(hostId, username, removeHome);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete user {Username} on host {HostId}", username, hostId);
            return BadRequest(new { error = ex.Message });
        }
    }
}
