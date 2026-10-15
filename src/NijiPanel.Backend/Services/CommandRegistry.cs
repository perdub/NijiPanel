using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface ICommandRegistry
{
    string GetCommand(string key, object? parameters = null);
    int GetTimeout(string key, int defaultTimeout = 30);
    Task<List<CommandTemplateDto>> GetAllAsync();
    Task<CommandTemplateDto?> GetByKeyAsync(string key);
    Task<bool> UpdateCommandAsync(string key, string command, int? timeoutSeconds = null, string? description = null);
    Task ResetToDefaultsAsync();
}

public class CommandRegistry : ICommandRegistry
{
    private readonly DatabaseContext _db;
    private readonly ILogger<CommandRegistry> _logger;
    private readonly ConcurrentDictionary<string, CommandTemplateDto> _cache = new(StringComparer.OrdinalIgnoreCase);
    private bool _initialized = false;
    private readonly object _lock = new();

    public CommandRegistry(DatabaseContext db, ILogger<CommandRegistry> logger)
    {
        _db = db;
        _logger = logger;
        EnsureInitialized();
    }

    private void EnsureInitialized()
    {
        if (_initialized) return;

        lock (_lock)
        {
            if (_initialized) return;
            LoadFromDatabase();
            _initialized = true;
        }
    }

    private void LoadFromDatabase()
    {
        try
        {
            using var conn = _db.CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT key, category, command, description, timeout_seconds, is_custom, updated_at FROM command_templates;";
            using var reader = cmd.ExecuteReader();

            _cache.Clear();
            while (reader.Read())
            {
                var key = reader.GetString(0);
                var category = reader.GetString(1);
                var command = reader.GetString(2);
                var description = reader.IsDBNull(3) ? null : reader.GetString(3);
                var timeout = reader.GetInt32(4);
                var isCustom = reader.GetInt32(5) == 1;
                var updatedAt = DateTime.Parse(reader.GetString(6));

                var dto = new CommandTemplateDto(key, category, command, description, timeout, isCustom, updatedAt);
                _cache[key] = dto;
            }

            _logger.LogInformation("CommandRegistry loaded {Count} command templates from database.", _cache.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load command templates from database.");
        }
    }

    public string GetCommand(string key, object? parameters = null)
    {
        EnsureInitialized();

        if (!_cache.TryGetValue(key, out var template))
        {
            _logger.LogWarning("Command template '{Key}' not found in registry.", key);
            throw new KeyNotFoundException($"Command template '{key}' not found in registry.");
        }

        var cmd = template.Command;
        if (parameters == null) return cmd;

        // 1. Check if dictionary
        if (parameters is IDictionary<string, object> dict)
        {
            foreach (var (k, v) in dict)
            {
                cmd = ReplacePlaceholder(cmd, k, v?.ToString() ?? "");
            }
            return cmd;
        }

        if (parameters is IReadOnlyDictionary<string, string> strDict)
        {
            foreach (var (k, v) in strDict)
            {
                cmd = ReplacePlaceholder(cmd, k, v ?? "");
            }
            return cmd;
        }

        // 2. Reflect over anonymous object properties
        var props = parameters.GetType().GetProperties();
        foreach (var prop in props)
        {
            var val = prop.GetValue(parameters);
            cmd = ReplacePlaceholder(cmd, prop.Name, val?.ToString() ?? "");
        }

        return cmd;
    }

    public int GetTimeout(string key, int defaultTimeout = 30)
    {
        EnsureInitialized();
        if (_cache.TryGetValue(key, out var template) && template.TimeoutSeconds > 0)
        {
            return template.TimeoutSeconds;
        }
        return defaultTimeout;
    }

    public Task<List<CommandTemplateDto>> GetAllAsync()
    {
        EnsureInitialized();
        return Task.FromResult(_cache.Values.OrderBy(c => c.Category).ThenBy(c => c.Key).ToList());
    }

    public Task<CommandTemplateDto?> GetByKeyAsync(string key)
    {
        EnsureInitialized();
        _cache.TryGetValue(key, out var template);
        return Task.FromResult(template);
    }

    public async Task<bool> UpdateCommandAsync(string key, string command, int? timeoutSeconds = null, string? description = null)
    {
        EnsureInitialized();
        if (!_cache.TryGetValue(key, out var existing))
        {
            return false;
        }

        var newTimeout = timeoutSeconds ?? existing.TimeoutSeconds;
        var newDesc = description ?? existing.Description;
        var now = DateTime.UtcNow;

        using var conn = _db.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE command_templates
            SET command = $cmd, timeout_seconds = $timeout, description = $desc, is_custom = 1, updated_at = $now
            WHERE key = $key;
        ";
        cmd.Parameters.AddWithValue("$cmd", command);
        cmd.Parameters.AddWithValue("$timeout", newTimeout);
        cmd.Parameters.AddWithValue("$desc", (object?)newDesc ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$now", now.ToString("o"));
        cmd.Parameters.AddWithValue("$key", key);

        var rows = await cmd.ExecuteNonQueryAsync();
        if (rows > 0)
        {
            _cache[key] = new CommandTemplateDto(key, existing.Category, command, newDesc, newTimeout, true, now);
            return true;
        }

        return false;
    }

    public async Task ResetToDefaultsAsync()
    {
        using var stream = EmbeddedAssetsManager.GetCommandsJsonStream();
        if (stream == null)
        {
            throw new FileNotFoundException("commands.json configuration stream not found.");
        }

        using var doc = await JsonDocument.ParseAsync(stream);
        var now = DateTime.UtcNow.ToString("o");

        using var conn = _db.CreateConnection();
        using var tx = conn.BeginTransaction();

        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var key = el.GetProperty("key").GetString();
            if (string.IsNullOrEmpty(key)) continue;

            var category = el.TryGetProperty("category", out var c) ? c.GetString() ?? "General" : "General";
            var command = el.TryGetProperty("command", out var cmdEl) ? cmdEl.GetString() ?? "" : "";
            var desc = el.TryGetProperty("description", out var d) ? d.GetString() : null;
            var timeout = el.TryGetProperty("timeoutSeconds", out var t) ? t.GetInt32() : 30;

            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = @"
                INSERT INTO command_templates (key, category, command, description, timeout_seconds, is_custom, updated_at)
                VALUES ($key, $cat, $cmd, $desc, $timeout, 0, $now)
                ON CONFLICT(key) DO UPDATE SET
                    command = excluded.command,
                    description = excluded.description,
                    timeout_seconds = excluded.timeout_seconds,
                    is_custom = 0,
                    updated_at = excluded.updated_at;
            ";
            cmd.Parameters.AddWithValue("$key", key);
            cmd.Parameters.AddWithValue("$cat", category);
            cmd.Parameters.AddWithValue("$cmd", command);
            cmd.Parameters.AddWithValue("$desc", (object?)desc ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$timeout", timeout);
            cmd.Parameters.AddWithValue("$now", now);
            await cmd.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
        LoadFromDatabase();
    }

    private static string ReplacePlaceholder(string template, string placeholderName, string value)
    {
        return template.Replace($"{{{placeholderName}}}", value, StringComparison.OrdinalIgnoreCase);
    }
}
