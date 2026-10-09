using System.Text;
using System.Text.Json;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface INotificationService
{
    Task<NotificationListResponse> GetNotificationsAsync();
    Task<NotificationDto> CreateNotificationAsync(string title, string message, string severity = "info", string? hostId = null);
    Task<bool> MarkAsReadAsync(string id);
    Task MarkAllAsReadAsync();
    Task<bool> DeleteNotificationAsync(string id);
    Task ClearAllAsync();
    AlertSettingsDto GetAlertSettings();
    void SaveAlertSettings(AlertSettingsDto settings);
    Task<TestAlertResult> SendTestAlertAsync(TestAlertRequest request);
    Task SendExternalAlertAsync(string title, string message, string severity, string? hostName = null);
}

public class NotificationService : INotificationService
{
    private readonly DatabaseContext _dbContext;
    private readonly ISettingsService _settingsService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<NotificationService> _logger;

    public const string SettingTelegramBotToken = "alert_telegram_bot_token";
    public const string SettingTelegramChatId = "alert_telegram_chat_id";
    public const string SettingWebhookUrl = "alert_webhook_url";
    public const string SettingAlertsEnabled = "alert_external_enabled";

    public NotificationService(
        DatabaseContext dbContext,
        ISettingsService settingsService,
        IHttpClientFactory httpClientFactory,
        ILogger<NotificationService> logger)
    {
        _dbContext = dbContext;
        _settingsService = settingsService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<NotificationListResponse> GetNotificationsAsync()
    {
        var list = new List<NotificationDto>();
        int unreadCount = 0;

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT id, host_id, title, message, severity, created_at, is_read
            FROM notifications
            ORDER BY created_at DESC
            LIMIT 100;
        ";

        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var isRead = reader.GetInt32(6) == 1;
            if (!isRead) unreadCount++;

            list.Add(new NotificationDto(
                reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                DateTime.Parse(reader.GetString(5)),
                isRead
            ));
        }

        return new NotificationListResponse(list, unreadCount);
    }

