import { parseRecommendation, validateRecommendation } from './recommendationParser';
import type { Recommendation } from './types';

const valid: Recommendation = {
  workoutType: 'Endurance ride',
  durationMinutes: 90,
  intensityZone: 'Zone 2',
  structure: [
    { order: 1, description: '10 min easy spin' },
    { order: 2, description: '60 min steady Zone 2' },
  ],
  reasoning: 'Load is rising and sleep was good.',
  missingSignals: [],
};

describe('parseRecommendation', () => {
  it('parses a JSON object into a recommendation', () => {
    const recommendation = parseRecommendation(
      JSON.stringify({
        workoutType: 'Endurance ride',
        durationMinutes: 90,
        intensityZone: 'Zone 2',
        structure: ['10 min easy spin', '60 min steady Zone 2'],
        reasoning: 'Load is rising and sleep was good.',
        missingSignals: ['HRV'],
      }),
    );

    expect(recommendation.workoutType).toBe('Endurance ride');
    expect(recommendation.durationMinutes).toBe(90);
    expect(recommendation.intensityZone).toBe('Zone 2');
    expect(recommendation.structure).toEqual([
      { order: 1, description: '10 min easy spin' },
      { order: 2, description: '60 min steady Zone 2' },
    ]);
    expect(recommendation.reasoning).toBe('Load is rising and sleep was good.');
    expect(recommendation.missingSignals).toEqual(['HRV']);
  });

  it('accepts steps given as objects with a description', () => {
    const recommendation = parseRecommendation(
      JSON.stringify({ ...valid, structure: [{ description: 'Warm up' }, { text: 'Cool down' }] }),
    );

    expect(recommendation.structure).toEqual([
      { order: 1, description: 'Warm up' },
      { order: 2, description: 'Cool down' },
    ]);
  });

  it('accepts a duration sent as a numeric string', () => {
    expect(parseRecommendation(JSON.stringify({ ...valid, durationMinutes: '75' })).durationMinutes).toBe(75);
  });

  it('strips a Markdown code fence', () => {
    const fenced = '```json\n' + JSON.stringify(valid) + '\n```';
    expect(parseRecommendation(fenced).workoutType).toBe('Endurance ride');
  });

  it('rejects an empty reply', () => {
    expect(() => parseRecommendation('   ')).toThrow(/empty session/i);
  });

  it('rejects a reply that is not JSON', () => {
    expect(() => parseRecommendation('I would ride Zone 2 for an hour.')).toThrow(/did not return a usable session/i);
  });

  it('rejects JSON that is not an object', () => {
    expect(() => parseRecommendation('[]')).toThrow(/did not return a usable session/i);
  });

  it('rejects an incomplete recommendation so no workout is invented', () => {
    expect(() => parseRecommendation(JSON.stringify({ ...valid, structure: [] }))).toThrow(
      /session was incomplete.*step-by-step structure/i,
    );
  });

  it('rejects a duration outside the allowed range', () => {
    expect(() => parseRecommendation(JSON.stringify({ ...valid, durationMinutes: 5 }))).toThrow(
      /Duration must be between 15 and 300 minutes/,
    );
  });
});

describe('validateRecommendation', () => {
  it('returns no problems for a complete recommendation', () => {
    expect(validateRecommendation(valid)).toEqual([]);
  });

  it('names every missing part', () => {
    const problems = validateRecommendation({
      workoutType: '',
      durationMinutes: 0,
      intensityZone: '',
      structure: [],
      reasoning: '',
      missingSignals: [],
    });

    expect(problems).toEqual([
      'Workout type is missing.',
      'Target intensity zone is missing.',
      'Duration must be between 15 and 300 minutes.',
      'No step-by-step structure was provided.',
      'No reasoning was provided.',
    ]);
  });
});