using GarminCoach.Core;

namespace GarminCoach.Services;

/// <summary>Persists settings in MAUI Preferences, so they survive app restarts.</summary>
public sealed class MauiKeyValueStore : IKeyValueStore
{
    public string? Get(string key) => Preferences.Default.Get<string?>(key, null);

    public void Set(string key, string value) => Preferences.Default.Set(key, value);
}