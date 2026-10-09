using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HostsController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly IMetricsHistoryService _metricsService;
    private readonly IBenchmarkService _benchmarkService;

    public HostsController(
        IHostService hostService,
        ISshConnectionManager sshManager,
        IMetricsHistoryService metricsService,
        IBenchmarkService benchmarkService)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _metricsService = metricsService;
        _benchmarkService = benchmarkService;
    }

    [HttpGet]
    public async Task<ActionResult<List<HostDto>>> GetHosts()
    {
        var hosts = await _hostService.GetAllHostsAsync();
        return Ok(hosts);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<HostDto>> GetHost(string id)
    {
        var host = await _hostService.GetHostDtoAsync(id);
        if (host == null) return NotFound(new { error = "Host not found" });
        return Ok(host);
    }

    [HttpPost]
    public async Task<ActionResult<HostDto>> CreateHost([FromBody] CreateHostRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Host))
        {
            return BadRequest(new { error = "Name and Host address are required" });
        }

        var created = await _hostService.CreateHostAsync(request);
        return CreatedAtAction(nameof(GetHost), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<HostDto>> UpdateHost(string id, [FromBody] UpdateHostRequest request)
    {
        var updated = await _hostService.UpdateHostAsync(id, request);
        if (updated == null) return NotFound(new { error = "Host not found" });
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteHost(string id)
    {
        var deleted = await _hostService.DeleteHostAsync(id);
        if (!deleted) return NotFound(new { error = "Host not found" });
        return NoContent();
    }

    [HttpPost("{id}/test")]
    public async Task<ActionResult> TestConnection(string id)
    {
        var host = await _hostService.GetHostEntityAsync(id);
        if (host == null) return NotFound(new { error = "Host not found" });

        var (success, error) = await _sshManager.TestConnectionAsync(host);
        return Ok(new { success, error });
    }

    [HttpGet("{id}/stats")]
    public async Task<ActionResult<HostSystemStats>> GetHostStats(string id)
    {
        var host = await _hostService.GetHostEntityAsync(id);
        if (host == null) return NotFound(new { error = "Host not found" });

        var stats = await _sshManager.GetHostStatsAsync(host);
        if (stats.IsOnline)
        {
            _metricsService.RecordFromStats(id, stats);
        }
        return Ok(stats);
    }

    [HttpGet("{id}/metrics/history")]
    public async Task<ActionResult<HostMetricsHistoryResponse>> GetMetricsHistory(string id)
    {
        var host = await _hostService.GetHostEntityAsync(id);
        if (host == null) return NotFound(new { error = "Host not found" });

        HostSystemStats? stats = null;
        try
        {
            stats = await _sshManager.GetHostStatsAsync(host);
            if (stats.IsOnline)
            {
                _metricsService.RecordFromStats(id, stats);
            }
        }
        catch
        {
            // Ignore stats failure, fallback to existing buffer
        }

        var history = _metricsService.GetHistory(id, stats);
        return Ok(history);
    }

    [HttpPost("{id}/benchmark")]
    [HttpGet("{id}/benchmark")]
    public async Task<ActionResult<BenchmarkResultDto>> RunBenchmark(string id)
    {
        var host = await _hostService.GetHostEntityAsync(id);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var result = await _benchmarkService.RunBenchmarkAsync(host);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id}/randomize-port")]
    public async Task<ActionResult<RandomizePortResult>> RandomizePort(string id, [FromBody] RandomizePortRequest? request)
    {
        try
        {
            var result = await _hostService.RandomizeSshPortAsync(id, request?.TargetPort);
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
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
