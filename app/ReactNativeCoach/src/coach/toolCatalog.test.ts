import { COACHING_TOOLS, READ_ONLY_TOOLS, isReadOnly } from './toolCatalog';

describe('toolCatalog', () => {
  it('lists the 21 read-only Garmin tools', () => {
    expect(READ_ONLY_TOOLS).toHaveLength(21);
    expect(READ_ONLY_TOOLS).toContain('search_activities');
    expect(READ_ONLY_TOOLS).toContain('get_profile_settings');
  });

  it('allows only read-only tools', () => {
    expect(isReadOnly('get_body_battery')).toBe(true);
    expect(isReadOnly('delete_activity')).toBe(false);
    expect(isReadOnly('upload_workout')).toBe(false);
  });

  it('coaches from six read-only tools', () => {
    expect(COACHING_TOOLS).toEqual([
      'search_activities',
      'get_daily_summaries',
      'get_sleep_summaries',
      'get_hrv_range',
      'get_body_battery',
      'get_profile_settings',
    ]);
    expect(COACHING_TOOLS.every(isReadOnly)).toBe(true);
  });
});