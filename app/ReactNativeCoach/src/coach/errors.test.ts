import { CoachError, MISSING_GARMIN_KEY, describeError, missingGarminKeyError } from './errors';

/**
 * The sentence the screen shows, copied out of the design by hand — including the
 * curly quotes — so that a missing or doubled escape in errors.ts cannot hide
 * behind this test importing the same constant it checks.
 */
const SHOWN_SENTENCE =
  'Add your Garmin personal API key in Settings, then tap “What should I ride today?” again.';

describe('the Garmin-key message', () => {
  it('shows real curly quotes around the question', () => {
    expect(MISSING_GARMIN_KEY).toBe(SHOWN_SENTENCE);
  });

  it('never shows the literal escape text to the user', () => {
    expect(MISSING_GARMIN_KEY).not.toMatch(/\\u/);
  });

  it('shows that same sentence when the coach refuses without a key', () => {
    expect(describeError(missingGarminKeyError(), 'http://10.0.2.2:8000')).toBe(SHOWN_SENTENCE);
  });

  it('hands the screen a user-facing CoachError with the sentence', () => {
    const error = missingGarminKeyError();

    expect(error).toBeInstanceOf(CoachError);
    expect(error.message).toBe(SHOWN_SENTENCE);
  });
});