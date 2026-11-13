using GarminCoach.Core;

namespace GarminCoach.Services;

/// <summary>Where the app gets the local MCP server it can start for the user.</summary>
public interface ILocalServer
{
    bool IsRunning { get; }
    Task<bool> StartAsync();
}

/// <summary>Combines the app-managed server with the configured MCP client.</summary>
public sealed class LocalGarminMcpServer : ILocalServer
{
    private readonly IEmbeddedGarminServer _server;
    public LocalGarminMcpServer(IEmbeddedGarminServer server) => _server = server;
    public bool IsRunning => _server.IsRunning;
    public Task<bool> StartAsync() => _server.StartAsync();
}

/// <summary>State the Blazor views bind to. Kept alive for the life of the app.</summary>
public sealed class CoachViewModel
{
    private readonly CoachService _coach;
    private readonly ILocalServer _server;

    public CoachViewModel(CoachService coach, ILocalServer server, SettingsStore settings)
    {
        _coach = coach;
        _server = server;
        Settings = settings;
    }

    public SettingsStore Settings { get; }
    public Recommendation? Recommendation => _coach.LastRecommendation;
    public string? Error => _coach.Error;
    public IReadOnlyList<ToolCallRecord> Activity => _coach.Activity;
    public GarminSignalSummary Signals => _coach.Signals;
    public bool HasSignals => _coach.HasSignals;
    public string ServerUrl => _coach.ServerUrl;
    public string? TestResult { get; private set; }

    public async Task RunAsync()
    {
        TestResult = null;
        await _server.StartAsync();
        await _coach.RunAsync();
    }

    public async Task<string> TestConnectionAsync()
    {
        TestResult = await _coach.TestConnectionAsync();
        return TestResult;
    }
}