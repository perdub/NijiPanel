using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

var webRoot = EmbeddedAssetsManager.EnsureWebRoot();
builder.Environment.WebRootPath = webRoot;
var fileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRoot);
builder.Environment.WebRootFileProvider = fileProvider;

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ICacheService, CacheService>();
builder.Services.AddSingleton<DatabaseContext>();
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
builder.Services.AddSingleton<IConnectionLogService, ConnectionLogService>();
builder.Services.AddSingleton<IAuthService, AuthService>();
builder.Services.AddSingleton<ISettingsService, SettingsService>();
builder.Services.AddSingleton<ISshConnectionManager, SshConnectionManager>();
builder.Services.AddScoped<IHostService, HostService>();
builder.Services.AddScoped<ISftpService, SftpService>();
builder.Services.AddScoped<IDockerService, DockerService>();
builder.Services.AddScoped<IHostExtrasService, HostExtrasService>();
builder.Services.AddSingleton<ITunnelService, TunnelService>();
builder.Services.AddSingleton<IUtilsService, UtilsService>();
builder.Services.AddSingleton<ITerminalSessionManager, TerminalSessionManager>();
builder.Services.AddScoped<IDirectTransferService, DirectTransferService>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddScoped<IFileShareService, FileShareService>();
builder.Services.AddScoped<ICronService, CronService>();
builder.Services.AddScoped<ISystemdService, SystemdService>();
builder.Services.AddScoped<ILinuxUserService, LinuxUserService>();
builder.Services.AddScoped<IPackageUpdateService, PackageUpdateService>();
builder.Services.AddSingleton<IMetricsHistoryService, MetricsHistoryService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IBenchmarkService, BenchmarkService>();
builder.Services.AddScoped<IFirewallService, FirewallService>();
builder.Services.AddSingleton<IPasskeyService, PasskeyService>();
builder.Services.AddScoped<IHostNetworkService, HostNetworkService>();
builder.Services.AddSingleton<ICommandRegistry, CommandRegistry>();

var jwtSecret = builder.Configuration["JWT_SECRET"];
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    var secretFile = Path.Combine(AppContext.BaseDirectory, "data", "jwt.key");
    Directory.CreateDirectory(Path.GetDirectoryName(secretFile)!);
    if (File.Exists(secretFile))
    {
        jwtSecret = File.ReadAllText(secretFile).Trim();
    }
    else
    {
        var randomBytes = new byte[64];
        System.Security.Cryptography.RandomNumberGenerator.Fill(randomBytes);
        jwtSecret = Convert.ToBase64String(randomBytes);
        File.WriteAllText(secretFile, jwtSecret);
    }
}
var jwtKey = Encoding.UTF8.GetBytes(jwtSecret.PadRight(64, '!')[..64]);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(jwtKey),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };

    // Support token in query string for WebSockets
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/ws"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// Add CORS for development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseCors("AllowAll");
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
});

// Serve frontend static files
app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Terminal REST endpoints for host-side session inspection and deletion
app.MapGet("/api/hosts/{hostId}/terminal/sessions", async (string hostId, IHostService hostService, ITerminalSessionManager termManager) =>
{
    var host = await hostService.GetHostEntityAsync(hostId);
    if (host == null) return Results.NotFound();
    var sessions = await termManager.GetHostSessionsAsync(host);
    return Results.Ok(sessions);
});

app.MapDelete("/api/terminal/sessions/{sessionId}", async (string sessionId, bool? killHost, ITerminalSessionManager termManager) =>
{
    await termManager.CloseSessionAsync(sessionId, killHost ?? false);
    return Results.Ok(new { success = true });
});

// WebSocket endpoint for persistent interactive terminal
app.Map("/ws/terminal", async (HttpContext context, IHostService hostService, ITerminalSessionManager termManager) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var hostId = context.Request.Query["hostId"].ToString();
    if (string.IsNullOrEmpty(hostId))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var host = await hostService.GetHostEntityAsync(hostId);
    if (host == null)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    var sessionId = context.Request.Query["sessionId"].ToString();
    var containerId = context.Request.Query["containerId"].ToString();
    var initialDir = context.Request.Query["initialDir"].ToString();
    int? tabIndex = int.TryParse(context.Request.Query["tabIndex"], out var ti) ? ti : null;
    uint.TryParse(context.Request.Query["cols"], out var cols);
    uint.TryParse(context.Request.Query["rows"], out var rows);

    var ws = await context.WebSockets.AcceptWebSocketAsync();
    await termManager.HandleWebSocketAsync(
        ws,
        host,
        string.IsNullOrEmpty(sessionId) ? null : sessionId,
        cols,
        rows,
        string.IsNullOrEmpty(containerId) ? null : containerId,
        tabIndex,
        string.IsNullOrEmpty(initialDir) ? null : initialDir);
}).RequireAuthorization();

app.Map("/ws/docker-exec", async (HttpContext context, IHostService hostService, ITerminalSessionManager termManager) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var hostId = context.Request.Query["hostId"].ToString();
    if (string.IsNullOrEmpty(hostId))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var host = await hostService.GetHostEntityAsync(hostId);
    if (host == null)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    var sessionId = context.Request.Query["sessionId"].ToString();
    var containerId = context.Request.Query["containerId"].ToString();
    uint.TryParse(context.Request.Query["cols"], out var cols);
    uint.TryParse(context.Request.Query["rows"], out var rows);

    var ws = await context.WebSockets.AcceptWebSocketAsync();
    await termManager.HandleWebSocketAsync(
        ws,
        host,
        string.IsNullOrEmpty(sessionId) ? null : sessionId,
        cols,
        rows,
        string.IsNullOrEmpty(containerId) ? null : containerId);
}).RequireAuthorization();

// SPA fallback for frontend client-side routing
app.MapFallback(async context =>
{
    var indexPath = Path.Combine(webRoot, "index.html");
    if (File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
    }
});

app.Run();
