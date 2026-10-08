namespace ServerDeck.Backend.Models;

public record ContainerDto(
    string Id,
    string Names,
    string Image,
    string Status,
    string State, // running, exited, paused
    string Ports,
    string CreatedAt,
    string Command
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
