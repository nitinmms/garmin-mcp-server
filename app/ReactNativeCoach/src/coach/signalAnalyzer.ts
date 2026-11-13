import type {
  DailyBodyBattery,
  DailyHrv,
  DailyLoad,
  DailySleep,
  GarminSignalSummary,
  SignalChip,
  SignalInputs,
} from './types';
import { NO_DATA, missingChip } from './types';

export function summarize(inputs: SignalInputs): GarminSignalSummary {
  const load = inputs.dailyLoad ?? [];
  const sleep = inputs.dailySleep ?? [];
  const hrv = inputs.dailyHrv ?? [];
  const battery = inputs.dailyBodyBattery ?? [];
  const rides = inputs.rides ?? [];

  const totalLoad = load.reduce((sum, day) => sum + day.load, 0);
  const averageSleepHours = sleep.length > 0 ? average(sleep.map(d => d.minutes)) / 60.0 : null;
  const averageHrv = hrv.length > 0 ? Math.round(average(hrv.map(d => d.value))) : null;
  const lowestBodyBattery = battery.length > 0 ? Math.min(...battery.map(d => d.low)) : null;

  const chips: SignalChip[] = [
    load.length > 0
      ? { label: 'Training load', value: String(totalLoad), trend: trendForLoad(load) }
      : missingChip('Training load'),
    averageSleepHours !== null
      ? { label: 'Sleep', value: averageSleepHours.toFixed(1) + ' h/night', trend: trendForSleep(sleep) }
      : missingChip('Sleep'),
    averageHrv !== null
      ? { label: 'HRV', value: averageHrv + ' ms avg', trend: trendForHrv(hrv) }
      : missingChip('HRV'),
    lowestBodyBattery !== null
      ? { label: 'Body Battery', value: 'low ' + lowestBodyBattery, trend: trendForBattery(battery) }
      : missingChip('Body Battery'),
  ];

  const missingSignals = chips.filter(chip => chip.value === NO_DATA).map(chip => chip.label);
  if (rides.length === 0) {
    missingSignals.push('Rides this week');
  }

  return {
    totalLoad,
    averageSleepHours,
    averageHrv,
    lowestBodyBattery,
    chips,
    dailyLoad: sortByDate(load),
    dailySleep: sortByDate(sleep),
    dailyHrv: sortByDate(hrv),
    rides,
    missingSignals,
    hasAnyData: load.length > 0 || sleep.length > 0 || hrv.length > 0 || battery.length > 0 || rides.length > 0,
  };
}

export function trendForLoad(load: DailyLoad[]): string {
  if (load.length < 2) {
    return 'steady';
  }
  const half = Math.floor(load.length / 2);
  const first = load.slice(0, half).reduce((sum, day) => sum + day.load, 0);
  const second = load.slice(half).reduce((sum, day) => sum + day.load, 0);
  const delta = second - first;
  if (Math.abs(delta) <= Math.max(1, first * 0.1)) {
    return 'steady';
  }
  return delta > 0 ? 'rising' : 'falling';
}

export function trendForSleep(sleep: DailySleep[]): string {
  return trendDirection(sleep.map(d => d.minutes), 20);
}

export function trendForHrv(hrv: DailyHrv[]): string {
  return trendDirection(hrv.map(d => d.value), 1);
}

export function trendForBattery(battery: DailyBodyBattery[]): string {
  return trendDirection(battery.map(d => d.low), 1);
}

function trendDirection(values: number[], tolerance: number): string {
  if (values.length < 2) {
    return 'steady';
  }
  const half = Math.floor(values.length / 2);
  const delta = average(values.slice(half)) - average(values.slice(0, half));
  if (Math.abs(delta) < tolerance) {
    return 'steady';
  }
  return delta > 0 ? 'improving' : 'declining';
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
}