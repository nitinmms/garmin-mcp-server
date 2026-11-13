import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';

describe('buildUserPrompt', () => {
  it('asks for exactly one cycling session and includes the signals JSON', () => {
    const prompt = buildUserPrompt('{"rides":[]}');

    expect(prompt).toContain('Recommend exactly one cycling session');
    expect(prompt).toContain('{"rides":[]}');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('asks for the recommendation keys and forbids inventing data', () => {
    expect(SYSTEM_PROMPT).toContain('workoutType');
    expect(SYSTEM_PROMPT).toContain('durationMinutes');
    expect(SYSTEM_PROMPT).toContain('intensityZone');
    expect(SYSTEM_PROMPT).toContain('structure');
    expect(SYSTEM_PROMPT).toContain('reasoning');
    expect(SYSTEM_PROMPT).toContain('missingSignals');
    expect(SYSTEM_PROMPT).toContain('Never invent data');
  });

  it('never asks the model to change Garmin data', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).not.toMatch(/create|update|delete|upload|write/);
  });
});