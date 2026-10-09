using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HostsController : ControllerBase
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly IMetricsHistoryService _metricsService;
    private readonly IBenchmarkService _benchmarkService;
    private readonly ISettingsService _settingsService;
    private readonly INotificationService _notificationService;
    private readonly IHostNetworkService _networkService;
    private readonly ILogger<HostsController> _logger;

    public HostsController(
        IHostService hostService,
        ISshConnectionManager sshManager,
        IMetricsHistoryService metricsService,
        IBenchmarkService benchmarkService,
        ISettingsService settingsService,
        INotificationService notificationService,
        IHostNetworkService networkService,
        ILogger<HostsController> logger)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _metricsService = metricsService;
        _benchmarkService = benchmarkService;
        _settingsService = settingsService;
        _notificationService = notificationService;
        _networkService = networkService;
        _logger = logger;
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

        // Auto-run bootstrap provisioning script on new host if enabled
        var bootstrapEnabled = _settingsService.GetSetting("host_provision_bootstrap_enabled") == "true";
        var bootstrapScript = _settingsService.GetSetting("host_provision_bootstrap_script");

        if (bootstrapEnabled && !string.IsNullOrWhiteSpace(bootstrapScript))
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var hostEntity = await _hostService.GetHostEntityAsync(created.Id);
                    if (hostEntity != null)
                    {
                        var sanitizedScript = bootstrapScript.Replace("\r\n", "\n");
                        var cmdResult = await _sshManager.RunCommandAsync(hostEntity, sanitizedScript, 300);
                        
                        await _notificationService.CreateNotificationAsync(
                            $"Bootstrap completed for {created.Name}",
                            $"Provisioning packages/setup script completed successfully.\nExit code: {cmdResult.ExitCode}",
                            cmdResult.ExitCode == 0 ? "info" : "warning",
                            created.Id
                        );
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Bootstrap execution failed for host {HostId}", created.Id);
                    await _notificationService.CreateNotificationAsync(
                        $"Bootstrap failed for {created.Name}",
                        $"Error executing provisioning script: {ex.Message}",
                        "error",
                        created.Id
                    );
                }
            });
        }

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

    [HttpGet("{id}/network")]
    public async Task<ActionResult<HostNetworkInfoDto>> GetHostNetwork(string id)
    {
        var host = await _hostService.GetHostEntityAsync(id);
        if (host == null) return NotFound(new { error = "Host not found" });

        try
        {
            var info = await _networkService.GetHostNetworkInfoAsync(host);
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve network info for host {HostId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("inspect-network")]
    public async Task<ActionResult<HostNetworkInfoDto>> InspectNetwork([FromBody] InspectNetworkRequest request)
    {
        try
        {
            var info = await _networkService.InspectNetworkAsync(
                request.Host,
                request.Port,
                request.Username,
                request.AuthType,
                request.Credential,
                request.Passphrase
            );
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to inspect network for host {Host}", request.Host);
            return BadRequest(new { error = ex.Message });
        }
    }
}
