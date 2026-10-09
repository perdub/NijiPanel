using Microsoft.Data.Sqlite;

namespace ServerDeck.Backend.Data;

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
                FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE CASCADE
            );
        ";
        cmd.ExecuteNonQuery();
    }
}
