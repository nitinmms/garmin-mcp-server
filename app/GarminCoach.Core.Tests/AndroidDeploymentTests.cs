using System.Runtime.CompilerServices;
using Xunit;

namespace GarminCoach.Core.Tests;

/// <summary>
/// Guards the Android deployment settings that let the sample app install onto an
/// emulator whose internal data partition is too small for a MAUI debug build.
/// Without an install location the generated AndroidManifest.xml is internal-only,
/// and Visual Studio fails the deploy with
/// "ADB0010: ... Requested internal only, but not enough space".
/// </summary>
public class AndroidDeploymentTests
{
    [Fact]
    public void The_android_app_allows_installing_outside_internal_storage()
    {
        var csproj = File.ReadAllText(AppCsprojPath());

        Assert.Contains("<AndroidInstallLocation>auto</AndroidInstallLocation>", csproj);
        Assert.DoesNotContain("internalOnly", csproj);
    }

    [Fact]
    public void The_readme_documents_the_out_of_space_deploy_failure()
    {
        var readme = File.ReadAllText(ReadmePath());

        Assert.Contains("AndroidInstallLocation", readme);
        Assert.Contains("not enough space", readme, StringComparison.OrdinalIgnoreCase);
    }

    private static string AppCsprojPath([CallerFilePath] string testFile = "")
    {
        var candidate = Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(testFile)!, "..", "GarminCoach", "GarminCoach.csproj"));
        Assert.True(File.Exists(candidate), $"GarminCoach.csproj not found at {candidate}");
        return candidate;
    }

    private static string ReadmePath([CallerFilePath] string testFile = "")
    {
        var candidate = Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(testFile)!, "..", "..", "README.md"));
        Assert.True(File.Exists(candidate), $"README.md not found at {candidate}");
        return candidate;
    }
}