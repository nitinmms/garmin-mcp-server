using GarminCoach.Core;
using Xunit;

namespace GarminCoach.Core.Tests;

/// <summary>A fake child process whose readiness and exit are controlled by the test.</summary>
public sealed class FakeServerProcess : IGarminServerProcess
{
    public GarminServerLaunchOptions? Options { get; private set; }
    public bool Started { get; private set; }
    public bool Killed { get; private set; }
    public bool ExitImmediately { get; set; }

    public bool HasExited => ExitImmediately || Killed;

    public void Start(GarminServerLaunchOptions options)
    {
        Options = options;
        Started = true;
        if (ExitImmediately) return;
    }

    public void Kill() => Killed = true;
    public void Dispose() { }
}

public class EmbeddedGarminServerTests
{
    [Fact]
    public async Task Starts_the_process_and_reports_the_base_url_when_health_answers()
    {
        var process = new FakeServerProcess();
        Uri? probed = null;
        var server = new EmbeddedGarminServer(
            new GarminServerLaunchOptions { Port = 8123 },
            (uri, _) => { probed = uri; return Task.FromResult(true); },
            () => process);

        Assert.True(await server.StartAsync());

        Assert.True(process.Started);
        Assert.True(server.IsRunning);
        Assert.Null(server.Error);
        Assert.Equal("http://127.0.0.1:8123/", server.BaseUrl);
        Assert.Equal("http://127.0.0.1:8123/health", probed!.ToString());
    }

    [Fact]
    public async Task Fails_when_the_server_process_exits_immediately()
    {
        var process = new FakeServerProcess { ExitImmediately = true };
        var server = new EmbeddedGarminServer(
            new GarminServerLaunchOptions { StartupTimeout = TimeSpan.FromMilliseconds(300), PollInterval = TimeSpan.FromMilliseconds(20) },
            (_, _) => Task.FromResult(false),
            () => process);

        Assert.False(await server.StartAsync());
        Assert.False(server.IsRunning);
        Assert.Contains("stopped immediately", server.Error);
    }

    [Fact]
    public async Task Stops_the_process_it_started()
    {
        var process = new FakeServerProcess();
        var server = new EmbeddedGarminServer(new GarminServerLaunchOptions(), (_, _) => Task.FromResult(true), () => process);

        await server.StartAsync();
        await server.StopAsync();

        Assert.True(process.Killed);
        Assert.False(server.IsRunning);
    }
}