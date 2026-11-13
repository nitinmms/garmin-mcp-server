import { runCoach, testConnection } from './coachService';
import { MISSING_AI_KEY, MISSING_GARMIN_KEY } from './errors';
import type { AppSettings } from './types';

const settings: AppSettings = {
  garminApiKey: 'garmin-secret',
  aiProvider: 'openai',
  aiApiKey: 'sk-secret',
  aiModel: 'gpt-4o-mini',
  serverUrl: 'http://10.0.2.2:8000',
};

const tools = [
  'search_activities',
  'get_daily_summaries',
  'get_sleep_summaries',
  'get_hrv_range',
  'get_body_battery',
  'get_profile_settings',
].map(name => ({ name, annotations: { readOnlyHint: true } }));

const recommendation = {
  workoutType: 'Endurance ride',
  durationMinutes: 90,
  intensityZone: 'Zone 2',
  structure: ['10 min easy spin', '60 min steady Zone 2', '10 min cool down'],
  reasoning: 'Load is rising and sleep was good.',
  missingSignals: [],
};

const toolReplies: Record<string, unknown> = {
  search_activities: [
    { activityType: { activityTypeKey: 'road_biking' }, startTimeLocal: '2026-11-02 08:15:00', distance: 42350, duration: 5400 },
  ],
  get_daily_summaries: [
    { calendarDate: '2026-11-01', activeKilocalories: 200 },
    { calendarDate: '2026-11-02', activeKilocalories: 300 },
  ],
  get_sleep_summaries: [
    { calendarDate: '2026-11-01', sleepTimeSeconds: 25200 },
    { calendarDate: '2026-11-02', sleepTimeSeconds: 28800 },
  ],
  get_hrv_range: [
    { calendarDate: '2026-11-01', lastNightAvg: 45 },
    { calendarDate: '2026-11-02', lastNightAvg: 41 },
  ],
  get_body_battery: [
    { calendarDate: '2026-11-01', lowestBodyBatteryLevel: 30 },
    { calendarDate: '2026-11-02', lowestBodyBatteryLevel: 22 },
  ],
  get_profile_settings: { birthDate: '1990-06-15', gender: 'M' },
};

type Seen = { url: string; headers: Record<string, string>; body: string };

function fakeFetch(options: {
  toolReplies?: Record<string, unknown>;
  aiText?: string;
  aiStatus?: number;
  mcpStatus?: number;
  fail?: 'network' | 'none';
}) {
  const seen: Seen[] = [];
  const fetchImpl = async (url: string, init: any) => {
    seen.push({ url, headers: init.headers ?? {}, body: init.body ?? '' });
    if (options.fail === 'network') {
      throw new TypeError('Network request failed');
    }
    if (url.startsWith('https://api.openai.com') || url.startsWith('https://api.anthropic.com')) {
      const status = options.aiStatus ?? 200;
      const body =
        status === 200
          ? { choices: [{ message: { content: options.aiText ?? JSON.stringify(recommendation) } }] }
          : { error: { message: 'bad key' } };
      return { status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) };
    }
    const payload = init.body ? JSON.parse(init.body) : {};
    let result: unknown = {};
    if (payload.method === 'initialize') {
      result = { serverInfo: { name: 'garmin' }, protocolVersion: '2025-06-18' };
    } else if (payload.method === 'tools/list') {
      result = { tools };
    } else if (payload.method === 'tools/call') {
      result = { content: [{ type: 'text', text: JSON.stringify((options.toolReplies ?? toolReplies)[payload.params.name] ?? {}) }] };
    }
    const status = options.mcpStatus ?? 200;
    return { status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }) };
  };
  return { fetchImpl: fetchImpl as any, seen };
}

const aiCalls = (seen: Seen[]) => seen.filter(call => call.url.startsWith('https://api.'));

