using System.Text.Json.Nodes;
using Microsoft.Extensions.AI;

namespace GarminCoach.Core;

/// <summary>
/// The read-only Garmin MCP surface the coach needs: the tools to offer the model,
/// the address to report in errors, and a guarded way to call one tool.
/// </summary>
public interface IGarminToolClient
{
    string ServerUrl { get; }

    Task<IReadOnlyList<AITool>> GetReadOnlyToolsAsync(CancellationToken cancellationToken = default);

    Task<JsonNode?> CallToolAsync(string toolName, IReadOnlyDictionary<string, object?> arguments,
        CancellationToken cancellationToken = default);
}