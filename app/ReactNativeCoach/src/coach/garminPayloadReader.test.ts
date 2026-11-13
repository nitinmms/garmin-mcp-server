import {
  isCycling,
  normalizeGender,
  parseActivities,
  parseBodyBattery,
  parseDailyLoad,
  parseHrv,
  parseProfile,
  parseSleep,
} from './garminPayloadReader';

describe('isCycling', () => {
  it('accepts cycling activity type keys', () => {
    expect(isCycling('road_biking')).toBe(true);
    expect(isCycling('indoor_cycling')).toBe(true);
    expect(isCycling('gravel_cycling')).toBe(true);
  });

  it('rejects other activity types and empty keys', () => {
    expect(isCycling('running')).toBe(false);
    expect(isCycling('')).toBe(false);
    expect(isCycling(null)).toBe(false);
  });
});

describe('parseActivities', () => {
  it('keeps cycling activities only and converts metres to km and seconds to minutes', () => {
    const rides = parseActivities([
      {
        activityType: { activityTypeKey: 'road_biking' },
        startTimeLocal: '2026-11-02 08:15:00',
        distance: 42350.6,
        duration: 5400,
      },
      { activityType: { activityTypeKey: 'running' }, startTimeLocal: '2026-11-02 07:00:00', distance: 5000, duration: 1800 },
    ]);

    expect(rides).toEqual([
      { date: '2026-11-02', type: 'road_biking', distanceKm: 42.35, durationMinutes: 90 },
    ]);
  });

  it('reads activities from a named array wrapper and defaults missing numbers to zero', () => {
    const rides = parseActivities({
      activityList: [{ activityTypeKey: 'cycling', startTimeGmt: '2026-11-03 06:00:00' }],
    });

    expect(rides).toEqual([{ date: '2026-11-03', type: 'cycling', distanceKm: 0, durationMinutes: 0 }]);
  });

  it('returns nothing for empty or missing payloads', () => {
    expect(parseActivities(null)).toEqual([]);
    expect(parseActivities([])).toEqual([]);
  });
});

describe('parseDailyLoad', () => {
  it('uses activeKilocalories and falls back to intensityMinutes', () => {
    expect(
      parseDailyLoad([
        { calendarDate: '2026-11-01', activeKilocalories: 512.4 },
        { calendarDate: '2026-11-02', intensityMinutes: 40 },
      ]),
    ).toEqual([
      { date: '2026-11-01', load: 512 },
      { date: '2026-11-02', load: 40 },
    ]);
  });

  it('skips days without a date or a numeric load', () => {
    expect(parseDailyLoad([{ activeKilocalories: 10 }, { calendarDate: '2026-11-03' }])).toEqual([]);
  });
});

describe('parseSleep', () => {
  it('converts sleep seconds to minutes', () => {
    expect(parseSleep([{ calendarDate: '2026-11-01', sleepTimeSeconds: 26100 }])).toEqual([
      { date: '2026-11-01', minutes: 435 },
    ]);
  });

  it('falls back to sleepingSeconds and durationInSeconds', () => {
    expect(
      parseSleep([
        { calendarDate: '2026-11-01', sleepingSeconds: 28800 },
        { calendarDate: '2026-11-02', durationInSeconds: 25200 },
      ]),
    ).toEqual([
      { date: '2026-11-01', minutes: 480 },
      { date: '2026-11-02', minutes: 420 },
    ]);
  });
});

describe('parseHrv', () => {
  it('prefers lastNightAvg, then weeklyAvg', () => {
    expect(
      parseHrv([
        { calendarDate: '2026-11-01', lastNightAvg: 47.6 },
        { calendarDate: '2026-11-02', weeklyAvg: 41 },
      ]),
    ).toEqual([
      { date: '2026-11-01', value: 48 },
      { date: '2026-11-02', value: 41 },
    ]);
  });

  it('ignores days without an HRV value', () => {
    expect(parseHrv([{ calendarDate: '2026-11-01' }])).toEqual([]);
  });
});

describe('parseBodyBattery', () => {
  it('takes the lowest level out of a sample array', () => {
    expect(
      parseBodyBattery([{ calendarDate: '2026-11-01', bodyBatteryValuesArray: [[1698000000000, 72], [1698003600000, 31]] }]),
    ).toEqual([{ date: '2026-11-01', low: 31 }]);
  });

  it('falls back to lowestBodyBatteryLevel', () => {
    expect(parseBodyBattery([{ calendarDate: '2026-11-02', lowestBodyBatteryLevel: 18 }])).toEqual([
      { date: '2026-11-02', low: 18 },
    ]);
  });

  it('skips days with no battery reading', () => {
    expect(parseBodyBattery([{ calendarDate: '2026-11-03' }])).toEqual([]);
  });
});

describe('parseProfile', () => {
  it('computes age from the birth date and normalises gender', () => {
    const profile = parseProfile({ birthDate: '1990-06-15', gender: 'M' }, 'garmin profile');

    expect(profile.age).toBe('36');
    expect(profile.gender).toBe('male');
    expect(profile.source).toBe('garmin profile');
  });

  it('returns an empty profile for non-object payloads', () => {
    expect(parseProfile(null, 'garmin profile')).toEqual({ age: null, gender: null, source: null });
  });
});

describe('normalizeGender', () => {
  it('maps the short forms and keeps unknown values lower-cased', () => {
    expect(normalizeGender('Male')).toBe('male');
    expect(normalizeGender('F')).toBe('female');
    expect(normalizeGender('nonbinary')).toBe('nonbinary');
    expect(normalizeGender('')).toBe(null);
  });
});