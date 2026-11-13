import { CoachError, rejectedGarminKeyError, serverUnreachableError } from '../coach/errors';
import { normalizeServerUrl } from '../coach/serverUrl';
import { isReadOnly } from '../coach/toolCatalog';
import type { McpToolInfo } from './types';

export type HttpResponse = {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<HttpResponse>;

export type McpClientOptions = {
  serverUrl: string;
  apiKey: string;
  fetchImpl?: FetchLike;
};

export type GarminMcpClient = {
  serverUrl: string;
  listTools(): Promise<McpToolInfo[]>;
  listReadOnlyTools(): Promise<McpToolInfo[]>;
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
};

const PROTOCOL_VERSION = '2025-06-18';
const DEFAULT_TIMEOUT_MS = 45000;

/**
 * A hand-rolled Streamable HTTP MCP client: one JSON-RPC POST per call to <server>/mcp,
 * with the Garmin key in the X-Garmin-Api-Key header. The key is never sent anywhere else.
 */
export function createGarminMcpClient(options: McpClientOptions): GarminMcpClient {
  const serverUrl = normalizeServerUrl(options.serverUrl);
  const endpoint = serverUrl + '/mcp';
  const apiKey = options.apiKey.trim();
  const doFetch: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));
  let nextId = 1;
  let initialized: Promise<void> | null = null;
  let readOnlyTools: McpToolInfo[] | null = null;

  function headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'X-Garmin-Api-Key': apiKey,
    };
  }

  async function post(method: string, params: unknown): Promise<any> {
    const id = nextId++;
    let response: HttpResponse;
    try {
      response = await doFetch(endpoint, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch {
      throw serverUnreachableError(serverUrl);
    }
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw rejectedGarminKeyError();
    }
    if (response.status >= 400) {
      if (/rejected|401|403|not set/i.test(text)) {
        throw rejectedGarminKeyError();
      }
      throw new CoachError(
        'Garmin data could not be read. No session was created from invented data. Please try again.',
      );
    }
    const payload = readJsonRpc(text);
    if (payload === null) {
      return null;
    }
    if (payload.error) {
      const message = String(payload.error.message ?? '');
      if (/rejected|401|403|not set/i.test(message)) {
        throw rejectedGarminKeyError();
      }
      throw new CoachError(
        'Garmin data could not be read. No session was created from invented data. Please try again.',
      );
    }
    return payload.result ?? null;
  }

  async function ensureInitialized(): Promise<void> {
    if (initialized === null) {
      initialized = (async () => {
        await post('initialize', {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'garmin-coach-react-native', version: '1.0' },
        });
        try {
          await doFetch(endpoint, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
          });
        } catch {
          throw serverUnreachableError(serverUrl);
        }
      })();
      try {
        await initialized;
      } catch (error) {
        initialized = null;
        throw error;
      }
    }
    return initialized;
  }

  async function loadTools(): Promise<McpToolInfo[]> {
    await ensureInitialized();
    if (readOnlyTools !== null) {
      return readOnlyTools;
    }
    const result = await post('tools/list', {});
    const raw = Array.isArray(result?.tools) ? result.tools : [];
    const tools: McpToolInfo[] = raw.map((tool: any) => ({
      name: String(tool?.name ?? ''),
      description: tool?.description === undefined ? undefined : String(tool.description),
      readOnlyHint: tool?.annotations?.readOnlyHint === true,
    }));
    readOnlyTools = tools.filter(tool => tool.readOnlyHint && isReadOnly(tool.name));
    return readOnlyTools;
  }

  return {
    serverUrl,
    listTools: async () => {
      await loadTools();
      return readOnlyTools ?? [];
    },
    listReadOnlyTools: loadTools,
    callTool: async (toolName, args) => {
      if (!isReadOnly(toolName)) {
        throw new CoachError("'" + toolName + "' is not an allowed read-only Garmin tool.");
      }
      const tools = await loadTools();
      const advertised = tools.find(tool => tool.name === toolName);
      if (advertised === undefined) {
        throw new CoachError("'" + toolName + "' is not an allowed read-only Garmin tool.");
      }
      const result = await post('tools/call', { name: toolName, arguments: args ?? {} });
      if (result === null || result === undefined) {
        return null;
      }
      if (result.isError === true) {
        const text = textOf(result);
        if (/rejected|401|403|not set/i.test(text)) {
          throw rejectedGarminKeyError();
        }
        throw new CoachError(
          'Garmin data could not be read. No session was created from invented data. Please try again.',
        );
      }
      const text = textOf(result);
      if (text.trim().length === 0) {
        return null;
      }
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  };
}

/** Reads a JSON-RPC reply, tolerating a Streamable HTTP server that answers with SSE frames. */
function readJsonRpc(text: string): any | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to the SSE parser.
    }
  }
  for (const line of trimmed.split(/\\r?\\n|\r?\n/)) {
    if (!line.startsWith('data:')) {
      continue;
    }
    const data = line.slice('data:'.length).trim();
    if (data.length === 0) {
      continue;
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) {
        return parsed;
      }
    } catch {
      // Keep scanning the remaining frames.
    }
  }
  return null;
}

function textOf(result: any): string {
  const content = Array.isArray(result?.content) ? result.content : [];
  return content
    .filter((item: any) => item?.type === 'text' && typeof item.text === 'string')
    .map((item: any) => item.text)
    .join('');
}