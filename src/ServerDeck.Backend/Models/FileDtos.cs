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

public record DiskUsageItemDto(
    string Path,
    string Name,
    long SizeBytes,
    double Percent,
    int Depth
);

public record DiskUsageResultDto(
    string Path,
    long TotalSizeBytes,
    List<DiskUsageItemDto> Items
);

public record ArchiveFilesRequest(
    string Path,
    List<string> Items,
    string Format, // "zip" | "tar.gz"
    string ArchiveName
);

public record ExtractArchiveRequest(
    string ArchivePath,
    string DestinationPath
);
