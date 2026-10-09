using System.Security.Cryptography;
using System.Text;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public record SharedFileDto(
    string Token,
    string HostId,
    string FilePath,
    string FileName,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    int DownloadCount,
    int? MaxDownloads,
    bool IsActive,
    string DownloadUrl,
    bool HasPassword = false
);

public record CreateShareLinkRequest(
    string? HostId,
    string FilePath,
    int? ExpireHours = null,
    int? ExpireDays = null,
    int? MaxDownloads = null,
    string? Password = null
);

public enum ShareValidationStatus
{
    Ok,
    NotFound,
    Expired,
    LimitReached,
    PasswordRequired,
    InvalidPassword
}

public record ShareValidationResult(
    ShareValidationStatus Status,
    HostEntity? Host = null,
    string? FilePath = null,
    string? FileName = null
);

public interface IFileShareService
{
    Task<SharedFileDto> CreateShareLinkAsync(
        string hostId,
        string filePath,
        int? expireHours = null,
        int? expireDays = null,
        int? maxDownloads = null,
        string? password = null
    );
    Task<List<SharedFileDto>> ListSharedFilesAsync(string? hostId = null);
    Task<bool> RevokeShareLinkAsync(string token);
    Task<ShareValidationResult> ValidateAndRecordDownloadAsync(string token, string? password = null);
}

public class FileShareService : IFileShareService
{
    private readonly DatabaseContext _dbContext;
    private readonly IHostService _hostService;

    public FileShareService(DatabaseContext dbContext, IHostService hostService)
    {
        _dbContext = dbContext;
        _hostService = hostService;
    }

    public async Task<SharedFileDto> CreateShareLinkAsync(
        string hostId,
        string filePath,
        int? expireHours = null,
        int? expireDays = null,
        int? maxDownloads = null,
        string? password = null)
    {
        var token = GenerateUrlSafeToken(12);
        var fileName = Path.GetFileName(filePath);
        var now = DateTime.UtcNow;

        DateTime? expiresAt = null;
        if (expireHours.HasValue && expireHours.Value > 0)
        {
            expiresAt = now.AddHours(expireHours.Value);
        }
        else if (expireDays.HasValue && expireDays.Value > 0)
        {
            expiresAt = now.AddDays(expireDays.Value);
        }

        string? passwordHash = null;
        if (!string.IsNullOrWhiteSpace(password))
        {
            passwordHash = HashPassword(password.Trim());
        }

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO shared_files (id, host_id, file_path, file_name, created_at, expires_at, download_count, max_downloads, is_active, password_hash)
            VALUES ($id, $host_id, $file_path, $file_name, $created_at, $expires_at, 0, $max_downloads, 1, $password_hash);
        ";
        cmd.Parameters.AddWithValue("$id", token);
        cmd.Parameters.AddWithValue("$host_id", hostId);
        cmd.Parameters.AddWithValue("$file_path", filePath);
        cmd.Parameters.AddWithValue("$file_name", fileName);
        cmd.Parameters.AddWithValue("$created_at", now.ToString("o"));
        cmd.Parameters.AddWithValue("$expires_at", (object?)expiresAt?.ToString("o") ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$max_downloads", (object?)maxDownloads ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$password_hash", (object?)passwordHash ?? DBNull.Value);
        cmd.ExecuteNonQuery();

        return new SharedFileDto(
            token,
            hostId,
            filePath,
            fileName,
            now,
            expiresAt,
            0,
            maxDownloads,
            true,
            $"/d/{token}",
            !string.IsNullOrEmpty(passwordHash)
        );
    }

