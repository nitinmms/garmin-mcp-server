import { summarize, trendForBattery, trendForHrv, trendForLoad, trendForSleep } from './signalAnalyzer';
import type { SignalInputs } from './types';

const emptyInputs: SignalInputs = {
  rides: [],
  dailyLoad: [],
  dailySleep: [],
  dailyHrv: [],
  dailyBodyBattery: [],
};

describe('summarize', () => {
  it('reports no data for every absent signal instead of a zero', () => {
    const summary = summarize(emptyInputs);

    expect(summary.chips).toEqual([
      { label: 'Training load', value: 'No data', trend: 'unavailable' },
      { label: 'Sleep', value: 'No data', trend: 'unavailable' },
      { label: 'HRV', value: 'No data', trend: 'unavailable' },
      { label: 'Body Battery', value: 'No data', trend: 'unavailable' },
    ]);
    expect(summary.missingSignals).toEqual([
      'Training load',
      'Sleep',
      'HRV',
      'Body Battery',
      'Rides this week',
    ]);
    expect(summary.hasAnyData).toBe(false);
  });

  it('summarises the five labelled signals with a value and a trend', () => {
    const summary = summarize({
      rides: [{ date: '2026-11-02', type: 'road_biking', distanceKm: 42.35, durationMinutes: 90 }],
      dailyLoad: [
        { date: '2026-11-01', load: 200 },
        { date: '2026-11-02', load: 300 },
        { date: '2026-11-03', load: 420 },
        { date: '2026-11-04', load: 460 },
      ],
      dailySleep: [
        { date: '2026-11-01', minutes: 420 },
        { date: '2026-11-02', minutes: 480 },
      ],
      dailyHrv: [
        { date: '2026-11-01', value: 44 },
        { date: '2026-11-02', value: 40 },
      ],
      dailyBodyBattery: [
        { date: '2026-11-01', low: 30 },
        { date: '2026-11-02', low: 22 },
      ],
    });

    expect(summary.chips).toEqual([
      { label: 'Training load', value: '1380', trend: 'rising' },
      { label: 'Sleep', value: '7.5 h/night', trend: 'improving' },
      { label: 'HRV', value: '42 ms avg', trend: 'declining' },
      { label: 'Body Battery', value: 'low 22', trend: 'declining' },
    ]);
    expect(summary.totalLoad).toBe(1380);
    expect(summary.averageSleepHours).toBe(7.5);
    expect(summary.averageHrv).toBe(42);
    expect(summary.lowestBodyBattery).toBe(22);
    expect(summary.hasAnyData).toBe(true);
  });

  it('marks only the missing signal when one summary is absent', () => {
    const summary = summarize({ ...emptyInputs, dailySleep: [{ date: '2026-11-01', minutes: 450 }] });

    expect(summary.chips[1]).toEqual({ label: 'Sleep', value: '7.5 h/night', trend: 'steady' });
    expect(summary.chips[0].value).toBe('No data');
    expect(summary.missingSignals).toEqual(['Training load', 'HRV', 'Body Battery', 'Rides this week']);
    expect(summary.hasAnyData).toBe(true);
  });

  it('orders the weekly series by date', () => {
    const summary = summarize({
      ...emptyInputs,
      dailyLoad: [
        { date: '2026-11-03', load: 30 },
        { date: '2026-11-01', load: 10 },
      ],
    });

    expect(summary.dailyLoad.map(d => d.date)).toEqual(['2026-11-01', '2026-11-03']);
  });
});

describe('trends', () => {
  it('calls a single reading steady', () => {
    expect(trendForLoad([{ date: '2026-11-01', load: 100 }])).toBe('steady');
  });

  it('treats a change within tolerance as steady', () => {
    expect(trendForLoad([{ date: '2026-11-01', load: 100 }, { date: '2026-11-02', load: 105 }])).toBe('steady');
  });

  it('reports rising and declining for load', () => {
    expect(trendForLoad([{ date: '2026-11-01', load: 100 }, { date: '2026-11-02', load: 400 }])).toBe('rising');
    expect(trendForLoad([{ date: '2026-11-01', load: 400 }, { date: '2026-11-02', load: 100 }])).toBe('falling');
  });

  it('reports improving and declining for sleep, HRV and Body Battery', () => {
    expect(trendForSleep([{ date: '2026-11-01', minutes: 300 }, { date: '2026-11-02', minutes: 420 }])).toBe('improving');
    expect(trendForHrv([{ date: '2026-11-01', value: 60 }, { date: '2026-11-02', value: 40 }])).toBe('declining');
    expect(trendForBattery([{ date: '2026-11-01', low: 40 }, { date: '2026-11-02', low: 60 }])).toBe('improving');
  });
});

describe('hasAnyData', () => {
  const only = (overrides: Partial<SignalInputs>): SignalInputs => ({ ...emptyInputs, ...overrides });

  it('counts a week whose only signal is training load as data', () => {
    expect(summarize(only({ dailyLoad: [{ date: '2026-11-01', load: 200 }] })).hasAnyData).toBe(true);
  });

  it('counts a week whose only signal is sleep as data', () => {
    expect(summarize(only({ dailySleep: [{ date: '2026-11-01', minutes: 420 }] })).hasAnyData).toBe(true);
  });

  it('counts a week whose only signal is HRV as data', () => {
    expect(summarize(only({ dailyHrv: [{ date: '2026-11-01', value: 44 }] })).hasAnyData).toBe(true);
  });

  it('counts a week whose only signal is Body Battery as data', () => {
    expect(summarize(only({ dailyBodyBattery: [{ date: '2026-11-01', low: 30 }] })).hasAnyData).toBe(true);
  });

  it('counts a week whose only signal is a ride as data', () => {
    expect(
      summarize(
        only({ rides: [{ date: '2026-11-01', type: 'road_biking', distanceKm: 40, durationMinutes: 80 }] }),
      ).hasAnyData,
    ).toBe(true);
  });

  it('reports no data only when all five signals are absent', () => {
    expect(summarize(emptyInputs).hasAnyData).toBe(false);
  });
});