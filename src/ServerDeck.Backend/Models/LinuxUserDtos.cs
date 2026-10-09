namespace ServerDeck.Backend.Models;

public record LinuxUserDto(
    string Username,
    int Uid,
    int Gid,
    string FullName,
    string HomeDirectory,
    string Shell,
    List<string> Groups,
    bool IsSudo,
    bool IsSystem,
    bool IsLocked
);

public record CreateLinuxUserRequest(
    string Username,
    string? Password = null,
    string? Shell = "/bin/bash",
    bool Sudo = false,
    bool CreateHome = true
);

public record LinuxUserActionResult(
    bool Success,
    string Message,
    string? Output = null
);
