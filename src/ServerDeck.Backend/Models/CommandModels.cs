namespace ServerDeck.Backend.Models;

public record CommandTemplateDto(
    string Key,
    string Category,
    string Command,
    string? Description,
    int TimeoutSeconds,
    bool IsCustom,
    DateTime UpdatedAt
);

public record UpdateCommandTemplateRequest(
    string Command,
    int? TimeoutSeconds = null,
    string? Description = null
);
