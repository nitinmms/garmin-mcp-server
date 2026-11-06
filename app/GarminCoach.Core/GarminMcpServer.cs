namespace GarminCoach.Core;

/// <summary>Where to reach the Garmin MCP server, and the Garmin key to use for the connection.</summary>
public sealed record GarminMcpServer(string BaseUrl, string ToolNamespace = "garmin")
{
    public const string DefaultBaseUrl = "http://10.0.2.2:8000";

    public static GarminMcpServer Create(string? baseUrl) =>
        new(string.IsNullOrWhiteSpace(baseUrl) ? DefaultBaseUrl : baseUrl.Trim());
}