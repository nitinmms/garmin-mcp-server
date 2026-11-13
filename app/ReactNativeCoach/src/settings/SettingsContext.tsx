import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '../coach/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settingsStore';

export type SettingsContextValue = {
  settings: AppSettings;
  loading: boolean;
  reload: () => Promise<void>;
  save: (next: AppSettings) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  reload: async () => {},
  save: async () => {},
});

export type SettingsProviderProps = {
  children: React.ReactNode;
  load?: () => Promise<AppSettings>;
  save?: (next: AppSettings) => Promise<void>;
};

export function SettingsProvider({ children, load, save }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const loader = load ?? loadSettings;
    try {
      setSettings(await loader());
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persist = useCallback(
    async (next: AppSettings) => {
      const saver = save ?? saveSettings;
      await saver(next);
      setSettings(next);
    },
    [save],
  );

  const value = useMemo(
    () => ({ settings, loading, reload, save: persist }),
    [settings, loading, reload, persist],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}