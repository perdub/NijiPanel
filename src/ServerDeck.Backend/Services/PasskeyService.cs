using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ServerDeck.Backend.Data;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public record PasskeyChallengeSession(
    string Challenge,
    string? UserId,
    DateTime ExpiresAt
);

public interface IPasskeyService
{
    PasskeyRegisterChallengeResponse CreateRegisterChallenge(string userId, string username, string rpId);
    Task<PasskeyDto> VerifyAndRegisterPasskeyAsync(string userId, PasskeyRegisterVerifyRequest request);
    PasskeyLoginChallengeResponse CreateLoginChallenge(string rpId);
    Task<AuthResponse> VerifyAndLoginPasskeyAsync(PasskeyLoginVerifyRequest request);
    Task<List<PasskeyDto>> GetUserPasskeysAsync(string userId);
    Task<bool> DeletePasskeyAsync(string userId, string passkeyId);
}

public class PasskeyService : IPasskeyService
{
    private readonly DatabaseContext _dbContext;
    private readonly IAuthService _authService;
    private readonly ILogger<PasskeyService> _logger;
    private readonly ConcurrentDictionary<string, PasskeyChallengeSession> _challenges = new();

    public PasskeyService(
        DatabaseContext dbContext,
        IAuthService authService,
        ILogger<PasskeyService> logger)
    {
        _dbContext = dbContext;
        _authService = authService;
        _logger = logger;
    }

    public PasskeyRegisterChallengeResponse CreateRegisterChallenge(string userId, string username, string rpId)
    {
        CleanupExpiredChallenges();

        var challengeBytes = new byte[32];
        RandomNumberGenerator.Fill(challengeBytes);
        var challenge = Base64UrlEncode(challengeBytes);

        var session = new PasskeyChallengeSession(challenge, userId, DateTime.UtcNow.AddMinutes(5));
        _challenges[challenge] = session;

        return new PasskeyRegisterChallengeResponse(
            Challenge: challenge,
            RpId: rpId,
            RpName: "NijiPanel",
            UserId: userId,
            UserName: username,
            UserDisplayName: username,
            Timeout: 60000
        );
    }

    public async Task<PasskeyDto> VerifyAndRegisterPasskeyAsync(string userId, PasskeyRegisterVerifyRequest request)
    {
        CleanupExpiredChallenges();

        if (string.IsNullOrWhiteSpace(request.CredentialId))
        {
            throw new ArgumentException("Credential ID cannot be empty.");
        }

        // Verify clientDataJSON contains a valid challenge
        string clientJson;
        try
        {
            var jsonBytes = Base64UrlDecode(request.ClientDataJson);
            clientJson = Encoding.UTF8.GetString(jsonBytes);
        }
        catch (Exception ex)
        {
            throw new ArgumentException($"Failed to decode clientDataJSON: {ex.Message}");
        }

        using var doc = JsonDocument.Parse(clientJson);
        if (!doc.RootElement.TryGetProperty("challenge", out var challengeProp))
        {
            throw new ArgumentException("clientDataJSON does not contain a challenge.");
        }

        var challenge = challengeProp.GetString();
        if (string.IsNullOrEmpty(challenge) || !_challenges.TryRemove(challenge, out var session) || session.UserId != userId)
        {
            throw new InvalidOperationException("Invalid or expired registration challenge.");
        }

        var now = DateTime.UtcNow;
        var name = string.IsNullOrWhiteSpace(request.Name) ? "Passkey Device" : request.Name.Trim();

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO passkeys (id, user_id, name, public_key, counter, credential_type, created_at)
            VALUES ($id, $user_id, $name, $public_key, 0, 'public-key', $created_at)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, public_key = excluded.public_key;
        ";
        cmd.Parameters.AddWithValue("$id", request.CredentialId);
        cmd.Parameters.AddWithValue("$user_id", userId);
        cmd.Parameters.AddWithValue("$name", name);
        cmd.Parameters.AddWithValue("$public_key", request.AttestationObject);
        cmd.Parameters.AddWithValue("$created_at", now.ToString("o"));
        await cmd.ExecuteNonQueryAsync();

        return new PasskeyDto(request.CredentialId, name, now);
    }

