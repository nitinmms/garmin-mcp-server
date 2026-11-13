import { CoachError, NO_DATA_MESSAGE } from './errors';
import type { ProfileSnapshot, SignalInputs } from './types';

/** Selects the fields the coach needs out of the raw tool replies. */
export function buildDataPayload(inputs: SignalInputs, profile: ProfileSnapshot): string {
  if (
    inputs.rides.length === 0 &&
    inputs.dailyLoad.length === 0 &&
    inputs.dailySleep.length === 0 &&
    inputs.dailyHrv.length === 0 &&
    inputs.dailyBodyBattery.length === 0
  ) {
    throw new CoachError(NO_DATA_MESSAGE);
  }

  return JSON.stringify({
    profile: { age: profile.age, gender: profile.gender, source: profile.source },
    rides: inputs.rides.map(ride => ({
      date: ride.date,
      type: ride.type,
      distanceKm: round(ride.distanceKm, 1),
      durationMin: ride.durationMinutes,
    })),
    dailyLoad: inputs.dailyLoad.map(day => ({ date: day.date, load: day.load })),
    dailySleep: inputs.dailySleep.map(day => ({ date: day.date, minutes: day.minutes })),
    dailyHrv: inputs.dailyHrv.map(day => ({ date: day.date, value: day.value })),
    dailyBodyBattery: inputs.dailyBodyBattery.map(day => ({ date: day.date, low: day.low })),
  });
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}