    public async Task<NotificationDto> CreateNotificationAsync(string title, string message, string severity = "info", string? hostId = null)
    {
        var id = Guid.NewGuid().ToString();
        var now = DateTime.UtcNow;
        var validSeverity = severity.ToLowerInvariant() switch
        {
            "warning" => "warning",
            "error" => "error",
            _ => "info"
        };

        using (var conn = _dbContext.CreateConnection())
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO notifications (id, host_id, title, message, severity, created_at, is_read)
                VALUES ($id, $host_id, $title, $message, $severity, $created_at, 0);
            ";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.Parameters.AddWithValue("$host_id", (object?)hostId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$title", title);
            cmd.Parameters.AddWithValue("$message", message);
            cmd.Parameters.AddWithValue("$severity", validSeverity);
            cmd.Parameters.AddWithValue("$created_at", now.ToString("o"));
            await cmd.ExecuteNonQueryAsync();
        }

        // Fire & forget external alerts dispatch
        _ = Task.Run(async () =>
        {
            try
            {
                await SendExternalAlertAsync(title, message, validSeverity, hostId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to dispatch external alert for {Title}", title);
            }
        });

        return new NotificationDto(id, hostId, title, message, validSeverity, now, false);
    }

    public async Task<bool> MarkAsReadAsync(string id)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE notifications SET is_read = 1 WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        var rows = await cmd.ExecuteNonQueryAsync();
        return rows > 0;
    }

    public async Task MarkAllAsReadAsync()
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE notifications SET is_read = 1;";
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<bool> DeleteNotificationAsync(string id)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM notifications WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        var rows = await cmd.ExecuteNonQueryAsync();
        return rows > 0;
    }

    public async Task ClearAllAsync()
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM notifications;";
        await cmd.ExecuteNonQueryAsync();
    }

    public AlertSettingsDto GetAlertSettings()
    {
        var token = _settingsService.GetSetting(SettingTelegramBotToken);
        var chatId = _settingsService.GetSetting(SettingTelegramChatId);
        var webhook = _settingsService.GetSetting(SettingWebhookUrl);
        var enabled = _settingsService.GetSetting(SettingAlertsEnabled) == "true";

        return new AlertSettingsDto(token, chatId, webhook, enabled);
    }

    public void SaveAlertSettings(AlertSettingsDto settings)
    {
        _settingsService.SetSetting(SettingTelegramBotToken, settings.TelegramBotToken?.Trim() ?? "");
        _settingsService.SetSetting(SettingTelegramChatId, settings.TelegramChatId?.Trim() ?? "");
        _settingsService.SetSetting(SettingWebhookUrl, settings.WebhookUrl?.Trim() ?? "");
        _settingsService.SetSetting(SettingAlertsEnabled, settings.AlertsEnabled ? "true" : "false");
    }

    public async Task SendExternalAlertAsync(string title, string message, string severity, string? hostName = null)
    {
        var settings = GetAlertSettings();
        if (!settings.AlertsEnabled) return;

        var client = _httpClientFactory.CreateClient();

        // 1. Send Telegram Alert
        if (!string.IsNullOrWhiteSpace(settings.TelegramBotToken) && !string.IsNullOrWhiteSpace(settings.TelegramChatId))
        {
            try
            {
                var icon = severity switch
                {
                    "error" => "🛑",
                    "warning" => "⚠️",
                    _ => "ℹ️"
                };
                var hostPrefix = !string.IsNullOrEmpty(hostName) ? $"[{hostName}] " : "";
                var tgText = $"{icon} *NijiPanel Alert*\n*{hostPrefix}{EscapeMarkdown(title)}*\n{EscapeMarkdown(message)}\n\n_Time: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC_";

                var payload = new
                {
                    chat_id = settings.TelegramChatId.Trim(),
                    text = tgText,
                    parse_mode = "Markdown"
                };

                var url = $"https://api.telegram.org/bot{settings.TelegramBotToken.Trim()}/sendMessage";
                var response = await client.PostAsync(url, new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
                if (!response.IsSuccessStatusCode)
                {
                    var respText = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Telegram dispatch returned status {StatusCode}: {Response}", response.StatusCode, respText);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error dispatching Telegram alert");
            }
        }

        // 2. Send Webhook Alert
        if (!string.IsNullOrWhiteSpace(settings.WebhookUrl))
        {
            try
            {
                var webhookPayload = new
                {
                    @event = "alert",
                    source = "NijiPanel",
                    title = title,
                    message = message,
                    severity = severity,
                    host = hostName,
                    timestamp = DateTime.UtcNow.ToString("o")
                };

                await client.PostAsync(
                    settings.WebhookUrl.Trim(),
                    new StringContent(JsonSerializer.Serialize(webhookPayload), Encoding.UTF8, "application/json")
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error dispatching Webhook alert to {Url}", settings.WebhookUrl);
            }
        }
    }

    public async Task<TestAlertResult> SendTestAlertAsync(TestAlertRequest request)
    {
        var client = _httpClientFactory.CreateClient();
        bool tgSuccess = false;
        string? tgError = null;
        bool hookSuccess = false;
        string? hookError = null;

        var token = !string.IsNullOrWhiteSpace(request.TelegramBotToken)
            ? request.TelegramBotToken.Trim()
            : _settingsService.GetSetting(SettingTelegramBotToken);

        var chatId = !string.IsNullOrWhiteSpace(request.TelegramChatId)
            ? request.TelegramChatId.Trim()
            : _settingsService.GetSetting(SettingTelegramChatId);

        var webhookUrl = !string.IsNullOrWhiteSpace(request.WebhookUrl)
            ? request.WebhookUrl.Trim()
            : _settingsService.GetSetting(SettingWebhookUrl);

        // Test Telegram
        if (!string.IsNullOrWhiteSpace(token) && !string.IsNullOrWhiteSpace(chatId))
        {
            try
            {
                var tgText = "🔔 *NijiPanel Test Alert*\n\nExternal notifications are working correctly from your NijiPanel instance!\n\n_Time: " + DateTime.UtcNow.ToString("u") + "_";
                var payload = new
                {
                    chat_id = chatId,
                    text = tgText,
                    parse_mode = "Markdown"
                };

                var url = $"https://api.telegram.org/bot{token}/sendMessage";
                var response = await client.PostAsync(url, new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
                if (response.IsSuccessStatusCode)
                {
                    tgSuccess = true;
                }
                else
                {
                    tgError = await response.Content.ReadAsStringAsync();
                }
            }
            catch (Exception ex)
            {
                tgError = ex.Message;
            }
        }
        else
        {
            tgError = "Telegram bot token or chat ID is not configured.";
        }

        // Test Webhook
        if (!string.IsNullOrWhiteSpace(webhookUrl))
        {
            try
            {
                var webhookPayload = new
                {
                    @event = "test",
                    source = "NijiPanel",
                    title = "NijiPanel Test Alert",
                    message = "External webhook integration is active.",
                    severity = "info",
                    timestamp = DateTime.UtcNow.ToString("o")
                };

                var response = await client.PostAsync(webhookUrl, new StringContent(JsonSerializer.Serialize(webhookPayload), Encoding.UTF8, "application/json"));
                if (response.IsSuccessStatusCode)
                {
                    hookSuccess = true;
                }
                else
                {
                    hookError = $"HTTP {(int)response.StatusCode}: {response.ReasonPhrase}";
                }
            }
            catch (Exception ex)
            {
                hookError = ex.Message;
            }
        }
        else
        {
            hookError = "Webhook URL is not configured.";
        }

        return new TestAlertResult(tgSuccess, tgError, hookSuccess, hookError);
    }

    private static string EscapeMarkdown(string text)
    {
        return text
            .Replace("_", "\\_")
            .Replace("*", "\\*")
            .Replace("[", "\\[")
            .Replace("]", "\\]")
            .Replace("`", "\\`");
    }
}
