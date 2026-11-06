using System.Text.Json.Nodes;
using GarminCoach.Core;
using Xunit;

namespace GarminCoach.Core.Tests;

public class GarminMcpServerTests
{
    [Fact]
    public void Create_defaults_to_the_emulator_host_address_and_adds_a_slash()
    {
        Assert.Equal("http://10.0.2.2:8000/", GarminMcpServer.Create(null).BaseUrl);
        Assert.Equal("http://10.0.2.2:8000/", GarminMcpServer.Create("   ").BaseUrl);
        Assert.Equal("http://192.168.1.5:9000/", GarminMcpServer.Create("192.168.1.5:9000").BaseUrl);
        Assert.Equal("https://box.local:8000/", GarminMcpServer.Create("https://box.local:8000/").BaseUrl);
    }

    [Theory]
    [InlineData("10.0.2.2", true)]
    [InlineData("127.0.0.1", true)]
    [InlineData("localhost", true)]
    [InlineData("api.example.com", false)]
    public void IsLocalHost_recognises_device_local_addresses(string host, bool expected)
    {
        Assert.Equal(expected, GarminMcpServer.IsLocalHostName(host));
    }

    [Fact]
    public void NormalizePort_and_host_fall_back_to_defaults()
    {
        Assert.Equal(8000, GarminMcpServer.NormalizePort(0));
        Assert.Equal(8000, GarminMcpServer.NormalizePort(70000));
        Assert.Equal(8123, GarminMcpServer.NormalizePort(8123));
        Assert.Equal("127.0.0.1", GarminMcpServer.NormalizeHost(null));
        Assert.Equal("127.0.0.1", GarminMcpServer.NormalizeHost(" "));
    }
}

public class GarminDataCollectorTests
{
    private static FakeGarminToolClient HappyClient() => new FakeGarminToolClient()
        .Result("search_activities", """
        [{"activityType":{"activityTypeKey":"cycling"},"startTimeLocal":"2026-11-01T08:00:00","distance":30000,"duration":3600}]
        """)
        .Result("get_daily_summaries", """[{"calendarDate":"2026-11-01","activeKilocalories":600}]""")
        .Result("get_sleep_summaries", """[{"calendarDate":"2026-11-01","sleepTimeSeconds":27000}]""")
        .Result("get_hrv_range", """[{"calendarDate":"2026-11-01","lastNightAvg":52}]""")
        .Result("get_body_battery", """[{"date":"2026-11-01","lowestBodyBatteryLevel":20}]""")
        .Result("get_profile_settings", """{"birthDate":"1990-05-01","gender":"MALE"}""");

    [Fact]
    public async Task Collects_only_read_only_tools_and_records_the_trace()
    {
        var client = HappyClient();
        var context = new AgentActivityContext();
        await new GarminDataCollector(client, () => new DateOnly(2026, 11, 6)).CollectAsync(context);

        Assert.All(client.Calls, name => Assert.True(McpToolCatalog.IsReadOnly(name), name));
        Assert.Equal(McpToolCatalog.Coaching.OrderBy(x => x), client.Calls.OrderBy(x => x));
        Assert.Equal(client.Calls.Count, context.Log.Records.Count);
        Assert.True(context.Collected);
    }

    [Fact]
    public async Task Turns_payloads_into_signals_and_profile()
    {
        var context = new AgentActivityContext();
        await new GarminDataCollector(HappyClient(), () => new DateOnly(2026, 11, 6)).CollectAsync(context);

        Assert.Equal(600, context.Summary.TotalLoad);
        Assert.Single(context.Summary.Rides);
        Assert.Single(context.Summary.DailyHrv);
        Assert.Equal("male", context.Profile.Gender);
        Assert.False(string.IsNullOrWhiteSpace(context.Profile.Age));
    }

    [Fact]
    public async Task Uses_manual_age_and_gender_when_garmin_returns_none()
    {
        var client = HappyClient().Result("get_profile_settings", """{}""");
        var context = new AgentActivityContext();
        await new GarminDataCollector(client, () => new DateOnly(2026, 11, 6),
            () => new ProfileSnapshot("41", "female", "entered in Settings")).CollectAsync(context);

        Assert.Equal("41", context.Profile.Age);
        Assert.Equal("female", context.Profile.Gender);
    }
}