describe('runCoach', () => {
  it('refuses without a Garmin key and makes no server call and no AI call', async () => {
    const { fetchImpl, seen } = fakeFetch({});

    const result = await runCoach({ settings: { ...settings, garminApiKey: '' }, fetchImpl });

    expect(result.error).toBe(MISSING_GARMIN_KEY);
    expect(result.recommendation).toBeNull();
    expect(result.trace).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  it('refuses without an AI key and shows no workout', async () => {
    const { fetchImpl, seen } = fakeFetch({});

    const result = await runCoach({ settings: { ...settings, aiApiKey: '' }, fetchImpl });

    expect(result.error).toBe(MISSING_AI_KEY);
    expect(result.recommendation).toBeNull();
    expect(aiCalls(seen)).toHaveLength(0);
  });

  it('names the server address when the server cannot be reached', async () => {
    const { fetchImpl } = fakeFetch({ fail: 'network' });

    const result = await runCoach({ settings, fetchImpl });

    expect(result.error).toBe(
      'Could not reach the Garmin MCP server at http://10.0.2.2:8000. Check that it is running and try again.',
    );
    expect(result.recommendation).toBeNull();
  });

  it('shows no workout when the AI reply cannot be read as a recommendation', async () => {
    const { fetchImpl } = fakeFetch({ aiText: 'Just ride your bike for a while.' });

    const result = await runCoach({ settings, fetchImpl });

    expect(result.error).toBe('The model did not return a usable session. Please try again.');
    expect(result.recommendation).toBeNull();
  });

  it('shows no workout when the AI reply is an incomplete recommendation', async () => {
    const { fetchImpl } = fakeFetch({ aiText: JSON.stringify({ ...recommendation, durationMinutes: 2 }) });

    const result = await runCoach({ settings, fetchImpl });

    expect(result.error).toMatch(/session was incomplete/i);
    expect(result.recommendation).toBeNull();
  });

  it('reports no data and shows no workout when all five signals are absent', async () => {
    const { fetchImpl } = fakeFetch({ toolReplies: {} });

    const result = await runCoach({ settings, fetchImpl });

    expect(result.error).toMatch(/No Garmin data came back for the last 7 days/);
    expect(result.recommendation).toBeNull();
    expect(result.summary.chips.map(chip => chip.value)).toEqual(['No data', 'No data', 'No data', 'No data']);
    expect(aiCalls([])).toHaveLength(0);
  });

  it('reads the last 7 days through six read-only tools and returns one recommendation', async () => {
    const { fetchImpl, seen } = fakeFetch({});

    const result = await runCoach({ settings, fetchImpl, today: new Date('2026-11-03T09:00:00Z') });

    expect(result.error).toBeNull();
    expect(result.recommendation).toEqual({
      workoutType: 'Endurance ride',
      durationMinutes: 90,
      intensityZone: 'Zone 2',
      structure: [
        { order: 1, description: '10 min easy spin' },
        { order: 2, description: '60 min steady Zone 2' },
        { order: 3, description: '10 min cool down' },
      ],
      reasoning: 'Load is rising and sleep was good.',
      missingSignals: [],
    });

    const toolCalls = seen
      .filter(call => call.body && JSON.parse(call.body).method === 'tools/call')
      .map(call => JSON.parse(call.body).params);
    expect(toolCalls.map(call => call.name)).toEqual([
      'search_activities',
      'get_daily_summaries',
      'get_sleep_summaries',
      'get_hrv_range',
      'get_body_battery',
      'get_profile_settings',
    ]);
    expect(toolCalls[0].arguments).toEqual({
      start_date: '2026-10-28',
      end_date: '2026-11-03',
      activity_type: 'cycling',
      limit: 100,
    });

    expect(result.trace).toHaveLength(6);
    expect(result.trace[0]).toEqual({
      order: 1,
      toolName: 'search_activities',
      arguments: 'start_date=2026-10-28, end_date=2026-11-03, activity_type=cycling, limit=100',
      summary: '2026-10-28..2026-11-03 (last 7 days)',
    });
    expect(result.trace[5].toolName).toBe('get_profile_settings');

    expect(result.summary.chips.map(chip => chip.value)).toEqual(['500', '7.5 h/night', '43 ms avg', 'low 22']);
    expect(aiCalls(seen)).toHaveLength(1);
  });

  it('sends the Garmin key only to the server and never to the AI provider', async () => {
    const { fetchImpl, seen } = fakeFetch({});

    await runCoach({ settings, fetchImpl });

    const garminCalls = seen.filter(call => !call.url.startsWith('https://api.'));
    expect(garminCalls.every(call => call.headers['X-Garmin-Api-Key'] === 'garmin-secret')).toBe(true);
    expect(aiCalls(seen).every(call => call.headers['X-Garmin-Api-Key'] === undefined)).toBe(true);
    expect(aiCalls(seen).every(call => !call.body.includes('garmin-secret'))).toBe(true);
  });

  it('keeps neither key in the error message or the trace', async () => {
    const { fetchImpl } = fakeFetch({ aiText: 'not json' });

    const result = await runCoach({ settings, fetchImpl });

    const shown = JSON.stringify({ error: result.error, trace: result.trace });
    expect(shown).not.toContain('garmin-secret');
    expect(shown).not.toContain('sk-secret');
  });
});

describe('testConnection', () => {
  it('reports the server address and the number of read-only tools', async () => {
    const { fetchImpl } = fakeFetch({});

    await expect(testConnection({ settings, fetchImpl })).resolves.toEqual({
      ok: true,
      message: 'Connected to the Garmin MCP server at http://10.0.2.2:8000 — 6 read-only tools available.',
    });
  });

  it('says the Garmin key is needed and makes no server call without one', async () => {
    const { fetchImpl, seen } = fakeFetch({});

    const result = await testConnection({ settings: { ...settings, garminApiKey: '' }, fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.message).toBe(MISSING_GARMIN_KEY);
    expect(seen).toHaveLength(0);
  });

  it('reports a plain-language error naming the address when the server is unreachable', async () => {
    const { fetchImpl } = fakeFetch({ fail: 'network' });

    const result = await testConnection({ settings: { ...settings, serverUrl: 'http://192.168.1.9:8000' }, fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      'Could not reach the Garmin MCP server at http://192.168.1.9:8000. Check that it is running and try again.',
    );
  });
});