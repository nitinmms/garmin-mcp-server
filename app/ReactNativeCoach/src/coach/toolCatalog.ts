/** The read-only Garmin MCP tools the app may call. Mirrors the Python server's 21 tools. */
export const READ_ONLY_TOOLS: readonly string[] = [
  'search_activities',
  'get_activity',
  'get_activity_workouts',
  'get_daily_summary',
  'get_daily_summaries',
  'get_steps',
  'get_stress',
  'get_heart_rate',
  'get_body_battery',
  'get_spo2',
  'get_hydration',
  'get_wellness_activities',
  'get_sleep',
  'get_sleep_summaries',
  'get_hrv',
  'get_hrv_range',
  'get_fitness_age',
  'get_weight',
  'get_weight_goals',
  'get_heart_rate_zones',
  'get_profile_settings',
];

/** The subset the coach needs for the last 7 days plus age and gender. */
export const COACHING_TOOLS: readonly string[] = [
  'search_activities',
  'get_daily_summaries',
  'get_sleep_summaries',
  'get_hrv_range',
  'get_body_battery',
  'get_profile_settings',
];

export function isReadOnly(toolName: string): boolean {
  return READ_ONLY_TOOLS.includes(toolName);
}