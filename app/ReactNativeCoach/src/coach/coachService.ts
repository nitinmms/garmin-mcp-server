import { createGarminMcpClient } from '../garmin/mcpClient';
import type { FetchLike } from '../garmin/mcpClient';
import { askAi } from './aiClient';
import { CoachError, describeError, MISSING_AI_KEY, missingGarminKeyError } from './errors';
import { buildDataPayload } from './garminDataPayload';
import {
  parseActivities,
  parseBodyBattery,
  parseDailyLoad,
  parseHrv,
  parseProfile,
  parseSleep,
} from './garminPayloadReader';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import { parseRecommendation } from './recommendationParser';
import { summarize } from './signalAnalyzer';
import type {
  AppSettings,
  GarminSignalSummary,
  ProfileSnapshot,
  Recommendation,
  SignalInputs,
  ToolCallRecord,
} from './types';

export type CoachRunOptions = {
  settings: AppSettings;
  fetchImpl?: FetchLike;
  today?: Date;
  signal?: AbortSignal;
};

export type CoachRunResult = {
  error: string | null;
  summary: GarminSignalSummary;
  trace: ToolCallRecord[];
  recommendation: Recommendation | null;
};

export type ConnectionResult = { ok: boolean; message: string };

const EMPTY_SUMMARY: GarminSignalSummary = {
  totalLoad: 0,
  averageSleepHours: null,
  averageHrv: null,
  lowestBodyBattery: null,
  chips: [],
  dailyLoad: [],
  dailySleep: [],
  dailyHrv: [],
  rides: [],
  missingSignals: [],
  hasAnyData: false,
};

/** Reads the last 7 days through the read-only tools and asks the model for exactly one session. */
export async function runCoach(options: CoachRunOptions): Promise<CoachRunResult> {
  const trace: ToolCallRecord[] = [];
  let summary: GarminSignalSummary = EMPTY_SUMMARY;
  try {
    if (options.settings.garminApiKey.trim().length === 0) {
      throw missingGarminKeyError();
    }
    const client = createGarminMcpClient({
      serverUrl: options.settings.serverUrl,
      apiKey: options.settings.garminApiKey,
      fetchImpl: options.fetchImpl,
    });
    await client.listReadOnlyTools();

    const today = options.today ?? new Date();
    const end = isoDate(today);
    const start = isoDate(addDays(today, -6));
    const range = start + '..' + end + ' (last 7 days)';
    const inputs: SignalInputs = {
      rides: [],
      dailyLoad: [],
      dailySleep: [],
      dailyHrv: [],
      dailyBodyBattery: [],
    };
    let profile: ProfileSnapshot = { age: null, gender: null, source: null };

    const call = async (
      toolName: string,
      summary: string,
      args: Record<string, unknown>,
      read: (node: unknown) => void,
    ) => {
      trace.push({
        order: trace.length + 1,
        toolName,
        arguments: renderArguments(args),
        summary,
      });
      const node = await client.callTool(toolName, args);
      read(node);
    };

    const rangeArgs = { start_date: start, end_date: end };
    await call('search_activities', range, { ...rangeArgs, activity_type: 'cycling', limit: 100 }, node => {
      inputs.rides = parseActivities(node);
    });
    await call('get_daily_summaries', range, rangeArgs, node => {
      inputs.dailyLoad = parseDailyLoad(node);
    });
    await call('get_sleep_summaries', range, rangeArgs, node => {
      inputs.dailySleep = parseSleep(node);
    });
    await call('get_hrv_range', range, rangeArgs, node => {
      inputs.dailyHrv = parseHrv(node);
    });
    await call('get_body_battery', range, { ...rangeArgs, include_samples: false }, node => {
      inputs.dailyBodyBattery = parseBodyBattery(node);
    });
    await call('get_profile_settings', 'current profile', {}, node => {
      profile = parseProfile(node, 'garmin profile');
    });

    summary = summarize(inputs);
    const dataJson = buildDataPayload(inputs, profile);

    if (options.settings.aiApiKey.trim().length === 0) {
      throw new CoachError(MISSING_AI_KEY);
    }

    const reply = await askAi({
      provider: options.settings.aiProvider,
      apiKey: options.settings.aiApiKey,
      model: options.settings.aiModel,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(dataJson),
      fetchImpl: (options.fetchImpl as any) ?? ((url, init) => fetch(url, init)),
      signal: options.signal,
    });

    const recommendation = parseRecommendation(reply);
    return { error: null, summary, trace, recommendation };
  } catch (error) {
    return {
      error: describeError(error, options.settings.serverUrl),
      summary,
      trace,
      recommendation: null,
    };
  }
}

/** Lists the read-only tools so the user can confirm the server is reachable. */
export async function testConnection(options: {
  settings: AppSettings;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<ConnectionResult> {
  try {
    if (options.settings.garminApiKey.trim().length === 0) {
      throw missingGarminKeyError();
    }
    const client = createGarminMcpClient({
      serverUrl: options.settings.serverUrl,
      apiKey: options.settings.garminApiKey,
      fetchImpl: options.fetchImpl,
    });
    const tools = await client.listReadOnlyTools();
    return {
      ok: true,
      message:
        'Connected to the Garmin MCP server at ' +
        client.serverUrl +
        ' \u2014 ' +
        tools.length +
        ' read-only tools available.',
    };
  } catch (error) {
    return { ok: false, message: describeError(error, options.settings.serverUrl) };
  }
}

function renderArguments(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => key + '=' + renderValue(value))
    .join(', ');
}

function renderValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}