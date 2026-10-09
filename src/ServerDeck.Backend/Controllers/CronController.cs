using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

public record CreateCronJobRequest(string Schedule, string Command, string? Comment, bool IsEnabled = true);
public record UpdateCronJobRequest(string Schedule, string Command, string? Comment, bool IsEnabled = true);
public record SaveRawCrontabRequest(string Content);
public record RunCronCommandRequest(string Command);

[ApiController]
[Authorize]
[Route("api/hosts/{hostId}/cron")]
public class CronController : ControllerBase
{
    private readonly ICronService _cronService;
    private readonly ILogger<CronController> _logger;

    public CronController(ICronService cronService, ILogger<CronController> logger)
    {
        _cronService = cronService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetJobs(string hostId)
    {
        try
        {
            var jobs = await _cronService.GetCronJobsAsync(hostId);
            return Ok(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load cron jobs for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("raw")]
    public async Task<IActionResult> GetRaw(string hostId)
    {
        try
        {
            var raw = await _cronService.GetRawCrontabAsync(hostId);
            return Ok(new { content = raw });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load raw crontab for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("raw")]
    public async Task<IActionResult> SaveRaw(string hostId, [FromBody] SaveRawCrontabRequest req)
    {
        try
        {
            await _cronService.SaveRawCrontabAsync(hostId, req.Content);
            return Ok(new { message = "Crontab updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save raw crontab for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddJob(string hostId, [FromBody] CreateCronJobRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Schedule) || string.IsNullOrWhiteSpace(req.Command))
            {
                return BadRequest(new { error = "Schedule and command cannot be empty" });
            }

            var job = await _cronService.AddCronJobAsync(hostId, req.Schedule, req.Command, req.Comment ?? "", req.IsEnabled);
            return Ok(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add cron job for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{lineIndex:int}")]
    public async Task<IActionResult> UpdateJob(string hostId, int lineIndex, [FromBody] UpdateCronJobRequest req)
    {
        try
        {
            var job = await _cronService.UpdateCronJobAsync(hostId, lineIndex, req.Schedule, req.Command, req.Comment ?? "", req.IsEnabled);
            return Ok(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update cron job for host {HostId} at line {LineIndex}", hostId, lineIndex);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{lineIndex:int}")]
    public async Task<IActionResult> DeleteJob(string hostId, int lineIndex)
    {
        try
        {
            await _cronService.DeleteCronJobAsync(hostId, lineIndex);
            return Ok(new { message = "Cron job deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete cron job for host {HostId} at line {LineIndex}", hostId, lineIndex);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{lineIndex:int}/toggle")]
    public async Task<IActionResult> ToggleJob(string hostId, int lineIndex)
    {
        try
        {
            var job = await _cronService.ToggleCronJobAsync(hostId, lineIndex);
            return Ok(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to toggle cron job for host {HostId} at line {LineIndex}", hostId, lineIndex);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("run")]
    public async Task<IActionResult> RunJob(string hostId, [FromBody] RunCronCommandRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Command))
            {
                return BadRequest(new { error = "Command cannot be empty" });
            }

            var result = await _cronService.RunCronCommandAsync(hostId, req.Command);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run cron test command for host {HostId}", hostId);
            return BadRequest(new { error = ex.Message });
        }
    }
}
