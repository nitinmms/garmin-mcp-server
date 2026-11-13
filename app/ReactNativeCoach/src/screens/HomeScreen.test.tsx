import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { HomeScreen } from './HomeScreen';
import type { CoachRunResult } from '../coach/coachService';
import { MISSING_GARMIN_KEY } from '../coach/errors';
import type { AppSettings } from '../coach/types';

const settings: AppSettings = {
  garminApiKey: 'garmin-secret',
  aiProvider: 'openai',
  aiApiKey: 'sk-secret',
  aiModel: 'gpt-4o-mini',
  serverUrl: 'http://10.0.2.2:8000',
};

const summary = {
  totalLoad: 500,
  averageSleepHours: 7.5,
  averageHrv: 43,
  lowestBodyBattery: 22,
  chips: [
    { label: 'Training load', value: '500', trend: 'rising' },
    { label: 'Sleep', value: '7.5 h/night', trend: 'improving' },
    { label: 'HRV', value: '43 ms avg', trend: 'declining' },
    { label: 'Body Battery', value: 'low 22', trend: 'declining' },
  ],
  dailyLoad: [],
  dailySleep: [],
  dailyHrv: [],
  rides: [],
  missingSignals: [],
  hasAnyData: true,
};

const success: CoachRunResult = {
  error: null,
  summary,
  trace: [
    {
      order: 1,
      toolName: 'search_activities',
      arguments: 'start_date=2026-10-28, end_date=2026-11-03, activity_type=cycling, limit=100',
      summary: '2026-10-28..2026-11-03 (last 7 days)',
    },
    {
      order: 2,
      toolName: 'get_daily_summaries',
      arguments: 'start_date=2026-10-28, end_date=2026-11-03',
      summary: '2026-10-28..2026-11-03 (last 7 days)',
    },
  ],
  recommendation: {
    workoutType: 'Endurance ride',
    durationMinutes: 90,
    intensityZone: 'Zone 2',
    structure: [
      { order: 1, description: '10 min easy spin' },
      { order: 2, description: '60 min steady Zone 2' },
      { order: 3, description: '10 min cool down' },
    ],
    reasoning: 'Load is rising and sleep was good.',
    missingSignals: ['HRV'],
  },
};

async function setup(overrides: Partial<Parameters<typeof HomeScreen>[0]> = {}) {
  const onRun = jest.fn(async () => success);
  const onTestConnection = jest.fn(async () => ({
    ok: true,
    message: 'Connected to the Garmin MCP server at http://10.0.2.2:8000 — 6 read-only tools available.',
  }));
  const onOpenSettings = jest.fn();
  await render(
    <HomeScreen
      settings={settings}
      onRun={onRun}
      onTestConnection={onTestConnection}
      onOpenSettings={onOpenSettings}
      {...overrides}
    />,
  );
  return { onRun, onTestConnection, onOpenSettings };
}

