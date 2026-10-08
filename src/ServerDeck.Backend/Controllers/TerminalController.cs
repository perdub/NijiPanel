using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TerminalController : ControllerBase
{
    private readonly ITerminalSessionManager _terminalManager;

    public TerminalController(ITerminalSessionManager terminalManager)
    {
        _terminalManager = terminalManager;
    }

    [HttpDelete("sessions/{sessionId}")]
    public ActionResult CloseSession(string sessionId)
    {
        _terminalManager.CloseSession(sessionId);
        return Ok(new { success = true });
    }
}
