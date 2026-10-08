namespace ServerDeck.Backend.Models;

public record FileItemDto(
    string Name,
    string Path,
    bool IsDirectory,
    long Size,
    DateTime LastModified,
    string Permissions,
    string Owner,
    string Group,
    string Extension,
    bool IsText,
    bool IsImage,
    bool IsAudio
);

public record DirectoryListingDto(
    string CurrentPath,
    string? ParentPath,
    List<FileItemDto> Items
);

public record FileContentDto(
    string Path,
    string Content,
    long Size,
    string Extension
);

public record SaveFileRequest(
    string Path,
    string Content
);

public record CreateEntryRequest(
    string Path
);

public record RenameEntryRequest(
    string OldPath,
    string NewPath
);
