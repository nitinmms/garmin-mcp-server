using System.Diagnostics;
using System.Globalization;

namespace GarminCoach.Core;

/// <summary>A started child process, isolated so the embedded-server logic can be unit tested.</summary>
public interface IGarminServerProcess : IDisposable
{
    bool HasExited { get; }

    void Start(GarminServerLaunchOptions options);

    void Kill();
}

/// <summary>Starts a real child process, handing it the bind host and port through the environment.</summary>
public sealed class SystemGarminServerProcess : IGarminServerProcess
{
    private Process? _process;

    public bool HasExited => _process is null || _process.HasExited;

    public void Start(GarminServerLaunchOptions options)
    {
        var info = new ProcessStartInfo(options.Command, options.Arguments)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        if (!string.IsNullOrWhiteSpace(options.WorkingDirectory))
        {
            info.WorkingDirectory = options.WorkingDirectory!;
        }
        info.Environment["GARMIN_MCP_HTTP_HOST"] = options.Host;
        info.Environment["GARMIN_MCP_HTTP_PORT"] = options.Port.ToString(CultureInfo.InvariantCulture);
        _process = Process.Start(info) ?? throw new InvalidOperationException("The Garmin MCP server process did not start.");
    }

    public void Kill()
    {
        if (_process is { HasExited: false })
        {
            _process.Kill(entireProcessTree: true);
        }
    }

    public void Dispose()
    {
        _process?.Dispose();
        _process = null;
    }
}