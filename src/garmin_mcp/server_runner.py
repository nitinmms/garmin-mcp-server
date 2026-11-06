# Run the Garmin MCP Streamable HTTP app on a background thread.
#
# This is what lets the sample .NET MAUI app start the MCP server in its own
# process, so a user can connect without managing a separate Python service.
# It is additive: the stdio server and ``garmin-mcp http`` are unchanged.

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

from . import settings
from .http_server import create_app


@dataclass(frozen=True)
class RunningServer:
    host: str
    port: int
    thread: threading.Thread
    server: Any

    @property
    def base_url(self) -> str:
        return "http://%s:%d" % (self.host, self.port)


def available() -> bool:
    """True when the HTTP transport's dependencies (uvicorn) are importable."""
    try:
        import uvicorn  # noqa: F401
    except ImportError:
        return False
    return True


def start_server(host: str | None = None, port: int | None = None) -> RunningServer:
    """Start the MCP HTTP app on a daemon thread and return how to reach it."""
    import uvicorn

    bind_host = settings.host() if host is None else host
    bind_port = settings.port() if port is None else port
    config = uvicorn.Config(create_app(), host=bind_host, port=bind_port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, name="garmin-mcp-http", daemon=True)
    thread.start()
    return RunningServer(host=bind_host, port=bind_port, thread=thread, server=server)


def stop_server(running: RunningServer | None) -> None:
    """Ask a server started by start_server to shut down and wait briefly."""
    if running is None:
        return
    running.server.should_exit = True
    running.thread.join(timeout=5)


def main() -> None:
    """Run in the foreground (used by desktop and tests)."""
    import uvicorn

    uvicorn.run(create_app(), host=settings.host(), port=settings.port())


if __name__ == "__main__":  # pragma: no cover
    main()