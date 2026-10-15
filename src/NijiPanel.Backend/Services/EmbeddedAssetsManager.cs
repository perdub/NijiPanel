using System.Reflection;
using Microsoft.Extensions.Logging;

namespace NijiPanel.Backend.Services;

public static class EmbeddedAssetsManager
{
    public static string EnsureWebRoot(ILogger? logger = null)
    {
        // 1. Check existing candidates on disk
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "wwwroot"),
            Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            Path.Combine(Directory.GetCurrentDirectory(), "src", "NijiPanel.Backend", "wwwroot"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "wwwroot"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "src", "NijiPanel.Backend", "wwwroot")
        };

        foreach (var c in candidates)
        {
            if (Directory.Exists(c) && File.Exists(Path.Combine(c, "index.html")))
            {
                var full = Path.GetFullPath(c);
                logger?.LogInformation("Using physical WebRoot: {Path}", full);
                return full;
            }
        }

        // 2. Extract embedded resources to target directory
        string targetDir = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        try
        {
            Directory.CreateDirectory(targetDir);
            var testFile = Path.Combine(targetDir, ".write_test");
            File.WriteAllText(testFile, "test");
            File.Delete(testFile);
        }
        catch
        {
            // Fallback to temp directory if BaseDirectory is not writable (e.g. read-only mount)
            targetDir = Path.Combine(Path.GetTempPath(), "nijipanel_wwwroot");
            Directory.CreateDirectory(targetDir);
        }

        var versionFile = Path.Combine(targetDir, ".version");
        var asm = typeof(EmbeddedAssetsManager).Assembly;
        var currentVersion = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion 
            ?? asm.GetName().Version?.ToString() 
            ?? "1.0.0";

        if (!File.Exists(versionFile) || File.ReadAllText(versionFile).Trim() != currentVersion)
        {
            ExtractEmbeddedWebRoot(targetDir, logger);
            try { File.WriteAllText(versionFile, currentVersion); } catch { }
        }

        return targetDir;
    }

    private static void ExtractEmbeddedWebRoot(string targetDir, ILogger? logger)
    {
        var asm = typeof(EmbeddedAssetsManager).Assembly;
        var names = asm.GetManifestResourceNames();
        const string prefix = "wwwroot/";

        int count = 0;
        foreach (var name in names)
        {
            if (!name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;

            var relPath = name[prefix.Length..];
            relPath = relPath.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
            var destPath = Path.Combine(targetDir, relPath);

            var dir = Path.GetDirectoryName(destPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            using var stream = asm.GetManifestResourceStream(name);
            if (stream == null) continue;

            using var fileStream = File.Create(destPath);
            stream.CopyTo(fileStream);
            count++;
        }

        logger?.LogInformation("Extracted {Count} embedded frontend assets to {TargetDir}", count, targetDir);
    }

    public static Stream? GetCommandsJsonStream()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "commands.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "commands.json"),
            Path.Combine(AppContext.BaseDirectory, "../../../commands.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "src/NijiPanel.Backend/commands.json")
        };

        foreach (var c in candidates)
        {
            if (File.Exists(c))
            {
                return File.OpenRead(Path.GetFullPath(c));
            }
        }

        return typeof(EmbeddedAssetsManager).Assembly.GetManifestResourceStream("commands.json");
    }
}
