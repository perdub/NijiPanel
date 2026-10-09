using System.Text.RegularExpressions;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public interface ILinuxUserService
{
    Task<List<LinuxUserDto>> GetUsersAsync(string hostId);
    Task<LinuxUserActionResult> CreateUserAsync(string hostId, CreateLinuxUserRequest request);
    Task<LinuxUserActionResult> LockUserAsync(string hostId, string username);
    Task<LinuxUserActionResult> UnlockUserAsync(string hostId, string username);
    Task<LinuxUserActionResult> ToggleSudoAsync(string hostId, string username);
    Task<LinuxUserActionResult> DeleteUserAsync(string hostId, string username, bool removeHome = true);
}

public class LinuxUserService : ILinuxUserService
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _sshManager;
    private readonly ILogger<LinuxUserService> _logger;

    public LinuxUserService(
        IHostService hostService,
        ISshConnectionManager sshManager,
        ILogger<LinuxUserService> logger)
    {
        _hostService = hostService;
        _sshManager = sshManager;
        _logger = logger;
    }

    public async Task<List<LinuxUserDto>> GetUsersAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        const string inspectCmd = @"
cat /etc/passwd
echo '===GROUP_DELIMITER==='
cat /etc/group
echo '===SHADOW_DELIMITER==='
passwd -Sa 2>/dev/null || cat /etc/shadow 2>/dev/null || true
";

        var res = await _sshManager.RunCommandAsync(host, inspectCmd, timeoutSeconds: 20);
        var raw = res.Output ?? "";

        var sections = raw.Split("===GROUP_DELIMITER===\n", StringSplitOptions.None);
        var passwdPart = sections.Length > 0 ? sections[0] : "";
        var restPart = sections.Length > 1 ? sections[1] : "";

        var groupShadow = restPart.Split("===SHADOW_DELIMITER===\n", StringSplitOptions.None);
        var groupPart = groupShadow.Length > 0 ? groupShadow[0] : "";
        var shadowPart = groupShadow.Length > 1 ? groupShadow[1] : "";

        // Parse groups
        var gidToGroupName = new Dictionary<int, string>();
        var userToGroups = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);

        var groupLines = groupPart.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var gLine in groupLines)
        {
            var gParts = gLine.Split(':');
            if (gParts.Length < 3) continue;

            var gName = gParts[0].Trim();
            if (int.TryParse(gParts[2].Trim(), out var gid))
            {
                gidToGroupName[gid] = gName;
            }

            if (gParts.Length >= 4 && !string.IsNullOrWhiteSpace(gParts[3]))
            {
                var members = gParts[3].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var member in members)
                {
                    if (!userToGroups.TryGetValue(member, out var gSet))
                    {
                        gSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        userToGroups[member] = gSet;
                    }
                    gSet.Add(gName);
                }
            }
        }

        // Parse shadow / locked status
        var lockedUsers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var shadowLines = shadowPart.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var sLine in shadowLines)
        {
            // Format 1: passwd -S output: "user L 2026-..." or "user LK ..."
            var sParts = Regex.Split(sLine, @"\s+");
            if (sParts.Length >= 2 && (sParts[1].Equals("L", StringComparison.OrdinalIgnoreCase) || sParts[1].Equals("LK", StringComparison.OrdinalIgnoreCase)))
            {
                lockedUsers.Add(sParts[0]);
                continue;
            }

            // Format 2: /etc/shadow output: "user:!:18921:0:99999:7:::" or "user:*:..."
            var colonParts = sLine.Split(':');
            if (colonParts.Length >= 2)
            {
                var pwField = colonParts[1];
                if (pwField.StartsWith("!") || pwField.StartsWith("*"))
                {
                    lockedUsers.Add(colonParts[0]);
                }
            }
        }

        // Parse passwd
        var users = new List<LinuxUserDto>();
        var passwdLines = passwdPart.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var line in passwdLines)
        {
            var p = line.Split(':');
            if (p.Length < 7) continue;

            var username = p[0].Trim();
            if (string.IsNullOrEmpty(username)) continue;

            int.TryParse(p[2].Trim(), out var uid);
            int.TryParse(p[3].Trim(), out var gid);
            var fullName = p[4].Trim();
            var home = p[5].Trim();
            var shell = p[6].Trim();

            // Collect all groups for this user
            if (!userToGroups.TryGetValue(username, out var userGroups))
            {
                userGroups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                userToGroups[username] = userGroups;
            }

            if (gidToGroupName.TryGetValue(gid, out var primGroup))
            {
                userGroups.Add(primGroup);
            }

            var groupsList = userGroups.OrderBy(x => x).ToList();

            var isSudo = uid == 0 ||
                         userGroups.Contains("sudo") ||
                         userGroups.Contains("wheel") ||
                         userGroups.Contains("admin");

            var isSystem = (uid < 1000 && uid != 0) ||
                           ((shell.EndsWith("nologin") || shell.EndsWith("false") || shell.EndsWith("sync")) && uid != 0);

            var isLocked = lockedUsers.Contains(username);

            users.Add(new LinuxUserDto(
                username,
                uid,
                gid,
                fullName,
                home,
                shell,
                groupsList,
                isSudo,
                isSystem,
                isLocked
            ));
        }

        // Sort: real users first (root first, then uid asc), then system users
        return users
            .OrderBy(u => u.IsSystem ? 1 : 0)
            .ThenByDescending(u => u.Uid == 0)
            .ThenBy(u => u.Uid)
            .ToList();
    }

    public async Task<LinuxUserActionResult> CreateUserAsync(string hostId, CreateLinuxUserRequest request)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanUser = request.Username?.Trim() ?? "";
        if (!Regex.IsMatch(cleanUser, @"^[a-z_][a-z0-9_-]{0,31}$"))
        {
            throw new ArgumentException("Username must start with lowercase letter or underscore and contain only [a-z0-9_-] (max 32 chars)");
        }

        var cleanShell = string.IsNullOrWhiteSpace(request.Shell) ? "/bin/bash" : request.Shell.Trim();
        if (!Regex.IsMatch(cleanShell, @"^/[a-zA-Z0-9_\-\/]+$"))
        {
            cleanShell = "/bin/bash";
        }

        var homeFlag = request.CreateHome ? "-m" : "-M";
        var cmd = $"useradd {homeFlag} -s {cleanShell} {cleanUser}";

        if (!string.IsNullOrEmpty(request.Password))
        {
            var escapedPw = request.Password.Replace("'", "'\\''");
            cmd += $" && echo '{cleanUser}:{escapedPw}' | chpasswd";
        }

        if (request.Sudo)
        {
            cmd += $" && (usermod -aG sudo {cleanUser} 2>/dev/null || usermod -aG wheel {cleanUser} 2>/dev/null || true)";
        }

        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 30);
        var success = res.ExitCode == 0;
        var output = (res.Output + "\n" + res.Error).Trim();

        return new LinuxUserActionResult(
            success,
            success ? $"User '{cleanUser}' created successfully" : $"Failed to create user: {output}",
            output
        );
    }

    public async Task<LinuxUserActionResult> LockUserAsync(string hostId, string username)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanUser = SanitizeUsername(username);
        var cmd = $"passwd -l {cleanUser} 2>&1 || usermod -L {cleanUser} 2>&1";
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 15);

        var success = res.ExitCode == 0;
        var output = (res.Output + "\n" + res.Error).Trim();

        return new LinuxUserActionResult(
            success,
            success ? $"User '{cleanUser}' locked" : $"Failed to lock user: {output}",
            output
        );
    }

    public async Task<LinuxUserActionResult> UnlockUserAsync(string hostId, string username)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanUser = SanitizeUsername(username);
        var cmd = $"passwd -u {cleanUser} 2>&1 || usermod -U {cleanUser} 2>&1";
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 15);

        var success = res.ExitCode == 0;
        var output = (res.Output + "\n" + res.Error).Trim();

        return new LinuxUserActionResult(
            success,
            success ? $"User '{cleanUser}' unlocked" : $"Failed to unlock user: {output}",
            output
        );
    }

    public async Task<LinuxUserActionResult> ToggleSudoAsync(string hostId, string username)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanUser = SanitizeUsername(username);
        if (cleanUser.Equals("root", StringComparison.OrdinalIgnoreCase))
        {
            return new LinuxUserActionResult(false, "Root already possesses all administrative privileges");
        }

        var checkCmd = $"id -Gn {cleanUser} 2>/dev/null";
        var checkRes = await _sshManager.RunCommandAsync(host, checkCmd, timeoutSeconds: 10);
        var groups = (checkRes.Output ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var hasSudo = groups.Any(g => g.Equals("sudo", StringComparison.OrdinalIgnoreCase) || g.Equals("wheel", StringComparison.OrdinalIgnoreCase));

        if (hasSudo)
        {
            var remCmd = $"gpasswd -d {cleanUser} sudo 2>/dev/null; gpasswd -d {cleanUser} wheel 2>/dev/null; deluser {cleanUser} sudo 2>/dev/null || true";
            var remRes = await _sshManager.RunCommandAsync(host, remCmd, timeoutSeconds: 15);
            return new LinuxUserActionResult(true, $"Removed sudo privileges from user '{cleanUser}'", remRes.Output);
        }
        else
        {
            var addCmd = $"usermod -aG sudo {cleanUser} 2>/dev/null || usermod -aG wheel {cleanUser} 2>/dev/null";
            var addRes = await _sshManager.RunCommandAsync(host, addCmd, timeoutSeconds: 15);
            return new LinuxUserActionResult(addRes.ExitCode == 0, $"Granted sudo privileges to user '{cleanUser}'", addRes.Output);
        }
    }

    public async Task<LinuxUserActionResult> DeleteUserAsync(string hostId, string username, bool removeHome = true)
    {
        var host = await _hostService.GetHostEntityAsync(hostId);
        if (host == null) throw new KeyNotFoundException($"Host {hostId} not found");

        var cleanUser = SanitizeUsername(username);
        if (cleanUser.Equals("root", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Cannot delete root user");
        }

        var homeFlag = removeHome ? "-r" : "";
        var cmd = $"userdel {homeFlag} {cleanUser} 2>&1";
        var res = await _sshManager.RunCommandAsync(host, cmd, timeoutSeconds: 20);

        var success = res.ExitCode == 0;
        var output = (res.Output + "\n" + res.Error).Trim();

        return new LinuxUserActionResult(
            success,
            success ? $"User '{cleanUser}' deleted" : $"Failed to delete user: {output}",
            output
        );
    }

    private static string SanitizeUsername(string username)
    {
        var clean = username.Trim();
        if (!Regex.IsMatch(clean, @"^[a-z_][a-z0-9_-]{0,31}$"))
        {
            throw new ArgumentException($"Invalid username format '{username}'");
        }
        return clean;
    }
}
