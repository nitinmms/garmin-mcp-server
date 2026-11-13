namespace GarminCoach.Core;

public sealed record SignalChip(string Label, string Value, string Trend)
{
    public static SignalChip Missing(string label) => new(label, "No data", "unavailable");
}

public sealed record WorkoutStep(int Order, string Description);

/// <summary>The single recommended workout for today.</summary>
public sealed record Recommendation
{
    public string WorkoutType { get; init; } = "";
    public int DurationMinutes { get; init; }
    public string IntensityZone { get; init; } = "";
    public IReadOnlyList<WorkoutStep> Structure { get; init; } = Array.Empty<WorkoutStep>();
    public string Reasoning { get; init; } = "";
    public IReadOnlyList<string> MissingSignals { get; init; } = Array.Empty<string>();

    public string DurationText => DurationMinutes >= 60
        ? $"{DurationMinutes / 60}h {DurationMinutes % 60:00}m"
        : $"{DurationMinutes} min";
}

public sealed record ActivityItem(string Date, string Type, double DistanceKm, int DurationMinutes);

public sealed record DailyLoad(string Date, long Load);

public sealed record DailySleep(string Date, int Minutes);

public sealed record DailyHrv(string Date, int Value);

public sealed record DailyBodyBattery(string Date, int Low);

/// <summary>Raw signals for the last 7 days, as fetched through the MCP read-only tools.</summary>
public sealed record SignalInputs
{
    public IReadOnlyList<ActivityItem> Rides { get; init; } = Array.Empty<ActivityItem>();
    public IReadOnlyList<DailyLoad> DailyLoad { get; init; } = Array.Empty<DailyLoad>();
    public IReadOnlyList<DailySleep> DailySleep { get; init; } = Array.Empty<DailySleep>();
    public IReadOnlyList<DailyHrv> DailyHrv { get; init; } = Array.Empty<DailyHrv>();
    public IReadOnlyList<DailyBodyBattery> DailyBodyBattery { get; init; } = Array.Empty<DailyBodyBattery>();
}

/// <summary>Derived, display-ready signals: the chips, the weekly series and what was missing.</summary>
public sealed class GarminSignalSummary
{
    public long TotalLoad { get; init; }
    public double? AverageSleepHours { get; init; }
    public int? AverageHrv { get; init; }
    public int? LowestBodyBattery { get; init; }
    public IReadOnlyList<SignalChip> Chips { get; init; } = Array.Empty<SignalChip>();
    public IReadOnlyList<DailyLoad> DailyLoad { get; init; } = Array.Empty<DailyLoad>();
    public IReadOnlyList<DailySleep> DailySleep { get; init; } = Array.Empty<DailySleep>();
    public IReadOnlyList<DailyHrv> DailyHrv { get; init; } = Array.Empty<DailyHrv>();
    public IReadOnlyList<ActivityItem> Rides { get; init; } = Array.Empty<ActivityItem>();
    public IReadOnlyList<string> MissingSignals { get; init; } = Array.Empty<string>();

    public bool HasAnyData => DailyLoad.Count > 0 || DailySleep.Count > 0 || DailyHrv.Count > 0;
}

public sealed record ProfileSnapshot(string? Age, string? Gender, string? Source);