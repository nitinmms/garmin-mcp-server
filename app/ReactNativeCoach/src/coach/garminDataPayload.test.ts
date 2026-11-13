import { buildDataPayload } from './garminDataPayload';
import type { SignalInputs } from './types';

const emptyInputs: SignalInputs = {
  rides: [],
  dailyLoad: [],
  dailySleep: [],
  dailyHrv: [],
  dailyBodyBattery: [],
};

describe('buildDataPayload', () => {
  it('throws a user-facing error when no Garmin data came back', () => {
    expect(() => buildDataPayload(emptyInputs, { age: null, gender: null, source: null })).toThrow(
      /No Garmin data came back for the last 7 days/,
    );
  });

  it('serialises the profile and the five signal series', () => {
    const payload = JSON.parse(
      buildDataPayload(
        {
          rides: [{ date: '2026-11-02', type: 'road_biking', distanceKm: 42.349, durationMinutes: 90 }],
          dailyLoad: [{ date: '2026-11-02', load: 300 }],
          dailySleep: [{ date: '2026-11-02', minutes: 480 }],
          dailyHrv: [{ date: '2026-11-02', value: 42 }],
          dailyBodyBattery: [{ date: '2026-11-02', low: 22 }],
        },
        { age: '35', gender: 'male', source: 'garmin profile' },
      ),
    );

    expect(payload.profile).toEqual({ age: '35', gender: 'male', source: 'garmin profile' });
    expect(payload.rides).toEqual([{ date: '2026-11-02', type: 'road_biking', distanceKm: 42.3, durationMin: 90 }]);
    expect(payload.dailyLoad).toEqual([{ date: '2026-11-02', load: 300 }]);
    expect(payload.dailySleep).toEqual([{ date: '2026-11-02', minutes: 480 }]);
    expect(payload.dailyHrv).toEqual([{ date: '2026-11-02', value: 42 }]);
    expect(payload.dailyBodyBattery).toEqual([{ date: '2026-11-02', low: 22 }]);
  });

  it('does not refuse a week whose only data is Body Battery', () => {
    const payload = JSON.parse(
      buildDataPayload(
        { ...emptyInputs, dailyBodyBattery: [{ date: '2026-11-02', low: 22 }] },
        { age: null, gender: null, source: null },
      ),
    );

    expect(payload.dailyBodyBattery).toEqual([{ date: '2026-11-02', low: 22 }]);
  });

  it('does not refuse a week whose only data is a ride', () => {
    const payload = JSON.parse(
      buildDataPayload(
        { ...emptyInputs, rides: [{ date: '2026-11-02', type: 'road_biking', distanceKm: 42.3, durationMinutes: 90 }] },
        { age: null, gender: null, source: null },
      ),
    );

    expect(payload.rides).toEqual([{ date: '2026-11-02', type: 'road_biking', distanceKm: 42.3, durationMin: 90 }]);
  });
});