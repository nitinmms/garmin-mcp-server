export const DEFAULT_SERVER_URL = 'http://10.0.2.2:8000';

/** The Android emulator reaches the development machine at 10.0.2.2. */
export function normalizeServerUrl(url: string | null | undefined): string {
  let text = (url ?? '').trim();
  if (text.length === 0) {
    return DEFAULT_SERVER_URL;
  }
  if (!text.includes('://')) {
    text = 'http://' + text.replace(/^\/+/, '');
  }
  return text.replace(/\/+$/, '');
}

/** The Streamable HTTP endpoint the app posts to. */
export function mcpEndpoint(url: string | null | undefined): string {
  return normalizeServerUrl(url) + '/mcp';
}