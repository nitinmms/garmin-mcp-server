namespace GarminCoach.Core;

/// <summary>Turns raw Garmin payloads into the chips, weekly series and missing-signal notes.</summary>
public static class GarminSignalAnalyzer
{
    public static GarminSignalSummary Summarize(SignalInputs inputs)
    {
        var load = inputs.DailyLoad ?? Array.Empty<DailyLoad>();
        var sleep = inputs.DailySleep ?? Array.Empty<DailySleep>();
        var hrv = inputs.DailyHrv ?? Array.Empty<DailyHrv>();
        var battery = inputs.DailyBodyBattery ?? Array.Empty<DailyBodyBattery>();
        var rides = inputs.Rides ?? Array.Empty<ActivityItem>();

        var totalLoad = load.Sum(d => d.Load);
        double? avgSleep = sleep.Count > 0 ? sleep.Average(d => d.Minutes) / 60.0 : null;
        int? avgHrv = hrv.Count > 0 ? (int)Math.Round(hrv.Average(d => d.Value)) : null;
        int? lowestBattery = battery.Count > 0 ? battery.Min(d => d.Low) : null;

        var chips = new List<SignalChip>
        {
            load.Count > 0
                ? new SignalChip("Training load", totalLoad.ToString(), TrendForLoad(load))
                : SignalChip.Missing("Training load"),
            avgSleep is { } s
                ? new SignalChip("Sleep", $"{s:0.0} h/night", TrendForSleep(sleep))
                : SignalChip.Missing("Sleep"),
            avgHrv is { } h
                ? new SignalChip("HRV", $"{h} ms avg", TrendForHrv(hrv))
                : SignalChip.Missing("HRV"),
            lowestBattery is { } b
                ? new SignalChip("Body Battery", $"low {b}", TrendForBattery(battery))
                : SignalChip.Missing("Body Battery"),
        };

        var missing = chips.Where(c => c.Value == "No data").Select(c => c.Label).ToList();
        if (rides.Count == 0)
        {
            missing.Add("Rides this week");
        }

        return new GarminSignalSummary
        {
            TotalLoad = totalLoad,
            AverageSleepHours = avgSleep,
            AverageHrv = avgHrv,
            LowestBodyBattery = lowestBattery,
            Chips = chips,
            DailyLoad = load.OrderBy(d => d.Date, StringComparer.Ordinal).ToList(),
            DailySleep = sleep.OrderBy(d => d.Date, StringComparer.Ordinal).ToList(),
            DailyHrv = hrv.OrderBy(d => d.Date, StringComparer.Ordinal).ToList(),
            Rides = rides,
            MissingSignals = missing,
        };
    }

    public static string TrendForLoad(IReadOnlyList<DailyLoad> load)
    {
        if (load.Count < 2) return "steady";
        var half = load.Count / 2;
        var first = load.Take(half).Sum(d => d.Load);
        var second = load.Skip(half).Sum(d => d.Load);
        var delta = second - first;
        if (Math.Abs(delta) <= Math.Max(1, first * 0.1)) return "steady";
        return delta > 0 ? "rising" : "falling";
    }

    public static string TrendForSleep(IReadOnlyList<DailySleep> sleep) => TrendDirection(
        sleep.Select(d => (double)d.Minutes).ToList(), 20);

    public static string TrendForHrv(IReadOnlyList<DailyHrv> hrv) => TrendDirection(
        hrv.Select(d => (double)d.Value).ToList(), 1);

    public static string TrendForBattery(IReadOnlyList<DailyBodyBattery> battery) => TrendDirection(
        battery.Select(d => (double)d.Low).ToList(), 1);

    private static string TrendDirection(IReadOnlyList<double> values, double tolerance)
    {
        if (values.Count < 2) return "steady";
        var half = values.Count / 2;
        var first = values.Take(half).Average();
        var second = values.Skip(half).Average();
        var delta = second - first;
        if (Math.Abs(delta) < tolerance) return "steady";
        return delta > 0 ? "improving" : "declining";
    }
}