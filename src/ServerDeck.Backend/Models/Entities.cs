namespace ServerDeck.Backend.Models;

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Salt { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class HostEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Host { get; set; } = "";
    public int Port { get; set; } = 22;
    public string Username { get; set; } = "root";
    public string AuthType { get; set; } = "global_key"; // 'password', 'key', 'global_key'
    public string? CredentialEncrypted { get; set; }
    public string? PassphraseEncrypted { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class HostPort
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string HostId { get; set; } = "";
    public int Port { get; set; }
    public string Protocol { get; set; } = "tcp";
    public string ServiceName { get; set; } = "";
    public string? Description { get; set; }
}

public class HostNote
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string HostId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class SshTunnelEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string HostId { get; set; } = "";
    public string Name { get; set; } = "";
    public int LocalPort { get; set; }
    public string RemoteHost { get; set; } = "127.0.0.1";
    public int RemotePort { get; set; }
    public bool IsActive { get; set; }
}

public class NotificationEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? HostId { get; set; }
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Severity { get; set; } = "info"; // info, warning, error
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
}

public class PasskeyEntity
{
    public string Id { get; set; } = ""; // base64url credentialId
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string PublicKey { get; set; } = "";
    public long Counter { get; set; }
    public string CredentialType { get; set; } = "public-key";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
