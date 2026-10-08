using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ServerDeck.Backend.Data;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface IAuthService
{
    bool IsSetup();
    AuthResponse Setup(string username, string password);
    AuthResponse? Login(string username, string password);
    bool ChangePassword(string username, string currentPassword, string newPassword);
    string GenerateJwt(string username, string userId);
}

public class AuthService : IAuthService
{
    private readonly DatabaseContext _dbContext;
    private readonly byte[] _jwtKey;

    public AuthService(DatabaseContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        var jwtSecret = configuration["JWT_SECRET"];
        if (string.IsNullOrWhiteSpace(jwtSecret))
        {
            var secretFile = Path.Combine(AppContext.BaseDirectory, "data", "jwt.key");
            Directory.CreateDirectory(Path.GetDirectoryName(secretFile)!);
            if (File.Exists(secretFile))
            {
                jwtSecret = File.ReadAllText(secretFile).Trim();
            }
            else
            {
                var randomBytes = new byte[64];
                RandomNumberGenerator.Fill(randomBytes);
                jwtSecret = Convert.ToBase64String(randomBytes);
                File.WriteAllText(secretFile, jwtSecret);
            }
        }
        _jwtKey = Encoding.UTF8.GetBytes(jwtSecret.PadRight(64, '!')[..64]);
    }

    public bool IsSetup()
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM users;";
        var count = Convert.ToInt64(cmd.ExecuteScalar());
        return count > 0;
    }

    public AuthResponse Setup(string username, string password)
    {
        if (IsSetup()) throw new InvalidOperationException("System is already configured.");

        username = username.Trim();
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            throw new ArgumentException("Username and password cannot be empty.");

        var saltBytes = new byte[16];
        RandomNumberGenerator.Fill(saltBytes);
        var salt = Convert.ToBase64String(saltBytes);
        var hash = HashPassword(password, saltBytes);

        var userId = Guid.NewGuid().ToString();

        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO users (id, username, password_hash, salt, created_at)
            VALUES ($id, $username, $hash, $salt, $created_at);
        ";
        cmd.Parameters.AddWithValue("$id", userId);
        cmd.Parameters.AddWithValue("$username", username);
        cmd.Parameters.AddWithValue("$hash", hash);
        cmd.Parameters.AddWithValue("$salt", salt);
        cmd.Parameters.AddWithValue("$created_at", DateTime.UtcNow.ToString("o"));
        cmd.ExecuteNonQuery();

        var token = GenerateJwt(username, userId);
        return new AuthResponse(token, username);
    }

    public AuthResponse? Login(string username, string password)
    {
        username = username.Trim();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, password_hash, salt FROM users WHERE username = $username LIMIT 1;";
        cmd.Parameters.AddWithValue("$username", username);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;

        var id = reader.GetString(0);
        var storedHash = reader.GetString(1);
        var salt = reader.GetString(2);

        var saltBytes = Convert.FromBase64String(salt);
        var computedHash = HashPassword(password, saltBytes);

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(storedHash),
            Encoding.UTF8.GetBytes(computedHash)))
        {
            return null;
        }

        var token = GenerateJwt(username, id);
        return new AuthResponse(token, username);
    }

    public bool ChangePassword(string username, string currentPassword, string newPassword)
    {
        username = username.Trim();
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, password_hash, salt FROM users WHERE username = $username LIMIT 1;";
        cmd.Parameters.AddWithValue("$username", username);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return false;

        var id = reader.GetString(0);
        var storedHash = reader.GetString(1);
        var salt = reader.GetString(2);
        reader.Close();

        var saltBytes = Convert.FromBase64String(salt);
        var computedHash = HashPassword(currentPassword, saltBytes);

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(storedHash),
            Encoding.UTF8.GetBytes(computedHash)))
        {
            return false;
        }

        var newSaltBytes = new byte[16];
        RandomNumberGenerator.Fill(newSaltBytes);
        var newSalt = Convert.ToBase64String(newSaltBytes);
        var newHash = HashPassword(newPassword, newSaltBytes);

        using var updateCmd = conn.CreateCommand();
        updateCmd.CommandText = "UPDATE users SET password_hash = $hash, salt = $salt WHERE id = $id;";
        updateCmd.Parameters.AddWithValue("$hash", newHash);
        updateCmd.Parameters.AddWithValue("$salt", newSalt);
        updateCmd.Parameters.AddWithValue("$id", id);
        updateCmd.ExecuteNonQuery();

        return true;
    }

    public string GenerateJwt(string username, string userId)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(_jwtKey);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.NameIdentifier, userId)
            ]),
            Expires = DateTime.UtcNow.AddDays(30),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private static string HashPassword(string password, byte[] salt)
    {
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            iterations: 100_000,
            hashAlgorithm: HashAlgorithmName.SHA256,
            outputLength: 32);
        return Convert.ToBase64String(hash);
    }
}
