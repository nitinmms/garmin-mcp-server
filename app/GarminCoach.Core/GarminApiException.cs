namespace GarminCoach.Core;

/// <summary>A user-facing failure. The message is safe to show and never contains a credential.</summary>
public sealed class GarminApiException : Exception
{
    public GarminApiException(string message, Exception? inner = null) : base(message, inner) { }
}

public static class FriendlyErrors
{
    public const string MissingGarminKey =
        "Add your Garmin personal API key in Settings, then tap \u201cWhat should I ride today?\u201d again.";

    public static GarminApiException MissingGarminKeyError() => new(MissingGarminKey);

    public static GarminApiException RejectedGarminKey() => new(
        "Garmin rejected your personal API key. Create a new one in Garmin Connect and paste it in Settings.");

    public static GarminApiException ServerUnreachable(string url, Exception? inner = null) => new(
        $"Could not reach the Garmin MCP server at {url}. Check that it is running and try again.", inner);

    public static GarminApiException MissingAiKey() => new(
        "Add your OpenAI or Anthropic API key in Settings and pick a model before asking for a session.");

    public static string Describe(Exception exception, string serverUrl) => exception switch
    {
        GarminApiException garmin => garmin.Message,
        TaskCanceledException => "The request timed out. Check your connection and try again.",
        HttpRequestException => ServerUnreachable(serverUrl, exception).Message,
        _ => "Something went wrong while building your session. No workout was invented; please try again.",
    };
}