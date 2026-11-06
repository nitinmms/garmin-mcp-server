import asyncio
import os

import httpx

from garmin_mcp import http_server, server


def _get(path):
    async def run():
        transport = httpx.ASGITransport(app=http_server.create_app())
        async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
            return await client.get(path)
    return asyncio.run(run())


def test_health_endpoint_reports_tool_count():
    response = _get('/health')
    assert response.status_code == 200
    body = response.json()
    assert body['status'] == 'ok'
    assert body['tool_count'] == 21


def test_api_key_from_headers_reads_case_insensitive_header():
    headers = [(b'Host', b'x'), (b'X-Garmin-Api-Key', b'  my-key  ')]
    assert http_server.api_key_from_headers(headers) == 'my-key'


def test_api_key_from_headers_is_none_when_absent_or_blank():
    assert http_server.api_key_from_headers([(b'host', b'x')]) is None
    assert http_server.api_key_from_headers([(b'X-Garmin-Api-Key', b'   ')]) is None
    assert http_server.api_key_from_headers([]) is None


def test_apply_api_key_points_the_cached_client_at_the_header_key(monkeypatch):
    monkeypatch.delenv(server.API_KEY_ENV, raising=False)
    http_server.apply_api_key('abc123')
    assert os.environ[server.API_KEY_ENV] == 'abc123'


def test_main_is_dispatched_from_the_server_cli(monkeypatch):
    calls = []
    monkeypatch.setattr(http_server, 'main', lambda: calls.append('http'))
    monkeypatch.setattr(server.sys, 'argv', ['garmin-mcp', 'http'])
    server.main()
    assert calls == ['http']


def test_host_and_port_have_defaults_and_env_overrides(monkeypatch):
    monkeypatch.delenv('GARMIN_MCP_HTTP_HOST', raising=False)
    monkeypatch.delenv('GARMIN_MCP_HTTP_PORT', raising=False)
    assert http_server.host() == '127.0.0.1'
    assert http_server.port() == 8000
    monkeypatch.setenv('GARMIN_MCP_HTTP_HOST', '0.0.0.0')
    monkeypatch.setenv('GARMIN_MCP_HTTP_PORT', '9111')
    assert http_server.host() == '0.0.0.0'
    assert http_server.port() == 9111
    monkeypatch.setenv('GARMIN_MCP_HTTP_PORT', 'not-a-number')
    assert http_server.port() == 8000


def test_read_only_tool_names_match_the_registered_tools():
    tools = asyncio.run(server.mcp.list_tools())
    assert sorted(t.name for t in tools) == sorted(server.READ_ONLY_TOOL_NAMES)
    assert len(server.READ_ONLY_TOOL_NAMES) == 21
