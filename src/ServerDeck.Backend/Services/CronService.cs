using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public class CronJobItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public int LineIndex { get; set; }
    public string Schedule { get; set; } = "* * * * *";
    public string Command { get; set; } = "";
    public string Comment { get; set; } = "";
    public bool IsEnabled { get; set; } = true;
    public string RawLine { get; set; } = "";
    public string ScheduleDescription { get; set; } = "";
}

public class CronExecutionResult
{
    public int ExitCode { get; set; }
    public string Output { get; set; } = "";
    public string Error { get; set; } = "";
    public long DurationMs { get; set; }
}

public interface ICronService
{
    Task<List<CronJobItem>> GetCronJobsAsync(string hostId);
    Task<string> GetRawCrontabAsync(string hostId);
    Task SaveRawCrontabAsync(string hostId, string rawContent);
    Task<CronJobItem> AddCronJobAsync(string hostId, string schedule, string command, string comment, bool enabled = true);
    Task<CronJobItem> UpdateCronJobAsync(string hostId, int lineIndex, string schedule, string command, string comment, bool enabled);
    Task DeleteCronJobAsync(string hostId, int lineIndex);
    Task<CronJobItem> ToggleCronJobAsync(string hostId, int lineIndex);
    Task<CronExecutionResult> RunCronCommandAsync(string hostId, string command);
}

public class CronService : ICronService
{
    private readonly IHostService _hostService;
    private readonly ISshConnectionManager _ssh;
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ILogger<CronService> _logger;

    public CronService(
        IHostService hostService,
        ISshConnectionManager ssh,
        ICommandRegistry cmdRegistry,
        ILogger<CronService> logger)
    {
        _hostService = hostService;
        _ssh = ssh;
        _cmdRegistry = cmdRegistry;
        _logger = logger;
    }

    public async Task<string> GetRawCrontabAsync(string hostId)
    {
        var host = await _hostService.GetHostEntityAsync(hostId)
            ?? throw new KeyNotFoundException($"Host '{hostId}' not found");

        var cmd = _cmdRegistry.GetCommand("Cron.ListJobs");
        var timeout = _cmdRegistry.GetTimeout("Cron.ListJobs", 10);
        var result = await _ssh.RunCommandAsync(host, cmd, timeout);
        if (result.ExitCode != 0 && (result.Output.Contains("no crontab for", StringComparison.OrdinalIgnoreCase) || result.Error.Contains("no crontab for", StringComparison.OrdinalIgnoreCase)))
        {
            return string.Empty;
        }

        return result.Output.TrimEnd();
    }

    public async Task SaveRawCrontabAsync(string hostId, string rawContent)
    {
        var host = await _hostService.GetHostEntityAsync(hostId)
            ?? throw new KeyNotFoundException($"Host '{hostId}' not found");

        // Write to temporary file and install via crontab <file>
        var base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(rawContent + "\n"));
        var cmd = _cmdRegistry.GetCommand("Cron.InstallCrontab", new { @base64 = base64 });
        var timeout = _cmdRegistry.GetTimeout("Cron.InstallCrontab", 15);
        
