namespace GarminCoach.Core;

/// <summary>How the app starts the bundled Garmin MCP server, and on which address.</summary>
public sealed class GarminServerLaunchOptions
{
    /// <summary>The Python interpreter or launcher to run.</summary>
    public string Command { get; set; } = "python";

    /// <summary>Arguments that run the server_runner module (Streamable HTTP on a thread).</summary>
    public string Arguments { get; set; } = "-m garmin_mcp.server_runner";

    /// <summary>Directory the server runs in (the checkout that has the garmin_mcp package).</summary>
    public string? WorkingDirectory { get; set; }

    public string Host { get; set; } = GarminMcpServer.DefaultHost;

    public int Port { get; set; } = GarminMcpServer.DefaultPort;

    public TimeSpan StartupTimeout { get; set; } = TimeSpan.FromSeconds(20);

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromMilliseconds(250);
}

/// <summary>
/// Runs the Garmin MCP server for the app so a user does not have to manage a separate
/// service. Implementations start the bundled Python server, wait until it answers
/// /health, and stop it again when asked.
/// </summary>
public interface IEmbeddedGarminServer
{
    bool IsRunning { get; }

    string BaseUrl { get; }

    string? Error { get; }

    Task<bool> StartAsync(CancellationToken cancellationToken = default);

    Task StopAsync(CancellationToken cancellationToken = default);
}