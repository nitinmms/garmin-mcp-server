export const MISSING_GARMIN_KEY =
  'Add your Garmin personal API key in Settings, then tap \u201cWhat should I ride today?\u201d again.';
export const MISSING_AI_KEY =
  'Add your OpenAI or Anthropic API key in Settings and pick a model before asking for a session.';
export const TIMEOUT_MESSAGE = 'The request timed out. Check your connection and try again.';
export const NO_DATA_MESSAGE =
  'No Garmin data came back for the last 7 days, so no session can be recommended. ' +
  'Check that your Garmin account is linked and try again.';
export const GENERIC_MESSAGE =
  'Something went wrong while building your session. No workout was invented; please try again.';

/** A user-facing failure. The message is safe to show and never contains a credential. */
export class CoachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoachError';
  }
}

export function missingGarminKeyError(): CoachError {
  return new CoachError(MISSING_GARMIN_KEY);
}

export function rejectedGarminKeyError(): CoachError {
  return new CoachError(
    'Garmin rejected your personal API key. Create a new one in Garmin Connect and paste it in Settings.',
  );
}

export function serverUnreachableError(url: string): CoachError {
  return new CoachError(
    'Could not reach the Garmin MCP server at ' + url + '. Check that it is running and try again.',
  );
}

export function missingAiKeyError(): CoachError {
  return new CoachError(MISSING_AI_KEY);
}

/** Turns any thrown value into a sentence safe to show the user. */
export function describeError(error: unknown, serverUrl: string): string {
  if (error instanceof CoachError) {
    return error.message;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return TIMEOUT_MESSAGE;
  }
  const text = error instanceof Error ? error.message : '';
  if (/timed out/i.test(text)) {
    return TIMEOUT_MESSAGE;
  }
  if (/network request failed|failed to fetch|econnrefused|unreachable/i.test(text)) {
    return serverUnreachableError(serverUrl).message;
  }
  return GENERIC_MESSAGE;
}