        var result = await _ssh.RunCommandAsync(host, cmd, timeout);
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to save crontab: {result.Error} {result.Output}");
        }
    }

    public async Task<List<CronJobItem>> GetCronJobsAsync(string hostId)
    {
        var raw = await GetRawCrontabAsync(hostId);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new List<CronJobItem>();
        }

        var lines = raw.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
        var jobs = new List<CronJobItem>();
        string pendingComment = "";

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrEmpty(line))
            {
                pendingComment = "";
                continue;
            }

            // Check if comment line
            if (line.StartsWith('#'))
            {
                var stripped = line.TrimStart('#').Trim();
                // Check if this commented-out line is actually a disabled cron expression
                if (TryParseCronLine(stripped, out var disSchedule, out var disCommand))
                {
                    jobs.Add(new CronJobItem
                    {
                        Id = $"job-{i}",
                        LineIndex = i,
                        Schedule = disSchedule,
                        Command = disCommand,
                        Comment = pendingComment,
                        IsEnabled = false,
                        RawLine = line,
                        ScheduleDescription = DescribeSchedule(disSchedule)
                    });
                    pendingComment = "";
                }
                else
                {
                    pendingComment = stripped;
                }
                continue;
            }

            // Active cron line
            if (TryParseCronLine(line, out var schedule, out var command))
            {
                jobs.Add(new CronJobItem
                {
                    Id = $"job-{i}",
                    LineIndex = i,
                    Schedule = schedule,
                    Command = command,
                    Comment = pendingComment,
                    IsEnabled = true,
                    RawLine = line,
                    ScheduleDescription = DescribeSchedule(schedule)
                });
                pendingComment = "";
            }
            else
            {
                pendingComment = "";
            }
        }

        return jobs;
    }

    public async Task<CronJobItem> AddCronJobAsync(string hostId, string schedule, string command, string comment, bool enabled = true)
    {
        var raw = await GetRawCrontabAsync(hostId);
        var sb = new StringBuilder(raw);
        if (sb.Length > 0 && !sb.ToString().EndsWith("\n")) sb.AppendLine();

        if (!string.IsNullOrWhiteSpace(comment))
        {
            sb.AppendLine($"# {comment.Trim()}");
        }

        var cronLine = $"{schedule.Trim()} {command.Trim()}";
        if (!enabled)
        {
            cronLine = $"# {cronLine}";
        }
        sb.AppendLine(cronLine);

        await SaveRawCrontabAsync(hostId, sb.ToString());

        var jobs = await GetCronJobsAsync(hostId);
        return jobs.LastOrDefault() ?? new CronJobItem
        {
            Schedule = schedule,
            Command = command,
            Comment = comment,
            IsEnabled = enabled,
            ScheduleDescription = DescribeSchedule(schedule)
        };
    }

    public async Task<CronJobItem> UpdateCronJobAsync(string hostId, int lineIndex, string schedule, string command, string comment, bool enabled)
    {
        var raw = await GetRawCrontabAsync(hostId);
        var lines = raw.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None).ToList();

        if (lineIndex < 0 || lineIndex >= lines.Count)
        {
            throw new ArgumentOutOfRangeException(nameof(lineIndex), "Invalid cron line index");
        }

        var cronLine = $"{schedule.Trim()} {command.Trim()}";
        if (!enabled)
        {
            cronLine = $"# {cronLine}";
        }

        // Check if preceding line is a comment
        if (lineIndex > 0 && lines[lineIndex - 1].Trim().StartsWith('#') && !TryParseCronLine(lines[lineIndex - 1].Trim().TrimStart('#').Trim(), out _, out _))
        {
            if (!string.IsNullOrWhiteSpace(comment))
            {
                lines[lineIndex - 1] = $"# {comment.Trim()}";
            }
            else
            {
                lines.RemoveAt(lineIndex - 1);
                lineIndex--;
            }
        }
        else if (!string.IsNullOrWhiteSpace(comment))
        {
            lines.Insert(lineIndex, $"# {comment.Trim()}");
            lineIndex++;
        }

        lines[lineIndex] = cronLine;
        await SaveRawCrontabAsync(hostId, string.Join("\n", lines));

        var jobs = await GetCronJobsAsync(hostId);
        return jobs.FirstOrDefault(j => j.LineIndex == lineIndex) ?? new CronJobItem
        {
            LineIndex = lineIndex,
            Schedule = schedule,
            Command = command,
            Comment = comment,
            IsEnabled = enabled,
            ScheduleDescription = DescribeSchedule(schedule)
        };
    }

    public async Task DeleteCronJobAsync(string hostId, int lineIndex)
    {
        var raw = await GetRawCrontabAsync(hostId);
        var lines = raw.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None).ToList();

        if (lineIndex < 0 || lineIndex >= lines.Count)
        {
            throw new ArgumentOutOfRangeException(nameof(lineIndex), "Invalid cron line index");
        }

        // If previous line was a comment for this job, remove it too
        if (lineIndex > 0 && lines[lineIndex - 1].Trim().StartsWith('#') && !TryParseCronLine(lines[lineIndex - 1].Trim().TrimStart('#').Trim(), out _, out _))
        {
            lines.RemoveAt(lineIndex - 1);
            lineIndex--;
        }

        lines.RemoveAt(lineIndex);
        await SaveRawCrontabAsync(hostId, string.Join("\n", lines));
    }

    public async Task<CronJobItem> ToggleCronJobAsync(string hostId, int lineIndex)
    {
        var raw = await GetRawCrontabAsync(hostId);
        var lines = raw.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None).ToList();

        if (lineIndex < 0 || lineIndex >= lines.Count)
        {
            throw new ArgumentOutOfRangeException(nameof(lineIndex), "Invalid cron line index");
        }

        var currentLine = lines[lineIndex].Trim();
        if (currentLine.StartsWith('#'))
        {
            // Enable it
            var stripped = currentLine.TrimStart('#').Trim();
            lines[lineIndex] = stripped;
        }
        else
        {
            // Disable it
            lines[lineIndex] = $"# {currentLine}";
        }

        await SaveRawCrontabAsync(hostId, string.Join("\n", lines));
        var jobs = await GetCronJobsAsync(hostId);
        return jobs.FirstOrDefault(j => j.LineIndex == lineIndex) ?? new CronJobItem { LineIndex = lineIndex };
    }

    public async Task<CronExecutionResult> RunCronCommandAsync(string hostId, string command)
    {
        var host = await _hostService.GetHostEntityAsync(hostId)
            ?? throw new KeyNotFoundException($"Host '{hostId}' not found");

        var sw = Stopwatch.StartNew();
        var result = await _ssh.RunCommandAsync(host, command, 60);
        sw.Stop();

        return new CronExecutionResult
        {
            ExitCode = result.ExitCode,
            Output = result.Output,
            Error = result.Error,
            DurationMs = sw.ElapsedMilliseconds
        };
    }

    private static bool TryParseCronLine(string line, out string schedule, out string command)
    {
        schedule = "";
        command = "";
        if (string.IsNullOrWhiteSpace(line)) return false;

        // Special shorthand tags: @reboot, @daily, @hourly, @weekly, @monthly, @yearly
        if (line.StartsWith('@'))
        {
            var parts = line.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 2)
            {
                schedule = parts[0];
                command = parts[1];
                return true;
            }
            return false;
        }

        // Standard 5-field cron (min hour day month weekday command...)
        var tokens = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length >= 6)
        {
            schedule = string.Join(" ", tokens.Take(5));
            command = string.Join(" ", tokens.Skip(5));
            return true;
        }

        return false;
    }

    public static string DescribeSchedule(string schedule)
    {
        var s = schedule.Trim().ToLowerInvariant();
        return s switch
        {
            "@reboot" => "Once at system reboot",
            "@hourly" or "0 * * * *" => "Every hour (at minute 0)",
            "@daily" or "@midnight" or "0 0 * * *" => "Every day at midnight (00:00)",
            "@weekly" or "0 0 * * 0" => "Every Sunday at midnight (00:00)",
            "@monthly" or "0 0 1 * *" => "1st day of every month at midnight",
            "@yearly" or "@annually" or "0 0 1 1 *" => "Once a year (Jan 1, 00:00)",
            "* * * * *" => "Every minute",
            "*/5 * * * *" => "Every 5 minutes",
            "*/10 * * * *" => "Every 10 minutes",
            "*/15 * * * *" => "Every 15 minutes",
            "*/30 * * * *" => "Every 30 minutes",
            "0 */2 * * *" => "Every 2 hours",
            "0 */6 * * *" => "Every 6 hours",
            "0 */12 * * *" => "Every 12 hours",
            "0 2 * * *" => "Every day at 02:00 AM",
            "0 4 * * *" => "Every day at 04:00 AM",
            _ => $"Custom schedule: {schedule}"
        };
    }
}
