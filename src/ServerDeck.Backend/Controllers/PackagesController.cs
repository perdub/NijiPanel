using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/hosts/{hostId}/packages")]
public class PackagesController : ControllerBase
{
    private readonly IPackageUpdateService _packageService;
    private readonly ILogger<PackagesController> _logger;

    public PackagesController(IPackageUpdateService packageService, ILogger<PackagesController> logger)
    {
        _packageService = packageService;
        _logger = logger;
    }

    [HttpGet("check")]
    public async Task<ActionResult<PackageUpdateCheckResult>> CheckUpdates(string hostId)
    {
        try
        {
            var result = await _packageService.CheckUpdatesAsync(hostId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check package updates for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("upgrade")]
    public async Task<ActionResult<PackageUpgradeResult>> RunUpgrade(string hostId)
    {
        try
        {
            var result = await _packageService.RunUpgradeAsync(hostId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run package upgrade on host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }
}
