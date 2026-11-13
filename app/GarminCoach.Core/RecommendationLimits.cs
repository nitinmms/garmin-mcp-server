namespace GarminCoach.Core;

/// <summary>Sanity-checks a recommendation so the UI never shows an impossible workout.</summary>
public static class RecommendationLimits
{
    public const int MinDurationMinutes = 15;
    public const int MaxDurationMinutes = 300;

    public static IReadOnlyList<string> Validate(Recommendation recommendation)
    {
        var problems = new List<string>();
        if (string.IsNullOrWhiteSpace(recommendation.WorkoutType))
        {
            problems.Add("Workout type is missing.");
        }
        if (string.IsNullOrWhiteSpace(recommendation.IntensityZone))
        {
            problems.Add("Target intensity zone is missing.");
        }
        if (recommendation.DurationMinutes < MinDurationMinutes || recommendation.DurationMinutes > MaxDurationMinutes)
        {
            problems.Add($"Duration must be between {MinDurationMinutes} and {MaxDurationMinutes} minutes.");
        }
        if (recommendation.Structure.Count == 0)
        {
            problems.Add("No step-by-step structure was provided.");
        }
        if (string.IsNullOrWhiteSpace(recommendation.Reasoning))
        {
            problems.Add("No reasoning was provided.");
        }
        return problems;
    }

    public static bool IsValid(Recommendation recommendation) => Validate(recommendation).Count == 0;
}