    public async Task<List<SharedFileDto>> ListSharedFilesAsync(string? hostId = null)
    {
        var list = new List<SharedFileDto>();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = string.IsNullOrEmpty(hostId)
            ? "SELECT id, host_id, file_path, file_name, created_at, expires_at, download_count, max_downloads, is_active, password_hash FROM shared_files ORDER BY created_at DESC;"
            : "SELECT id, host_id, file_path, file_name, created_at, expires_at, download_count, max_downloads, is_active, password_hash FROM shared_files WHERE host_id = $host_id ORDER BY created_at DESC;";

        if (!string.IsNullOrEmpty(hostId))
        {
            cmd.Parameters.AddWithValue("$host_id", hostId);
        }

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var token = reader.GetString(0);
            var hId = reader.GetString(1);
            var fPath = reader.GetString(2);
            var fName = reader.GetString(3);
            var created = DateTime.Parse(reader.GetString(4));
            DateTime? expires = reader.IsDBNull(5) ? null : DateTime.Parse(reader.GetString(5));
            var count = reader.GetInt32(6);
            int? max = reader.IsDBNull(7) ? null : reader.GetInt32(7);
            var active = reader.GetInt32(8) == 1;
            var hasPassword = !reader.IsDBNull(9) && !string.IsNullOrEmpty(reader.GetString(9));

            list.Add(new SharedFileDto(
                token,
                hId,
                fPath,
                fName,
                created,
                expires,
                count,
                max,
                active,
                $"/d/{token}",
                hasPassword
            ));
        }

        return list;
    }

    public async Task<bool> RevokeShareLinkAsync(string token)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE shared_files SET is_active = 0 WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", token);
        return cmd.ExecuteNonQuery() > 0;
    }

    public async Task<ShareValidationResult> ValidateAndRecordDownloadAsync(string token, string? password = null)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT host_id, file_path, file_name, expires_at, download_count, max_downloads, is_active, password_hash FROM shared_files WHERE id = $id LIMIT 1;";
        cmd.Parameters.AddWithValue("$id", token);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return new ShareValidationResult(ShareValidationStatus.NotFound);

        var hostId = reader.GetString(0);
        var filePath = reader.GetString(1);
        var fileName = reader.GetString(2);
        DateTime? expiresAt = reader.IsDBNull(3) ? null : DateTime.Parse(reader.GetString(3));
        var downloadCount = reader.GetInt32(4);
        int? maxDownloads = reader.IsDBNull(5) ? null : reader.GetInt32(5);
        var isActive = reader.GetInt32(6) == 1;
        var passwordHash = reader.IsDBNull(7) ? null : reader.GetString(7);
        reader.Close();

        if (!isActive) return new ShareValidationResult(ShareValidationStatus.NotFound);

        if (expiresAt.HasValue && DateTime.UtcNow > expiresAt.Value)
        {
            return new ShareValidationResult(ShareValidationStatus.Expired);
        }

        if (maxDownloads.HasValue && downloadCount >= maxDownloads.Value)
        {
            return new ShareValidationResult(ShareValidationStatus.LimitReached);
        }

        if (!string.IsNullOrEmpty(passwordHash))
        {
            if (string.IsNullOrEmpty(password))
            {
                return new ShareValidationResult(ShareValidationStatus.PasswordRequired);
            }

            var enteredHash = HashPassword(password.Trim());
            if (!string.Equals(enteredHash, passwordHash, StringComparison.OrdinalIgnoreCase))
            {
                return new ShareValidationResult(ShareValidationStatus.InvalidPassword);
            }
        }

        // Increment count
        using var incCmd = conn.CreateCommand();
        incCmd.CommandText = "UPDATE shared_files SET download_count = download_count + 1 WHERE id = $id;";
        incCmd.Parameters.AddWithValue("$id", token);
        incCmd.ExecuteNonQuery();

        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return new ShareValidationResult(ShareValidationStatus.NotFound);

        return new ShareValidationResult(ShareValidationStatus.Ok, host, filePath, fileName);
    }

    private static string HashPassword(string password)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string GenerateUrlSafeToken(int length = 12)
    {
        const string chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(length);
        for (int i = 0; i < length; i++)
        {
            sb.Append(chars[bytes[i] % chars.Length]);
        }
        return sb.ToString();
    }
}
