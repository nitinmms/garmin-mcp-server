namespace GarminCoach.Core;

/// <summary>The AI provider/model/credential the user picks in Settings.</summary>
public sealed class AiSettings
{
    public const string OpenAi = "openai";
    public const string Anthropic = "anthropic";

    /// <summary>Endpoints that accept an OpenAI-compatible chat-completions API.</summary>
    public static IReadOnlyList<string> Providers { get; } = new[] { OpenAi, Anthropic };

    /// <summary>A small, cheap, broad default model catalog. The user can type any model id instead.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> Catalog { get; } =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [OpenAi] = new[] { "gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1" },
            [Anthropic] = new[] { "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-7-sonnet-latest" },
        };

    public string Provider { get; set; } = OpenAi;
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "gpt-4o-mini";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(Model);

    public static string DefaultModel(string provider) =>
        NormalizeProvider(provider) == Anthropic ? "claude-3-5-sonnet-latest" : "gpt-4o-mini";

    public static bool IsKnownProvider(string? provider) =>
        provider is not null && Providers.Contains(provider.Trim().ToLowerInvariant());

    private static string NormalizeProvider(string? provider) =>
        IsKnownProvider(provider) ? provider!.Trim().ToLowerInvariant() : OpenAi;
}