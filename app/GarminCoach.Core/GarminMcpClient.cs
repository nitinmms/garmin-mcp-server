using System.Text.Json.Nodes;
using Microsoft.Extensions.AI;
using ModelContextProtocol;
using ModelContextProtocol.Client;

namespace GarminCoach.Core;

/// <summary>
/// Speaks MCP to the Garmin server over the opt-in Streamable HTTP transport.
/// Every Garmin request the app makes goes through here - the app never calls Garmin directly.
/// Only read-only tools are offered to the agent.
/// </summary>
public sealed class GarminMcpClient : IGarminToolClient, IAsyncDisposable
{
    private readonly GarminMcpServer _server;
    private readonly Func<string> _garminApiKey;
    private readonly HttpClient? _httpClient;
    private McpClient? _client;

    public GarminMcpClient(GarminMcpServer server, Func<string> garminApiKey, HttpClient? httpClient = null)
    {
        _server = server;
        _garminApiKey = garminApiKey;
        _httpClient = httpClient;
    }

    /// <summary>The server address, safe to show to the user in an error message.</summary>
    public string ServerUrl => _server.BaseUrl;

    public async Task<McpClient> ConnectAsync(CancellationToken cancellationToken = default)
    {
        if (_client is not null) return _client;

        var key = _garminApiKey()?.Trim() ?? "";
        if (key.Length == 0) throw FriendlyErrors.MissingGarminKeyError();

        var options = new HttpClientTransportOptions
        {
            Endpoint = _server.Endpoint,
            TransportMode = HttpTransportMode.StreamableHttp,
            AdditionalHeaders = new Dictionary<string, string> { ["X-Garmin-Api-Key"] = key },
            ConnectionTimeout = TimeSpan.FromSeconds(30),
        };

        try
        {
            var transport = _httpClient is null
                ? new HttpClientTransport(options)
                : new HttpClientTransport(options, _httpClient);
            _client = await McpClient.CreateAsync(transport, cancellationToken: cancellationToken);
        }
        catch (Exception exception)
        {
            throw FriendlyErrors.ServerUnreachable(_server.BaseUrl, exception);
        }
        return _client;
    }

    /// <summary>The read-only tools, as M.E.AI functions the agent can call.</summary>
    public async Task<IReadOnlyList<AITool>> GetReadOnlyToolsAsync(CancellationToken cancellationToken = default)
    {
        var client = await ConnectAsync(cancellationToken);
        IList<McpClientTool> tools = await client.ListToolsAsync(cancellationToken: cancellationToken);
        return tools.Cast<AITool>().ToList();
    }

    public async Task<JsonNode?> CallToolAsync(string toolName, IReadOnlyDictionary<string, object?> arguments,
        CancellationToken cancellationToken = default)
    {
        if (!McpToolCatalog.IsReadOnly(toolName))
        {
            throw new GarminApiException($"'{toolName}' is not an allowed read-only Garmin tool.");
        }

        var client = await ConnectAsync(cancellationToken);
        try
        {
            var result = await client.CallToolAsync(toolName, Compact(arguments), cancellationToken: cancellationToken);
            var text = TextOf(result);
            if (result.IsError == true)
            {
                throw MapServerError(text, _server.BaseUrl);
            }
            if (string.IsNullOrWhiteSpace(text)) return null;
            return JsonNode.Parse(text);
        }
        catch (GarminApiException) { throw; }
        catch (Exception exception)
        {
            throw FriendlyErrors.ServerUnreachable(_server.BaseUrl, exception);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_client is not null)
        {
            await _client.DisposeAsync();
            _client = null;
        }
    }

    public static GarminApiException MapServerError(string? text, string serverUrl)
    {
        var detail = text ?? "";
        if (detail.Contains("rejected", StringComparison.OrdinalIgnoreCase) ||
            detail.Contains("401", StringComparison.Ordinal) ||
            detail.Contains("403", StringComparison.Ordinal) ||
            detail.Contains("not set", StringComparison.OrdinalIgnoreCase))
        {
            return FriendlyErrors.RejectedGarminKey();
        }
        return new GarminApiException(
            "Garmin data could not be read. No session was created from invented data. Please try again.");
    }

    private static string TextOf(ModelContextProtocol.Protocol.CallToolResult result)
    {
        var contents = AIContentExtensions.ToAIContents(result.Content);
        return string.Concat(contents.OfType<TextContent>().Select(item => item.Text));
    }

    private static IReadOnlyDictionary<string, object?> Compact(IReadOnlyDictionary<string, object?> arguments) =>
        arguments.Where(pair => pair.Value is not null)
                 .ToDictionary(pair => pair.Key, pair => pair.Value);
}