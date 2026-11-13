using System.Reflection;
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Routing;
using Xunit;

namespace GarminCoach.Core.Tests;

/// <summary>
/// Guards the Blazor route map that the MAUI WebView boots into.
/// The Android app used to crash on startup with
/// "Object of type 'Microsoft.AspNetCore.Components.Routing.Router' does not
/// have a property matching the name 'NotFoundPage'", because <c>NotFoundPage</c>
/// only exists on the .NET 10 Router while this app is built against the .NET 9
/// Components assemblies. The not-found UI therefore has to go through the
/// <c>NotFound</c> fragment. These tests pin both halves of that decision.
/// </summary>
public class BlazorRoutesTests
{
    [Fact]
    public void The_router_used_by_this_app_has_no_NotFoundPage_parameter()
    {
        var names = typeof(Router).GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain("NotFoundPage", names);
        Assert.Contains("NotFound", names);
    }

    [Fact]
    public async Task Supplying_NotFoundPage_to_the_router_throws_which_is_the_startup_crash_we_fixed()
    {
        var router = new Router();
        var parameters = ParameterView.FromDictionary(new Dictionary<string, object?>
        {
            ["AppAssembly"] = typeof(BlazorRoutesTests).Assembly,
            ["NotFoundPage"] = typeof(object),
        });

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => router.SetParametersAsync(parameters));
        Assert.Contains("NotFoundPage", error.Message);
    }

    [Fact]
    public void Routes_razor_renders_the_not_found_ui_from_the_NotFound_fragment_and_not_from_a_router_parameter()
    {
        var markup = File.ReadAllText(RoutesRazorPath());

        Assert.Contains("<NotFound>", markup);
        Assert.DoesNotContain("NotFoundPage=", markup);
    }

    [Fact]
    public void Routes_razor_points_the_router_at_the_application_assembly()
    {
        var markup = File.ReadAllText(RoutesRazorPath());
        Assert.Contains("AppAssembly=", markup);
        Assert.Contains("<Found Context=\"routeData\">", markup);
    }

    private static string RoutesRazorPath([CallerFilePath] string testFile = "")
    {
        var candidate = Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(testFile)!, "..", "GarminCoach", "Components", "Routes.razor"));
        Assert.True(File.Exists(candidate), $"Routes.razor not found at {candidate}");
        return candidate;
    }
}