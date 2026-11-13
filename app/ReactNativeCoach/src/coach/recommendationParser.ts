import { CoachError } from './errors';
import type { Recommendation, WorkoutStep } from './types';

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 300;

/** Reads the model's reply as a recommendation, or throws so no workout is invented. */
export function parseRecommendation(text: string): Recommendation {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new CoachError('The model returned an empty session.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text.trim()));
  } catch {
    throw new CoachError('The model did not return a usable session. Please try again.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CoachError('The model did not return a usable session. Please try again.');
  }

  const root = parsed as Record<string, unknown>;
  const recommendation: Recommendation = {
    workoutType: stringValue(root.workoutType),
    durationMinutes: intValue(root.durationMinutes),
    intensityZone: stringValue(root.intensityZone),
    structure: steps(root.structure),
    reasoning: stringValue(root.reasoning),
    missingSignals: stringArray(root.missingSignals),
  };

  const problems = validateRecommendation(recommendation);
  if (problems.length > 0) {
    throw new CoachError(
      "The model's session was incomplete (" +
        problems.join(' ') +
        '). Nothing was shown so that no workout is invented.',
    );
  }
  return recommendation;
}

export function validateRecommendation(recommendation: Recommendation): string[] {
  const problems: string[] = [];
  if (recommendation.workoutType.trim().length === 0) {
    problems.push('Workout type is missing.');
  }
  if (recommendation.intensityZone.trim().length === 0) {
    problems.push('Target intensity zone is missing.');
  }
  if (
    recommendation.durationMinutes < MIN_DURATION_MINUTES ||
    recommendation.durationMinutes > MAX_DURATION_MINUTES
  ) {
    problems.push(
      'Duration must be between ' + MIN_DURATION_MINUTES + ' and ' + MAX_DURATION_MINUTES + ' minutes.',
    );
  }
  if (recommendation.structure.length === 0) {
    problems.push('No step-by-step structure was provided.');
  }
  if (recommendation.reasoning.trim().length === 0) {
    problems.push('No reasoning was provided.');
  }
  return problems;
}

function stripCodeFence(text: string): string {
  if (!text.startsWith('```')) {
    return text;
  }
  const firstNewline = text.indexOf('\n');
  if (firstNewline < 0) {
    return text;
  }
  const end = text.lastIndexOf('```');
  if (end <= firstNewline) {
    return text;
  }
  return text.slice(firstNewline + 1, end).trim();
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function intValue(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return 0;
}

function steps(value: unknown): WorkoutStep[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const list: WorkoutStep[] = [];
  for (const step of value) {
    let description = '';
    if (typeof step === 'string') {
      description = step;
    } else if (typeof step === 'object' && step !== null) {
      const record = step as Record<string, unknown>;
      description = stringValue(record.description) || stringValue(record.text);
    }
    if (description.trim().length > 0) {
      list.push({ order: list.length + 1, description });
    }
  }
  return list;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}