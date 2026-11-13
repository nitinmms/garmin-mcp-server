using GarminCoach.Core;

namespace GarminCoach;

public partial class App : Application
{
private readonly IEmbeddedGarminServer _server;

public App(IEmbeddedGarminServer server)
{
InitializeComponent();
_server = server;
}

protected override Window CreateWindow(IActivationState? activationState) =>
new Window(new MainPage()) { Title = "GarminCoach" };

protected override void OnSleep()
{
// Keep the embedded server running in the background; it is stopped on exit.
}

protected override void CleanUp()
{
_ = _server.StopAsync();
base.CleanUp();
}
}