    public PasskeyLoginChallengeResponse CreateLoginChallenge(string rpId)
    {
        CleanupExpiredChallenges();

        var challengeBytes = new byte[32];
        RandomNumberGenerator.Fill(challengeBytes);
        var challenge = Base64UrlEncode(challengeBytes);

        var session = new PasskeyChallengeSession(challenge, null, DateTime.UtcNow.AddMinutes(5));
        _challenges[challenge] = session;

        // Retrieve existing registered passkey IDs
        var allowCredentials = new List<string>();
        using (var conn = _dbContext.CreateConnection())
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT id FROM passkeys;";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                allowCredentials.Add(reader.GetString(0));
            }
        }

        return new PasskeyLoginChallengeResponse(
            Challenge: challenge,
            RpId: rpId,
            Timeout: 60000,
            AllowCredentials: allowCredentials.Count > 0 ? allowCredentials : null
        );
    }

    public async Task<AuthResponse> VerifyAndLoginPasskeyAsync(PasskeyLoginVerifyRequest request)
    {
        CleanupExpiredChallenges();

        if (string.IsNullOrWhiteSpace(request.CredentialId))
        {
            throw new ArgumentException("Credential ID is required.");
        }

        // Decode clientDataJSON
        string clientJson;
        try
        {
            var jsonBytes = Base64UrlDecode(request.ClientDataJson);
            clientJson = Encoding.UTF8.GetString(jsonBytes);
        }
        catch (Exception ex)
        {
            throw new ArgumentException($"Failed to decode clientDataJSON: {ex.Message}");
        }

        using var doc = JsonDocument.Parse(clientJson);
        if (!doc.RootElement.TryGetProperty("challenge", out var challengeProp))
        {
            throw new ArgumentException("clientDataJSON does not contain a challenge.");
        }

        var challenge = challengeProp.GetString();
        if (string.IsNullOrEmpty(challenge) || !_challenges.TryRemove(challenge, out _))
        {
            throw new InvalidOperationException("Invalid or expired login challenge.");
        }

        // Look up registered passkey and user
        string userId;
        string username;

        using (var conn = _dbContext.CreateConnection())
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                SELECT p.user_id, u.username
                FROM passkeys p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = $id
                LIMIT 1;
            ";
            cmd.Parameters.AddWithValue("$id", request.CredentialId);

            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Passkey not recognized or not associated with any active user.");
            }

            userId = reader.GetString(0);
            username = reader.GetString(1);
        }

        // Issue JWT token for the user
        var token = _authService.GenerateJwt(username, userId);
        return new AuthResponse(token, username);
    }

    public async Task<List<PasskeyDto>> GetUserPasskeysAsync(string userId)
    {
        var list = new List<PasskeyDto>();

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, name, created_at FROM passkeys WHERE user_id = $uid ORDER BY created_at DESC;";
        cmd.Parameters.AddWithValue("$uid", userId);

        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new PasskeyDto(
                reader.GetString(0),
                reader.GetString(1),
                DateTime.Parse(reader.GetString(2))
            ));
        }

        return list;
    }

    public async Task<bool> DeletePasskeyAsync(string userId, string passkeyId)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM passkeys WHERE id = $id AND user_id = $uid;";
        cmd.Parameters.AddWithValue("$id", passkeyId);
        cmd.Parameters.AddWithValue("$uid", userId);
        var rows = await cmd.ExecuteNonQueryAsync();
        return rows > 0;
    }

    private void CleanupExpiredChallenges()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _challenges)
        {
            if (kvp.Value.ExpiresAt < now)
            {
                _challenges.TryRemove(kvp.Key, out _);
            }
        }
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }

    private static byte[] Base64UrlDecode(string input)
    {
        string padded = input.Replace("-", "+").Replace("_", "/");
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
