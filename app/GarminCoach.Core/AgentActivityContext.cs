namespace GarminCoach.Core;

/// <summary>Shared state for one "What should I ride today?" run.</summary>
public sealed class AgentActivityContext
{
    public ToolCallLog Log { get; } = new();

    public SignalInputs Inputs { get; private set; } = new();

    public ProfileSnapshot Profile { get; private set; } = new(null, null, null);

    public GarminSignalSummary Summary { get; private set; } = new();

    public string DataJson { get; private set; } = "{}";

    public bool Collected { get; private set; }

    public void SetData(SignalInputs inputs, ProfileSnapshot profile)
    {
        Inputs = inputs;
        Profile = profile;
        Summary = GarminSignalAnalyzer.Summarize(inputs);
        DataJson = GarminDataPayload.Build(inputs, profile);
        Collected = true;
    }

    public void Clear()
    {
        Log.Clear();
        Inputs = new SignalInputs();
        Profile = new ProfileSnapshot(null, null, null);
        Summary = new GarminSignalSummary();
        DataJson = "{}";
        Collected = false;
    }
}