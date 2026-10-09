namespace NijiPanel.Backend.Models;

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
    string? Tags,
    bool HardeningRandomPort = false
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

public record LiveSocketDto(
    string Protocol,
    string State,
    string LocalAddress,
    int Port,
    string? ProcessName,
    int? Pid,
    string Raw
);

public record RandomizePortRequest(int? TargetPort = null);

public record RandomizePortResult(
    bool Success,
    int OldPort,
    int NewPort,
    string Message,
    string? Details = null
);

// === Packet 4: Monitoring, Alerts, Security & Passkeys ===

// 1. Beszel-Style Metrics & Prediction
public record MetricDataPoint(
    DateTime Timestamp,
    double CpuPercent,
    double RamPercent,
    double NetRxKbps,
    double NetTxKbps,
    double DiskPercent
);

public record DiskFillPrediction(
    bool IsStable,
    double? DaysUntilFull,
    double? HoursUntilFull,
    string FormattedPrediction
);

public record HostMetricsHistoryResponse(
    string HostId,
    DiskFillPrediction Prediction,
    List<MetricDataPoint> History
);

// 2. Notifications & External Alerts
public record NotificationDto(
    string Id,
    string? HostId,
    string Title,
    string Message,
    string Severity,
    DateTime CreatedAt,
    bool IsRead
);

public record NotificationListResponse(
    List<NotificationDto> Notifications,
    int UnreadCount
);

public record CreateNotificationRequest(
    string? HostId,
    string Title,
    string Message,
    string Severity = "info"
);

public record AlertSettingsDto(
    string? TelegramBotToken,
    string? TelegramChatId,
    string? WebhookUrl,
    bool AlertsEnabled
);

public record TestAlertRequest(
    string? TelegramBotToken,
    string? TelegramChatId,
    string? WebhookUrl
);

public record TestAlertResult(
    bool TelegramSuccess,
    string? TelegramError,
    bool WebhookSuccess,
    string? WebhookError
);

// 3. Hardware Benchmark
public record BenchmarkResultDto(
    string HostId,
    string HostName,
    int Score,
    double DiskWriteSpeedMBps,
    string DiskWriteFormatted,
    long CpuSha256Ops,
    string CpuFormatted,
    double PingAverageMs,
    string PingFormatted,
    DateTime ExecutedAt,
    string Summary
);

// 4. Firewall & Fail2ban
public record FirewallRuleDto(
    int Number,
    string Action,
    string From,
    string To,
    string Protocol,
    string? Direction
);

public record FirewallStatusDto(
    bool IsActive,
    string StatusText,
    string Backend,
    List<FirewallRuleDto> Rules
);

public record CreateFirewallRuleRequest(
    string Port,
    string Protocol = "tcp", // tcp, udp, any
    string Action = "allow", // allow, deny, reject
    string? From = null // "Anywhere" or specific IP/CIDR
);

public record FirewallOperationResult(
    bool Success,
    string Message,
    string? Output = null
);

public record Fail2banStatusDto(
    bool IsInstalled,
    bool IsRunning,
    List<string> Jails,
    List<string> BannedIps,
    int CurrentlyBanned,
    int TotalBanned
);

public record UnbanIpRequest(
    string Ip,
    string? Jail = null
);

// 5. Passkeys (WebAuthn)
public record PasskeyDto(
    string Id,
    string Name,
    DateTime CreatedAt
);

public record PasskeyRegisterChallengeResponse(
    string Challenge,
    string RpId,
    string RpName,
    string UserId,
    string UserName,
    string UserDisplayName,
    long Timeout = 60000
);

public record PasskeyRegisterVerifyRequest(
    string Name,
    string CredentialId,
    string ClientDataJson,
    string AttestationObject
);

public record PasskeyLoginChallengeResponse(
    string Challenge,
    string RpId,
    long Timeout = 60000,
    List<string>? AllowCredentials = null
);

public record PasskeyLoginVerifyRequest(
    string CredentialId,
    string ClientDataJson,
    string AuthenticatorData,
    string Signature,
    string? UserHandle = null
);


