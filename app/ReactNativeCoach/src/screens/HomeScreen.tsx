import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ConnectionResult, CoachRunResult } from '../coach/coachService';
import { MISSING_GARMIN_KEY } from '../coach/errors';
import { durationText } from '../coach/types';
import type { AppSettings, Recommendation, ToolCallRecord } from '../coach/types';
import type { GarminSignalSummary } from '../coach/types';

export type HomeScreenProps = {
  settings: AppSettings;
  onRun: () => Promise<CoachRunResult>;
  onTestConnection: () => Promise<ConnectionResult>;
  onOpenSettings: () => void;
};

export function HomeScreen({ settings, onRun, onTestConnection, onOpenSettings }: HomeScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachRunResult | null>(null);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);

  const hasGarminKey = settings.garminApiKey.trim().length > 0;

  const run = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!hasGarminKey) {
        setError(MISSING_GARMIN_KEY);
        return;
      }
      const next = await onRun();
      setResult(next);
      setError(next.error);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }, [busy, hasGarminKey, onRun]);

  const test = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setConnection(await onTestConnection());
    } catch (failure) {
      setConnection({ ok: false, message: failure instanceof Error ? failure.message : String(failure) });
    } finally {
      setBusy(false);
    }
  }, [busy, onTestConnection]);

  const recommendation = result?.recommendation ?? null;
  const summary = result?.summary ?? null;
  const trace = result?.trace ?? [];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Garmin Coach</Text>
        <Pressable accessibilityLabel="Open Settings" onPress={onOpenSettings} accessibilityRole="button">
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>

      {!hasGarminKey ? <Text style={styles.warning}>{MISSING_GARMIN_KEY}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={run}
        style={[styles.button, busy ? styles.buttonDisabled : null]}>
        <Text style={styles.buttonText}>What should I ride today?</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={test}
        style={[styles.secondaryButton, busy ? styles.buttonDisabled : null]}>
        <Text style={styles.secondaryText}>Test connection</Text>
      </Pressable>

      {busy ? <ActivityIndicator testID="busy" /> : null}
      {connection ? (
        <Text testID="connection-result" style={connection.ok ? styles.ok : styles.error}>
          {connection.message}
        </Text>
      ) : null}
      {error ? (
        <Text testID="coach-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {summary ? <SignalSummaries summary={summary} /> : null}
      {trace.length > 0 ? <ToolCallTrace trace={trace} /> : null}
      {recommendation ? <RecommendationCard recommendation={recommendation} /> : null}
    </ScrollView>
  );
}

function SignalSummaries({ summary }: { summary: GarminSignalSummary }) {
  const chips = summary.chips;
  if (chips.length === 0) {
    return null;
  }
  return (
    <View testID="signal-summaries" style={styles.section}>
      <Text style={styles.sectionTitle}>Last 7 days</Text>
      {chips.map(chip => (
        <View key={chip.label} testID="signal-row" style={styles.row}>
          <Text style={styles.rowLabel}>{chip.label}</Text>
          <Text style={styles.rowValue}>{chip.value}</Text>
          <Text style={styles.rowTrend}>{chip.trend}</Text>
        </View>
      ))}
      {summary.rides.length > 0 ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Rides this week</Text>
          <Text style={styles.rowValue}>{summary.rides.length}</Text>
          <Text style={styles.rowTrend}>{summary.rides.length === 1 ? 'ride' : 'rides'}</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Rides this week</Text>
          <Text style={styles.rowValue}>No data</Text>
          <Text style={styles.rowTrend}>unavailable</Text>
        </View>
      )}
    </View>
  );
}

function ToolCallTrace({ trace }: { trace: ToolCallRecord[] }) {
  return (
    <View testID="tool-call-trace" style={styles.section}>
      <Text style={styles.sectionTitle}>Garmin tool calls</Text>
      {trace.map(record => (
        <View key={record.order} testID="tool-call-row" style={styles.traceRow}>
          <Text style={styles.traceNumber}>{'#' + record.order}</Text>
          <Text style={styles.traceTool}>{record.toolName}</Text>
          <Text style={styles.traceArguments}>{record.arguments}</Text>
        </View>
      ))}
    </View>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <View testID="recommendation" style={styles.section}>
      <Text style={styles.sectionTitle}>Today's session</Text>
      <Text style={styles.workoutType}>{recommendation.workoutType}</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Duration</Text>
        <Text style={styles.rowValue}>{durationText(recommendation.durationMinutes)}</Text>
        <Text style={styles.rowTrend}>{recommendation.intensityZone}</Text>
      </View>
      <Text style={styles.subTitle}>Steps</Text>
      {recommendation.structure.map(step => (
        <Text key={step.order} style={styles.step}>
          {step.order + '. ' + step.description}
        </Text>
      ))}
      <Text style={styles.subTitle}>Why this session</Text>
      <Text style={styles.reasoning}>{recommendation.reasoning}</Text>
      <Text style={styles.subTitle}>Signals unavailable</Text>
      <Text style={styles.missing}>
        {recommendation.missingSignals.length > 0 ? recommendation.missingSignals.join(', ') : 'None'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '700' },
  link: { fontSize: 16, color: '#1f6feb' },
  warning: { color: '#8a4b00', backgroundColor: '#fff4d6', padding: 10, borderRadius: 8 },
  button: { backgroundColor: '#1f6feb', padding: 14, borderRadius: 10 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, textAlign: 'center', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#1f6feb', padding: 12, borderRadius: 10 },
  secondaryText: { color: '#1f6feb', fontSize: 16, textAlign: 'center' },
  ok: { color: '#1a7f37' },
  error: { color: '#b42318' },
  section: { borderWidth: 1, borderColor: '#d0d7de', borderRadius: 10, padding: 12, gap: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  subTitle: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { flex: 1, fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: '600' },
  rowTrend: { fontSize: 13, color: '#57606a', minWidth: 80, textAlign: 'right' },
  traceRow: { borderTopWidth: 1, borderTopColor: '#eaeef2', paddingTop: 6, gap: 2 },
  traceNumber: { fontSize: 12, color: '#57606a' },
  traceTool: { fontSize: 14, fontWeight: '600' },
  traceArguments: { fontSize: 12, color: '#57606a' },
  workoutType: { fontSize: 20, fontWeight: '700' },
  step: { fontSize: 15 },
  reasoning: { fontSize: 15 },
  missing: { fontSize: 14, color: '#8a4b00' },
});