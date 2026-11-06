using System.ClientModel;
using Microsoft.Extensions.AI;
using OpenAI;

namespace GarminCoach.Core;

/// <summary>Builds the chat client for the provider and model chosen in Settings.</summary>
public static class AiClientFactory
{
    /// <summary>Anthropic exposes an OpenAI-compatible chat-completions API at this base URL.</summary>
    public const string AnthropicBaseUrl = "https://api.anthropic.com/v1";

    public static IChatClient Create(AiSettings settings)
    {
        if (!settings.IsConfigured)
        {
            throw FriendlyErrors.MissingAiKey();
        }

        var options = new OpenAIClientOptions();
        if (string.Equals(settings.Provider, AiSettings.Anthropic, StringComparison.OrdinalIgnoreCase))
        {
            options.Endpoint = new Uri(AnthropicBaseUrl);
        }

        var client = new OpenAIClient(new ApiKeyCredential(settings.ApiKey.Trim()), options);
        return client.GetChatClient(settings.Model.Trim()).AsIChatClient();
    }
}