using System.Text.Json;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface IDockerService
{
    Task<List<ContainerDto>> GetContainersAsync(HostEntity host);
    Task<ContainerInspectDto> InspectContainerAsync(HostEntity host, string containerId);
    Task<(bool Success, string Output, string Error)> ExecuteActionAsync(HostEntity host, string containerId, string action);
    Task<string> GetLogsAsync(HostEntity host, string containerId, int tail = 200);
    Task<List<ComposeProjectDto>> FindComposeProjectsAsync(HostEntity host, string? customDir = null);
    Task<ComposeActionResponse> ExecuteComposeActionAsync(HostEntity host, string composeFile, string action);
    Task<string> GetComposeLogsAsync(HostEntity host, string composeFile, int tail = 200);
}

public class DockerService : IDockerService
{
    private readonly ISshConnectionManager _sshManager;

    public DockerService(ISshConnectionManager sshManager)
    {
        _sshManager = sshManager;
    }

    public async Task<List<ContainerDto>> GetContainersAsync(HostEntity host)
    {
        // Run docker ps -a with json format
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(
            host,
            "docker ps -a --no-trunc --format '{{json .}}'",
            timeoutSeconds: 15
        );

        if (exitCode != 0 && string.IsNullOrWhiteSpace(output))
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(error) ? "Docker error" : error);
        }

        var list = new List<ContainerDto>();
        using var reader = new StringReader(output);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                using var doc = JsonDocument.Parse(line);
                var root = doc.RootElement;

                var id = root.TryGetProperty("ID", out var pId) ? pId.GetString() ?? "" : "";
                var names = root.TryGetProperty("Names", out var pNames) ? pNames.GetString() ?? "" : "";
                var image = root.TryGetProperty("Image", out var pImg) ? pImg.GetString() ?? "" : "";
                var status = root.TryGetProperty("Status", out var pSt) ? pSt.GetString() ?? "" : "";
                var state = root.TryGetProperty("State", out var pState) ? pState.GetString() ?? "" : "";
                var ports = root.TryGetProperty("Ports", out var pPorts) ? pPorts.GetString() ?? "" : "";
                var created = root.TryGetProperty("CreatedAt", out var pCr) ? pCr.GetString() ?? "" : "";
                var cmd = root.TryGetProperty("Command", out var pCmd) ? pCmd.GetString() ?? "" : "";

                list.Add(new ContainerDto(id, names, image, status, state, ports, created, cmd));
            }
            catch
            {
                // Ignore unparseable lines
            }
        }

        return list;
    }

    public async Task<ContainerInspectDto> InspectContainerAsync(HostEntity host, string containerId)
    {
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(
            host,
            $"docker inspect {SanitizeId(containerId)}",
            timeoutSeconds: 15
        );

        if (exitCode != 0 || string.IsNullOrWhiteSpace(output))
        {
            throw new InvalidOperationException($"Inspect failed: {error}");
        }

        using var doc = JsonDocument.Parse(output);
        var array = doc.RootElement;
        if (array.GetArrayLength() == 0)
        {
            throw new KeyNotFoundException("Container not found");
        }

        var root = array[0];
        var id = root.GetProperty("Id").GetString() ?? containerId;
        var name = root.GetProperty("Name").GetString()?.TrimStart('/') ?? "";
        var createdStr = root.GetProperty("Created").GetString();
        DateTime.TryParse(createdStr, out var created);

        var config = root.GetProperty("Config");
        var image = config.GetProperty("Image").GetString() ?? "";

        var stateEl = root.GetProperty("State");
        var state = stateEl.GetProperty("Status").GetString() ?? "";
        var status = stateEl.TryGetProperty("Error", out var err) && !string.IsNullOrEmpty(err.GetString())
            ? err.GetString()!
            : state;

        var envList = new List<string>();
        if (config.TryGetProperty("Env", out var envEl) && envEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in envEl.EnumerateArray())
            {
                envList.Add(item.GetString() ?? "");
            }
        }

        var portsList = new List<string>();
        if (root.TryGetProperty("NetworkSettings", out var netEl) &&
            netEl.TryGetProperty("Ports", out var portsEl) &&
            portsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in portsEl.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.Array)
                {
                    foreach (var binding in prop.Value.EnumerateArray())
                    {
                        var hostIp = binding.TryGetProperty("HostIp", out var hip) ? hip.GetString() : "";
                        var hostPort = binding.TryGetProperty("HostPort", out var hp) ? hp.GetString() : "";
                        portsList.Add($"{hostIp}:{hostPort} -> {prop.Name}");
                    }
                }
                else
                {
                    portsList.Add(prop.Name);
                }
            }
        }

        var mountsList = new List<string>();
        if (root.TryGetProperty("Mounts", out var mountsEl) && mountsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var mount in mountsEl.EnumerateArray())
            {
                var src = mount.TryGetProperty("Source", out var s) ? s.GetString() : "";
                var dst = mount.TryGetProperty("Destination", out var d) ? d.GetString() : "";
                var type = mount.TryGetProperty("Type", out var t) ? t.GetString() : "";
                mountsList.Add($"{type}: {src} -> {dst}");
            }
        }

        var restartPolicy = "none";
        if (root.TryGetProperty("HostConfig", out var hc) &&
            hc.TryGetProperty("RestartPolicy", out var rp) &&
            rp.TryGetProperty("Name", out var rpn))
        {
            restartPolicy = rpn.GetString() ?? "none";
        }

        return new ContainerInspectDto(
            id,
            name,
            image,
            state,
            status,
            created,
            envList,
            portsList,
            mountsList,
            restartPolicy,
            output
        );
    }

    public async Task<(bool Success, string Output, string Error)> ExecuteActionAsync(HostEntity host, string containerId, string action)
    {
        var safeId = SanitizeId(containerId);
        string cmd = action.ToLowerInvariant() switch
        {
            "start" => $"docker start {safeId}",
            "stop" => $"docker stop {safeId}",
            "restart" => $"docker restart {safeId}",
            "kill" => $"docker kill {safeId}",
            "rm" => $"docker rm -f {safeId}",
            _ => throw new ArgumentException($"Invalid container action '{action}'")
        };

        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 30);
        return (exitCode == 0, output, error);
    }

    public async Task<string> GetLogsAsync(HostEntity host, string containerId, int tail = 200)
    {
        var safeId = SanitizeId(containerId);
        var cmd = $"docker logs --tail {tail} --timestamps {safeId} 2>&1";
        var (_, output, _) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 20);
        return output;
    }

    public async Task<List<ComposeProjectDto>> FindComposeProjectsAsync(HostEntity host, string? customDir = null)
    {
        var searchRoots = !string.IsNullOrWhiteSpace(customDir)
            ? customDir.Trim()
            : "/opt /home /root /var/www /etc/docker";

        var findCmd = $"find {searchRoots} -maxdepth 4 \\( -name 'docker-compose.yml' -o -name 'compose.yaml' -o -name 'docker-compose.yaml' \\) 2>/dev/null";
        var (_, output, _) = await _sshManager.RunCommandAsync(host, findCmd, timeoutSeconds: 15);

        var projects = new List<ComposeProjectDto>();
        using var reader = new StringReader(output);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            var filePath = line.Trim();
            if (string.IsNullOrWhiteSpace(filePath)) continue;

            var dir = Path.GetDirectoryName(filePath)?.Replace('\\', '/') ?? "/";
            var name = Path.GetFileName(dir);
            if (string.IsNullOrEmpty(name)) name = "root";

            // Run quick ps to get service count and status
            var psCmd = $"docker compose -f '{filePath}' ps --format '{{{{.Service}}}}' 2>/dev/null || docker-compose -f '{filePath}' ps --services 2>/dev/null";
            var (_, servicesOutput, _) = await _sshManager.RunCommandAsync(host, psCmd, timeoutSeconds: 5);

            var services = servicesOutput.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct().ToList();

            projects.Add(new ComposeProjectDto(
                name,
                filePath,
                dir,
                services,
                services.Count > 0 ? "Configured" : "Inactive"
            ));
        }

        return projects;
    }

    public async Task<ComposeActionResponse> ExecuteComposeActionAsync(HostEntity host, string composeFile, string action)
    {
        var dir = Path.GetDirectoryName(composeFile)?.Replace('\\', '/') ?? ".";
        string composeSubCmd = action.ToLowerInvariant() switch
        {
            "up" => "up -d",
            "down" => "down",
            "restart" => "restart",
            "pull" => "pull",
            "stop" => "stop",
            "start" => "start",
            _ => throw new ArgumentException($"Invalid compose action '{action}'")
        };

        var cmd = $"cd '{dir}' && (docker compose -f '{composeFile}' {composeSubCmd} 2>&1 || docker-compose -f '{composeFile}' {composeSubCmd} 2>&1)";
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 120);

        return new ComposeActionResponse(
            exitCode == 0,
            exitCode,
            output,
            error
        );
    }

    public async Task<string> GetComposeLogsAsync(HostEntity host, string composeFile, int tail = 200)
    {
        var dir = Path.GetDirectoryName(composeFile)?.Replace('\\', '/') ?? ".";
        var cmd = $"cd '{dir}' && (docker compose -f '{composeFile}' logs --tail {tail} 2>&1 || docker-compose -f '{composeFile}' logs --tail {tail} 2>&1)";
        var (_, output, _) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 20);
        return output;
    }

    private static string SanitizeId(string id)
    {
        var clean = id.Trim();
        foreach (var c in clean)
        {
            if (!char.IsLetterOrDigit(c) && c != '-' && c != '_' && c != '.')
            {
                throw new ArgumentException("Invalid container identifier");
            }
        }
        return clean;
    }
}
