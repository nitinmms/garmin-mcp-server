using System.Text.Json.Nodes;
using GarminCoach.Core;
using Microsoft.Extensions.AI;

namespace GarminCoach.Core.Tests;

/// <summary>An in-memory Garmin MCP client: canned payloads, a tool list, and a call trace.</summary>
public sealed class FakeGarminToolClient : IGarminToolClient
{
    private readonly Dictionary<string, JsonNode?> _results = new();
    public List<string> Calls { get; } = new();
    public int ToolCount { get; set; } = 21;
    public string ServerUrl { get; set; } = "http://10.0.2.2:8000/";
    public Exception? FailWith { get; set; }

    public FakeGarminToolClient Result(string tool, string json) { _results[tool] = JsonNode.Parse(json); return this; }

    public Task<IReadOnlyList<AITool>> GetReadOnlyToolsAsync(CancellationToken cancellationToken = default)
    {
        if (FailWith is not null) throw FailWith;
        var tools = Enumerable.Range(0, ToolCount)
            .Select(i => (AITool)AIFunctionFactory.Create(() => "ok", new AIFunctionFactoryOptions { Name = $"tool_{i}" }))
            .ToList();
        return Task.FromResult<IReadOnlyList<AITool>>(tools);
    }

    public Task<JsonNode?> CallToolAsync(string toolName, IReadOnlyDictionary<string, object?> arguments,
        CancellationToken cancellationToken = default)
    {
        Calls.Add(toolName);
        if (!McpToolCatalog.IsReadOnly(toolName))
            throw new GarminApiException($"'{toolName}' is not an allowed read-only Garmin tool.");
        if (FailWith is not null) throw FailWith;
        return Task.FromResult(_results.TryGetValue(toolName, out var node) ? node?.DeepClone() : null);
    }
}

/// <summary>A chat client that returns one fixed reply, so the coach can be tested offline.</summary>
public sealed class StubChatClient : IChatClient
{
    private readonly string _reply;
    public int Calls { get; private set; }
    public StubChatClient(string reply) => _reply = reply;

    public Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        Calls++;
        return Task.FromResult(new ChatResponse(new ChatMessage(ChatRole.Assistant, _reply)));
    }

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages,
        ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    public object? GetService(Type serviceType, object? serviceKey = null) => null;
    public void Dispose() { }
}

public static class Payloads
{
    public const string Good = """
    {"workoutType":"Endurance ride","durationMinutes":75,"intensityZone":"Zone 2",
     "structure":["15 min warm-up","45 min steady","15 min cool-down"],
     "reasoning":"HRV steady and sleep good.","missingSignals":[]}
    """;

    public const string TooShort = """
    {"workoutType":"Sprint","durationMinutes":5,"intensityZone":"Zone 5",
     "structure":["go hard"],"reasoning":"because"}
    """;
}