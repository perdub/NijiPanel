using System.Text;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public record DirectTransferRequest(
    string SourceHostId,
    string SourcePath,
    string TargetHostId,
    string TargetPath
);

public record DirectTransferResponse(
    bool Success,
    int ExitCode,
    string Output,
    string? Error = null
);

public interface IDirectTransferService
{
    Task<DirectTransferResponse> TransferDirectAsync(DirectTransferRequest request);
}

public class DirectTransferService : IDirectTransferService
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly ISettingsService _settingsService;
    private readonly IEncryptionService _encryptionService;

    public DirectTransferService(
        IHostService hostService,
        ISshConnectionManager sshManager,
        ISettingsService settingsService,
        IEncryptionService encryptionService)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _settingsService = settingsService;
        _encryptionService = encryptionService;
    }

    public async Task<DirectTransferResponse> TransferDirectAsync(DirectTransferRequest request)
    {
        var sourceHost = await _hostService.GetHostEntityAsync(request.SourceHostId);
        if (sourceHost == null) return new DirectTransferResponse(false, 1, "", "Source host not found");

        var targetHost = await _hostService.GetHostEntityAsync(request.TargetHostId);
        if (targetHost == null) return new DirectTransferResponse(false, 1, "", "Target host not found");

        // Determine private key for target host to authorize source host directly
        string privateKeyPem;
        if (targetHost.AuthType.Equals("key", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(targetHost.CredentialEncrypted))
        {
            privateKeyPem = _encryptionService.Decrypt(targetHost.CredentialEncrypted);
        }
        else
        {
            // Default: global master key
            privateKeyPem = _settingsService.GetMasterPrivateKey();
        }

        // Base64 encode the private key to safely place it into a temporary file on the source host
        var keyBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(privateKeyPem));

        var cleanSourcePath = request.SourcePath.Trim().Replace("'", "'\\''");
        var cleanTargetPath = request.TargetPath.Trim().Replace("'", "'\\''");
        var targetUser = targetHost.Username.Replace("'", "");
        var targetIp = targetHost.Host.Replace("'", "");
        var targetPort = targetHost.Port;

        // Script executed on SOURCE host that transfers directly to TARGET host via rsync/scp
        var script = $@"
KEY_FILE=$(mktemp)
echo '{keyBase64}' | base64 -d > ""$KEY_FILE""
chmod 600 ""$KEY_FILE""

echo '=== НАЧАЛО ПРЯМОЙ ПЕРЕДАЧИ СЕРВЕР->СЕРВЕР ==='
echo 'Источник: {cleanSourcePath}'
echo 'Назначение: {targetUser}@{targetIp}:{cleanTargetPath}'

if command -v rsync >/dev/null 2>&1; then
    echo 'Используется rsync (прямое соединение с докачкой)...'
    rsync -avz --progress -e ""ssh -i $KEY_FILE -p {targetPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"" '{cleanSourcePath}' '{targetUser}@{targetIp}:{cleanTargetPath}'
    EXIT_CODE=$?
else
    echo 'rsync не найден, используется scp (прямое соединение)...'
    scp -i ""$KEY_FILE"" -P {targetPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -r '{cleanSourcePath}' '{targetUser}@{targetIp}:{cleanTargetPath}'
    EXIT_CODE=$?
fi

rm -f ""$KEY_FILE""
echo '=== ПЕРЕДАЧА ЗАВЕРШЕНА (Код: '$EXIT_CODE') ==='
exit $EXIT_CODE
";

        var (exitCode, output, error) = await _sshManager.RunCommandAsync(sourceHost, script, timeoutSeconds: 3600);
        return new DirectTransferResponse(exitCode == 0, exitCode, output, error);
    }
}
