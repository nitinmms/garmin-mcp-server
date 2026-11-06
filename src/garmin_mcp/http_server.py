# Opt-in HTTP transport for the Garmin MCP server.
#
# Additive only: stdio stays the default and the 21 read-only tools are untouched.
# Run ``garmin-mcp http`` (or ``python -m garmin_mcp.http_server``) to expose the very
# same tools over Streamable HTTP so a mobile client - such as the .NET MAUI Blazor
# Hybrid sample app in ``app/GarminCoach`` - can reach them.
#
# The Garmin personal API key is supplied by the client per connection in the
# ``X-Garmin-Api-Key`` request header, so several users can share one server.

from __future__ import annotations

import json
import os
from collections.abc import Iterable
from typing import Any

from . import server
from .server import API_KEY_ENV, mcp

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
API_KEY_HEADER = "x-garmin-api-key"

HEALTH_PATH = "/health"


def host() -> str:
    # Bind host, overridable with GARMIN_MCP_HTTP_HOST.
    return os.environ.get("GARMIN_MCP_HTTP_HOST", DEFAULT_HOST).strip() or DEFAULT_HOST


def port() -> int:
    # Bind port, overridable with GARMIN_MCP_HTTP_PORT.
    raw = os.environ.get("GARMIN_MCP_HTTP_PORT", "").strip()
    if not raw:
        return DEFAULT_PORT
    try:
        return int(raw)
    except ValueError:
        return DEFAULT_PORT


def api_key_from_headers(headers: Iterable[tuple[bytes, bytes]]) -> str | None:
    # Return the API key sent in the X-Garmin-Api-Key header, if any.
    for raw_name, raw_value in headers or ():
        if raw_name.decode("latin-1").lower() == API_KEY_HEADER:
            value = raw_value.decode("latin-1").strip()
            return value or None
    return None


def apply_api_key(key: str) -> None:
    # Point the cached Garmin client at this connection's key.
    os.environ[API_KEY_ENV] = key
    server.client.cache_clear()


async def _send_json(send: Any, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    await send({"type": "http.response.start", "status": status,
                "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": body})


def create_app() -> Any:
    # Wrap the MCP Streamable HTTP app, adding the per-request key and /health.
    inner = mcp.streamable_http_app()

    async def app(scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") == "http":
            path = (scope.get("path") or "").rstrip("/") or "/"
            if path == HEALTH_PATH:
                await _send_json(send, 200, {
                    "status": "ok",
                    "server": "garmin",
                    "transport": "streamable-http",
                    "tool_count": len(server.READ_ONLY_TOOL_NAMES),
                })
                return
            key = api_key_from_headers(scope.get("headers") or [])
            if key:
                apply_api_key(key)
        await inner(scope, receive, send)

    return app


def main() -> None:
    try:
        import uvicorn
    except ImportError:  # pragma: no cover - depends on optional extra
        raise SystemExit(
            "The HTTP transport needs uvicorn. Install it with 'pip install uvicorn'."
        ) from None
    uvicorn.run(create_app(), host=host(), port=port())


if __name__ == "__main__":  # pragma: no cover
    main()
