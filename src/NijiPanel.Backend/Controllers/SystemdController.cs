using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/hosts/{hostId}/systemd")]
public class SystemdController : ControllerBase
{
    private readonly ISystemdService _systemdService;
    private readonly ILogger<SystemdController> _logger;

    public SystemdController(ISystemdService systemdService, ILogger<SystemdController> logger)
    {
        _systemdService = systemdService;
        _logger = logger;
    }

    [HttpGet("services")]
    public async Task<ActionResult<List<SystemdServiceDto>>> GetServices(string hostId)
    {
        try
        {
            var services = await _systemdService.GetServicesAsync(hostId);
            return Ok(services);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get systemd services for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("services/{unitName}/action")]
    public async Task<ActionResult<SystemdActionResult>> ExecuteAction(
        string hostId,
        string unitName,
        [FromBody] SystemdActionRequest request)
    {
        try
        {
            var result = await _systemdService.ExecuteActionAsync(hostId, unitName, request.Action);
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
            _logger.LogError(ex, "Failed to execute action {Action} on unit {Unit} for host {HostId}", request.Action, unitName, hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("services/{unitName}/logs")]
    public async Task<ActionResult> GetLogs(
        string hostId,
        string unitName,
        [FromQuery] int lines = 100,
        [FromQuery] string? priority = null)
    {
        try
        {
            var logs = await _systemdService.GetLogsAsync(hostId, unitName, lines, priority);
            return Ok(new { logs });
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
            _logger.LogError(ex, "Failed to get logs for unit {Unit} on host {HostId}", unitName, hostId);
            return BadRequest(new { error = ex.Message });
        }
    }
}
