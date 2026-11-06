namespace GarminCoach.Core;

/// <summary>Read-only facts the UI shows about how the app runs its own MCP server.</summary>
public sealed class AppRuntimeInfo
{
    public AppRuntimeInfo(IEmbeddedGarminServer server, string version)
    {
        Server = server;
        Version = version;
    }

    public IEmbeddedGarminServer Server { get; }
    public string Version { get; }
    public bool RunsServerInProcess => Server.IsRunning;
    public string ServerUrl => Server.BaseUrl;
}