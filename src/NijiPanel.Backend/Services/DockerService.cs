using System.Text;
using System.Text.Json;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface IDockerService
{
    Task<List<ContainerDto>> GetContainersAsync(HostEntity host);
    Task<ContainerCrashDumpDto> GetCrashDumpAsync(HostEntity host, string containerId);
    Task<ContainerInspectDto> InspectContainerAsync(HostEntity host, string containerId);
    Task<(bool Success, string Output, string Error)> ExecuteActionAsync(HostEntity host, string containerId, string action);
    Task<string> GetLogsAsync(HostEntity host, string containerId, int tail = 200);
    Task<List<ComposeProjectDto>> FindComposeProjectsAsync(HostEntity host, string? customDir = null);
    Task<ComposeActionResponse> ExecuteComposeActionAsync(HostEntity host, string composeFile, string action);
    Task<string> GetComposeLogsAsync(HostEntity host, string composeFile, int tail = 200);
    Task<ComposeStackDetailDto> GetComposeStackDetailsAsync(HostEntity host, string filePath);
    Task<ComposeValidateResponse> ValidateComposeAsync(HostEntity host, string? filePath, string? composeYaml);
    Task<List<AppTemplateDto>> GetTemplatesAsync();
    Task<DeployTemplateResponse> DeployTemplateAsync(HostEntity host, DeployTemplateRequest request);
    Task<DockerHubSearchResponse> SearchDockerHubAsync(string query);
    Task<DockerPrunePreviewResponse> GetPrunePreviewAsync(HostEntity host);
    Task<DockerPruneExecuteResponse> ExecutePruneAsync(HostEntity host, DockerPruneExecuteRequest request);
}

public class DockerService : IDockerService
{
    private readonly ISshConnectionManager _sshManager;
    private readonly ICommandRegistry _cmdRegistry;

    public DockerService(ISshConnectionManager sshManager, ICommandRegistry cmdRegistry)
    {
        _sshManager = sshManager;
        _cmdRegistry = cmdRegistry;
    }

