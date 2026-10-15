using System.Globalization;
using System.Text.RegularExpressions;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface IBenchmarkService
{
    Task<BenchmarkResultDto> RunBenchmarkAsync(HostEntity host);
}

public class BenchmarkService : IBenchmarkService
{
    private readonly ISshConnectionManager _sshManager;
    private readonly INotificationService _notificationService;
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ILogger<BenchmarkService> _logger;

    public BenchmarkService(
        ISshConnectionManager sshManager,
        INotificationService notificationService,
        ICommandRegistry cmdRegistry,
        ILogger<BenchmarkService> logger)
    {
        _sshManager = sshManager;
        _notificationService = notificationService;
        _cmdRegistry = cmdRegistry;
        _logger = logger;
    }

    public async Task<BenchmarkResultDto> RunBenchmarkAsync(HostEntity host)
    {
        var benchScript = _cmdRegistry.GetCommand("System.HardwareBenchmark");
        var timeout = _cmdRegistry.GetTimeout("System.HardwareBenchmark", 35);

        var (exitCode, output, error) = await _sshManager.RunCommandAsync(host, benchScript, timeoutSeconds: timeout);
        if (string.IsNullOrEmpty(output) && exitCode != 0)
        {
            throw new InvalidOperationException($"Benchmark failed on host {host.Name}: {error}");
        }

        // Parse CPU
        double cpuMBps = 0.0;
        long cpuOps = 0;
        string cpuFormatted = "N/A";
        var cpuSection = ExtractSection(output, "CPU");
        if (!string.IsNullOrEmpty(cpuSection))
        {
            var match = Regex.Match(cpuSection, @"([0-9]+[.,]?[0-9]*)\s*([kKMmGg]?)b?\/s|(\d+[.,]?\d*)\s*k", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var numStr = (match.Groups[1].Success ? match.Groups[1].Value : match.Groups[3].Value).Replace(',', '.');
                if (double.TryParse(numStr, CultureInfo.InvariantCulture, out var val))
                {
                    if (cpuSection.Contains('k', StringComparison.OrdinalIgnoreCase))
                    {
                        cpuMBps = Math.Round(val / 1024.0, 1);
                    }
                    else
                    {
                        cpuMBps = Math.Round(val, 1);
                    }
                    cpuOps = (long)(cpuMBps * 3500);
                    cpuFormatted = $"{cpuMBps} MB/s";
                }
            }
        }

        // Parse DISK
        double diskMBps = 0.0;
        string diskFormatted = "N/A";
        var diskSection = ExtractSection(output, "DISK");
        if (!string.IsNullOrEmpty(diskSection))
        {
            // E.g.: "268 MB/s" or "1.2 GB/s" or "54.2 MB/s" or "250,4 MB/s"
            var match = Regex.Match(diskSection, @"([0-9]+[.,]?[0-9]*)\s*([MGK]B\/s|MB\/s|GB\/s|kB\/s)", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var numStr = match.Groups[1].Value.Replace(',', '.');
                if (double.TryParse(numStr, CultureInfo.InvariantCulture, out var dval))
                {
                    var unit = match.Groups[2].Value.ToUpperInvariant();
                    if (unit.StartsWith("GB"))
                    {
                        diskMBps = Math.Round(dval * 1024.0, 1);
                    }
                    else if (unit.StartsWith("KB"))
                    {
                        diskMBps = Math.Round(dval / 1024.0, 1);
                    }
                    else
                    {
                        diskMBps = Math.Round(dval, 1);
                    }
                    diskFormatted = diskMBps >= 1000 ? $"{Math.Round(diskMBps / 1024.0, 2)} GB/s" : $"{diskMBps} MB/s";
                }
            }
        }

        // Parse PING
        double pingAvgMs = 0.0;
        string pingFormatted = "N/A";
        var pingSection = ExtractSection(output, "PING");
        if (!string.IsNullOrEmpty(pingSection))
        {
            // rtt min/avg/max/mdev = 12.345/14.567/18.910/2.123 ms
            var match = Regex.Match(pingSection, @"=\s*([0-9]+[.,]?[0-9]*)\/([0-9]+[.,]?[0-9]*)\/([0-9]+[.,]?[0-9]*)", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var numStr = match.Groups[2].Value.Replace(',', '.');
                if (double.TryParse(numStr, CultureInfo.InvariantCulture, out var pAvg))
                {
                    pingAvgMs = Math.Round(pAvg, 1);
                    pingFormatted = $"{pingAvgMs} ms";
                }
            }
        }

        // Calculate Overall Health Score (0 - 100)
        // Disk score (0-40)
        int diskScore = diskMBps switch
        {
            >= 1000 => 40,
            >= 500 => 36,
            >= 250 => 30,
            >= 100 => 22,
            >= 50 => 16,
            > 0 => 10,
            _ => 0
        };

        // CPU score (0-40)
        int cpuScore = cpuMBps switch
        {
            >= 800 => 40,
            >= 400 => 35,
            >= 200 => 28,
            >= 100 => 20,
            > 0 => 12,
            _ => 0
        };

        // Ping score (0-20)
        int pingScore = pingAvgMs switch
        {
            <= 0 => 0,
            <= 10 => 20,
            <= 25 => 18,
            <= 50 => 15,
            <= 100 => 11,
            <= 200 => 6,
            _ => 2
        };

        int totalScore = Math.Clamp(diskScore + cpuScore + pingScore, 0, 100);
        var now = DateTime.UtcNow;
        var summary = $"Score {totalScore}/100 (Disk: {diskFormatted}, CPU: {cpuFormatted}, Ping: {pingFormatted})";

        // Auto-create notification in Notification Center
        await _notificationService.CreateNotificationAsync(
            title: $"Benchmark completed for {host.Name}",
            message: $"Score {totalScore}/100! (Disk: {diskFormatted}, CPU: {cpuOps:N0} ops, Ping: {pingFormatted})",
            severity: totalScore >= 70 ? "info" : "warning",
            hostId: host.Id
        );

        return new BenchmarkResultDto(
            host.Id,
            host.Name,
            totalScore,
            diskMBps,
            diskFormatted,
            cpuOps,
            cpuFormatted,
            pingAvgMs,
            pingFormatted,
            now,
            summary
        );
    }

    private static string ExtractSection(string text, string tag)
    {
        var startTag = $"==={tag}===";
        var idx = text.IndexOf(startTag, StringComparison.Ordinal);
        if (idx == -1) return "";
        idx += startTag.Length;
        var nextIdx = text.IndexOf("===", idx, StringComparison.Ordinal);
        return (nextIdx == -1 ? text[idx..] : text[idx..nextIdx]).Trim();
    }
}
