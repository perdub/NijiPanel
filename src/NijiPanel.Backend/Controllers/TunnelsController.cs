using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}/tunnels")]
[Authorize]
public class TunnelsController : ControllerBase
{
    private readonly ITunnelService _tunnelService;

    public TunnelsController(ITunnelService tunnelService)
    {
        _tunnelService = tunnelService;
    }

    [HttpGet]
    public async Task<ActionResult<List<SshTunnelDto>>> GetTunnels(string hostId)
    {
        var tunnels = await _tunnelService.GetTunnelsAsync(hostId);
        return Ok(tunnels);
    }

    [HttpPost]
    public async Task<ActionResult<SshTunnelDto>> CreateTunnel(string hostId, [FromBody] CreateSshTunnelRequest request)
    {
        if (request.LocalPort <= 0 || request.RemotePort <= 0 || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { error = "Valid ports and name are required" });
        }

        var tunnel = await _tunnelService.CreateTunnelAsync(hostId, request);
        return Ok(tunnel);
    }

    [HttpDelete("{tunnelId}")]
    public async Task<ActionResult> DeleteTunnel(string hostId, string tunnelId)
    {
        var deleted = await _tunnelService.DeleteTunnelAsync(tunnelId, hostId);
        return Ok(new { success = deleted });
    }

    [HttpPost("{tunnelId}/start")]
    public async Task<ActionResult> StartTunnel(string hostId, string tunnelId)
    {
        var (success, error) = await _tunnelService.StartTunnelAsync(tunnelId, hostId);
        return Ok(new { success, error });
    }

    [HttpPost("{tunnelId}/stop")]
    public async Task<ActionResult> StopTunnel(string hostId, string tunnelId)
    {
        var stopped = await _tunnelService.StopTunnelAsync(tunnelId, hostId);
        return Ok(new { success = stopped });
    }
}
