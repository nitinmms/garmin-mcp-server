"""Tests for the embedded/background HTTP server helpers (.NET app integration)."""

from __future__ import annotations

from garmin_mcp import server_runner, settings
from garmin_mcp.http_server import DEFAULT_HOST, DEFAULT_PORT, create_server_app

HOST_ENV = "GARMIN_MCP_HTTP_HOST"
PORT_ENV = "GARMIN_MCP_HTTP_PORT"


def test_transport_settings_have_defaults(monkeypatch):
    monkeypatch.delenv(HOST_ENV, raising=False)
    monkeypatch.delenv(PORT_ENV, raising=False)
    assert settings.host() == DEFAULT_HOST
    assert settings.port() == DEFAULT_PORT


def test_transport_settings_read_env_overrides(monkeypatch):
    monkeypatch.setenv(HOST_ENV, "0.0.0.0")
    monkeypatch.setenv(PORT_ENV, "9123")
    assert settings.host() == "0.0.0.0"
    assert settings.port() == 9123


def test_transport_settings_fall_back_on_a_blank_or_invalid_port(monkeypatch):
    monkeypatch.setenv(PORT_ENV, "")
    assert settings.port() == DEFAULT_PORT
    monkeypatch.setenv(PORT_ENV, "not-a-port")
    assert settings.port() == DEFAULT_PORT


def test_set_host_port_records_the_chosen_address(monkeypatch):
    monkeypatch.delenv(HOST_ENV, raising=False)
    monkeypatch.delenv(PORT_ENV, raising=False)
    settings.set_host_port("127.0.0.1", 8001)
    assert settings.host() == "127.0.0.1"
    assert settings.port() == 8001


def test_available_reports_whether_uvicorn_is_importable():
    assert isinstance(server_runner.available(), bool)


def test_create_server_app_records_the_bind_address(monkeypatch):
    monkeypatch.delenv(PORT_ENV, raising=False)
    create_server_app("127.0.0.1", 8010)
    assert settings.port() == 8010


def test_running_server_builds_a_base_url():
    running = server_runner.RunningServer(host="127.0.0.1", port=8000, thread=None, server=None)  # type: ignore[arg-type]
    assert running.base_url == "http://127.0.0.1:8000"


def test_stop_server_tolerates_nothing_running():
    server_runner.stop_server(None)
import time

import pytest


def test_start_server_serves_health_end_to_end():
    pytest.importorskip("uvicorn")
    httpx = pytest.importorskip("httpx")
    running = server_runner.start_server("127.0.0.1", 8123)
    try:
        deadline = time.monotonic() + 10
        payload = None
        while time.monotonic() < deadline:
            try:
                response = httpx.get(running.base_url + "/health", timeout=1.0)
                if response.status_code == 200:
                    payload = response.json()
                    break
            except httpx.HTTPError:
                time.sleep(0.2)
        assert payload is not None, "the embedded server never became healthy"
        assert payload["status"] == "ok"
        assert payload["tool_count"] == 21
    finally:
        server_runner.stop_server(running)