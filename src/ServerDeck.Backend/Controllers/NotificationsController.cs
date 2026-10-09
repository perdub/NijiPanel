using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServerDeck.Backend.Models;
using ServerDeck.Backend.Services;

namespace ServerDeck.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<NotificationListResponse>> GetNotifications()
    {
        var response = await _notificationService.GetNotificationsAsync();
        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<NotificationDto>> CreateNotification([FromBody] CreateNotificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { error = "Title cannot be empty" });
        }

        var created = await _notificationService.CreateNotificationAsync(
            request.Title,
            request.Message,
            request.Severity,
            request.HostId
        );
        return Ok(created);
    }

    [HttpPost("{id}/read")]
    public async Task<ActionResult> MarkAsRead(string id)
    {
        var success = await _notificationService.MarkAsReadAsync(id);
        return Ok(new { success });
    }

    [HttpPost("read-all")]
    public async Task<ActionResult> MarkAllAsRead()
    {
        await _notificationService.MarkAllAsReadAsync();
        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteNotification(string id)
    {
        var success = await _notificationService.DeleteNotificationAsync(id);
        return Ok(new { success });
    }

    [HttpDelete("clear-all")]
    public async Task<ActionResult> ClearAll()
    {
        await _notificationService.ClearAllAsync();
        return Ok(new { success = true });
    }

    [HttpGet("settings")]
    public ActionResult<AlertSettingsDto> GetAlertSettings()
    {
        var settings = _notificationService.GetAlertSettings();
        return Ok(settings);
    }

    [HttpPost("settings")]
    public ActionResult SaveAlertSettings([FromBody] AlertSettingsDto settings)
    {
        _notificationService.SaveAlertSettings(settings);
        return Ok(new { success = true, message = "Alert settings saved" });
    }

    [HttpPost("test")]
    public async Task<ActionResult<TestAlertResult>> SendTestAlert([FromBody] TestAlertRequest request)
    {
        var result = await _notificationService.SendTestAlertAsync(request);
        return Ok(result);
    }
}
