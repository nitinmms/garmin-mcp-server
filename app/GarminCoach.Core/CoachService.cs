using System.Text.Json.Nodes;
using Microsoft.Extensions.AI;

namespace GarminCoach.Core;

/// <summary>Supplies the chat client for the configured AI provider, or null when unset.</summary>
public delegate IChatClient? ChatClientProvider();

/// <summary>
/// The .NET coach: gathers the last 7 days of Garmin signals through the read-only MCP
/// tools, shows the user exactly which tools ran, asks the model for one session, and
/// sanity-checks the answer. It never invents a workout when a step fails.
/// </summary>
public sealed class CoachService
{
    private readonly IGarminToolClient _client;
    private readonly ChatClientProvider _chatClient;
    private readonly AgentActivityContext _context;

    public CoachService(IGarminToolClient client, ChatClientProvider chatClient, AgentActivityContext? context = null)
    {
        _client = client;
        _chatClient = chatClient;
        _context = context ?? new AgentActivityContext();
    }

    public AgentActivityContext Context => _context;
    public IReadOnlyList<ToolCallRecord> Activity => _context.Log.Records;
    public GarminSignalSummary Signals => _context.Summary;
    public bool HasSignals => _context.Summary.HasAnyData;
    public string ServerUrl => _client.ServerUrl;
    public Recommendation? LastRecommendation { get; private set; }
    public string? Error { get; private set; }

    /// <summary>Asks for a session. Any failure is reported through <see cref="Error"/>.</summary>
    public async Task<bool> RunAsync(CancellationToken cancellationToken = default)
    {
        Error = null;
        LastRecommendation = null;
        _context.Clear();
        try
        {
            await new GarminDataCollector(_client).CollectAsync(_context, cancellationToken);
            var chat = _chatClient();
            if (chat is null) throw FriendlyErrors.MissingAiKey();
            var text = await AskAsync(chat, _context, cancellationToken);
            LastRecommendation = RecommendationParser.Parse(text);
            return true;
        }
        catch (OperationCanceledException)
        {
            Error = "The request timed out. Check your connection and try again.";
            return false;
        }
        catch (Exception exception)
        {
            Error = FriendlyErrors.Describe(exception, _client.ServerUrl);
            return false;
        }
    }

    /// <summary>Lists the read-only tools so the user can confirm the server is reachable.</summary>
    public async Task<string> TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var tools = await _client.GetReadOnlyToolsAsync(cancellationToken);
            return $"Connected to the Garmin MCP server at {_client.ServerUrl} — {tools.Count} read-only tools available.";
        }
        catch (Exception exception)
        {
            return FriendlyErrors.Describe(exception, _client.ServerUrl);
        }
    }

    /// <summary>Asks the model for one session, offering it only the read-only Garmin tools.</summary>
    public async Task<string> AskAsync(IChatClient chat, AgentActivityContext context, CancellationToken cancellationToken = default)
    {
        var tools = await _client.GetReadOnlyToolsAsync(cancellationToken);
        var options = new ChatOptions { Tools = tools.ToList(), ToolMode = ChatToolMode.Auto };
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, SystemPrompt),
            new(ChatRole.User, BuildUserPrompt(context.DataJson)),
        };
        var response = await chat.GetResponseAsync(messages, options, cancellationToken);
        return response.Text ?? "";
    }

    public static string BuildUserPrompt(string dataJson) =>
        "Here are the last 7 days of my Garmin signals as JSON. Recommend exactly one cycling " +
        "session for today and reply with only the JSON object described above.\n\n" + dataJson;

    public const string SystemPrompt =
        "You are a cycling coach. Using the supplied Garmin signals and the read-only Garmin " +
        "tools (which you may call for more detail), recommend exactly one training session " +
        "for today. Reply with a single JSON object using the keys workoutType, durationMinutes " +
        "(integer), intensityZone, structure (array of step descriptions in order), reasoning, " +
        "and missingSignals (array of signal names you could not read). Never invent data.";
}