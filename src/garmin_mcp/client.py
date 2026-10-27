"""HTTP client for the Garmin Connect Personal API.

Auth flow (https://developer.garmin.com/gc-developer-program/personal/personal-faq/):
the personal API key is exchanged for an OAuth2 access token valid for 24 hours.
There are no refresh tokens, so we simply exchange the key again when the token
expires or the API answers 401.
"""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

import httpx

BASE_URL = "https://personal.connectapi.garmin.com"
TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token"

DEFAULT_TOKEN_TTL = 24 * 3600
TOKEN_EXPIRY_MARGIN = 300  # renew 5 minutes before the token actually expires


class GarminAPIError(RuntimeError):
    """A Garmin API request failed. The message never contains credentials."""


class GarminClient:
    def __init__(self, api_key: str, *, transport: httpx.BaseTransport | None = None):
        if not api_key:
            raise GarminAPIError("GARMIN_PERSONAL_API_KEY is not set")
        self._api_key = api_key
        self._http = httpx.Client(base_url=BASE_URL, timeout=30.0, transport=transport)
        self._token: str | None = None
        self._token_expires_at = 0.0

    def close(self) -> None:
        self._http.close()

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """GET a JSON resource, renewing the access token once on 401."""
        params = {k: v for k, v in (params or {}).items() if v is not None}
        response = self._http.get(path, params=params, headers=self._auth_header())
        if response.status_code == 401:
            self._token = None
            response = self._http.get(path, params=params, headers=self._auth_header())
        _raise_for_status(response, path)
        if not response.content:
            return None
        return response.json()

    def get_chunked(self, path_template: str, start: date, end: date, max_days: int,
                    params: dict[str, Any] | None = None, query_dates: bool = False) -> list[Any]:
        """Call a date-range endpoint in windows of at most `max_days` and concatenate results.

        `path_template` uses `{start}`/`{end}` placeholders, unless `query_dates` is set,
        in which case the window is sent as `startDate`/`endDate` query parameters.
        """
        results: list[Any] = []
        for chunk_start, chunk_end in date_windows(start, end, max_days):
            if query_dates:
                data = self.get(path_template, {**(params or {}),
                                                "startDate": chunk_start.isoformat(),
                                                "endDate": chunk_end.isoformat()})
            else:
                path = path_template.format(start=chunk_start.isoformat(), end=chunk_end.isoformat())
                data = self.get(path, params)
            if isinstance(data, list):
                results.extend(data)
            elif data is not None:
                results.append(data)
        return results

    def _auth_header(self) -> dict[str, str]:
        if self._token is None or time.monotonic() >= self._token_expires_at:
            self._fetch_token()
        return {"Authorization": f"Bearer {self._token}"}

    def _fetch_token(self) -> None:
        response = self._http.post(TOKEN_PATH, headers={"Authorization": f"ApiKey {self._api_key}"})
        if response.status_code in (401, 403):
            raise GarminAPIError(
                "Garmin rejected the personal API key (expired, deleted, or mistyped). "
                "Create a new one at https://connect.garmin.com/app/settings/personalApiToken"
            )
        _raise_for_status(response, TOKEN_PATH)
        self._token, ttl = _parse_token_response(response)
        self._token_expires_at = time.monotonic() + max(ttl - TOKEN_EXPIRY_MARGIN, 60)


def _parse_token_response(response: httpx.Response) -> tuple[str, int]:
    """Extract (access_token, ttl_seconds). The response shape isn't documented, so be lenient."""
    try:
        body = response.json()
    except ValueError:
        body = response.text.strip().strip('"')
    if isinstance(body, str) and body:
        return body, DEFAULT_TOKEN_TTL
    if isinstance(body, dict):
        token = body.get("access_token") or body.get("accessToken") or body.get("token")
        ttl = body.get("expires_in") or body.get("expiresIn") or DEFAULT_TOKEN_TTL
        if token:
            return str(token), int(ttl)
        raise GarminAPIError(f"Unrecognised token response fields: {sorted(body)}")
    raise GarminAPIError("Empty token response from Garmin")


def _raise_for_status(response: httpx.Response, path: str) -> None:
    if response.is_success:
        return
    if response.status_code == 429:
        raise GarminAPIError("Garmin rate limit reached (HTTP 429); try again later")
    detail = response.text[:300].strip()
    raise GarminAPIError(f"Garmin API {path} returned HTTP {response.status_code}: {detail}")


def date_windows(start: date, end: date, max_days: int) -> list[tuple[date, date]]:
    """Split the inclusive range [start, end] into consecutive windows of at most max_days."""
    if end < start:
        raise ValueError(f"end_date {end} is before start_date {start}")
    windows = []
    while start <= end:
        window_end = min(start + timedelta(days=max_days - 1), end)
        windows.append((start, window_end))
        start = window_end + timedelta(days=1)
    return windows
