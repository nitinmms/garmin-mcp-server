from datetime import date

import httpx
import pytest

from garmin_mcp.client import TOKEN_PATH, GarminAPIError, GarminClient, date_windows


def make_client(handler):
    return GarminClient("test-key", transport=httpx.MockTransport(handler))


def test_exchanges_key_for_token_and_sends_bearer():
    seen = []

    def handler(request: httpx.Request):
        seen.append((request.url.path, request.headers["Authorization"]))
        if request.url.path == TOKEN_PATH:
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 86400})
        return httpx.Response(200, json={"ok": True})

    client = make_client(handler)
    assert client.get("/a") == {"ok": True}
    assert client.get("/b") == {"ok": True}
    assert seen == [(TOKEN_PATH, "ApiKey test-key"), ("/a", "Bearer tok"), ("/b", "Bearer tok")]


def test_renews_token_once_on_401():
    tokens = iter(["old", "new"])

    def handler(request: httpx.Request):
        if request.url.path == TOKEN_PATH:
            return httpx.Response(200, json={"accessToken": next(tokens)})
        if request.headers["Authorization"] == "Bearer old":
            return httpx.Response(401)
        return httpx.Response(200, json=[1])

    assert make_client(handler).get("/x") == [1]


def test_rejected_key_gives_actionable_error_without_leaking_key():
    client = make_client(lambda request: httpx.Response(401))
    with pytest.raises(GarminAPIError) as exc:
        client.get("/x")
    assert "personalApiToken" in str(exc.value)
    assert "test-key" not in str(exc.value)


def test_plain_string_token_response():
    def handler(request: httpx.Request):
        if request.url.path == TOKEN_PATH:
            return httpx.Response(200, text="raw-token")
        return httpx.Response(200, json={"auth": request.headers["Authorization"]})

    assert make_client(handler).get("/x") == {"auth": "Bearer raw-token"}


def test_get_chunked_splits_range_and_concatenates():
    calls = []

    def handler(request: httpx.Request):
        if request.url.path == TOKEN_PATH:
            return httpx.Response(200, json={"access_token": "t"})
        calls.append(request.url.path)
        return httpx.Response(200, json=[request.url.path])

    result = make_client(handler).get_chunked(
        "/steps/{start}/{end}", date(2026, 1, 1), date(2026, 3, 1), max_days=28)
    assert calls == ["/steps/2026-01-01/2026-01-28", "/steps/2026-01-29/2026-02-25",
                     "/steps/2026-02-26/2026-03-01"]
    assert result == calls


def test_get_chunked_query_dates():
    def handler(request: httpx.Request):
        if request.url.path == TOKEN_PATH:
            return httpx.Response(200, json={"access_token": "t"})
        return httpx.Response(200, json={"q": dict(request.url.params)})

    result = make_client(handler).get_chunked(
        "/sleep", date(2026, 1, 1), date(2026, 1, 2), max_days=31, query_dates=True)
    assert result == [{"q": {"startDate": "2026-01-01", "endDate": "2026-01-02"}}]


def test_date_windows_single_day_and_invalid():
    assert date_windows(date(2026, 5, 1), date(2026, 5, 1), 28) == [(date(2026, 5, 1), date(2026, 5, 1))]
    with pytest.raises(ValueError):
        date_windows(date(2026, 5, 2), date(2026, 5, 1), 28)


def test_rate_limit_error():
    def handler(request: httpx.Request):
        if request.url.path == TOKEN_PATH:
            return httpx.Response(200, json={"access_token": "t"})
        return httpx.Response(429)

    with pytest.raises(GarminAPIError, match="rate limit"):
        make_client(handler).get("/x")