describe('HomeScreen', () => {
  it('offers the coach action and a link to Settings on the first screen', async () => {
    await setup();

    expect(await screen.findByText('What should I ride today?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Settings'));
    expect(await screen.findByText('What should I ride today?')).toBeTruthy();
  });

  it('opens Settings when the link is tapped', async () => {
    const { onOpenSettings } = await setup();

    await fireEvent.press(await screen.findByLabelText('Open Settings'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('says a Garmin key is needed and runs nothing when the key is not set', async () => {
    const { onRun } = await setup({ settings: { ...settings, garminApiKey: '' } });

    expect(await screen.findByText(MISSING_GARMIN_KEY)).toBeTruthy();
    await fireEvent.press(screen.getByText('What should I ride today?'));

    await waitFor(() => expect(onRun).not.toHaveBeenCalled());
  });

  it('shows the one recommendation with type, duration, zone, ordered steps, reasoning and missing signals', async () => {
    await setup();

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(await screen.findByText('Endurance ride')).toBeTruthy();
    expect(screen.getByText('1h 30m')).toBeTruthy();
    expect(screen.getByText('Zone 2')).toBeTruthy();
    expect(screen.getByText('1. 10 min easy spin')).toBeTruthy();
    expect(screen.getByText('2. 60 min steady Zone 2')).toBeTruthy();
    expect(screen.getByText('3. 10 min cool down')).toBeTruthy();
    expect(screen.getByText('Load is rising and sleep was good.')).toBeTruthy();
    expect(screen.getAllByText(/HRV/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByTestId('recommendation')).toHaveLength(1);
  });

  it('shows one row per Garmin tool call with the tool name and arguments', async () => {
    await setup();

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    const rows = await screen.findAllByTestId('tool-call-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].props.children).toBeTruthy();
    expect(screen.getByText('search_activities')).toBeTruthy();
    expect(
      screen.getByText('start_date=2026-10-28, end_date=2026-11-03, activity_type=cycling, limit=100'),
    ).toBeTruthy();
    expect(screen.getByText('get_daily_summaries')).toBeTruthy();
  });

  it('shows the five labelled signal summaries with a value and a trend', async () => {
    await setup();

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(await screen.findByText('Training load')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getAllByText('HRV').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Body Battery')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.getByText('7.5 h/night')).toBeTruthy();
    expect(screen.getByText('rising')).toBeTruthy();
  });

  it('reads an absent signal as no data rather than a zero', async () => {
    await setup({
      onRun: jest.fn(async () => ({
        ...success,
        summary: {
          ...summary,
          totalLoad: 0,
          chips: [
            { label: 'Training load', value: 'No data', trend: 'unavailable' },
            { label: 'Sleep', value: 'No data', trend: 'unavailable' },
            { label: 'HRV', value: 'No data', trend: 'unavailable' },
            { label: 'Body Battery', value: 'No data', trend: 'unavailable' },
          ],
        },
      })),
    });

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(await screen.findAllByText('No data')).toHaveLength(5);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('says there is no data and shows no workout when all five signals are absent', async () => {
    await setup({
      onRun: jest.fn(async () => ({
        error: 'No Garmin data came back for the last 7 days, so no session can be recommended. Check that your Garmin account is linked and try again.',
        summary: { ...summary, hasAnyData: false, chips: [] },
        trace: [],
        recommendation: null,
      })),
    });

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(await screen.findByText(/No Garmin data came back for the last 7 days/)).toBeTruthy();
    expect(screen.queryByTestId('recommendation')).toBeNull();
  });

  it('shows the AI-key error and no workout when the AI key is not set', async () => {
    await setup({
      settings: { ...settings, aiApiKey: '' },
      onRun: jest.fn(async () => ({
        error: 'Add your OpenAI or Anthropic API key in Settings and pick a model before asking for a session.',
        summary,
        trace: [],
        recommendation: null,
      })),
    });

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(
      await screen.findByText(
        'Add your OpenAI or Anthropic API key in Settings and pick a model before asking for a session.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('recommendation')).toBeNull();
  });

  it('names the server address in a plain-language error when the server cannot be reached', async () => {
    await setup({
      onRun: jest.fn(async () => ({
        error: 'Could not reach the Garmin MCP server at http://10.0.2.2:8000. Check that it is running and try again.',
        summary,
        trace: [],
        recommendation: null,
      })),
    });

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(
      await screen.findByText(
        'Could not reach the Garmin MCP server at http://10.0.2.2:8000. Check that it is running and try again.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('recommendation')).toBeNull();
  });

  it('shows an error and no workout when the AI reply cannot be read as a recommendation', async () => {
    await setup({
      onRun: jest.fn(async () => ({
        error: 'The model did not return a usable session. Please try again.',
        summary,
        trace: [],
        recommendation: null,
      })),
    });

    await fireEvent.press(await screen.findByText('What should I ride today?'));

    expect(await screen.findByText('The model did not return a usable session. Please try again.')).toBeTruthy();
    expect(screen.queryByTestId('recommendation')).toBeNull();
  });

  it('reports the server address and read-only tool count on Test connection', async () => {
    await setup();

    await fireEvent.press(await screen.findByText('Test connection'));

    expect(
      await screen.findByText('Connected to the Garmin MCP server at http://10.0.2.2:8000 — 6 read-only tools available.'),
    ).toBeTruthy();
  });
});