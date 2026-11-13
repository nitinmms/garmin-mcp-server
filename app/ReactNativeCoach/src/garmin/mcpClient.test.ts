import { createGarminMcpClient } from './mcpClient';
import type { FetchLike, HttpResponse } from './mcpClient';

type Call = { url: string; headers: Record<string, string>; body?: string; method: string };

/** A tiny fake of a Streamable HTTP MCP endpoint, enough for the JSON responses the app uses. */
function fakeServer(handler: (call: Call, payload: any) => any) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const payload = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, headers: init.headers, body: init.body, method: init.method });
    const answer = handler({ url, headers: init.headers, body: init.body, method: init.method }, payload);
    const status = answer.status ?? 200;
    const bodyText = answer.body === undefined ? '' : JSON.stringify(answer.body);
    const response: HttpResponse = {
      status,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      text: async () => bodyText,
    };
    return response;
  };
  return { fetchImpl, calls };
}

const tools = [
  { name: 'search_activities', annotations: { readOnlyHint: true } },
  { name: 'get_daily_summaries', annotations: { readOnlyHint: true } },
  { name: 'delete_activity', annotations: { readOnlyHint: false } },
];

function rpcResult(id: number, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

describe('createGarminMcpClient', () => {
  it('posts to the /mcp endpoint with the Garmin key in the X-Garmin-Api-Key header only', async () => {
    const { fetchImpl, calls } = fakeServer((_call, payload) =>
      payload.method === 'initialize'
        ? { body: rpcResult(payload.id, { serverInfo: { name: 'garmin' }, protocolVersion: '2025-06-18' }) }
        : { body: rpcResult(payload.id, { tools }) },
    );

    const client = createGarminMcpClient({
      serverUrl: 'http://10.0.2.2:8000',
      apiKey: 'garmin-secret',
      fetchImpl,
    });
    await client.listTools();

    expect(calls[0].url).toBe('http://10.0.2.2:8000/mcp');
    expect(calls[0].headers['X-Garmin-Api-Key']).toBe('garmin-secret');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].headers.Accept).toContain('application/json');
    const everything = JSON.stringify(calls);
    expect(everything).not.toContain('Bearer');
  });

  it('lists tools and keeps only the read-only ones', async () => {
    const { fetchImpl } = fakeServer((_call, payload) =>
      payload.method === 'initialize'
        ? { body: rpcResult(payload.id, { serverInfo: { name: 'garmin' } }) }
        : { body: rpcResult(payload.id, { tools }) },
    );

    const client = createGarminMcpClient({ serverUrl: 'http://10.0.2.2:8000/', apiKey: 'k', fetchImpl });
    const readOnly = await client.listReadOnlyTools();

    expect(readOnly.map(tool => tool.name)).toEqual(['search_activities', 'get_daily_summaries']);
    expect(readOnly.every(tool => tool.readOnlyHint)).toBe(true);
  });

  it('calls a read-only tool and returns the parsed JSON text content', async () => {
    const { fetchImpl, calls } = fakeServer((_call, payload) => {
      if (payload.method === 'initialize') {
        return { body: rpcResult(payload.id, { serverInfo: { name: 'garmin' } }) };
      }
      if (payload.method === 'notifications/initialized') {
        return { status: 202, body: undefined };
      }
      if (payload.method === 'tools/list') {
        return { body: rpcResult(payload.id, { tools }) };
      }
      return {
        body: rpcResult(payload.id, { content: [{ type: 'text', text: '{"activities":[{"id":1}]}' }] }),
      };
    });

    const client = createGarminMcpClient({ serverUrl: 'http://10.0.2.2:8000', apiKey: 'k', fetchImpl });
    const result = await client.callTool('search_activities', { activity_type: 'cycling' });

    expect(result).toEqual({ activities: [{ id: 1 }] });
    const toolCall = calls.find(call => call.body && JSON.parse(call.body).method === 'tools/call');
    expect(JSON.parse(toolCall!.body!).params).toEqual({
      name: 'search_activities',
      arguments: { activity_type: 'cycling' },
    });
  });

  it('refuses to call a tool that is not in the read-only catalog', async () => {
    const { fetchImpl, calls } = fakeServer(() => ({ body: rpcResult(1, {}) }));
    const client = createGarminMcpClient({ serverUrl: 'http://10.0.2.2:8000', apiKey: 'k', fetchImpl });

    await expect(client.callTool('delete_activity', { activity_id: 1 })).rejects.toThrow(/read-only/i);
    expect(calls).toHaveLength(0);
  });

  it('reports an unreachable server with the address in the message', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('Network request failed');
    };
    const client = createGarminMcpClient({ serverUrl: 'http://192.168.1.5:8000', apiKey: 'k', fetchImpl });

    await expect(client.listReadOnlyTools()).rejects.toThrow(
      'Could not reach the Garmin MCP server at http://192.168.1.5:8000. Check that it is running and try again.',
    );
  });

  it('reports a server-side tool error without leaking the key', async () => {
    const { fetchImpl } = fakeServer((_call, payload) => {
      if (payload.method === 'initialize') {
        return { body: rpcResult(payload.id, { serverInfo: { name: 'garmin' } }) };
      }
      if (payload.method === 'tools/list') {
        return { body: rpcResult(payload.id, { tools }) };
      }
      return { body: rpcResult(payload.id, { isError: true, content: [{ type: 'text', text: 'Garmin 401 rejected' }] }) };
    });

    const client = createGarminMcpClient({ serverUrl: 'http://10.0.2.2:8000', apiKey: 'garmin-secret', fetchImpl });

    await expect(client.callTool('search_activities', {})).rejects.toThrow(/Garmin rejected your personal API key/);
    try {
      await client.callTool('search_activities', {});
    } catch (error) {
      expect((error as Error).message).not.toContain('garmin-secret');
    }
  });

  it('refuses to call a tool the server does not annotate as read-only', async () => {
    const { fetchImpl } = fakeServer((_call, payload) => {
      if (payload.method === 'initialize') {
        return { body: rpcResult(payload.id, { serverInfo: { name: 'garmin' } }) };
      }
      if (payload.method === 'tools/list') {
        return {
          body: rpcResult(payload.id, {
            tools: [
              { name: 'search_activities', annotations: { readOnlyHint: true } },
              { name: 'get_daily_summaries' },
            ],
          }),
        };
      }
      return { body: rpcResult(payload.id, { content: [] }) };
    });

    const client = createGarminMcpClient({ serverUrl: 'http://10.0.2.2:8000', apiKey: 'k', fetchImpl });
    await expect(client.callTool('get_daily_summaries', {})).rejects.toThrow(/read-only/i);
  });

  it('parses a multi-line SSE reply that uses real CR/LF line breaks', async () => {
    const sseFor = (result: unknown) =>
      ['event: message', 'data: ' + JSON.stringify(rpcResult(1, result)), '', ''].join('\r\n');
    const fetchImpl: FetchLike = async (_url, init) => {
      const payload = init.body ? JSON.parse(init.body) : undefined;
      if (payload?.method === 'notifications/initialized') {
        return { status: 202, headers: { get: () => 'text/event-stream' }, text: async () => '' };
      }
      const result = payload?.method === 'tools/list' ? { tools } : { serverInfo: { name: 'garmin' } };
      return {
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
        text: async () => sseFor(result),
      };
    };

    const client = createGarminMcpClient({ serverUrl: 'http://10.0.2.2:8000', apiKey: 'k', fetchImpl });
    const readOnly = await client.listReadOnlyTools();

    expect(readOnly.map(tool => tool.name)).toEqual(['search_activities', 'get_daily_summaries']);
  });
});
