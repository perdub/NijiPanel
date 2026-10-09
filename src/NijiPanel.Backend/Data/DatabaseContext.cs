using Microsoft.Data.Sqlite;
using NijiPanel.Backend.Services;

namespace NijiPanel.Backend.Data;

public class DatabaseContext
{
    private readonly string _connectionString;

    public DatabaseContext(IConfiguration configuration)
    {
        var dbPath = configuration["DATABASE_PATH"];
        if (string.IsNullOrWhiteSpace(dbPath))
        {
            var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
            Directory.CreateDirectory(dataDir);
            dbPath = Path.Combine(dataDir, "servers.db");
        }
        else
        {
            var dir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
        }

        _connectionString = $"Data Source={dbPath};";
        InitializeDatabase();
    }

    public SqliteConnection CreateConnection()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        return connection;
    }

    private void InitializeDatabase()
    {
        using var conn = CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                username TEXT NOT NULL,
                auth_type TEXT NOT NULL, /* 'password', 'key', 'global_key' */
                credential_encrypted TEXT,
                passphrase_encrypted TEXT,
                notes TEXT,
                tags TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS host_ports (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                port INTEGER NOT NULL,
                protocol TEXT NOT NULL DEFAULT 'tcp',
                service_name TEXT NOT NULL,
                description TEXT,
                FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS host_notes (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ssh_tunnels (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                name TEXT NOT NULL,
                local_port INTEGER NOT NULL,
                remote_host TEXT NOT NULL DEFAULT '127.0.0.1',
                remote_port INTEGER NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS shared_files (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                download_count INTEGER NOT NULL DEFAULT 0,
                max_downloads INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                password_hash TEXT,
                FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                host_id TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'info', /* 'info', 'warning', 'error' */
                created_at TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS passkeys (
                id TEXT PRIMARY KEY, /* base64url credentialId */
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                public_key TEXT NOT NULL,
                counter INTEGER NOT NULL DEFAULT 0,
                credential_type TEXT NOT NULL DEFAULT 'public-key',
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS command_templates (
                key TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                command TEXT NOT NULL,
                description TEXT,
                timeout_seconds INTEGER NOT NULL DEFAULT 30,
                is_custom INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
        ";
        cmd.ExecuteNonQuery();

        try
        {
            using var alterCmd = conn.CreateCommand();
            alterCmd.CommandText = "ALTER TABLE shared_files ADD COLUMN password_hash TEXT;";
            alterCmd.ExecuteNonQuery();
        }
        catch
        {
            // Column already exists or table newly created
        }

        SeedCommandTemplates(conn);
    }

    private void SeedCommandTemplates(SqliteConnection conn)
    {
        using var stream = EmbeddedAssetsManager.GetCommandsJsonStream();
        if (stream == null) return;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(stream);
            var now = DateTime.UtcNow.ToString("o");

            using var tx = conn.BeginTransaction();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var key = el.GetProperty("key").GetString();
                if (string.IsNullOrEmpty(key)) continue;

                var category = el.TryGetProperty("category", out var c) ? c.GetString() ?? "General" : "General";
                var command = el.TryGetProperty("command", out var cmdEl) ? cmdEl.GetString() ?? "" : "";
                var desc = el.TryGetProperty("description", out var d) ? d.GetString() : null;
                var timeout = el.TryGetProperty("timeoutSeconds", out var t) ? t.GetInt32() : 30;

                using var insertCmd = conn.CreateCommand();
                insertCmd.Transaction = tx;
                insertCmd.CommandText = @"
                    INSERT OR IGNORE INTO command_templates (key, category, command, description, timeout_seconds, is_custom, updated_at)
                    VALUES ($key, $cat, $cmd, $desc, $timeout, 0, $now);
                ";
                insertCmd.Parameters.AddWithValue("$key", key);
                insertCmd.Parameters.AddWithValue("$cat", category);
                insertCmd.Parameters.AddWithValue("$cmd", command);
                insertCmd.Parameters.AddWithValue("$desc", (object?)desc ?? DBNull.Value);
                insertCmd.Parameters.AddWithValue("$timeout", timeout);
                insertCmd.Parameters.AddWithValue("$now", now);
                insertCmd.ExecuteNonQuery();
            }
            tx.Commit();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DatabaseContext] Warning: Failed to seed command templates: {ex.Message}");
        }
    }
}
