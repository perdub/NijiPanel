using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NijiPanel.Backend.Models;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommandsController : ControllerBase
{
    private readonly ICommandRegistry _commandRegistry;
    private readonly ILogger<CommandsController> _logger;

    public CommandsController(ICommandRegistry commandRegistry, ILogger<CommandsController> logger)
    {
        _commandRegistry = commandRegistry;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<CommandTemplateDto>>> GetAllCommands()
    {
        var list = await _commandRegistry.GetAllAsync();
        return Ok(list);
    }

    [HttpGet("{key}")]
    public async Task<ActionResult<CommandTemplateDto>> GetCommand(string key)
    {
        var cmd = await _commandRegistry.GetByKeyAsync(key);
        if (cmd == null) return NotFound(new { error = $"Command template '{key}' not found" });
        return Ok(cmd);
    }

    [HttpPut("{key}")]
    public async Task<ActionResult<CommandTemplateDto>> UpdateCommand(string key, [FromBody] UpdateCommandTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Command))
        {
            return BadRequest(new { error = "Command content cannot be empty" });
        }

        var success = await _commandRegistry.UpdateCommandAsync(key, request.Command, request.TimeoutSeconds, request.Description);
        if (!success)
        {
            return NotFound(new { error = $"Command template '{key}' not found" });
        }

        var updated = await _commandRegistry.GetByKeyAsync(key);
        return Ok(updated);
    }

    [HttpPost("reset")]
    public async Task<ActionResult> ResetCommands()
    {
        try
        {
            await _commandRegistry.ResetToDefaultsAsync();
            return Ok(new { success = true, message = "All commands reset to default configuration from commands.json" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reset command templates to defaults");
            return BadRequest(new { error = ex.Message });
        }
    }
}