public class CoachServiceTests
{
    private static FakeGarminToolClient Data() => new FakeGarminToolClient()
        .Result("search_activities", """[]""")
        .Result("get_daily_summaries", """[{"calendarDate":"2026-11-01","activeKilocalories":600}]""")
        .Result("get_sleep_summaries", """[{"calendarDate":"2026-11-01","sleepTimeSeconds":27000}]""")
        .Result("get_hrv_range", """[{"calendarDate":"2026-11-01","lastNightAvg":52}]""")
        .Result("get_body_battery", """[{"date":"2026-11-01","lowestBodyBatteryLevel":20}]""")
        .Result("get_profile_settings", """{"birthDate":"1990-05-01","gender":"MALE"}""");

    [Fact]
    public async Task Runs_the_whole_flow_and_returns_a_session()
    {
        var chat = new StubChatClient(Payloads.Good);
        var coach = new CoachService(Data(), () => chat);

        Assert.True(await coach.RunAsync());

        Assert.Null(coach.Error);
        Assert.NotNull(coach.LastRecommendation);
        Assert.Equal("Endurance ride", coach.LastRecommendation!.WorkoutType);
        Assert.Equal(6, coach.Activity.Count);
        Assert.True(coach.HasSignals);
        Assert.Equal(1, chat.Calls);
    }

    [Fact]
    public async Task Reports_a_missing_ai_key_without_inventing_a_session()
    {
        var coach = new CoachService(Data(), () => null);

        Assert.False(await coach.RunAsync());

        Assert.Null(coach.LastRecommendation);
        Assert.Equal(FriendlyErrors.MissingAiKey().Message, coach.Error);
    }

    [Fact]
    public async Task Surfaces_garmin_failures_and_keeps_no_recommendation()
    {
        var client = Data();
        client.FailWith = new GarminApiException("Garmin rejected your personal API key.");
        var coach = new CoachService(client, () => new StubChatClient(Payloads.Good));

        Assert.False(await coach.RunAsync());
        Assert.Null(coach.LastRecommendation);
        Assert.Equal("Garmin rejected your personal API key.", coach.Error);
    }

    [Fact]
    public async Task Rejects_an_out_of_range_model_answer()
    {
        var coach = new CoachService(Data(), () => new StubChatClient(Payloads.TooShort));

        Assert.False(await coach.RunAsync());
        Assert.Null(coach.LastRecommendation);
        Assert.Contains("incomplete", coach.Error!);
    }

    [Fact]
    public async Task Test_connection_lists_the_read_only_tools()
    {
        var client = Data();
        client.ToolCount = 21;
        var coach = new CoachService(client, () => null);

        var message = await coach.TestConnectionAsync();

        Assert.Contains("Connected", message);
        Assert.Contains("21", message);
    }
}

public class RecommendationTests
{
    [Fact]
    public void Parses_structure_from_strings_and_objects()
    {
        var recommendation = RecommendationParser.Parse("""
        {"workoutType":"Tempo","durationMinutes":60,"intensityZone":"Zone 3",
         "structure":["warm-up",{"description":"3 x 10 min tempo"}],
         "reasoning":"HRV steady","missingSignals":["HRV"]}
        """);

        Assert.Equal(2, recommendation.Structure.Count);
        Assert.Equal("3 x 10 min tempo", recommendation.Structure[1].Description);
        Assert.Single(recommendation.MissingSignals);
        Assert.Equal("1h 00m", recommendation.DurationText);
    }

    [Fact]
    public void Limits_flag_a_session_that_is_too_short_or_empty()
    {
        var problems = RecommendationLimits.Validate(new Recommendation { DurationMinutes = 5 });
        Assert.Contains(problems, p => p.Contains("Duration"));
        Assert.Contains(problems, p => p.Contains("Workout type"));
        Assert.False(RecommendationLimits.IsValid(new Recommendation()));
    }
}