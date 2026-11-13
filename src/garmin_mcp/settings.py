# Launch settings shared by the embedded and standalone HTTP transport.
#
# These read the same environment variables as ``garmin_mcp.http_server`` so a
# desktop/test harness can start a server on a port of its own and have the .NET
# app (or a test) point at it.

from __future__ import annotations

import os

from .http_server import DEFAULT_HOST, DEFAULT_PORT

HOST_ENV = "GARMIN_MCP_HTTP_HOST"
PORT_ENV = "GARMIN_MCP_HTTP_PORT"


def host() -> str:
    """The bind host, overridable with GARMIN_MCP_HTTP_HOST."""
    return os.environ.get(HOST_ENV, DEFAULT_HOST).strip() or DEFAULT_HOST


def port() -> int:
    """The bind port, overridable with GARMIN_MCP_HTTP_PORT."""
    raw = os.environ.get(PORT_ENV, "").strip()
    if not raw:
        return DEFAULT_PORT
    try:
        return int(raw)
    except ValueError:
        return DEFAULT_PORT


def set_host_port(name: str | None = None, port_value: int | None = None) -> None:
    """Override the bind host/port for this process (used by create_server_app)."""
    if name is not None:
        os.environ[HOST_ENV] = name
    if port_value is not None:
        os.environ[PORT_ENV] = str(port_value)