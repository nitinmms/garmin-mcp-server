using GarminCoach.Core;
using GarminCoach.Services;
using Microsoft.Extensions.Logging;

namespace GarminCoach;

public static class MauiProgram
{
public static MauiApp CreateMauiApp()
{
var builder = MauiApp.CreateBuilder();
builder
.UseMauiApp<App>()
.ConfigureFonts(fonts =>
{
fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
});

builder.Services.AddMauiBlazorWebView();

builder.Services.AddSingleton<IKeyValueStore, MauiKeyValueStore>();
builder.Services.AddSingleton<SettingsStore>();
builder.Services.AddSingleton<AgentActivityContext>();
builder.Services.AddSingleton(sp => GarminMcpServer.Create(sp.GetRequiredService<SettingsStore>().Get(GarminMcpServer.BaseUrlKey)));
builder.Services.AddSingleton(sp => new GarminMcpClient(sp.GetRequiredService<GarminMcpServer>(), () => sp.GetRequiredService<SettingsStore>().GarminApiKey));
builder.Services.AddSingleton<IGarminToolClient>(sp => sp.GetRequiredService<GarminMcpClient>());
builder.Services.AddSingleton<IEmbeddedGarminServer>(sp =>
{
var port = sp.GetRequiredService<GarminMcpServer>().Endpoint.Port;
return new EmbeddedGarminServer(new GarminServerLaunchOptions { Host = GarminMcpServer.DefaultHost, Port = port });
});
builder.Services.AddSingleton<ILocalServer, LocalGarminMcpServer>();
builder.Services.AddSingleton<ChatClientProvider>(sp => () =>
{
var ai = sp.GetRequiredService<SettingsStore>().Ai;
return ai.IsConfigured ? AiClientFactory.Create(ai) : null;
});
builder.Services.AddSingleton(sp => new CoachService(
sp.GetRequiredService<IGarminToolClient>(),
sp.GetRequiredService<ChatClientProvider>(),
sp.GetRequiredService<AgentActivityContext>()));
builder.Services.AddSingleton<CoachViewModel>();
builder.Services.AddSingleton(sp => new AppRuntimeInfo(sp.GetRequiredService<IEmbeddedGarminServer>(), AppVersion.Current));

#if DEBUG
builder.Services.AddBlazorWebViewDeveloperTools();
builder.Logging.AddDebug();
#endif

return builder.Build();
}
}