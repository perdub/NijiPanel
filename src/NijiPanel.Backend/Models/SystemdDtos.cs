namespace NijiPanel.Backend.Models;

public record SystemdServiceDto(
    string Unit,
    string Load,
    string Active,
    string Sub,
    string Description
);

public record SystemdActionRequest(string Action);

public record SystemdActionResult(
    bool Success,
    string Unit,
    string Action,
    string Output,
    string? Error = null
);
