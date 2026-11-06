using System.Reflection;

namespace GarminCoach.Core;

/// <summary>Application version and User-Agent, stripped of any SourceLink build metadata.</summary>
public static class AppVersion
{
    public static string Current { get; } = Read();

    public static string UserAgent => "garmin-coach-maui/" + Current;

    private static string Read()
    {
        var assembly = typeof(AppVersion).Assembly;
        var value = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (string.IsNullOrWhiteSpace(value))
        {
            value = assembly.GetName().Version?.ToString() ?? "unknown";
        }
        var plus = value.IndexOf('+');
        return plus >= 0 ? value[..plus] : value;
    }
}