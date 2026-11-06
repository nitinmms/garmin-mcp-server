using System.Globalization;
using System.Text.Json.Nodes;

namespace GarminCoach.Core;

/// <summary>
/// Calls the Garmin MCP server's read-only tools for the last 7 days plus age and gender,
/// recording every call so the Activity view can show the trace.
/// </summary>
public sealed class GarminDataCollector
{
    private readonly GarminMcpClient _client;
    private readonly Func<DateOnly> _today;
    private readonly Func<ProfileSnapshot> _manualProfile;

    public GarminDataCollector(GarminMcpClient client, Func<DateOnly>? today = null, Func<ProfileSnapshot>? manualProfile = null)
    {
        _client = client;
        _today = today ?? (() => DateOnly.FromDateTime(DateTime.UtcNow));
        _manualProfile = manualProfile ?? (() => new ProfileSnapshot(null, null, null));
    }

    public async Task<AgentActivityContext> CollectAsync(AgentActivityContext context, CancellationToken cancellationToken = default)
    {
        var end = _today();
        var start = end.AddDays(-6);
        var range = ToolCallArguments.Range(Iso(start), Iso(end));

        var activities = await CallAsync(context, "search_activities", range, cancellationToken,
            ("start_date", Iso(start)), ("end_date", Iso(end)), ("activity_type", "cycling"), ("limit", 100));

        var daily = await CallAsync(context, "get_daily_summaries", range, cancellationToken,
            ("start_date", Iso(start)), ("end_date", Iso(end)));

        var sleep = await CallAsync(context, "get_sleep_summaries", range, cancellationToken,
            ("start_date", Iso(start)), ("end_date", Iso(end)));

        var hrv = await CallAsync(context, "get_hrv_range", range, cancellationToken,
            ("start_date", Iso(start)), ("end_date", Iso(end)));

        var battery = await CallAsync(context, "get_body_battery", range, cancellationToken,
            ("start_date", Iso(start)), ("end_date", Iso(end)), ("include_samples", false));

        var profileJson = await CallAsync(context, "get_profile_settings", "current profile", cancellationToken);

        var inputs = new SignalInputs
        {
            Rides = GarminPayloadReader.ParseActivities(activities),
            DailyLoad = GarminPayloadReader.ParseDailyLoad(daily),
            DailySleep = GarminPayloadReader.ParseSleep(sleep),
            DailyHrv = GarminPayloadReader.ParseHrv(hrv),
            DailyBodyBattery = GarminPayloadReader.ParseBodyBattery(battery),
        };

        context.SetData(inputs, MergeProfile(profileJson));
        return context;
    }

    public ProfileSnapshot MergeProfile(JsonNode? profileJson)
    {
        var fetched = GarminPayloadReader.ParseProfile(profileJson, "garmin profile");
        var manual = _manualProfile();
        var age = !string.IsNullOrWhiteSpace(fetched.Age) ? fetched.Age : manual.Age;
        var gender = !string.IsNullOrWhiteSpace(fetched.Gender) ? fetched.Gender : manual.Gender;
        var source = fetched.Age is not null || fetched.Gender is not null
            ? fetched.Source
            : string.IsNullOrWhiteSpace(manual.Age) && string.IsNullOrWhiteSpace(manual.Gender) ? null : manual.Source;
        return new ProfileSnapshot(age, gender, source);
    }

    private async Task<JsonNode?> CallAsync(AgentActivityContext context, string toolName, string summary,
        CancellationToken cancellationToken, params (string Key, object? Value)[] arguments)
    {
        var dictionary = arguments.ToDictionary(pair => pair.Key, pair => pair.Value);
        var rendered = string.Join(", ", arguments
            .Where(pair => pair.Value is not null)
            .Select(pair => $"{pair.Key}={Render(pair.Value!)}"));
        context.Log.Record(toolName, rendered, summary);
        return await _client.CallToolAsync(toolName, dictionary, cancellationToken);
    }

    private static string Render(object value) => value switch
    {
        bool flag => flag ? "true" : "false",
        string text => text,
        _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? "",
    };

    private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}