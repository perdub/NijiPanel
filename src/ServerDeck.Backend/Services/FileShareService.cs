using System.Security.Cryptography;
using System.Text;
using ServerDeck.Backend.Data;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

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
    string DownloadUrl
);

public record CreateShareLinkRequest(
    string FilePath,
    int? ExpireDays = null,
    int? MaxDownloads = null
);

public interface IFileShareService
{
    Task<SharedFileDto> CreateShareLinkAsync(string hostId, string filePath, int? expireDays = null, int? maxDownloads = null);
    Task<List<SharedFileDto>> ListSharedFilesAsync(string? hostId = null);
    Task<bool> RevokeShareLinkAsync(string token);
    Task<(HostEntity Host, string FilePath, string FileName)?> ValidateAndRecordDownloadAsync(string token);
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

    public async Task<SharedFileDto> CreateShareLinkAsync(string hostId, string filePath, int? expireDays = null, int? maxDownloads = null)
    {
        var token = GenerateUrlSafeToken(12);
        var fileName = Path.GetFileName(filePath);
        var now = DateTime.UtcNow;
        DateTime? expiresAt = expireDays.HasValue && expireDays.Value > 0
            ? now.AddDays(expireDays.Value)
            : null;

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO shared_files (id, host_id, file_path, file_name, created_at, expires_at, download_count, max_downloads, is_active)
            VALUES ($id, $host_id, $file_path, $file_name, $created_at, $expires_at, 0, $max_downloads, 1);
        ";
        cmd.Parameters.AddWithValue("$id", token);
        cmd.Parameters.AddWithValue("$host_id", hostId);
        cmd.Parameters.AddWithValue("$file_path", filePath);
        cmd.Parameters.AddWithValue("$file_name", fileName);
        cmd.Parameters.AddWithValue("$created_at", now.ToString("o"));
        cmd.Parameters.AddWithValue("$expires_at", (object?)expiresAt?.ToString("o") ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$max_downloads", (object?)maxDownloads ?? DBNull.Value);
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
            $"/d/{token}"
        );
    }

    public async Task<List<SharedFileDto>> ListSharedFilesAsync(string? hostId = null)
    {
        var list = new List<SharedFileDto>();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = string.IsNullOrEmpty(hostId)
            ? "SELECT id, host_id, file_path, file_name, created_at, expires_at, download_count, max_downloads, is_active FROM shared_files ORDER BY created_at DESC;"
            : "SELECT id, host_id, file_path, file_name, created_at, expires_at, download_count, max_downloads, is_active FROM shared_files WHERE host_id = $host_id ORDER BY created_at DESC;";

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
                $"/d/{token}"
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

    public async Task<(HostEntity Host, string FilePath, string FileName)?> ValidateAndRecordDownloadAsync(string token)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT host_id, file_path, file_name, expires_at, download_count, max_downloads, is_active FROM shared_files WHERE id = $id LIMIT 1;";
        cmd.Parameters.AddWithValue("$id", token);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;

        var hostId = reader.GetString(0);
        var filePath = reader.GetString(1);
        var fileName = reader.GetString(2);
        DateTime? expiresAt = reader.IsDBNull(3) ? null : DateTime.Parse(reader.GetString(3));
        var downloadCount = reader.GetInt32(4);
        int? maxDownloads = reader.IsDBNull(5) ? null : reader.GetInt32(5);
        var isActive = reader.GetInt32(6) == 1;
        reader.Close();

        if (!isActive) return null;

        if (expiresAt.HasValue && DateTime.UtcNow > expiresAt.Value)
        {
            return null; // Expired
        }

        if (maxDownloads.HasValue && downloadCount >= maxDownloads.Value)
        {
            return null; // Exceeded limit
        }

        // Increment count
        using var incCmd = conn.CreateCommand();
        incCmd.CommandText = "UPDATE shared_files SET download_count = download_count + 1 WHERE id = $id;";
        incCmd.Parameters.AddWithValue("$id", token);
        incCmd.ExecuteNonQuery();

        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) return null;

        return (host, filePath, fileName);
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
