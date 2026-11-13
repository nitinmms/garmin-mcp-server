import { DEFAULT_SERVER_URL, mcpEndpoint, normalizeServerUrl } from './serverUrl';

describe('normalizeServerUrl', () => {
  it('defaults to the Android emulator route to the development machine', () => {
    expect(DEFAULT_SERVER_URL).toBe('http://10.0.2.2:8000');
    expect(normalizeServerUrl('')).toBe('http://10.0.2.2:8000');
    expect(normalizeServerUrl(null)).toBe('http://10.0.2.2:8000');
  });

  it('adds a scheme and drops a trailing slash', () => {
    expect(normalizeServerUrl('192.168.1.20:8000/')).toBe('http://192.168.1.20:8000');
  });

  it('keeps an explicit scheme and host', () => {
    expect(normalizeServerUrl('https://garmin.example.com')).toBe('https://garmin.example.com');
  });
});

describe('mcpEndpoint', () => {
  it('appends the Streamable HTTP path', () => {
    expect(mcpEndpoint('http://10.0.2.2:8000')).toBe('http://10.0.2.2:8000/mcp');
    expect(mcpEndpoint('http://10.0.2.2:8000/')).toBe('http://10.0.2.2:8000/mcp');
  });
});