import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  AI_KEY_SERVICE,
  DEFAULT_SETTINGS,
  GARMIN_KEY_SERVICE,
  loadSettings,
  saveSettings,
} from './settingsStore';

const keychain = Keychain as unknown as {
  setGenericPassword: jest.Mock;
  getGenericPassword: jest.Mock;
  resetGenericPassword: jest.Mock;
  __reset: () => void;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  keychain.__reset();
  jest.clearAllMocks();
});

const settings = {
  garminApiKey: 'garmin-secret',
  aiProvider: 'anthropic' as const,
  aiApiKey: 'anthropic-secret',
  aiModel: 'claude-3-5-sonnet-latest',
  serverUrl: 'http://192.168.1.20:8000',
};

describe('loadSettings', () => {
  it('returns the documented defaults for a fresh install', async () => {
    await expect(loadSettings()).resolves.toEqual({
      garminApiKey: '',
      aiProvider: 'openai',
      aiApiKey: '',
      aiModel: 'gpt-4o-mini',
      serverUrl: 'http://10.0.2.2:8000',
    });
  });

  it('reads the two keys from encrypted storage and the three settings from async storage', async () => {
    await saveSettings(settings);

    const loaded = await loadSettings();
    expect(loaded).toEqual(settings);
    expect(keychain.getGenericPassword).toHaveBeenCalledWith({ service: GARMIN_KEY_SERVICE });
    expect(keychain.getGenericPassword).toHaveBeenCalledWith({ service: AI_KEY_SERVICE });
  });

  it('falls back to defaults when the stored settings JSON is unreadable', async () => {
    await AsyncStorage.setItem('@garminCoach/settings', 'not json');

    const loaded = await loadSettings();
    expect(loaded.aiProvider).toBe('openai');
    expect(loaded.aiModel).toBe('gpt-4o-mini');
    expect(loaded.serverUrl).toBe(DEFAULT_SETTINGS.serverUrl);
  });

  it('keeps a stored server address and provider', async () => {
    await AsyncStorage.setItem(
      '@garminCoach/settings',
      JSON.stringify({ serverUrl: 'https://garmin.example.com/', aiProvider: 'anthropic', aiModel: 'claude-x' }),
    );

    const loaded = await loadSettings();
    expect(loaded.serverUrl).toBe('https://garmin.example.com');
    expect(loaded.aiProvider).toBe('anthropic');
    expect(loaded.aiModel).toBe('claude-x');
  });
});

describe('saveSettings', () => {
  it('writes the Garmin and AI keys into Keystore-backed storage and never into async storage', async () => {
    await saveSettings(settings);

    expect(keychain.setGenericPassword).toHaveBeenCalledWith('garmin', 'garmin-secret', {
      service: GARMIN_KEY_SERVICE,
      accessible: 'AccessibleAfterFirstUnlock',
    });
    expect(keychain.setGenericPassword).toHaveBeenCalledWith('ai', 'anthropic-secret', {
      service: AI_KEY_SERVICE,
      accessible: 'AccessibleAfterFirstUnlock',
    });

    const raw = await AsyncStorage.getItem('@garminCoach/settings');
    expect(raw).not.toBeNull();
    expect(raw!).not.toContain('garmin-secret');
    expect(raw!).not.toContain('anthropic-secret');
    expect(JSON.parse(raw!)).toEqual({
      serverUrl: 'http://192.168.1.20:8000',
      aiProvider: 'anthropic',
      aiModel: 'claude-3-5-sonnet-latest',
    });
  });

  it('clears a key that was removed in Settings', async () => {
    await saveSettings(settings);
    await saveSettings({ ...settings, garminApiKey: '', aiApiKey: '' });

    expect(keychain.resetGenericPassword).toHaveBeenCalledWith({ service: GARMIN_KEY_SERVICE });
    expect(keychain.resetGenericPassword).toHaveBeenCalledWith({ service: AI_KEY_SERVICE });
    const loaded = await loadSettings();
    expect(loaded.garminApiKey).toBe('');
    expect(loaded.aiApiKey).toBe('');
    expect(loaded.aiProvider).toBe('anthropic');
  });
});