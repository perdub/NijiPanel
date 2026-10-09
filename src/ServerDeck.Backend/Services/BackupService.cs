using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ServerDeck.Backend.Data;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public record BackupPackage(
    string Magic,
    int Version,
    string Salt,
    string Nonce,
    string Tag,
    string Data
);

public record CloudExportResponse(
    string ShareUrl,
    string ShareCode,
    string Passphrase
);

public record CloudImportRequest(
    string ShareCodeOrUrl,
    string Passphrase
);

public interface IBackupService
{
    Task<string> ExportEncryptedBackupAsync(string passphrase);
    Task<int> ImportEncryptedBackupAsync(string backupJson, string passphrase);
    Task<CloudExportResponse> ExportToCloudAsync(string? customPassphrase = null);
    Task<int> ImportFromCloudAsync(CloudImportRequest request);
}

public class BackupService : IBackupService
{
    private readonly DatabaseContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private const string MagicHeader = "SERVERDECK_ENCRYPTED_BACKUP";

    public BackupService(DatabaseContext dbContext, IHttpClientFactory httpClientFactory)
    {
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<string> ExportEncryptedBackupAsync(string passphrase)
    {
        if (string.IsNullOrWhiteSpace(passphrase))
        {
            throw new ArgumentException("Passphrase cannot be empty");
        }

        // Gather all state from SQLite
        var backupDict = new Dictionary<string, object>();

        using (var conn = _dbContext.CreateConnection())
        {
            // Hosts
            var hosts = new List<Dictionary<string, object?>>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT id, name, host, port, username, auth_type, credential_encrypted, passphrase_encrypted, notes, tags, created_at FROM hosts;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    hosts.Add(new Dictionary<string, object?>
                    {
                        ["id"] = reader.GetString(0),
                        ["name"] = reader.GetString(1),
                        ["host"] = reader.GetString(2),
                        ["port"] = reader.GetInt32(3),
                        ["username"] = reader.GetString(4),
                        ["auth_type"] = reader.GetString(5),
                        ["credential_encrypted"] = reader.IsDBNull(6) ? null : reader.GetString(6),
                        ["passphrase_encrypted"] = reader.IsDBNull(7) ? null : reader.GetString(7),
                        ["notes"] = reader.IsDBNull(8) ? null : reader.GetString(8),
                        ["tags"] = reader.IsDBNull(9) ? null : reader.GetString(9),
                        ["created_at"] = reader.GetString(10),
                    });
                }
            }
            backupDict["hosts"] = hosts;

            // Settings
            var settings = new Dictionary<string, string>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT key, value FROM settings;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    settings[reader.GetString(0)] = reader.GetString(1);
                }
            }
            backupDict["settings"] = settings;

            // Host Ports
            var ports = new List<Dictionary<string, object?>>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT id, host_id, port, protocol, service_name, description FROM host_ports;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    ports.Add(new Dictionary<string, object?>
                    {
                        ["id"] = reader.GetString(0),
                        ["host_id"] = reader.GetString(1),
                        ["port"] = reader.GetInt32(2),
                        ["protocol"] = reader.GetString(3),
                        ["service_name"] = reader.GetString(4),
                        ["description"] = reader.IsDBNull(5) ? null : reader.GetString(5),
                    });
                }
            }
            backupDict["host_ports"] = ports;

            // Host Notes
            var notes = new List<Dictionary<string, object?>>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT id, host_id, title, content, updated_at FROM host_notes;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    notes.Add(new Dictionary<string, object?>
                    {
                        ["id"] = reader.GetString(0),
                        ["host_id"] = reader.GetString(1),
                        ["title"] = reader.GetString(2),
                        ["content"] = reader.GetString(3),
                        ["updated_at"] = reader.GetString(4),
                    });
                }
            }
            backupDict["host_notes"] = notes;

            // SSH Tunnels
            var tunnels = new List<Dictionary<string, object?>>();
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT id, host_id, name, local_port, remote_host, remote_port FROM ssh_tunnels;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    tunnels.Add(new Dictionary<string, object?>
                    {
                        ["id"] = reader.GetString(0),
                        ["host_id"] = reader.GetString(1),
                        ["name"] = reader.GetString(2),
                        ["local_port"] = reader.GetInt32(3),
                        ["remote_host"] = reader.GetString(4),
                        ["remote_port"] = reader.GetInt32(5),
                    });
                }
            }
            backupDict["ssh_tunnels"] = tunnels;
        }

        var json = JsonSerializer.Serialize(backupDict);
        var plainBytes = Encoding.UTF8.GetBytes(json);

        // Derive AES-256 key from passphrase with PBKDF2
        var salt = new byte[16];
        RandomNumberGenerator.Fill(salt);

        var key = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(passphrase),
            salt,
            iterations: 100_000,
            hashAlgorithm: HashAlgorithmName.SHA256,
            outputLength: 32);

        var nonce = new byte[12];
        RandomNumberGenerator.Fill(nonce);

        var tag = new byte[16];
        var cipher = new byte[plainBytes.Length];

        using (var aesGcm = new AesGcm(key, 16))
        {
            aesGcm.Encrypt(nonce, plainBytes, cipher, tag);
        }

        var pkg = new BackupPackage(
            MagicHeader,
            1,
            Convert.ToBase64String(salt),
            Convert.ToBase64String(nonce),
            Convert.ToBase64String(tag),
            Convert.ToBase64String(cipher)
        );

        return JsonSerializer.Serialize(pkg);
    }

    public async Task<int> ImportEncryptedBackupAsync(string backupJson, string passphrase)
    {
        var pkg = JsonSerializer.Deserialize<BackupPackage>(backupJson)
            ?? throw new ArgumentException("Invalid backup package format");

        if (pkg.Magic != MagicHeader)
        {
            throw new ArgumentException("Unrecognized backup signature");
        }

        var salt = Convert.FromBase64String(pkg.Salt);
        var nonce = Convert.FromBase64String(pkg.Nonce);
        var tag = Convert.FromBase64String(pkg.Tag);
        var cipher = Convert.FromBase64String(pkg.Data);

        var key = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(passphrase),
            salt,
            iterations: 100_000,
            hashAlgorithm: HashAlgorithmName.SHA256,
            outputLength: 32);

        var plainBytes = new byte[cipher.Length];
        using (var aesGcm = new AesGcm(key, 16))
        {
            aesGcm.Decrypt(nonce, cipher, tag, plainBytes);
        }

        var json = Encoding.UTF8.GetString(plainBytes);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        int importedCount = 0;

        using var conn = _dbContext.CreateConnection();
        using var trans = conn.BeginTransaction();

        // Import Settings
        if (root.TryGetProperty("settings", out var settingsEl))
        {
            foreach (var prop in settingsEl.EnumerateObject())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = trans;
                cmd.CommandText = @"
                    INSERT INTO settings (key, value) VALUES ($key, $val)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                ";
                cmd.Parameters.AddWithValue("$key", prop.Name);
                cmd.Parameters.AddWithValue("$val", prop.Value.GetString() ?? "");
                cmd.ExecuteNonQuery();
            }
        }

        // Import Hosts
        if (root.TryGetProperty("hosts", out var hostsEl))
        {
            foreach (var h in hostsEl.EnumerateArray())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = trans;
                cmd.CommandText = @"
                    INSERT INTO hosts (id, name, host, port, username, auth_type, credential_encrypted, passphrase_encrypted, notes, tags, created_at)
                    VALUES ($id, $name, $host, $port, $user, $auth, $cred, $pass, $notes, $tags, $created)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        host = excluded.host,
                        port = excluded.port,
                        username = excluded.username,
                        auth_type = excluded.auth_type,
                        credential_encrypted = excluded.credential_encrypted,
                        passphrase_encrypted = excluded.passphrase_encrypted,
                        notes = excluded.notes,
                        tags = excluded.tags;
                ";
                cmd.Parameters.AddWithValue("$id", h.GetProperty("id").GetString() ?? Guid.NewGuid().ToString());
                cmd.Parameters.AddWithValue("$name", h.GetProperty("name").GetString() ?? "");
                cmd.Parameters.AddWithValue("$host", h.GetProperty("host").GetString() ?? "");
                cmd.Parameters.AddWithValue("$port", h.GetProperty("port").GetInt32());
                cmd.Parameters.AddWithValue("$user", h.GetProperty("username").GetString() ?? "root");
                cmd.Parameters.AddWithValue("$auth", h.GetProperty("auth_type").GetString() ?? "global_key");
                cmd.Parameters.AddWithValue("$cred", h.TryGetProperty("credential_encrypted", out var c) && c.ValueKind != JsonValueKind.Null ? c.GetString() : (object)DBNull.Value);
                cmd.Parameters.AddWithValue("$pass", h.TryGetProperty("passphrase_encrypted", out var p) && p.ValueKind != JsonValueKind.Null ? p.GetString() : (object)DBNull.Value);
                cmd.Parameters.AddWithValue("$notes", h.TryGetProperty("notes", out var n) && n.ValueKind != JsonValueKind.Null ? n.GetString() : (object)DBNull.Value);
                cmd.Parameters.AddWithValue("$tags", h.TryGetProperty("tags", out var t) && t.ValueKind != JsonValueKind.Null ? t.GetString() : (object)DBNull.Value);
                cmd.Parameters.AddWithValue("$created", h.TryGetProperty("created_at", out var cr) && cr.ValueKind != JsonValueKind.Null ? cr.GetString() : DateTime.UtcNow.ToString("o"));
                cmd.ExecuteNonQuery();
                importedCount++;
            }
        }

        // Import Ports
        if (root.TryGetProperty("host_ports", out var portsEl))
        {
            foreach (var port in portsEl.EnumerateArray())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = trans;
                cmd.CommandText = @"
                    INSERT INTO host_ports (id, host_id, port, protocol, service_name, description)
                    VALUES ($id, $host_id, $port, $protocol, $service_name, $description)
                    ON CONFLICT(id) DO UPDATE SET
                        port = excluded.port,
                        protocol = excluded.protocol,
                        service_name = excluded.service_name,
                        description = excluded.description;
                ";
                cmd.Parameters.AddWithValue("$id", port.GetProperty("id").GetString() ?? Guid.NewGuid().ToString());
                cmd.Parameters.AddWithValue("$host_id", port.GetProperty("host_id").GetString() ?? "");
                cmd.Parameters.AddWithValue("$port", port.GetProperty("port").GetInt32());
                cmd.Parameters.AddWithValue("$protocol", port.GetProperty("protocol").GetString() ?? "tcp");
                cmd.Parameters.AddWithValue("$service_name", port.GetProperty("service_name").GetString() ?? "");
                cmd.Parameters.AddWithValue("$description", port.TryGetProperty("description", out var d) && d.ValueKind != JsonValueKind.Null ? d.GetString() : (object)DBNull.Value);
                cmd.ExecuteNonQuery();
            }
        }

        // Import Notes
        if (root.TryGetProperty("host_notes", out var notesEl))
        {
            foreach (var note in notesEl.EnumerateArray())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = trans;
                cmd.CommandText = @"
                    INSERT INTO host_notes (id, host_id, title, content, updated_at)
                    VALUES ($id, $host_id, $title, $content, $updated_at)
                    ON CONFLICT(id) DO UPDATE SET
                        title = excluded.title,
                        content = excluded.content,
                        updated_at = excluded.updated_at;
                ";
                cmd.Parameters.AddWithValue("$id", note.GetProperty("id").GetString() ?? Guid.NewGuid().ToString());
                cmd.Parameters.AddWithValue("$host_id", note.GetProperty("host_id").GetString() ?? "");
                cmd.Parameters.AddWithValue("$title", note.GetProperty("title").GetString() ?? "");
                cmd.Parameters.AddWithValue("$content", note.GetProperty("content").GetString() ?? "");
                cmd.Parameters.AddWithValue("$updated_at", note.GetProperty("updated_at").GetString() ?? DateTime.UtcNow.ToString("o"));
                cmd.ExecuteNonQuery();
            }
        }

        trans.Commit();
        return importedCount;
    }

    public async Task<CloudExportResponse> ExportToCloudAsync(string? customPassphrase = null)
    {
        var pass = string.IsNullOrWhiteSpace(customPassphrase)
            ? GenerateRandomSecret(24)
            : customPassphrase.Trim();

        var encryptedJson = await ExportEncryptedBackupAsync(pass);

        // Upload to anonymous encrypted paste service
        var client = _httpClientFactory.CreateClient();
        
        // Try paste.rs first
        string shareUrl = "";
        try
        {
            var content = new StringContent(encryptedJson, Encoding.UTF8, "text/plain");
            var res = await client.PostAsync("https://paste.rs", content);
            if (res.IsSuccessStatusCode)
            {
                shareUrl = (await res.Content.ReadAsStringAsync()).Trim();
            }
        }
        catch { }

        // Fallback to dpaste.org if paste.rs fails
        if (string.IsNullOrEmpty(shareUrl))
        {
            var form = new Dictionary<string, string>
            {
                ["content"] = encryptedJson,
                ["expiry_days"] = "14",
                ["syntax"] = "text",
            };
            var res = await client.PostAsync("https://dpaste.org/api/", new FormUrlEncodedContent(form));
            res.EnsureSuccessStatusCode();
            shareUrl = (await res.Content.ReadAsStringAsync()).Trim().Trim('"');
        }

        // Short code extraction
        var shareCode = shareUrl.TrimEnd('/').Split('/').Last();

        return new CloudExportResponse(shareUrl, shareCode, pass);
    }

    public async Task<int> ImportFromCloudAsync(CloudImportRequest request)
    {
        var targetUrl = request.ShareCodeOrUrl.Trim();
        if (!targetUrl.StartsWith("http://") && !targetUrl.StartsWith("https://"))
        {
            // If just code, assume paste.rs or dpaste
            targetUrl = $"https://paste.rs/{targetUrl}";
        }

        var client = _httpClientFactory.CreateClient();
        var res = await client.GetAsync(targetUrl);

        if (!res.IsSuccessStatusCode)
        {
            // Try dpaste /raw if code failed on paste.rs
            if (!targetUrl.Contains("/raw"))
            {
                var dpasteUrl = targetUrl + "/raw";
                var dpasteRes = await client.GetAsync(dpasteUrl);
                if (dpasteRes.IsSuccessStatusCode)
                {
                    res = dpasteRes;
                }
            }
        }

        res.EnsureSuccessStatusCode();
        var encryptedJson = await res.Content.ReadAsStringAsync();

        return await ImportEncryptedBackupAsync(encryptedJson.Trim(), request.Passphrase.Trim());
    }

    private static string GenerateRandomSecret(int length)
    {
        const string pool = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(length);
        foreach (var b in bytes)
        {
            sb.Append(pool[b % pool.Length]);
        }
        return sb.ToString();
    }
}
