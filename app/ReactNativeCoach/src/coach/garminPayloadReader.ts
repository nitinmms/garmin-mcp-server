import type {
  ActivityItem,
  DailyBodyBattery,
  DailyHrv,
  DailyLoad,
  DailySleep,
  ProfileSnapshot,
} from './types';

const CYCLING_KEYS = [
  'cycling',
  'road_biking',
  'mountain_biking',
  'gravel_cycling',
  'indoor_cycling',
  'virtual_ride',
  'cyclocross',
  'track_cycling',
  'commuter',
  'e_bike_fitness',
  'bmx',
];

export function isCycling(activityTypeKey: string | null | undefined): boolean {
  if (typeof activityTypeKey !== 'string' || activityTypeKey.trim().length === 0) {
    return false;
  }
  const key = activityTypeKey.trim().toLowerCase();
  return CYCLING_KEYS.includes(key) || key.includes('cycl') || key.includes('bik');
}

export function parseActivities(node: unknown): ActivityItem[] {
  const rides: ActivityItem[] = [];
  for (const activity of objects(node)) {
    const typeKey = text(nested(activity, 'activityType', 'activityTypeKey')) ?? text(activity.activityTypeKey);
    if (!isCycling(typeKey)) {
      continue;
    }
    const start = text(activity.startTimeLocal) ?? text(activity.startTimeGmt) ?? '';
    const distance = number(activity.distance) ?? 0;
    const duration = number(activity.duration) ?? 0;
    rides.push({
      date: iso(start),
      type: typeKey ?? 'cycling',
      distanceKm: round(distance / 1000.0, 2),
      durationMinutes: Math.round(duration / 60.0),
    });
  }
  return rides;
}

export function parseDailyLoad(node: unknown): DailyLoad[] {
  const load: DailyLoad[] = [];
  for (const day of objects(node)) {
    const dateText = date(day);
    if (dateText === null) {
      continue;
    }
    const value =
      number(day.activeKilocalories) ??
      number(day.totalKilocalories) ??
      number(day.intensityMinutes) ??
      number(day.activeTimeInSeconds);
    if (value === null) {
      continue;
    }
    load.push({ date: dateText, load: Math.round(value) });
  }
  return load;
}

export function parseSleep(node: unknown): DailySleep[] {
  const sleep: DailySleep[] = [];
  for (const day of objects(node)) {
    const dateText = date(day);
    if (dateText === null) {
      continue;
    }
    const seconds = number(day.sleepTimeSeconds) ?? number(day.sleepingSeconds) ?? number(day.durationInSeconds);
    if (seconds === null) {
      continue;
    }
    sleep.push({ date: dateText, minutes: Math.round(seconds / 60.0) });
  }
  return sleep;
}

export function parseHrv(node: unknown): DailyHrv[] {
  const hrv: DailyHrv[] = [];
  for (const day of objects(node)) {
    const dateText = date(day);
    if (dateText === null) {
      continue;
    }
    const value = number(day.lastNightAvg) ?? number(day.weeklyAvg) ?? number(day.hrvValue);
    if (value === null) {
      continue;
    }
    hrv.push({ date: dateText, value: Math.round(value) });
  }
  return hrv;
}

export function parseBodyBattery(node: unknown): DailyBodyBattery[] {
  const battery: DailyBodyBattery[] = [];
  for (const day of objects(node)) {
    const dateText = date(day);
    if (dateText === null) {
      continue;
    }
    const low = lowestBattery(day);
    if (low === null) {
      continue;
    }
    battery.push({ date: dateText, low: Math.round(low) });
  }
  return battery;
}

export function parseProfile(node: unknown, source: string): ProfileSnapshot {
  if (!isRecord(node)) {
    return { age: null, gender: null, source: null };
  }
  const birth = text(node.birthDate) ?? text(node.birthdate);
  return {
    age: computeAge(birth),
    gender: normalizeGender(text(node.gender)),
    source,
  };
}

export function normalizeGender(gender: string | null | undefined): string | null {
  if (typeof gender !== 'string' || gender.trim().length === 0) {
    return null;
  }
  const key = gender.trim().toLowerCase();
  if (key === 'male' || key === 'm') {
    return 'male';
  }
  if (key === 'female' || key === 'f') {
    return 'female';
  }
  return key;
}

function computeAge(birth: string | null, today: Date = new Date()): string | null {
  if (birth === null) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birth.trim());
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let years = today.getUTCFullYear() - year;
  const monthIndex = today.getUTCMonth() + 1;
  if (monthIndex < month || (monthIndex === month && today.getUTCDate() < day)) {
    years--;
  }
  return years >= 0 && years < 120 ? String(years) : null;
}

function lowestBattery(day: Record<string, unknown>): number | null {
  const levels: number[] = [];
  for (const key of ['bodyBatteryValuesArray', 'values', 'levels']) {
    const array = day[key];
    if (!Array.isArray(array)) {
      continue;
    }
    for (const entry of array) {
      const value = Array.isArray(entry)
        ? number(entry[1])
        : isRecord(entry)
          ? number(entry.bodyBatteryLevel)
          : null;
      if (value !== null) {
        levels.push(value);
      }
    }
  }
  if (levels.length > 0) {
    return Math.min(...levels);
  }
  return (
    number(day.lowestBodyBatteryLevel) ??
    number(day.endBodyBatteryLevel) ??
    number(day.mostRecentBodyBatteryLevel)
  );
}

function objects(node: unknown): Record<string, unknown>[] {
  if (isRecord(node) && (node.calendarDate != null || node.date != null)) {
    return [node];
  }
  const found: Record<string, unknown>[] = [];
  for (const candidate of arrays(node)) {
    if (isRecord(candidate)) {
      found.push(candidate);
    }
  }
  return found;
}

function arrays(node: unknown): unknown[] {
  if (Array.isArray(node)) {
    return node;
  }
  if (isRecord(node)) {
    const found: unknown[] = [];
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        found.push(...value);
      }
    }
    return found;
  }
  return [];
}

function date(day: Record<string, unknown>): string | null {
  const value = iso(text(day.calendarDate) ?? text(day.date) ?? text(day.startTimeLocal));
  return value.length > 0 ? value : null;
}

function iso(value: string | null): string {
  if (value === null) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.length >= 10 && trimmed[4] === '-' ? trimmed.slice(0, 10) : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nested(value: Record<string, unknown>, parent: string, child: string): unknown {
  const inner = value[parent];
  return isRecord(inner) ? inner[child] : undefined;
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value === true) {
    return 'true';
  }
  if (value === false) {
    return 'false';
  }
  return null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}