    public async Task<List<ContainerDto>> GetContainersAsync(HostEntity host)
    {
        // Run docker ps -a with json format
        var listCmd = _cmdRegistry.GetCommand("Docker.ListContainers");
        var listTimeout = _cmdRegistry.GetTimeout("Docker.ListContainers", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(
            host,
            listCmd,
            timeoutSeconds: listTimeout
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

        // Crash Watchdog & OOMKilled Detector: inspect inactive or restarting containers
        var inspectCandidates = list.Where(c =>
            c.State.ToLowerInvariant() != "running" ||
            c.State.ToLowerInvariant() == "restarting" ||
            c.Status.Contains("Restarting", StringComparison.OrdinalIgnoreCase)
        ).ToList();

        if (inspectCandidates.Count > 0)
        {
            try
            {
                var candidateIds = string.Join(" ", inspectCandidates.Select(c => SanitizeId(c.Id)).Take(30));
                var inspectCmd = _cmdRegistry.GetCommand("Docker.InspectStateBatch", new { ids = candidateIds });
                var inspTimeout = _cmdRegistry.GetTimeout("Docker.InspectStateBatch", 10);
                var (inspCode, inspOut, _) = await _sshManager.RunCommandAsync(host, inspectCmd, timeoutSeconds: inspTimeout);

                if (inspCode == 0 && !string.IsNullOrWhiteSpace(inspOut))
                {
                    using var inspReader = new StringReader(inspOut);
                    string? inspLine;
                    var stateMap = new Dictionary<string, (int ExitCode, bool OOMKilled, bool Dead, bool Restarting, string Error)>();

                    while ((inspLine = inspReader.ReadLine()) != null)
                    {
                        if (string.IsNullOrWhiteSpace(inspLine)) continue;
                        try
                        {
                            using var doc = JsonDocument.Parse(inspLine);
                            var r = doc.RootElement;
                            var id = r.TryGetProperty("Id", out var idProp) ? idProp.GetString() ?? "" : "";
                            var ec = r.TryGetProperty("ExitCode", out var ecProp) ? ecProp.GetInt32() : 0;
                            var oom = r.TryGetProperty("OOMKilled", out var oomProp) && oomProp.GetBoolean();
                            var dead = r.TryGetProperty("Dead", out var deadProp) && deadProp.GetBoolean();
                            var restarting = r.TryGetProperty("Restarting", out var restProp) && restProp.GetBoolean();
                            var err = r.TryGetProperty("Error", out var errProp) ? errProp.GetString() ?? "" : "";

                            if (!string.IsNullOrEmpty(id))
                            {
                                stateMap[id] = (ec, oom, dead, restarting, err);
                            }
                        }
                        catch { }
                    }

                    // Update list with enriched crash / OOM information
                    for (int i = 0; i < list.Count; i++)
                    {
                        var c = list[i];
                        // Match either full ID or prefix
                        var matchKey = stateMap.Keys.FirstOrDefault(k => k.StartsWith(c.Id) || c.Id.StartsWith(k));
                        if (matchKey != null)
                        {
                            var s = stateMap[matchKey];
                            bool isOom = s.OOMKilled || s.ExitCode == 137;
                            bool isCrashed = isOom || s.ExitCode != 0 || s.Dead || (!string.IsNullOrEmpty(s.Error) && s.ExitCode != 0);

                            list[i] = c with
                            {
                                IsOOMKilled = isOom,
                                IsCrashed = isCrashed,
                                ExitCode = s.ExitCode
                            };
                        }
                    }
                }
            }
            catch
            {
                // Non-critical background enrichment failure should not block container listing
            }
        }

        return list;
    }

    public async Task<ContainerCrashDumpDto> GetCrashDumpAsync(HostEntity host, string containerId)
    {
        var safeId = SanitizeId(containerId);
        var inspCmd = _cmdRegistry.GetCommand("Docker.InspectCrashDump", new { containerId = safeId });
        var inspTimeout = _cmdRegistry.GetTimeout("Docker.InspectCrashDump", 10);
        var (_, inspOut, _) = await _sshManager.RunCommandAsync(host, inspCmd, timeoutSeconds: inspTimeout);

        string name = safeId;
        string state = "unknown";
        int exitCode = 0;
        bool oomKilled = false;
        string? finishedAt = null;
        string? error = null;

        if (!string.IsNullOrWhiteSpace(inspOut))
        {
            try
            {
                using var doc = JsonDocument.Parse(inspOut.Trim());
                var r = doc.RootElement;
                name = r.TryGetProperty("Name", out var np) ? np.GetString()?.TrimStart('/') ?? safeId : safeId;
                state = r.TryGetProperty("Status", out var sp) ? sp.GetString() ?? "unknown" : "unknown";
                exitCode = r.TryGetProperty("ExitCode", out var ecp) ? ecp.GetInt32() : 0;
                oomKilled = r.TryGetProperty("OOMKilled", out var oomp) && oomp.GetBoolean();
                if (exitCode == 137) oomKilled = true;
                finishedAt = r.TryGetProperty("FinishedAt", out var fp) ? fp.GetString() : null;
                error = r.TryGetProperty("Error", out var ep) ? ep.GetString() : null;
            }
            catch { }
        }

        // Capture last 50 lines of logs
        var logCmd = _cmdRegistry.GetCommand("Docker.ContainerLogs", new { containerId = safeId, tail = 50 });
        var logTimeout = _cmdRegistry.GetTimeout("Docker.ContainerLogs", 15);
        var (_, logs, _) = await _sshManager.RunCommandAsync(host, logCmd, timeoutSeconds: logTimeout);

        return new ContainerCrashDumpDto(
            safeId,
            name,
            state,
            exitCode,
            oomKilled,
            finishedAt,
            error,
            logs
        );
    }

    public async Task<ContainerInspectDto> InspectContainerAsync(HostEntity host, string containerId)
    {
        var safeId = SanitizeId(containerId);
        var inspectCmd = _cmdRegistry.GetCommand("Docker.InspectContainer", new { containerId = safeId });
        var timeout = _cmdRegistry.GetTimeout("Docker.InspectContainer", 15);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(
            host,
            inspectCmd,
            timeoutSeconds: timeout
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
        string actionVerb = action.ToLowerInvariant() switch
        {
            "start" => "start",
            "stop" => "stop",
            "restart" => "restart",
            "kill" => "kill",
            "rm" => "rm -f",
            _ => throw new ArgumentException($"Invalid container action '{action}'")
        };

        var cmd = _cmdRegistry.GetCommand("Docker.ContainerAction", new { action = actionVerb, containerId = safeId });
        var timeout = _cmdRegistry.GetTimeout("Docker.ContainerAction", 30);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
        return (exitCode == 0, output, error);
    }

    public async Task<string> GetLogsAsync(HostEntity host, string containerId, int tail = 200)
    {
        var safeId = SanitizeId(containerId);
        var cmd = _cmdRegistry.GetCommand("Docker.ContainerLogs", new { containerId = safeId, tail });
        var timeout = _cmdRegistry.GetTimeout("Docker.ContainerLogs", 20);
        var (_, output, _) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
        return output;
    }

    public async Task<List<ComposeProjectDto>> FindComposeProjectsAsync(HostEntity host, string? customDir = null)
    {
        var searchRoots = !string.IsNullOrWhiteSpace(customDir)
            ? customDir.Trim()
            : "/opt /home /root /var/www /etc/docker";

        var findCmd = _cmdRegistry.GetCommand("Docker.FindCompose", new { searchRoots });
        var findTimeout = _cmdRegistry.GetTimeout("Docker.FindCompose", 15);
        var (_, output, _) = await _sshManager.RunCommandAsync(host, findCmd, timeoutSeconds: findTimeout);

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
            var psCmd = _cmdRegistry.GetCommand("Docker.ComposePsServices", new { filePath });
            var psTimeout = _cmdRegistry.GetTimeout("Docker.ComposePsServices", 5);
            var (_, servicesOutput, _) = await _sshManager.RunCommandAsync(host, psCmd, timeoutSeconds: psTimeout);

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

        var cmd = _cmdRegistry.GetCommand("Docker.ComposeAction", new { dir, composeFile, action = composeSubCmd });
        var timeout = _cmdRegistry.GetTimeout("Docker.ComposeAction", 120);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);

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
        var cmd = _cmdRegistry.GetCommand("Docker.ComposeLogs", new { dir, composeFile, tail });
        var timeout = _cmdRegistry.GetTimeout("Docker.ComposeLogs", 20);
        var (_, output, _) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
        return output;
    }

    public async Task<ComposeStackDetailDto> GetComposeStackDetailsAsync(HostEntity host, string filePath)
    {
        var dir = Path.GetDirectoryName(filePath)?.Replace('\\', '/') ?? "/";
        var projectName = Path.GetFileName(dir);
        if (string.IsNullOrEmpty(projectName)) projectName = "compose";

        // Read raw file content
        var catCmd = _cmdRegistry.GetCommand("Docker.CatCompose", new { filePath });
        var catTimeout = _cmdRegistry.GetTimeout("Docker.CatCompose", 10);
        var (_, rawYaml, _) = await _sshManager.RunCommandAsync(host, catCmd, timeoutSeconds: catTimeout);

        // Normalize and parse via docker compose config --format json
        var configJsonCmd = _cmdRegistry.GetCommand("Docker.ComposeConfigJson", new { dir, filePath });
        var configTimeout = _cmdRegistry.GetTimeout("Docker.ComposeConfigJson", 15);
        var (exitCode, jsonOut, _) = await _sshManager.RunCommandAsync(host, configJsonCmd, timeoutSeconds: configTimeout);

        var services = new List<ComposeServiceDetailDto>();

        if (exitCode == 0 && !string.IsNullOrWhiteSpace(jsonOut))
        {
            try
            {
                using var doc = JsonDocument.Parse(jsonOut);
                var root = doc.RootElement;
                if (root.TryGetProperty("services", out var srvObj) && srvObj.ValueKind == JsonValueKind.Object)
                {
                    foreach (var srvProp in srvObj.EnumerateObject())
                    {
                        var sName = srvProp.Name;
                        var sEl = srvProp.Value;

                        var image = sEl.TryGetProperty("image", out var imgP) ? imgP.GetString() ?? "" : "";
                        var restart = sEl.TryGetProperty("restart", out var rstP) ? rstP.GetString() ?? "no" : "no";

                        var ports = new List<string>();
                        if (sEl.TryGetProperty("ports", out var portsEl) && portsEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var p in portsEl.EnumerateArray())
                            {
                                if (p.ValueKind == JsonValueKind.Object)
                                {
                                    var pub = p.TryGetProperty("published", out var pubP) ? pubP.GetString() : "";
                                    var tgt = p.TryGetProperty("target", out var tgtP) ? tgtP.ToString() : "";
                                    var proto = p.TryGetProperty("protocol", out var prP) ? prP.GetString() : "tcp";
                                    ports.Add($"{pub}:{tgt}/{proto}");
                                }
                                else
                                {
                                    ports.Add(p.ToString());
                                }
                            }
                        }

                        var envDict = new Dictionary<string, string>();
                        if (sEl.TryGetProperty("environment", out var envEl))
                        {
                            if (envEl.ValueKind == JsonValueKind.Object)
                            {
                                foreach (var envProp in envEl.EnumerateObject())
                                {
                                    envDict[envProp.Name] = envProp.Value.GetString() ?? "";
                                }
                            }
                            else if (envEl.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in envEl.EnumerateArray())
                                {
                                    var str = item.GetString() ?? "";
                                    var idx = str.IndexOf('=');
                                    if (idx > 0)
                                    {
                                        envDict[str[..idx]] = str[(idx + 1)..];
                                    }
                                }
                            }
                        }

                        var volumes = new List<string>();
                        if (sEl.TryGetProperty("volumes", out var volsEl) && volsEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var v in volsEl.EnumerateArray())
                            {
                                if (v.ValueKind == JsonValueKind.Object)
                                {
                                    var src = v.TryGetProperty("source", out var srcP) ? srcP.GetString() : "";
                                    var tgt = v.TryGetProperty("target", out var tgtP) ? tgtP.GetString() : "";
                                    volumes.Add($"{src}:{tgt}");
                                }
                                else
                                {
                                    volumes.Add(v.ToString());
                                }
                            }
                        }

                        var dependsOn = new List<string>();
                        if (sEl.TryGetProperty("depends_on", out var depEl))
                        {
                            if (depEl.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var d in depEl.EnumerateArray()) dependsOn.Add(d.GetString() ?? "");
                            }
                            else if (depEl.ValueKind == JsonValueKind.Object)
                            {
                                foreach (var d in depEl.EnumerateObject()) dependsOn.Add(d.Name);
                            }
                        }

                        var networks = new List<string>();
                        if (sEl.TryGetProperty("networks", out var netEl))
                        {
                            if (netEl.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var n in netEl.EnumerateArray()) networks.Add(n.GetString() ?? "");
                            }
                            else if (netEl.ValueKind == JsonValueKind.Object)
                            {
                                foreach (var n in netEl.EnumerateObject()) networks.Add(n.Name);
                            }
                        }

                        services.Add(new ComposeServiceDetailDto(
                            sName,
                            image,
                            ports,
                            envDict,
                            volumes,
                            dependsOn,
                            restart,
                            networks
                        ));
                    }
                }
            }
            catch { }
        }

        // Fallback: If services list is empty, scan simple YAML service blocks
        if (services.Count == 0 && !string.IsNullOrWhiteSpace(rawYaml))
        {
            var fallbackServices = ExtractServicesFromYaml(rawYaml);
            services.AddRange(fallbackServices);
        }

        return new ComposeStackDetailDto(
            projectName,
            filePath,
            dir,
            rawYaml,
            services
        );
    }

    public async Task<ComposeValidateResponse> ValidateComposeAsync(HostEntity host, string? filePath, string? composeYaml)
    {
        string cmd;
        int timeout = 30;
        if (!string.IsNullOrWhiteSpace(filePath))
        {
            var dir = Path.GetDirectoryName(filePath)?.Replace('\\', '/') ?? ".";
            cmd = _cmdRegistry.GetCommand("Docker.ComposeValidateFile", new { dir, filePath });
            timeout = _cmdRegistry.GetTimeout("Docker.ComposeValidateFile", 30);
        }
        else if (!string.IsNullOrWhiteSpace(composeYaml))
        {
            var tempPath = $"/tmp/nijipanel_val_{Guid.NewGuid():N}.yml";
            var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(composeYaml));
            cmd = _cmdRegistry.GetCommand("Docker.ComposeValidateYaml", new { b64, tempPath });
            timeout = _cmdRegistry.GetTimeout("Docker.ComposeValidateYaml", 30);
        }
        else
        {
            return new ComposeValidateResponse(false, "", "No filePath or composeYaml provided");
        }

        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: timeout);
        bool valid = exitCode == 0;
        return new ComposeValidateResponse(valid, output, valid ? null : error);
    }

    public Task<List<AppTemplateDto>> GetTemplatesAsync()
    {
        return Task.FromResult(DockerTemplatesCatalog.All);
    }

    public async Task<DeployTemplateResponse> DeployTemplateAsync(HostEntity host, DeployTemplateRequest request)
    {
        var template = DockerTemplatesCatalog.All.FirstOrDefault(t => t.Id == request.TemplateId);
        if (template == null)
        {
            throw new KeyNotFoundException($"Template '{request.TemplateId}' was not found in catalog");
        }

        var projectName = SanitizeProjectName(request.ProjectName);
        if (string.IsNullOrWhiteSpace(projectName))
        {
            projectName = template.Id;
        }

        var appDir = $"/opt/nijipanel/apps/{projectName}";

        // Merge default env with overrides
        var finalEnv = new Dictionary<string, string>(template.DefaultEnv);
        if (request.Env != null)
        {
            foreach (var (k, v) in request.Env)
            {
                finalEnv[k] = v;
            }
        }

        // Generate .env file
        var envBuilder = new StringBuilder();
        foreach (var (k, v) in finalEnv)
        {
            envBuilder.AppendLine($"{k}={v}");
        }

        var envB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(envBuilder.ToString()));
        var composeB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(template.ComposeYaml.Trim()));

        var cmd = $"mkdir -p '{appDir}' && echo '{envB64}' | base64 -d > '{appDir}/.env' && echo '{composeB64}' | base64 -d > '{appDir}/docker-compose.yml' && cd '{appDir}' && (docker compose up -d 2>&1 || docker-compose up -d 2>&1)";

        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 120);

        return new DeployTemplateResponse(
            exitCode == 0,
            projectName,
            appDir,
            output,
            exitCode == 0 ? null : (string.IsNullOrWhiteSpace(error) ? output : error)
        );
    }

    public async Task<DockerHubSearchResponse> SearchDockerHubAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new DockerHubSearchResponse(0, new List<DockerHubRepoDto>());
        }

        try
        {
            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            httpClient.DefaultRequestHeaders.Add("User-Agent", "NijiPanel-AppStore/1.0");
            var url = $"https://hub.docker.com/v2/search/repositories/?query={Uri.EscapeDataString(query)}&page=1&page_size=24";

            var response = await httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                return new DockerHubSearchResponse(0, new List<DockerHubRepoDto>());
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var count = root.TryGetProperty("count", out var cProp) ? cProp.GetInt32() : 0;
            var list = new List<DockerHubRepoDto>();

            if (root.TryGetProperty("results", out var resProp) && resProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in resProp.EnumerateArray())
                {
                    var name = item.TryGetProperty("repo_name", out var n) ? n.GetString() ?? "" : "";
                    var desc = item.TryGetProperty("short_description", out var d) ? d.GetString() ?? "" : "";
                    var stars = item.TryGetProperty("star_count", out var s) ? s.GetInt32() : 0;
                    var pulls = item.TryGetProperty("pull_count", out var p)
                        ? (p.ValueKind == JsonValueKind.Number ? p.GetInt64() : 0)
                        : 0;
                    var isOfficial = item.TryGetProperty("is_official", out var o) && o.GetBoolean();

                    list.Add(new DockerHubRepoDto(name, desc, stars, pulls, isOfficial));
                }
            }

            return new DockerHubSearchResponse(count, list);
        }
        catch
        {
            return new DockerHubSearchResponse(0, new List<DockerHubRepoDto>());
        }
    }

    public async Task<DockerPrunePreviewResponse> GetPrunePreviewAsync(HostEntity host)
    {
        // 1. Run docker system df --format json
        var dfCmd = _cmdRegistry.GetCommand("Docker.PrunePreview");
        var dfTimeout = _cmdRegistry.GetTimeout("Docker.PrunePreview", 15);
        var (_, dfOut, _) = await _sshManager.RunCommandAsync(host, dfCmd, timeoutSeconds: dfTimeout);

        var categories = new List<DockerPruneCategoryInfo>();
        long totalReclaimableBytes = 0;

        if (!string.IsNullOrWhiteSpace(dfOut))
        {
            using var reader = new StringReader(dfOut);
            string? line;
            while ((line = reader.ReadLine()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var r = doc.RootElement;

                    var type = r.TryGetProperty("Type", out var tProp) ? tProp.GetString() ?? "" : "";
                    if (type == "Local Volumes") type = "Volumes";

                    int totalCount = 0;
                    if (r.TryGetProperty("TotalCount", out var tcProp))
                    {
                        if (tcProp.ValueKind == JsonValueKind.Number) totalCount = tcProp.GetInt32();
                        else int.TryParse(tcProp.GetString(), out totalCount);
                    }

                    int activeCount = 0;
                    if (r.TryGetProperty("Active", out var actProp))
                    {
                        if (actProp.ValueKind == JsonValueKind.Number) activeCount = actProp.GetInt32();
                        else int.TryParse(actProp.GetString(), out activeCount);
                    }

                    var size = r.TryGetProperty("Size", out var sProp) ? sProp.GetString() ?? "0B" : "0B";
                    var reclaimable = r.TryGetProperty("Reclaimable", out var recProp) ? recProp.GetString() ?? "0B" : "0B";

                    // Estimate bytes for reclaimable
                    long recBytes = ParseSizeToBytes(reclaimable);
                    totalReclaimableBytes += recBytes;

                    categories.Add(new DockerPruneCategoryInfo(type, totalCount, activeCount, size, reclaimable, recBytes));
                }
                catch { }
            }
        }

        // If system df was empty, fill sensible defaults
        if (categories.Count == 0)
        {
            categories.Add(new DockerPruneCategoryInfo("Images", 0, 0, "0B", "0B", 0));
            categories.Add(new DockerPruneCategoryInfo("Containers", 0, 0, "0B", "0B", 0));
            categories.Add(new DockerPruneCategoryInfo("Volumes", 0, 0, "0B", "0B", 0));
            categories.Add(new DockerPruneCategoryInfo("Build Cache", 0, 0, "0B", "0B", 0));
        }

        var totalFormatted = FormatBytes(totalReclaimableBytes);
        return new DockerPrunePreviewResponse(categories, totalFormatted, totalReclaimableBytes);
    }

    public async Task<DockerPruneExecuteResponse> ExecutePruneAsync(HostEntity host, DockerPruneExecuteRequest request)
    {
        var cmds = new List<string>();
        if (request.PruneImages) cmds.Add("docker image prune -a -f 2>&1");
        if (request.PruneContainers) cmds.Add("docker container prune -f 2>&1");
        if (request.PruneVolumes) cmds.Add("docker volume prune -f 2>&1");
        if (request.PruneBuildCache) cmds.Add("docker builder prune -f 2>&1");

        if (cmds.Count == 0)
        {
            return new DockerPruneExecuteResponse(true, "No prune categories were selected.", null);
        }

        var combinedCmd = string.Join(" && echo '---' && ", cmds);
        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, combinedCmd, timeoutSeconds: 120);

        return new DockerPruneExecuteResponse(
            exitCode == 0,
            output,
            exitCode == 0 ? null : error
        );
    }

    private static List<ComposeServiceDetailDto> ExtractServicesFromYaml(string yaml)
    {
        var services = new List<ComposeServiceDetailDto>();
        bool inServices = false;
        string? currentService = null;
        string currentImage = "";
        var ports = new List<string>();
        var env = new Dictionary<string, string>();
        var vols = new List<string>();
        var depends = new List<string>();

        using var reader = new StringReader(yaml);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("services:"))
            {
                inServices = true;
                continue;
            }

            if (!inServices) continue;

            // Service block start (2 spaces indentation)
            if (line.StartsWith("  ") && !line.StartsWith("   ") && trimmed.EndsWith(':'))
            {
                if (currentService != null)
                {
                    services.Add(new ComposeServiceDetailDto(
                        currentService, currentImage, ports, env, vols, depends, "unless-stopped", new List<string>()
                    ));
                    ports = new List<string>();
                    env = new Dictionary<string, string>();
                    vols = new List<string>();
                    depends = new List<string>();
                    currentImage = "";
                }
                currentService = trimmed.TrimEnd(':');
            }
            else if (currentService != null)
            {
                if (trimmed.StartsWith("image:"))
                {
                    currentImage = trimmed.Substring(6).Trim().Trim('"').Trim('\'');
                }
                else if (trimmed.StartsWith("- \"") && trimmed.Contains(':'))
                {
                    ports.Add(trimmed.Trim('-').Trim().Trim('"'));
                }
            }
        }

        if (currentService != null)
        {
            services.Add(new ComposeServiceDetailDto(
                currentService, currentImage, ports, env, vols, depends, "unless-stopped", new List<string>()
            ));
        }

        return services;
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

    private static string SanitizeProjectName(string name)
    {
        var clean = name.Trim().ToLowerInvariant();
        var sb = new StringBuilder();
        foreach (var c in clean)
        {
            if (char.IsLetterOrDigit(c) || c == '-' || c == '_')
            {
                sb.Append(c);
            }
            else if (char.IsWhiteSpace(c))
            {
                sb.Append('-');
            }
        }
        return sb.ToString().Trim('-');
    }

    private static long ParseSizeToBytes(string sizeStr)
    {
        if (string.IsNullOrWhiteSpace(sizeStr)) return 0;
        try
        {
            // E.g. "3.603GB", "57.34kB", "175.6MB", "-2.91e+08B (-8%)"
            var clean = sizeStr.Split('(')[0].Trim();
            if (clean.StartsWith('-')) return 0; // Ignore negative or odd format

            if (clean.EndsWith("GB", StringComparison.OrdinalIgnoreCase))
            {
                if (double.TryParse(clean[..^2], out var gb)) return (long)(gb * 1024 * 1024 * 1024);
            }
            if (clean.EndsWith("MB", StringComparison.OrdinalIgnoreCase))
            {
                if (double.TryParse(clean[..^2], out var mb)) return (long)(mb * 1024 * 1024);
            }
            if (clean.EndsWith("kB", StringComparison.OrdinalIgnoreCase) || clean.EndsWith("KB", StringComparison.OrdinalIgnoreCase))
            {
                if (double.TryParse(clean[..^2], out var kb)) return (long)(kb * 1024);
            }
            if (clean.EndsWith("B", StringComparison.OrdinalIgnoreCase))
            {
                if (double.TryParse(clean[..^1], out var b)) return (long)b;
            }
        }
        catch { }
        return 0;
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes <= 0) return "0 B";
        string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
        int i = 0;
        double d = bytes;
        while (d >= 1024 && i < suffixes.Length - 1)
        {
            d /= 1024;
            i++;
        }
        return $"{d:0.##} {suffixes[i]}";
    }
}
