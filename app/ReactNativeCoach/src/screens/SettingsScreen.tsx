import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ConnectionResult } from '../coach/coachService';
import { MISSING_GARMIN_KEY } from '../coach/errors';
import type { AiProvider, AppSettings } from '../coach/types';

export type SettingsScreenProps = {
  settings: AppSettings;
  onSave: (next: AppSettings) => Promise<void>;
  onTestConnection: (next: AppSettings) => Promise<ConnectionResult>;
  onBack: () => void;
};

const PROVIDERS: AiProvider[] = ['openai', 'anthropic'];

export function SettingsScreen({ settings, onSave, onTestConnection, onBack }: SettingsScreenProps) {
  const [garminApiKey, setGarminApiKey] = useState(settings.garminApiKey);
  const [aiProvider, setAiProvider] = useState<AiProvider>(settings.aiProvider);
  const [aiApiKey, setAiApiKey] = useState(settings.aiApiKey);
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft: AppSettings = {
    garminApiKey: garminApiKey.trim(),
    aiProvider,
    aiApiKey: aiApiKey.trim(),
    aiModel: aiModel.trim(),
    serverUrl: serverUrl.trim(),
  };

  const save = useCallback(async () => {
    setBusy(true);
    try {
      await onSave(draft);
      setMessageIsError(false);
      setMessage('Settings saved.');
    } catch (failure) {
      setMessageIsError(true);
      setMessage(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }, [draft, onSave]);

  const test = useCallback(async () => {
    setBusy(true);
    try {
      if (draft.garminApiKey.length === 0) {
        setMessageIsError(true);
        setMessage(MISSING_GARMIN_KEY);
        return;
      }
      const result = await onTestConnection(draft);
      setMessageIsError(!result.ok);
      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }, [draft, onTestConnection]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.label}>Garmin personal API key</Text>
      <TextInput
        accessibilityLabel="Garmin personal API key"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={garminApiKey}
        onChangeText={setGarminApiKey}
        style={styles.input}
        placeholder="Paste your Garmin key"
      />

      <Text style={styles.label}>AI provider</Text>
      <View style={styles.providerRow}>
        {PROVIDERS.map(provider => (
          <Pressable
            key={provider}
            accessibilityLabel={'AI provider: ' + provider}
            accessibilityRole="button"
            accessibilityState={{ selected: aiProvider === provider }}
            onPress={() => setAiProvider(provider)}
            style={[styles.providerButton, aiProvider === provider ? styles.providerSelected : null]}>
            <Text style={aiProvider === provider ? styles.providerSelectedText : styles.providerText}>
              {provider === 'openai' ? 'OpenAI' : 'Anthropic'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>AI API key</Text>
      <TextInput
        accessibilityLabel="AI API key"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={aiApiKey}
        onChangeText={setAiApiKey}
        style={styles.input}
        placeholder="Paste your provider key"
      />

      <Text style={styles.label}>AI model</Text>
      <TextInput
        accessibilityLabel="AI model"
        autoCapitalize="none"
        autoCorrect={false}
        value={aiModel}
        onChangeText={setAiModel}
        style={styles.input}
        placeholder="gpt-4o-mini"
      />

      <Text style={styles.label}>Garmin MCP server address</Text>
      <TextInput
        accessibilityLabel="Garmin MCP server address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={serverUrl}
        onChangeText={setServerUrl}
        style={styles.input}
        placeholder="http://10.0.2.2:8000"
      />

      <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={styles.button}>
        <Text style={styles.buttonText}>Save</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={test}
        style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Test connection</Text>
      </Pressable>

      {message ? (
        <Text testID="settings-message" style={messageIsError ? styles.error : styles.ok}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  link: { fontSize: 16, color: '#1f6feb' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  providerRow: { flexDirection: 'row', gap: 10 },
  providerButton: { borderWidth: 1, borderColor: '#d0d7de', borderRadius: 8, padding: 10 },
  providerSelected: { borderColor: '#1f6feb', backgroundColor: '#dbeafe' },
  providerText: { fontSize: 15 },
  providerSelectedText: { fontSize: 15, fontWeight: '700' },
  button: { backgroundColor: '#1f6feb', padding: 14, borderRadius: 10, marginTop: 12 },
  buttonText: { color: '#ffffff', fontSize: 16, textAlign: 'center', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#1f6feb', padding: 12, borderRadius: 10 },
  secondaryText: { color: '#1f6feb', fontSize: 16, textAlign: 'center' },
  ok: { color: '#1a7f37' },
  error: { color: '#b42318' },
});