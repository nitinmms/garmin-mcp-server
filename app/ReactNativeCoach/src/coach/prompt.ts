export const SYSTEM_PROMPT =
  'You are a cycling coach. Using the supplied Garmin signals and the read-only Garmin ' +
  'tools (which you may call for more detail), recommend exactly one training session ' +
  'for today. Reply with a single JSON object using the keys workoutType, durationMinutes ' +
  '(integer), intensityZone, structure (array of step descriptions in order), reasoning, ' +
  'and missingSignals (array of signal names you could not read). Never invent data.';

export function buildUserPrompt(dataJson: string): string {
  return (
    'Here are the last 7 days of my Garmin signals as JSON. Recommend exactly one cycling ' +
    'session for today and reply with only the JSON object described above.\n\n' +
    dataJson
  );
}