namespace ServerDeck.Backend.Models;

public record AuthStatusResponse(bool IsSetup, bool IsAuthenticated, string? Username);

public record SetupRequest(string Username, string Password);

public record LoginRequest(string Username, string Password);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record AuthResponse(string Token, string Username);

public record MasterKeyDto(string PublicKey, string KeyType, string Fingerprint);

public record HostDto(
    string Id,
    string Name,
    string Host,
    int Port,
    string Username,
    string AuthType,
    string? Notes,
    string? Tags,
    DateTime CreatedAt,
    bool IsOnline = false,
    string? OsInfo = null,
    string? Uptime = null,
    string? CpuUsage = null,
    string? MemoryUsage = null,
    string? DiskUsage = null
);

public record CreateHostRequest(
    string Name,
    string Host,
    int Port,
    string Username,
    string AuthType,
    string? Credential, // plain text password or private key content
    string? Passphrase,
    string? Notes,
    string? Tags
);

public record UpdateHostRequest(
    string Name,
    string Host,
    int Port,
    string Username,
    string AuthType,
    string? Credential, // optional updated credential
    string? Passphrase,
    string? Notes,
    string? Tags
);

public record HostPortDto(
    string Id,
    string HostId,
    int Port,
    string Protocol,
    string ServiceName,
    string? Description
);

public record CreateHostPortRequest(
    int Port,
    string Protocol,
    string ServiceName,
    string? Description
);

public record HostNoteDto(
    string Id,
    string HostId,
    string Title,
    string Content,
    DateTime UpdatedAt
);

public record SaveHostNoteRequest(
    string Title,
    string Content
);

public record SshTunnelDto(
    string Id,
    string HostId,
    string Name,
    int LocalPort,
    string RemoteHost,
    int RemotePort,
    bool IsActive
);

public record CreateSshTunnelRequest(
    string Name,
    int LocalPort,
    string RemoteHost,
    int RemotePort
);

public record PasswordGenerateRequest(
    int Length = 16,
    bool IncludeSymbols = true,
    bool IncludeNumbers = true,
    bool IncludeUppercase = true
);

public record SshKeyGenerateRequest(
    string Type = "ed25519", // "ed25519" or "rsa"
    int Bits = 4096,
    string? Comment = "serverdeck-key"
);

public record SshKeyGenerateResponse(
    string PublicKey,
    string PrivateKey,
    string Type,
    string Fingerprint
);
