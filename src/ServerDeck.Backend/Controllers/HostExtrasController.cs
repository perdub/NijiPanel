using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}")]
[Authorize]
public class HostExtrasController : ControllerBase
{
    private readonly IHostExtrasService _extrasService;

    public HostExtrasController(IHostExtrasService extrasService)
    {
        _extrasService = extrasService;
    }

    [HttpGet("ports")]
    public async Task<ActionResult<List<HostPortDto>>> GetPorts(string hostId)
    {
        var ports = await _extrasService.GetPortsAsync(hostId);
        return Ok(ports);
    }

    [HttpPost("ports")]
    public async Task<ActionResult<HostPortDto>> AddPort(string hostId, [FromBody] CreateHostPortRequest request)
    {
        if (request.Port <= 0 || request.Port > 65535 || string.IsNullOrWhiteSpace(request.ServiceName))
        {
            return BadRequest(new { error = "Valid port and service name are required" });
        }

        var created = await _extrasService.AddPortAsync(hostId, request);
        return Ok(created);
    }

    [HttpDelete("ports/{portId}")]
    public async Task<ActionResult> DeletePort(string hostId, string portId)
    {
        var deleted = await _extrasService.DeletePortAsync(portId);
        return Ok(new { success = deleted });
    }

    [HttpGet("note")]
    public async Task<ActionResult<HostNoteDto?>> GetNote(string hostId)
    {
        var note = await _extrasService.GetNoteAsync(hostId);
        return Ok(note ?? new HostNoteDto("", hostId, "Notes", "", DateTime.UtcNow));
    }

    [HttpPost("note")]
    public async Task<ActionResult<HostNoteDto>> SaveNote(string hostId, [FromBody] SaveHostNoteRequest request)
    {
        var saved = await _extrasService.SaveNoteAsync(hostId, request);
        return Ok(saved);
    }
}
