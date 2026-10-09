namespace NijiPanel.Backend.Models;

public record ContainerDto(
    string Id,
    string Names,
    string Image,
    string Status,
    string State, // running, exited, paused, restarting, dead
    string Ports,
    string CreatedAt,
    string Command,
    bool IsCrashed = false,
    bool IsOOMKilled = false,
    int? ExitCode = null,
    string? CrashDump = null
);

public record ContainerCrashDumpDto(
    string ContainerId,
    string Name,
    string State,
    int ExitCode,
    bool OOMKilled,
    string? FinishedAt,
    string? Error,
    string Logs
);

public record ContainerInspectDto(
    string Id,
    string Name,
    string Image,
    string State,
    string Status,
    DateTime Created,
    List<string> Env,
    List<string> Ports,
    List<string> Mounts,
    string RestartPolicy,
    string RawJson
);

public record ContainerActionRequest(
    string Action // start, stop, restart, kill, rm
);

public record ComposeProjectDto(
    string Name,
    string FilePath,
    string Directory,
    List<string> Services,
    string Status
);

public record ComposeServiceDetailDto(
    string Name,
    string Image,
    List<string> Ports,
    Dictionary<string, string> Environment,
    List<string> Volumes,
    List<string> DependsOn,
    string Restart,
    List<string> Networks
);

public record ComposeStackDetailDto(
    string ProjectName,
    string FilePath,
    string Directory,
    string RawYaml,
    List<ComposeServiceDetailDto> Services
);

public record ComposeActionRequest(
    string FilePath,
    string Action // up, down, restart, pull, stop, start
);

public record ComposeActionResponse(
    bool Success,
    int ExitCode,
    string Output,
    string Error
);

public record ComposeValidateRequest(
    string? FilePath = null,
    string? ComposeYaml = null
);

public record ComposeValidateResponse(
    bool Valid,
    string Output,
    string? Error
);

public record SaveComposeYamlRequest(
    string FilePath,
    string Content
);

// App Store & Templates
public record AppTemplateDto(
    string Id,
    string Name,
    string Category, // Database, Web, Media, Tools, Dev, Analytics
    string Description,
    string Icon,
    Dictionary<string, string> DefaultEnv,
    string ComposeYaml
);

public record DeployTemplateRequest(
    string TemplateId,
    Dictionary<string, string> Env,
    string ProjectName
);

public record DeployTemplateResponse(
    bool Success,
    string ProjectName,
    string Directory,
    string Output,
    string? Error
);

// Docker Hub Search
public record DockerHubRepoDto(
    string RepoName,
    string ShortDescription,
    int StarCount,
    long PullCount,
    bool IsOfficial
);

public record DockerHubSearchResponse(
    int Count,
    List<DockerHubRepoDto> Results
);

// Smart Prune
public record DockerPruneCategoryInfo(
    string Type, // Images, Containers, Volumes, Build Cache
    int TotalCount,
    int ActiveCount,
    string Size,
    string Reclaimable,
    long ReclaimableBytes
);

public record DockerPrunePreviewResponse(
    List<DockerPruneCategoryInfo> Categories,
    string TotalReclaimable,
    long TotalReclaimableBytes
);

public record DockerPruneExecuteRequest(
    bool PruneImages = true,
    bool PruneContainers = true,
    bool PruneVolumes = false,
    bool PruneBuildCache = true
);

public record DockerPruneExecuteResponse(
    bool Success,
    string Output,
    string? Error
);
