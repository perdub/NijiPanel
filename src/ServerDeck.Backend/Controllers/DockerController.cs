using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}/docker")]
[Authorize]
public class DockerController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly IDockerService _dockerService;

    public DockerController(IHostService hostService, IDockerService dockerService)
    {
        _hostService = hostService;
        _dockerService = dockerService;
    }

    private async Task<HostEntity?> GetHostOrNotFoundAsync(string hostId)
    {
        return await _hostService.GetHostEntityAsync(hostId);
    }

    [HttpGet("containers")]
    public async Task<ActionResult<List<ContainerDto>>> GetContainers(string hostId)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var containers = await _dockerService.GetContainersAsync(host);
            return Ok(containers);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("containers/{containerId}")]
    public async Task<ActionResult<ContainerInspectDto>> InspectContainer(string hostId, string containerId)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var details = await _dockerService.InspectContainerAsync(host, containerId);
            return Ok(details);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("containers/{containerId}/action")]
    public async Task<ActionResult> ExecuteAction(string hostId, string containerId, [FromBody] ContainerActionRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var (success, output, error) = await _dockerService.ExecuteActionAsync(host, containerId, request.Action);
            return Ok(new { success, output, error });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("containers/{containerId}/logs")]
    public async Task<ActionResult> GetLogs(string hostId, string containerId, [FromQuery] int tail = 200)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var logs = await _dockerService.GetLogsAsync(host, containerId, tail);
            return Ok(new { logs });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
