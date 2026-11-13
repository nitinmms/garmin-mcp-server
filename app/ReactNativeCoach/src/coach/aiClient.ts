import { CoachError } from './errors';
import type { AiProvider } from './types';

export type AiFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

export type AiRequest = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  fetchImpl: AiFetch;
  signal?: AbortSignal;
};

export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const AI_TIMEOUT_MS = 90000;

/**
 * Asks the chosen provider for one reply. The Garmin key is never part of this request:
 * only the AI provider's own key reaches it.
 */
export async function askAi(request: AiRequest): Promise<string> {
  const provider: AiProvider = request.provider === 'anthropic' ? 'anthropic' : 'openai';
  const url = provider === 'anthropic' ? ANTHROPIC_URL : OPENAI_URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: unknown;

  if (provider === 'anthropic') {
    headers['x-api-key'] = request.apiKey;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
    body = {
      model: request.model,
      max_tokens: 2048,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    };
  } else {
    headers.Authorization = 'Bearer ' + request.apiKey;
    body = {
      model: request.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      response_format: { type: 'json_object' },
    };
  }

  let response: { status: number; text(): Promise<string> };
  try {
    response = await request.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: request.signal ?? AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CoachError('The request timed out. Check your connection and try again.');
    }
    throw new CoachError('Could not reach the AI provider. Check your connection and try again.');
  }

  const text = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new CoachError(
      'The AI provider rejected the API key. Create a new one and paste it in Settings.',
    );
  }
  if (response.status >= 400) {
    throw new CoachError('The AI provider returned an error. Please try again.');
  }

  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new CoachError('The AI provider returned a reply that could not be read.');
  }

  const content =
    provider === 'anthropic'
      ? Array.isArray(payload?.content)
        ? payload.content.filter((item: any) => item?.type === 'text').map((item: any) => String(item.text ?? '')).join('')
        : ''
      : String(payload?.choices?.[0]?.message?.content ?? '');

  if (content.trim().length === 0) {
    throw new CoachError('The AI provider returned an empty reply.');
  }
  return content;
}