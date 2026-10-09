using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
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

    [HttpGet("api/hosts/{hostId}/docker/containers")]
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

    [HttpGet("api/hosts/{hostId}/docker/containers/{containerId}")]
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

    [HttpGet("api/hosts/{hostId}/docker/containers/{containerId}/crash-dump")]
    public async Task<ActionResult<ContainerCrashDumpDto>> GetCrashDump(string hostId, string containerId)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var dump = await _dockerService.GetCrashDumpAsync(host, containerId);
            return Ok(dump);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("api/hosts/{hostId}/docker/containers/{containerId}/action")]
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

    [HttpGet("api/hosts/{hostId}/docker/containers/{containerId}/logs")]
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

    // --- TASK 1: APP STORE TEMPLATES & DOCKER HUB ---

    [HttpGet("api/hosts/{hostId}/docker/templates")]
    public async Task<ActionResult<List<AppTemplateDto>>> GetTemplates(string hostId)
    {
        var templates = await _dockerService.GetTemplatesAsync();
        return Ok(templates);
    }

    [HttpPost("api/hosts/{hostId}/docker/templates/deploy")]
    public async Task<ActionResult<DeployTemplateResponse>> DeployTemplate(string hostId, [FromBody] DeployTemplateRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var res = await _dockerService.DeployTemplateAsync(host, request);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("api/docker/hub-search")]
    [HttpGet("api/hosts/{hostId}/docker/hub-search")]
    public async Task<ActionResult<DockerHubSearchResponse>> SearchHub([FromQuery] string? q)
    {
        try
        {
            var res = await _dockerService.SearchDockerHubAsync(q ?? "");
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // --- TASK 3: SMART DOCKER PRUNE ---

    [HttpGet("api/hosts/{hostId}/docker/prune/preview")]
    public async Task<ActionResult<DockerPrunePreviewResponse>> GetPrunePreview(string hostId)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var preview = await _dockerService.GetPrunePreviewAsync(host);
            return Ok(preview);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("api/hosts/{hostId}/docker/prune/execute")]
    public async Task<ActionResult<DockerPruneExecuteResponse>> ExecutePrune(string hostId, [FromBody] DockerPruneExecuteRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var result = await _dockerService.ExecutePruneAsync(host, request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
