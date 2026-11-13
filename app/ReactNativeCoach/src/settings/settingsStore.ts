import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { DEFAULT_SERVER_URL, normalizeServerUrl } from '../coach/serverUrl';
import type { AiProvider, AppSettings } from '../coach/types';

export const GARMIN_KEY_SERVICE = 'garminCoach.garminApiKey';
export const AI_KEY_SERVICE = 'garminCoach.aiApiKey';
export const SETTINGS_KEY = '@garminCoach/settings';

export const DEFAULT_AI_PROVIDER: AiProvider = 'openai';
export const DEFAULT_AI_MODEL = 'gpt-4o-mini';
export const AI_PROVIDERS: AiProvider[] = ['openai', 'anthropic'];

export const DEFAULT_SETTINGS: AppSettings = {
  garminApiKey: '',
  aiProvider: DEFAULT_AI_PROVIDER,
  aiApiKey: '',
  aiModel: DEFAULT_AI_MODEL,
  serverUrl: DEFAULT_SERVER_URL,
};

type StoredSettings = {
  serverUrl: string;
  aiProvider: AiProvider;
  aiModel: string;
};

/** Reads the three plain settings from AsyncStorage and the two keys from Keystore-backed storage. */
export async function loadSettings(): Promise<AppSettings> {
  const [raw, garminApiKey, aiApiKey] = await Promise.all([
    AsyncStorage.getItem(SETTINGS_KEY),
    readSecret(GARMIN_KEY_SERVICE),
    readSecret(AI_KEY_SERVICE),
  ]);
  const stored = parseStored(raw);
  return {
    garminApiKey,
    aiProvider: stored.aiProvider,
    aiApiKey,
    aiModel: stored.aiModel,
    serverUrl: normalizeServerUrl(stored.serverUrl),
  };
}

/** Writes the keys into Keystore-backed storage and never into AsyncStorage. */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const stored: StoredSettings = {
    serverUrl: normalizeServerUrl(settings.serverUrl),
    aiProvider: settings.aiProvider === 'anthropic' ? 'anthropic' : 'openai',
    aiModel: settings.aiModel.trim(),
  };
  await Promise.all([
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored)),
    writeSecret(GARMIN_KEY_SERVICE, 'garmin', settings.garminApiKey),
    writeSecret(AI_KEY_SERVICE, 'ai', settings.aiApiKey),
  ]);
}

async function readSecret(service: string): Promise<string> {
  try {
    const entry = await Keychain.getGenericPassword({ service });
    return entry ? entry.password : '';
  } catch {
    return '';
  }
}

async function writeSecret(service: string, username: string, password: string): Promise<void> {
  const value = password.trim();
  try {
    if (value.length === 0) {
      await Keychain.resetGenericPassword({ service });
      return;
    }
    await Keychain.setGenericPassword(username, value, {
      service,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
  } catch {
    // Storage unavailable: the key stays in memory for this session only.
  }
}

function parseStored(raw: string | null): StoredSettings {
  const fallback: StoredSettings = {
    serverUrl: DEFAULT_SETTINGS.serverUrl,
    aiProvider: DEFAULT_SETTINGS.aiProvider,
    aiModel: DEFAULT_SETTINGS.aiModel,
  };
  if (raw === null) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return fallback;
    }
    return {
      serverUrl: typeof parsed.serverUrl === 'string' && parsed.serverUrl.trim().length > 0
        ? parsed.serverUrl
        : fallback.serverUrl,
      aiProvider: parsed.aiProvider === 'anthropic' ? 'anthropic' : 'openai',
      aiModel: typeof parsed.aiModel === 'string' && parsed.aiModel.trim().length > 0
        ? parsed.aiModel.trim()
        : fallback.aiModel,
    };
  } catch {
    return fallback;
  }
}