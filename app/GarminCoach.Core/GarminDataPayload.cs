using System.Text.Json.Nodes;

namespace GarminCoach.Core;

/// <summary>Selects the fields the coach needs out of the raw MCP tool replies, tolerating their shape.</summary>
public static class GarminDataPayload
{
    public static string Build(SignalInputs inputs, ProfileSnapshot profile)
    {
        if (inputs.Rides.Count == 0 && !inputs.DailyLoad.Any() && !inputs.DailySleep.Any() && !inputs.DailyHrv.Any())
        {
            throw new GarminApiException(
                "No Garmin data came back for the last 7 days, so no session can be recommended. " +
                "Check that your Garmin account is linked and try again.");
        }

        var payload = new JsonObject
        {
            ["profile"] = new JsonObject
            {
                ["age"] = profile.Age,
                ["gender"] = profile.Gender,
                ["source"] = profile.Source,
            },
            ["rides"] = new JsonArray(inputs.Rides.Select(r => (JsonNode)new JsonObject
            {
                ["date"] = r.Date,
                ["type"] = r.Type,
                ["distanceKm"] = Math.Round(r.DistanceKm, 1),
                ["durationMin"] = r.DurationMinutes,
            }).ToArray()),
            ["dailyLoad"] = new JsonArray(inputs.DailyLoad.Select(d => (JsonNode)new JsonObject
            {
                ["date"] = d.Date,
                ["load"] = d.Load,
            }).ToArray()),
            ["dailySleep"] = new JsonArray(inputs.DailySleep.Select(d => (JsonNode)new JsonObject
            {
                ["date"] = d.Date,
                ["minutes"] = d.Minutes,
            }).ToArray()),
            ["dailyHrv"] = new JsonArray(inputs.DailyHrv.Select(d => (JsonNode)new JsonObject
            {
                ["date"] = d.Date,
                ["value"] = d.Value,
            }).ToArray()),
            ["dailyBodyBattery"] = new JsonArray(inputs.DailyBodyBattery.Select(d => (JsonNode)new JsonObject
            {
                ["date"] = d.Date,
                ["low"] = d.Low,
            }).ToArray()),
        };
        return payload.ToJsonString();
    }
}