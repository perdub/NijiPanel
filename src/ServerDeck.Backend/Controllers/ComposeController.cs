using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}/compose")]
[Authorize]
public class ComposeController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly IDockerService _dockerService;

    public ComposeController(IHostService hostService, IDockerService dockerService)
    {
        _hostService = hostService;
        _dockerService = dockerService;
    }

    private async Task<HostEntity?> GetHostOrNotFoundAsync(string hostId)
    {
        return await _hostService.GetHostEntityAsync(hostId);
    }

    [HttpGet("projects")]
    public async Task<ActionResult<List<ComposeProjectDto>>> GetProjects(string hostId, [FromQuery] string? customDir = null)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var projects = await _dockerService.FindComposeProjectsAsync(host, customDir);
            return Ok(projects);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("action")]
    public async Task<ActionResult<ComposeActionResponse>> ExecuteAction(string hostId, [FromBody] ComposeActionRequest request)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        if (string.IsNullOrWhiteSpace(request.FilePath))
        {
            return BadRequest(new { error = "FilePath is required" });
        }

        try
        {
            var res = await _dockerService.ExecuteComposeActionAsync(host, request.FilePath, request.Action);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("logs")]
    public async Task<ActionResult> GetLogs(string hostId, [FromQuery] string filePath, [FromQuery] int tail = 200)
    {
        var host = await GetHostOrNotFoundAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return BadRequest(new { error = "FilePath is required" });
        }

        try
        {
            var logs = await _dockerService.GetComposeLogsAsync(host, filePath, tail);
            return Ok(new { logs });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
