using System.Text.Json;

namespace GarminCoach.Core;

/// <summary>Parses the model's structured-output JSON into a <see cref="Recommendation"/>.</summary>
public static class RecommendationParser
{
    public static Recommendation Parse(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new GarminApiException("The model returned an empty session.");
        }

        var cleaned = StripCodeFence(json.Trim());
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(cleaned);
        }
        catch (JsonException exception)
        {
            throw new GarminApiException("The model did not return a usable session. Please try again.", exception);
        }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                throw new GarminApiException("The model did not return a usable session. Please try again.");
            }

            var recommendation = new Recommendation
            {
                WorkoutType = String(root, "workoutType"),
                DurationMinutes = Int(root, "durationMinutes"),
                IntensityZone = String(root, "intensityZone"),
                Structure = Steps(root),
                Reasoning = String(root, "reasoning"),
                MissingSignals = StringArray(root, "missingSignals"),
            };

            var problems = RecommendationLimits.Validate(recommendation);
            if (problems.Count > 0)
            {
                throw new GarminApiException(
                    "The model's session was incomplete (" + string.Join(" ", problems) +
                    "). Nothing was shown so that no workout is invented.");
            }
            return recommendation;
        }
    }

    private static string StripCodeFence(string text)
    {
        if (!text.StartsWith("```", StringComparison.Ordinal)) return text;
        var firstNewline = text.IndexOf('\n');
        if (firstNewline < 0) return text;
        var end = text.LastIndexOf("```", StringComparison.Ordinal);
        if (end <= firstNewline) return text;
        return text[(firstNewline + 1)..end].Trim();
    }

    private static string String(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : "";

    private static int Int(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value)) return 0;
        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(value.GetString(), out var parsed) => parsed,
            _ => 0,
        };
    }

    private static IReadOnlyList<WorkoutStep> Steps(JsonElement root)
    {
        if (!root.TryGetProperty("structure", out var steps) || steps.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<WorkoutStep>();
        }
        var list = new List<WorkoutStep>();
        var order = 1;
        foreach (var step in steps.EnumerateArray())
        {
            if (step.ValueKind == JsonValueKind.String)
            {
                list.Add(new WorkoutStep(order++, step.GetString() ?? ""));
            }
            else if (step.ValueKind == JsonValueKind.Object)
            {
                var description = String(step, "description");
                if (string.IsNullOrWhiteSpace(description)) description = String(step, "text");
                if (!string.IsNullOrWhiteSpace(description)) list.Add(new WorkoutStep(order++, description));
            }
        }
        return list;
    }

    private static IReadOnlyList<string> StringArray(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var array) || array.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<string>();
        }
        var list = new List<string>();
        foreach (var item in array.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var value = item.GetString();
                if (!string.IsNullOrWhiteSpace(value)) list.Add(value);
            }
        }
        return list;
    }
}