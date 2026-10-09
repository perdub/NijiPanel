namespace NijiPanel.Backend.Models;

public record PackageUpdateCheckResult(
    string PackageManager,
    int AvailableUpdatesCount,
    int SecurityUpdatesCount,
    List<string> Packages,
    string Summary,
    string RawOutput
);

public record PackageUpgradeResult(
    bool Success,
    int ExitCode,
    string Output,
    string Error
);
