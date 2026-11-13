using System.Globalization;
using System.Text.Json.Nodes;

namespace GarminCoach.Core;

/// <summary>Reads the raw JSON returned by the Garmin MCP tools into coach-friendly records.</summary>
public static class GarminPayloadReader
{
    private static readonly string[] CyclingKeys =
    {
        "cycling", "road_biking", "mountain_biking", "gravel_cycling", "indoor_cycling",
        "virtual_ride", "cyclocross", "track_cycling", "commuter", "e_bike_fitness", "bmx",
    };

    public static bool IsCycling(string? activityTypeKey)
    {
        if (string.IsNullOrWhiteSpace(activityTypeKey)) return false;
        var key = activityTypeKey.Trim().ToLowerInvariant();
        return CyclingKeys.Contains(key) || key.Contains("cycl") || key.Contains("bik");
    }

    public static IReadOnlyList<ActivityItem> ParseActivities(JsonNode? node)
    {
        var rides = new List<ActivityItem>();
        foreach (var activity in Objects(node))
        {
            var typeKey = Text(activity["activityType"]?["activityTypeKey"]) ?? Text(activity["activityTypeKey"]);
            if (!IsCycling(typeKey)) continue;
            var start = Text(activity["startTimeLocal"]) ?? Text(activity["startTimeGmt"]) ?? "";
            var distance = Number(activity["distance"]) ?? 0;
            var duration = Number(activity["duration"]) ?? 0;
            rides.Add(new ActivityItem(
                ISO(start),
                typeKey ?? "cycling",
                Math.Round(distance / 1000.0, 2),
                (int)Math.Round(duration / 60.0)));
        }
        return rides;
    }

    public static IReadOnlyList<DailyLoad> ParseDailyLoad(JsonNode? node)
    {
        var load = new List<DailyLoad>();
        foreach (var day in Objects(node))
        {
            var dateText = Date(day);
            if (dateText is null) continue;
            var value = Number(day["activeKilocalories"]) ?? Number(day["totalKilocalories"])
                        ?? Number(day["intensityMinutes"]) ?? Number(day["activeTimeInSeconds"]);
            if (value is null) continue;
            load.Add(new DailyLoad(dateText, (long)Math.Round(value.Value)));
        }
        return load;
    }

    public static IReadOnlyList<DailySleep> ParseSleep(JsonNode? node)
    {
        var sleep = new List<DailySleep>();
        foreach (var day in Objects(node))
        {
            var dateText = Date(day);
            if (dateText is null) continue;
            var seconds = Number(day["sleepTimeSeconds"]) ?? Number(day["sleepingSeconds"] ?? day["durationInSeconds"]);
            if (seconds is null) continue;
            sleep.Add(new DailySleep(dateText, (int)Math.Round(seconds.Value / 60.0)));
        }
        return sleep;
    }

    public static IReadOnlyList<DailyHrv> ParseHrv(JsonNode? node)
    {
        var hrv = new List<DailyHrv>();
        foreach (var day in Objects(node))
        {
            var dateText = Date(day);
            if (dateText is null) continue;
            var value = Number(day["lastNightAvg"]) ?? Number(day["weeklyAvg"]) ?? Number(day["hrvValue"]);
            if (value is null) continue;
            hrv.Add(new DailyHrv(dateText, (int)Math.Round(value.Value)));
        }
        return hrv;
    }

    public static IReadOnlyList<DailyBodyBattery> ParseBodyBattery(JsonNode? node)
    {
        var battery = new List<DailyBodyBattery>();
        foreach (var day in Objects(node))
        {
            var dateText = Date(day);
            if (dateText is null) continue;
            var low = LowestBattery(day);
            if (low is null) continue;
            battery.Add(new DailyBodyBattery(dateText, (int)Math.Round(low.Value)));
        }
        return battery;
    }

    public static ProfileSnapshot ParseProfile(JsonNode? node, string source)
    {
        if (node is not JsonObject profile) return new ProfileSnapshot(null, null, null);
        var birth = Text(profile["birthDate"]) ?? Text(profile["birthdate"]);
        var age = ComputeAge(birth);
        var gender = NormalizeGender(Text(profile["gender"]) ?? Text(profile["sex"]));
        return new ProfileSnapshot(age, gender, source);
    }

    public static string? ComputeAge(string? birthDate, DateOnly? today = null)
    {
        if (string.IsNullOrWhiteSpace(birthDate)) return null;
        if (!DateOnly.TryParse(birthDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var born)) return null;
        var reference = today ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var years = reference.Year - born.Year;
        if (reference.DayOfYear < born.DayOfYear) years--;
        return years is >= 0 and < 120 ? years.ToString(CultureInfo.InvariantCulture) : null;
    }

    public static string? NormalizeGender(string? gender)
    {
        if (string.IsNullOrWhiteSpace(gender)) return null;
        return gender.Trim().ToLowerInvariant() switch
        {
            "male" or "m" => "male",
            "female" or "f" => "female",
            _ => gender.Trim().ToLowerInvariant(),
        };
    }

    private static double? LowestBattery(JsonObject day)
    {
        var levels = new List<double>();
        foreach (var key in new[] { "bodyBatteryValuesArray", "values", "levels" })
        {
            if (day[key] is not JsonArray array) continue;
            foreach (var entry in array)
            {
                var value = entry is JsonArray pair && pair.Count > 1 ? Number(pair[1]) : Number(entry?["bodyBatteryLevel"]);
                if (value is not null) levels.Add(value.Value);
            }
        }
        if (levels.Count > 0) return levels.Min();
        return Number(day["lowestBodyBatteryLevel"]) ?? Number(day["endBodyBatteryLevel"])
               ?? Number(day["mostRecentBodyBatteryLevel"]);
    }

    private static IEnumerable<JsonObject> Objects(JsonNode? node)
    {
        if (node is JsonObject single && (single["calendarDate"] != null || single["date"] != null))
        {
            yield return single;
            yield break;
        }
        foreach (var candidate in Arrays(node))
        {
            if (candidate is JsonObject obj) yield return obj;
        }
    }

    private static IEnumerable<JsonNode?> Arrays(JsonNode? node)
    {
        switch (node)
        {
            case JsonArray array:
                foreach (var item in array) yield return item;
                break;
            case JsonObject obj:
                foreach (var pair in obj)
                {
                    if (pair.Value is JsonArray nested)
                    {
                        foreach (var item in nested) yield return item;
                    }
                }
                break;
        }
    }

    private static string? Date(JsonObject day) =>
        ISO(Text(day["calendarDate"]) ?? Text(day["date"]) ?? Text(day["startTimeLocal"]));

    private static string ISO(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var text = value.Trim();
        return text.Length >= 10 && text[4] == '-' ? text[..10] : text;
    }

    private static string? Text(JsonNode? node)
    {
        if (node is null) return null;
        return node.GetValueKind() switch
        {
            System.Text.Json.JsonValueKind.String => node.GetValue<string>(),
            System.Text.Json.JsonValueKind.Number => node.ToJsonString(),
            System.Text.Json.JsonValueKind.True => "true",
            System.Text.Json.JsonValueKind.False => "false",
            _ => null,
        };
    }

    private static double? Number(JsonNode? node)
    {
        if (node is null) return null;
        return node.GetValueKind() switch
        {
            System.Text.Json.JsonValueKind.Number => node.GetValue<double>(),
            System.Text.Json.JsonValueKind.String when double.TryParse(node.GetValue<string>(), out var parsed) => parsed,
            _ => null,
        };
    }
}