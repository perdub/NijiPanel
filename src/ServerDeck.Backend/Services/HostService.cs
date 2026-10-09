using ServerDeck.Backend.Data;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface IHostService
{
    Task<List<HostDto>> GetAllHostsAsync();
    Task<HostEntity?> GetHostEntityAsync(string id);
    Task<HostDto?> GetHostDtoAsync(string id);
    Task<HostDto> CreateHostAsync(CreateHostRequest request);
    Task<HostDto?> UpdateHostAsync(string id, UpdateHostRequest request);
    Task<bool> DeleteHostAsync(string id);
    Task<RandomizePortResult> RandomizeSshPortAsync(string hostId, int? desiredPort = null);
}

public class HostService : IHostService
{
    private readonly DatabaseContext _dbContext;
    private readonly IEncryptionService _encryptionService;
    private readonly ISshConnectionManager _sshManager;

    public HostService(
        DatabaseContext dbContext,
        IEncryptionService encryptionService,
        ISshConnectionManager sshManager)
    {
        _dbContext = dbContext;
        _encryptionService = encryptionService;
        _sshManager = sshManager;
    }

    public async Task<List<HostDto>> GetAllHostsAsync()
    {
        var entities = new List<HostEntity>();

        using (var conn = _dbContext.CreateConnection())
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT id, name, host, port, username, auth_type, credential_encrypted, passphrase_encrypted, notes, tags, created_at FROM hosts ORDER BY name ASC;";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                entities.Add(new HostEntity
                {
                    Id = reader.GetString(0),
                    Name = reader.GetString(1),
                    Host = reader.GetString(2),
                    Port = reader.GetInt32(3),
                    Username = reader.GetString(4),
                    AuthType = reader.GetString(5),
                    CredentialEncrypted = reader.IsDBNull(6) ? null : reader.GetString(6),
                    PassphraseEncrypted = reader.IsDBNull(7) ? null : reader.GetString(7),
                    Notes = reader.IsDBNull(8) ? null : reader.GetString(8),
                    Tags = reader.IsDBNull(9) ? null : reader.GetString(9),
                    CreatedAt = DateTime.Parse(reader.GetString(10))
                });
            }
        }

        // Return DTOs
        var dtos = new List<HostDto>();
        foreach (var h in entities)
        {
            dtos.Add(new HostDto(
                h.Id,
                h.Name,
                h.Host,
                h.Port,
                h.Username,
                h.AuthType,
                h.Notes,
                h.Tags,
                h.CreatedAt
            ));
        }

        return dtos;
    }

    public async Task<HostEntity?> GetHostEntityAsync(string id)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, name, host, port, username, auth_type, credential_encrypted, passphrase_encrypted, notes, tags, created_at FROM hosts WHERE id = $id LIMIT 1;";
        cmd.Parameters.AddWithValue("$id", id);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;

        return new HostEntity
        {
            Id = reader.GetString(0),
            Name = reader.GetString(1),
            Host = reader.GetString(2),
            Port = reader.GetInt32(3),
            Username = reader.GetString(4),
            AuthType = reader.GetString(5),
            CredentialEncrypted = reader.IsDBNull(6) ? null : reader.GetString(6),
            PassphraseEncrypted = reader.IsDBNull(7) ? null : reader.GetString(7),
            Notes = reader.IsDBNull(8) ? null : reader.GetString(8),
            Tags = reader.IsDBNull(9) ? null : reader.GetString(9),
            CreatedAt = DateTime.Parse(reader.GetString(10))
        };
    }

    public async Task<HostDto?> GetHostDtoAsync(string id)
    {
        var entity = await GetHostEntityAsync(id);
        if (entity == null) return null;

        return new HostDto(
            entity.Id,
            entity.Name,
            entity.Host,
            entity.Port,
            entity.Username,
            entity.AuthType,
            entity.Notes,
            entity.Tags,
            entity.CreatedAt
        );
    }

    public async Task<HostDto> CreateHostAsync(CreateHostRequest request)
    {
        var id = Guid.NewGuid().ToString();
        var encryptedCred = !string.IsNullOrEmpty(request.Credential)
            ? _encryptionService.Encrypt(request.Credential)
            : null;
        var encryptedPassphrase = !string.IsNullOrEmpty(request.Passphrase)
            ? _encryptionService.Encrypt(request.Passphrase)
            : null;

        var now = DateTime.UtcNow;

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO hosts (id, name, host, port, username, auth_type, credential_encrypted, passphrase_encrypted, notes, tags, created_at)
            VALUES ($id, $name, $host, $port, $username, $auth_type, $cred, $passphrase, $notes, $tags, $created_at);
        ";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$name", request.Name.Trim());
        cmd.Parameters.AddWithValue("$host", request.Host.Trim());
        cmd.Parameters.AddWithValue("$port", request.Port <= 0 ? 22 : request.Port);
        cmd.Parameters.AddWithValue("$username", string.IsNullOrWhiteSpace(request.Username) ? "root" : request.Username.Trim());
        cmd.Parameters.AddWithValue("$auth_type", request.AuthType.ToLowerInvariant());
        cmd.Parameters.AddWithValue("$cred", (object?)encryptedCred ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$passphrase", (object?)encryptedPassphrase ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$notes", (object?)request.Notes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$tags", (object?)request.Tags ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$created_at", now.ToString("o"));
        cmd.ExecuteNonQuery();

        return new HostDto(
            id,
            request.Name.Trim(),
            request.Host.Trim(),
            request.Port <= 0 ? 22 : request.Port,
            string.IsNullOrWhiteSpace(request.Username) ? "root" : request.Username.Trim(),
            request.AuthType.ToLowerInvariant(),
            request.Notes,
            request.Tags,
            now
        );
    }

    public async Task<HostDto?> UpdateHostAsync(string id, UpdateHostRequest request)
    {
        var existing = await GetHostEntityAsync(id);
        if (existing == null) return null;

        _sshManager.InvalidateHost(id);

        string? encryptedCred = existing.CredentialEncrypted;
        if (!string.IsNullOrEmpty(request.Credential))
        {
            encryptedCred = _encryptionService.Encrypt(request.Credential);
        }

        string? encryptedPassphrase = existing.PassphraseEncrypted;
        if (request.Passphrase != null)
        {
            encryptedPassphrase = !string.IsNullOrEmpty(request.Passphrase)
                ? _encryptionService.Encrypt(request.Passphrase)
                : null;
        }

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE hosts SET
                name = $name,
                host = $host,
                port = $port,
                username = $username,
                auth_type = $auth_type,
                credential_encrypted = $cred,
                passphrase_encrypted = $passphrase,
                notes = $notes,
                tags = $tags
            WHERE id = $id;
        ";
        cmd.Parameters.AddWithValue("$name", request.Name.Trim());
        cmd.Parameters.AddWithValue("$host", request.Host.Trim());
        cmd.Parameters.AddWithValue("$port", request.Port <= 0 ? 22 : request.Port);
        cmd.Parameters.AddWithValue("$username", string.IsNullOrWhiteSpace(request.Username) ? "root" : request.Username.Trim());
        cmd.Parameters.AddWithValue("$auth_type", request.AuthType.ToLowerInvariant());
        cmd.Parameters.AddWithValue("$cred", (object?)encryptedCred ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$passphrase", (object?)encryptedPassphrase ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$notes", (object?)request.Notes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$tags", (object?)request.Tags ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();

        return new HostDto(
            id,
            request.Name.Trim(),
            request.Host.Trim(),
            request.Port <= 0 ? 22 : request.Port,
            string.IsNullOrWhiteSpace(request.Username) ? "root" : request.Username.Trim(),
            request.AuthType.ToLowerInvariant(),
            request.Notes,
            request.Tags,
            existing.CreatedAt
        );
    }

    public async Task<bool> DeleteHostAsync(string id)
    {
        _sshManager.InvalidateHost(id);

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM hosts WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        var rows = cmd.ExecuteNonQuery();
        return rows > 0;
    }

    public async Task<RandomizePortResult> RandomizeSshPortAsync(string hostId, int? desiredPort = null)
    {
        var host = await GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException("Host not found");

        var oldPort = host.Port;
        var newPort = (desiredPort.HasValue && desiredPort.Value >= 1024 && desiredPort.Value <= 65535)
            ? desiredPort.Value
            : Random.Shared.Next(20000, 59001);

        if (newPort == oldPort)
        {
            newPort = Random.Shared.Next(20000, 59001);
        }

        try
        {
            var hardeningScript = $@"
NEW_PORT={newPort}

if ss -tulpn 2>/dev/null | grep -q "":$NEW_PORT\b""; then
  echo ""PORT_IN_USE""
  exit 1
fi

cp /etc/ssh/sshd_config /etc/ssh/sshd_config.serverdeck.bak 2>/dev/null || true

if grep -q -E ""^[#]*[[:space:]]*Port[[:space:]]+"" /etc/ssh/sshd_config; then
  sed -i -E ""s/^[#]*[[:space:]]*Port[[:space:]]+[0-9]+/Port $NEW_PORT/"" /etc/ssh/sshd_config
else
  echo ""Port $NEW_PORT"" >> /etc/ssh/sshd_config
fi

if [ -d /etc/ssh/sshd_config.d ]; then
  echo ""Port $NEW_PORT"" > /etc/ssh/sshd_config.d/99-serverdeck-port.conf
fi

sshd -t 2>&1
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo ""SSHD_TEST_FAILED""
  if [ -f /etc/ssh/sshd_config.serverdeck.bak ]; then
    cp /etc/ssh/sshd_config.serverdeck.bak /etc/ssh/sshd_config
  fi
  if [ -f /etc/ssh/sshd_config.d/99-serverdeck-port.conf ]; then
    rm -f /etc/ssh/sshd_config.d/99-serverdeck-port.conf
  fi
  exit 1
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q ""Status: active""; then
  ufw allow $NEW_PORT/tcp 2>/dev/null || true
fi

if command -v iptables >/dev/null 2>&1; then
  iptables -C INPUT -p tcp --dport $NEW_PORT -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport $NEW_PORT -j ACCEPT 2>/dev/null || true
fi

systemctl reload ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || systemctl reload sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || service ssh reload 2>/dev/null || service ssh restart 2>/dev/null || true

echo ""SSHD_HARDENING_SUCCESS""
";

            var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, hardeningScript, 30);

            if (exitCode != 0 || !output.Contains("SSHD_HARDENING_SUCCESS"))
            {
                var failureMsg = string.IsNullOrWhiteSpace(error) ? output : error;
                return new RandomizePortResult(
                    false,
                    oldPort,
                    oldPort,
                    "SSH port hardening check failed. Configuration rolled back.",
                    failureMsg
                );
            }

            using (var conn = _dbContext.CreateConnection())
            using (var dbCmd = conn.CreateCommand())
            {
                dbCmd.CommandText = "UPDATE hosts SET port = $port WHERE id = $id;";
                dbCmd.Parameters.AddWithValue("$port", newPort);
                dbCmd.Parameters.AddWithValue("$id", hostId);
                dbCmd.ExecuteNonQuery();
            }

            _sshManager.InvalidateHost(hostId);

            return new RandomizePortResult(
                true,
                oldPort,
                newPort,
                $"SSH port hardened to {newPort} (firewall opened & sshd reloaded).",
                output
            );
        }
        catch (Exception ex)
        {
            return new RandomizePortResult(
                false,
                oldPort,
                oldPort,
                $"Failed to harden SSH port: {ex.Message}",
                ex.ToString()
            );
        }
    }
}
