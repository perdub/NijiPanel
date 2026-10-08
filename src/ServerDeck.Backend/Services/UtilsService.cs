using System.Security.Cryptography;
using System.Text;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface IUtilsService
{
    string GeneratePassword(int length = 16, bool includeSymbols = true, bool includeNumbers = true, bool includeUppercase = true);
    SshKeyGenerateResponse GenerateSshKey(string type = "rsa", int bits = 4096, string comment = "serverdeck-key");
    string GenerateOneLinerSetupCommand(string publicKey);
}

public class UtilsService : IUtilsService
{
    public string GeneratePassword(int length = 16, bool includeSymbols = true, bool includeNumbers = true, bool includeUppercase = true)
    {
        if (length < 8) length = 8;
        if (length > 128) length = 128;

        const string lowercase = "abcdefghijkmnopqrstuvwxyz"; // exclude l
        const string uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude I, O
        const string numbers = "23456789";                  // exclude 0, 1
        const string symbols = "!@#$%^&*()-_=+[]{}";

        var charPool = new StringBuilder(lowercase);
        if (includeUppercase) charPool.Append(uppercase);
        if (includeNumbers) charPool.Append(numbers);
        if (includeSymbols) charPool.Append(symbols);

        var pool = charPool.ToString();
        var chars = new char[length];
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);

        for (int i = 0; i < length; i++)
        {
            chars[i] = pool[bytes[i] % pool.Length];
        }

        return new string(chars);
    }

    public SshKeyGenerateResponse GenerateSshKey(string type = "rsa", int bits = 4096, string comment = "serverdeck-key")
    {
        if (bits < 2048) bits = 2048;
        if (bits > 8192) bits = 8192;

        using var rsa = RSA.Create(bits);
        var privPem = rsa.ExportRSAPrivateKeyPem();
        var pubOpenSsh = SettingsService.ExportRsaToOpenSsh(rsa, comment);
        var fingerprint = SettingsService.ComputeFingerprint(pubOpenSsh);

        return new SshKeyGenerateResponse(pubOpenSsh, privPem, "ssh-rsa", fingerprint);
    }

    public string GenerateOneLinerSetupCommand(string publicKey)
    {
        var cleanKey = publicKey.Trim().Replace("'", "'\\''");
        return $"mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{cleanKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'SSH key installed successfully!'";
    }
}
