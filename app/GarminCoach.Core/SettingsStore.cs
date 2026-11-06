using System.Text.Json;

namespace GarminCoach.Core;

/// <summary>Minimal key/value persistence, backed by MAUI Preferences on device.</summary>
public interface IKeyValueStore
{
    string? Get(string key);
    void Set(string key, string value);
}

public sealed class InMemoryKeyValueStore : IKeyValueStore
{
    private readonly Dictionary<string, string> _values = new();

    public string? Get(string key) => _values.TryGetValue(key, out var value) ? value : null;

    public void Set(string key, string value) => _values[key] = value;
}

/// <summary>Stores the Garmin API key, the AI settings and the manual age/gender fallback.</summary>
public sealed class SettingsStore
{
    public const string GarminKeyKey = "garmin.apiKey";
    public const string AiSettingsKey = "ai.settings";
    public const string AgeKey = "profile.age";
    public const string GenderKey = "profile.gender";

    private readonly IKeyValueStore _store;
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    public SettingsStore(IKeyValueStore store) => _store = store;

    public string GarminApiKey
    {
        get => _store.Get(GarminKeyKey) ?? "";
        set => _store.Set(GarminKeyKey, value?.Trim() ?? "");
    }

    public string ManualAge
    {
        get => _store.Get(AgeKey) ?? "";
        set => _store.Set(AgeKey, value?.Trim() ?? "");
    }

    public string ManualGender
    {
        get => _store.Get(GenderKey) ?? "";
        set => _store.Set(GenderKey, value?.Trim() ?? "");
    }

    public AiSettings Ai
    {
        get
        {
            var raw = _store.Get(AiSettingsKey);
            if (string.IsNullOrWhiteSpace(raw)) return new AiSettings();
            try
            {
                return JsonSerializer.Deserialize<AiSettings>(raw, Json) ?? new AiSettings();
            }
            catch (JsonException)
            {
                return new AiSettings();
            }
        }
        set => _store.Set(AiSettingsKey, JsonSerializer.Serialize(value ?? new AiSettings(), Json));
    }

    public bool HasGarminKey => GarminApiKey.Length > 0;

    public string Get(string key) => _store.Get(key) ?? "";

    public void Set(string key, string value) => _store.Set(key, value ?? "");

    public ProfileSnapshot ManualProfile => new(
        string.IsNullOrWhiteSpace(ManualAge) ? null : ManualAge,
        GarminPayloadReader.NormalizeGender(ManualGender),
        "entered in Settings");
}