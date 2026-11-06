namespace GarminCoach.Core;

/// <summary>Ordered trace of the MCP tool calls the agent made, shown in the Activity view.</summary>
public sealed class ToolCallLog
{
    private readonly List<ToolCallRecord> _records = new();

    public IReadOnlyList<ToolCallRecord> Records => _records;

    public ToolCallRecord Record(string toolName, string arguments, string summary)
    {
        var record = new ToolCallRecord(_records.Count + 1, toolName, arguments, summary);
        _records.Add(record);
        return record;
    }

    public void Clear() => _records.Clear();
}

public sealed record ToolCallRecord(int Order, string ToolName, string Arguments, string Summary)
{
    public string Number => "#" + Order;

    public override string ToString() => $"{Number} {ToolName}({Arguments})";
}

/// <summary>Renders the tool arguments shown next to each call in the Activity view.</summary>
public static class ToolCallArguments
{
    /// <summary>Renders a date range as "2026-10-30..2026-11-05 (last 7 days)".</summary>
    public static string Range(string start, string end) => $"{start}..{end} (last 7 days)";
}