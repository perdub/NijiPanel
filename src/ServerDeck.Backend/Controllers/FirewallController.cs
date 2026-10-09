using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/hosts/{hostId}/[controller]")]
[Authorize]
public class FirewallController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly IFirewallService _firewallService;

    public FirewallController(IHostService hostService, IFirewallService firewallService)
    {
        _hostService = hostService;
        _firewallService = firewallService;
    }

    [HttpGet("rules")]
    public async Task<ActionResult<FirewallStatusDto>> GetRules(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        var status = await _firewallService.GetRulesAsync(host);
        return Ok(status);
    }

    [HttpPost("rules")]
    public async Task<ActionResult<FirewallOperationResult>> AddRule(string hostId, [FromBody] CreateFirewallRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Port))
        {
            return BadRequest(new { error = "Port is required" });
        }

        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        var result = await _firewallService.AddRuleAsync(host, request);
        return Ok(result);
    }

    [HttpDelete("rules/{ruleNumber:int}")]
    public async Task<ActionResult<FirewallOperationResult>> DeleteRule(string hostId, int ruleNumber)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        var result = await _firewallService.DeleteRuleAsync(host, ruleNumber);
        return Ok(result);
    }

    [HttpGet("fail2ban")]
    public async Task<ActionResult<Fail2banStatusDto>> GetFail2banStatus(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        var status = await _firewallService.GetFail2banStatusAsync(host);
        return Ok(status);
    }

    [HttpPost("fail2ban/unban")]
    public async Task<ActionResult<FirewallOperationResult>> UnbanIp(string hostId, [FromBody] UnbanIpRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Ip))
        {
            return BadRequest(new { error = "IP address is required" });
        }

        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return NotFound(new { error = "Host not found" });

        var result = await _firewallService.UnbanIpAsync(host, request.Ip, request.Jail);
        return Ok(result);
    }
}
