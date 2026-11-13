import { ANTHROPIC_URL, OPENAI_URL, askAi } from './aiClient';

type Call = { url: string; headers: Record<string, string>; body: any };

function fakeFetch(answer: { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    return { status: answer.status ?? 200, text: async () => JSON.stringify(answer.body) };
  };
  return { fetchImpl, calls };
}

const base = {
  systemPrompt: 'You are a cycling coach.',
  userPrompt: 'Here are the last 7 days.',
};

describe('askAi', () => {
  it('posts to the OpenAI chat completions endpoint and returns the message text', async () => {
    const { fetchImpl, calls } = fakeFetch({
      body: { choices: [{ message: { content: '{"workoutType":"Endurance ride"}' } }] },
    });

    const text = await askAi({
      ...base,
      provider: 'openai',
      apiKey: 'sk-secret',
      model: 'gpt-4o-mini',
      fetchImpl: fetchImpl as any,
    });

    expect(text).toBe('{"workoutType":"Endurance ride"}');
    expect(calls[0].url).toBe(OPENAI_URL);
    expect(calls[0].headers.Authorization).toBe('Bearer sk-secret');
    expect(calls[0].body.model).toBe('gpt-4o-mini');
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'You are a cycling coach.' },
      { role: 'user', content: 'Here are the last 7 days.' },
    ]);
  });

  it('posts to the Anthropic messages endpoint with the anthropic header', async () => {
    const { fetchImpl, calls } = fakeFetch({ body: { content: [{ type: 'text', text: '{"workoutType":"Recovery spin"}' }] } });

    const text = await askAi({
      ...base,
      provider: 'anthropic',
      apiKey: 'anthropic-secret',
      model: 'claude-3-5-sonnet-latest',
      fetchImpl: fetchImpl as any,
    });

    expect(text).toBe('{"workoutType":"Recovery spin"}');
    expect(calls[0].url).toBe(ANTHROPIC_URL);
    expect(calls[0].headers['x-api-key']).toBe('anthropic-secret');
    expect(calls[0].headers['anthropic-version']).toBe('2023-06-01');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].body.system).toBe('You are a cycling coach.');
    expect(calls[0].body.messages).toEqual([{ role: 'user', content: 'Here are the last 7 days.' }]);
  });

  it('never sends the Garmin key to the AI provider', async () => {
    const { fetchImpl, calls } = fakeFetch({ body: { choices: [{ message: { content: 'x' } }] } });

    await askAi({ ...base, provider: 'openai', apiKey: 'sk-secret', model: 'm', fetchImpl: fetchImpl as any });

    const everything = JSON.stringify(calls);
    expect(everything).not.toContain('garmin-secret');
    expect(everything).not.toContain('X-Garmin-Api-Key');
  });

  it('throws a plain-language error for a rejected AI key without echoing it', async () => {
    const { fetchImpl } = fakeFetch({ status: 401, body: { error: { message: 'Incorrect API key provided: sk-secret' } } });

    await expect(
      askAi({ ...base, provider: 'openai', apiKey: 'sk-secret', model: 'm', fetchImpl: fetchImpl as any }),
    ).rejects.toThrow(/AI provider rejected the API key/);

    try {
      await askAi({ ...base, provider: 'openai', apiKey: 'sk-secret', model: 'm', fetchImpl: fetchImpl as any });
    } catch (error) {
      expect((error as Error).message).not.toContain('sk-secret');
    }
  });

  it('throws a plain-language error when the provider cannot be reached', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Network request failed');
    };

    await expect(
      askAi({ ...base, provider: 'openai', apiKey: 'k', model: 'm', fetchImpl: fetchImpl as any }),
    ).rejects.toThrow(/Could not reach the AI provider/);
  });
});