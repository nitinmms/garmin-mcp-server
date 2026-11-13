using System.Globalization;

namespace GarminCoach.Core;

/// <summary>
/// Starts the bundled Garmin MCP server (the Python Streamable HTTP transport) as a
/// supervised child process and waits until it answers /health. The app then talks to it
/// over the ordinary MCP client - the server is inside the app's own lifecycle.
/// </summary>
public sealed class EmbeddedGarminServer : IEmbeddedGarminServer
{
    private readonly GarminServerLaunchOptions _options;
    private readonly Func<Uri, CancellationToken, Task<bool>> _probe;
    private readonly Func<IGarminServerProcess> _processFactory;
    private IGarminServerProcess? _process;

    public EmbeddedGarminServer(
        GarminServerLaunchOptions? options = null,
        Func<Uri, CancellationToken, Task<bool>>? probe = null,
        Func<IGarminServerProcess>? processFactory = null)
    {
        _options = options ?? new GarminServerLaunchOptions();
        _probe = probe ?? ProbeHealthAsync;
        _processFactory = processFactory ?? (() => new SystemGarminServerProcess());
    }

    public bool IsRunning => _process is { HasExited: false };

    public string BaseUrl => string.Create(CultureInfo.InvariantCulture, $"http://{_options.Host}:{_options.Port}/");

    public string? Error { get; private set; }

    public async Task<bool> StartAsync(CancellationToken cancellationToken = default)
    {
        Error = null;
        if (IsRunning) return true;

        try
        {
            _process = _processFactory();
            _process.Start(_options);
        }
        catch (Exception exception)
        {
            Error = "Could not start the Garmin MCP server (" + exception.Message +
                    "). Install Python with 'uv sync' and try again.";
            _process = null;
            return false;
        }

        var health = new Uri(BaseUrl + "health");
        var deadline = DateTime.UtcNow + _options.StartupTimeout;
        while (DateTime.UtcNow < deadline)
        {
            if (_process.HasExited)
            {
                Error = "The Garmin MCP server stopped immediately after starting. Check that 'uv sync' has been run.";
                _process.Dispose();
                _process = null;
                return false;
            }
            try
            {
                if (await _probe(health, cancellationToken)) return true;
            }
            catch (OperationCanceledException) { throw; }
            catch { /* keep polling until the deadline */ }
            try
            {
                await Task.Delay(_options.PollInterval, cancellationToken);
            }
            catch (OperationCanceledException) { throw; }
        }

        Error = "The Garmin MCP server did not become ready in time. Check the server log and try again.";
        return false;
    }

    public Task StopAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _process?.Kill();
        }
        catch { /* the process may already be gone */ }
        _process?.Dispose();
        _process = null;
        return Task.CompletedTask;
    }

    private static async Task<bool> ProbeHealthAsync(Uri health, CancellationToken cancellationToken)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        using var response = await client.GetAsync(health, cancellationToken);
        return response.IsSuccessStatusCode;
    }
}