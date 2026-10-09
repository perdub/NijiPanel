using System.Security.Cryptography;
using System.Text;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface ISettingsService
{
    string? GetSetting(string key);
    void SetSetting(string key, string value);
    MasterKeyDto GetMasterKey();
    string GetMasterPrivateKey();
    MasterKeyDto RegenerateMasterKey(int bits = 4096);
}

public class SettingsService : ISettingsService
{
    private readonly DatabaseContext _dbContext;
    private readonly IEncryptionService _encryptionService;
    private const string MasterPrivateKeySettingKey = "global_ssh_private_key";
    private const string MasterPublicKeySettingKey = "global_ssh_public_key";
    private const string MasterKeyTypeSettingKey = "global_ssh_key_type";

    public SettingsService(DatabaseContext dbContext, IEncryptionService encryptionService)
    {
        _dbContext = dbContext;
        _encryptionService = encryptionService;

        EnsureMasterKeyExists();
    }

    public string? GetSetting(string key)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT value FROM settings WHERE key = $key LIMIT 1;";
        cmd.Parameters.AddWithValue("$key", key);
        var result = cmd.ExecuteScalar();
        return result?.ToString();
    }

    public void SetSetting(string key, string value)
    {
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO settings (key, value) VALUES ($key, $value)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        ";
        cmd.Parameters.AddWithValue("$key", key);
        cmd.Parameters.AddWithValue("$value", value);
        cmd.ExecuteNonQuery();
    }

    private void EnsureMasterKeyExists()
    {
        var pub = GetSetting(MasterPublicKeySettingKey);
        var priv = GetSetting(MasterPrivateKeySettingKey);
        if (string.IsNullOrEmpty(pub) || string.IsNullOrEmpty(priv))
        {
            RegenerateMasterKey();
        }
    }

    public MasterKeyDto GetMasterKey()
    {
        var pub = GetSetting(MasterPublicKeySettingKey) ?? "";
        var type = GetSetting(MasterKeyTypeSettingKey) ?? "ssh-rsa";
        var fingerprint = ComputeFingerprint(pub);
        return new MasterKeyDto(pub, type, fingerprint);
    }

    public string GetMasterPrivateKey()
    {
        var encryptedPriv = GetSetting(MasterPrivateKeySettingKey)
            ?? throw new InvalidOperationException("Master private key not found");
        return _encryptionService.Decrypt(encryptedPriv);
    }

    public MasterKeyDto RegenerateMasterKey(int bits = 4096)
    {
        using var rsa = RSA.Create(bits);
        var privateKeyPem = rsa.ExportRSAPrivateKeyPem();
        var publicKeyOpenSsh = ExportRsaToOpenSsh(rsa, "serverdeck-master-key");

        var encryptedPriv = _encryptionService.Encrypt(privateKeyPem);
        SetSetting(MasterPrivateKeySettingKey, encryptedPriv);
        SetSetting(MasterPublicKeySettingKey, publicKeyOpenSsh);
        SetSetting(MasterKeyTypeSettingKey, "ssh-rsa");

        var fingerprint = ComputeFingerprint(publicKeyOpenSsh);
        return new MasterKeyDto(publicKeyOpenSsh, "ssh-rsa", fingerprint);
    }

    public static string ExportRsaToOpenSsh(RSA rsa, string comment = "serverdeck-key")
    {
        var parameters = rsa.ExportParameters(false);
        using var ms = new MemoryStream();
        using var writer = new BinaryWriter(ms);

        void WriteString(byte[] bytes)
        {
            var len = BitConverter.GetBytes(bytes.Length);
            if (BitConverter.IsLittleEndian) Array.Reverse(len);
            writer.Write(len);
            writer.Write(bytes);
        }

        void WriteMpint(byte[] bytes)
        {
            if (bytes.Length > 0 && (bytes[0] & 0x80) != 0)
            {
                var padded = new byte[bytes.Length + 1];
                Buffer.BlockCopy(bytes, 0, padded, 1, bytes.Length);
                WriteString(padded);
            }
            else
            {
                WriteString(bytes);
            }
        }

        WriteString(Encoding.ASCII.GetBytes("ssh-rsa"));
        WriteMpint(parameters.Exponent!);
        WriteMpint(parameters.Modulus!);

        var base64Key = Convert.ToBase64String(ms.ToArray());
        return $"ssh-rsa {base64Key} {comment}";
    }

    public static string ComputeFingerprint(string openSshKey)
    {
        try
        {
            var parts = openSshKey.Trim().Split(' ');
            if (parts.Length < 2) return "unknown";
            var keyBytes = Convert.FromBase64String(parts[1]);
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(keyBytes);
            return "SHA256:" + Convert.ToBase64String(hash).TrimEnd('=');
        }
        catch
        {
            return "unknown";
        }
    }
}
