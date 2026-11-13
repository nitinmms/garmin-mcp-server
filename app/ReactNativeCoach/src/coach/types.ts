export type AiProvider = 'openai' | 'anthropic';

export const NO_DATA = 'No data';
export const UNAVAILABLE = 'unavailable';

export type SignalChip = { label: string; value: string; trend: string };

export function missingChip(label: string): SignalChip {
  return { label, value: NO_DATA, trend: UNAVAILABLE };
}

export type WorkoutStep = { order: number; description: string };

export type Recommendation = {
  workoutType: string;
  durationMinutes: number;
  intensityZone: string;
  structure: WorkoutStep[];
  reasoning: string;
  missingSignals: string[];
};

export function durationText(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours + 'h ' + String(rest).padStart(2, '0') + 'm';
  }
  return minutes + ' min';
}

export type ActivityItem = {
  date: string;
  type: string;
  distanceKm: number;
  durationMinutes: number;
};

export type DailyLoad = { date: string; load: number };
export type DailySleep = { date: string; minutes: number };
export type DailyHrv = { date: string; value: number };
export type DailyBodyBattery = { date: string; low: number };

export type SignalInputs = {
  rides: ActivityItem[];
  dailyLoad: DailyLoad[];
  dailySleep: DailySleep[];
  dailyHrv: DailyHrv[];
  dailyBodyBattery: DailyBodyBattery[];
};

export type GarminSignalSummary = {
  totalLoad: number;
  averageSleepHours: number | null;
  averageHrv: number | null;
  lowestBodyBattery: number | null;
  chips: SignalChip[];
  dailyLoad: DailyLoad[];
  dailySleep: DailySleep[];
  dailyHrv: DailyHrv[];
  rides: ActivityItem[];
  missingSignals: string[];
  hasAnyData: boolean;
};

export type ProfileSnapshot = {
  age: string | null;
  gender: string | null;
  source: string | null;
};

export type ToolCallRecord = {
  order: number;
  toolName: string;
  arguments: string;
  summary: string;
};

export type AiSettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

export type AppSettings = {
  garminApiKey: string;
  aiProvider: AiProvider;
  aiApiKey: string;
  aiModel: string;
  serverUrl: string;
};