using System.Security.Cryptography;
using System.Text;

namespace NijiPanel.Backend.Services;

public interface IEncryptionService
{
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}

public class EncryptionService : IEncryptionService
{
    private readonly byte[] _key;

    public EncryptionService(IConfiguration configuration)
    {
        var secret = configuration["ENCRYPTION_KEY"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            var keyFile = Path.Combine(AppContext.BaseDirectory, "data", "encryption.key");
            Directory.CreateDirectory(Path.GetDirectoryName(keyFile)!);
            if (File.Exists(keyFile))
            {
                secret = File.ReadAllText(keyFile).Trim();
            }
            else
            {
                var randomBytes = new byte[32];
                RandomNumberGenerator.Fill(randomBytes);
                secret = Convert.ToHexString(randomBytes);
                File.WriteAllText(keyFile, secret);
            }
        }

        using var sha = SHA256.Create();
        _key = sha.ComputeHash(Encoding.UTF8.GetBytes(secret));
    }

    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return "";

        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
        byte[] nonce = new byte[12]; // standard 96-bit nonce for AES-GCM
        RandomNumberGenerator.Fill(nonce);

        byte[] tag = new byte[16];
        byte[] cipherBytes = new byte[plainBytes.Length];

        using var aesGcm = new AesGcm(_key, 16);
        aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);

        // Combined payload: nonce (12) + tag (16) + cipher
        byte[] combined = new byte[nonce.Length + tag.Length + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, combined, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipherBytes, 0, combined, nonce.Length + tag.Length, cipherBytes.Length);

        return Convert.ToBase64String(combined);
    }

    public string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return "";

        byte[] combined = Convert.FromBase64String(cipherText);
        if (combined.Length < 28) throw new ArgumentException("Invalid cipher length");

        byte[] nonce = new byte[12];
        byte[] tag = new byte[16];
        int cipherLength = combined.Length - 28;
        byte[] cipherBytes = new byte[cipherLength];
        byte[] plainBytes = new byte[cipherLength];

        Buffer.BlockCopy(combined, 0, nonce, 0, 12);
        Buffer.BlockCopy(combined, 12, tag, 0, 16);
        Buffer.BlockCopy(combined, 28, cipherBytes, 0, cipherLength);

        using var aesGcm = new AesGcm(_key, 16);
        aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
