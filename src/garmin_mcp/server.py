"""MCP server exposing read-only tools over the Garmin Connect Personal API.

Built on the MCP Python SDK v2 (MCPServer). Endpoints come from Garmin's Personal API Swagger docs:
https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
"""

from __future__ import annotations

import os
import sys
from datetime import date
from functools import cache
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations

from .client import GarminAPIError, GarminClient

API_KEY_ENV = "GARMIN_PERSONAL_API_KEY"
MAX_RANGE_DAYS = 366
MAX_SAMPLES = 48  # lists longer than this are treated as time series and omitted by default

mcp = MCPServer(
    "garmin",
    instructions=(
        "Read-only access to the user's own Garmin Connect data. Dates are YYYY-MM-DD in the "
        "user's local calendar; omit a date to mean today. Durations are in seconds and "
        "distances in meters unless a field says otherwise."
    ),
)
read_only = ToolAnnotations(read_only_hint=True, open_world_hint=True)


@cache
def client() -> GarminClient:
    return GarminClient(os.environ.get(API_KEY_ENV, "").strip())


def _day(value: str | None, name: str = "date") -> date:
    if not value:
        return date.today()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"{name} must be YYYY-MM-DD, got {value!r}") from None


def _range(start_date: str, end_date: str | None) -> tuple[date, date]:
    start, end = _day(start_date, "start_date"), _day(end_date, "end_date")
    if end < start:
        raise ValueError(f"end_date {end} is before start_date {start}")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ValueError(f"Date range is limited to {MAX_RANGE_DAYS} days")
    return start, end


def _omit_samples(data: Any) -> Any:
    """Replace long time-series lists with a short note so responses stay small."""
    if isinstance(data, dict):
        return {k: _omit_samples(v) for k, v in data.items()}
    if isinstance(data, list):
        if len(data) > MAX_SAMPLES:
            return f"<{len(data)} samples omitted; call again with include_samples=true>"
        return [_omit_samples(v) for v in data]
    return data


# --- Activities -------------------------------------------------------------------------

@mcp.tool(annotations=read_only)
def search_activities(start_date: str | None = None, end_date: str | None = None,
                      activity_type: str | None = None, search: str | None = None,
                      limit: int = 20, start: int = 0) -> Any:
    """Search recorded activities (runs, rides, swims, strength, ...), newest first.

    Args:
        start_date: Earliest activity date, YYYY-MM-DD.
        end_date: Latest activity date, YYYY-MM-DD.
        activity_type: Garmin activity type key, e.g. "running", "cycling", "lap_swimming".
        search: Free-text match on activity name.
        limit: Page size (1-100).
        start: Offset for pagination.
    """
    return client().get("/activitylist-service/activities/search/activities", {
        "startDate": start_date and _day(start_date, "start_date").isoformat(),
        "endDate": end_date and _day(end_date, "end_date").isoformat(),
        "activityType": activity_type,
        "search": search,
        "limit": max(1, min(limit, 100)),
        "start": max(0, start),
    })


@mcp.tool(annotations=read_only)
def get_activity(activity_id: int) -> Any:
    """Get one activity's summary, metadata, measurements and split summaries."""
    return client().get(f"/activity-service/activity/{activity_id}")


@mcp.tool(annotations=read_only)
def get_activity_workouts(activity_id: int) -> Any:
    """Get the structured workouts performed during an activity."""
    return client().get(f"/activity-service/activity/{activity_id}/workouts")


# --- Daily health -----------------------------------------------------------------------

@mcp.tool(annotations=read_only)
def get_daily_summary(date: str | None = None) -> Any:
    """Get one day's wellness summary: steps, calories, stress, Body Battery, intensity minutes, resting HR."""
    return client().get("/usersummary-service/usersummary/daily",
                        {"calendarDate": _day(date).isoformat()})


@mcp.tool(annotations=read_only)
def get_daily_summaries(start_date: str, end_date: str | None = None) -> Any:
    """Get daily wellness summaries for a date range (up to a year). Best for trends across many days."""
    start, end = _range(start_date, end_date)
    return client().get_chunked("/usersummary-service/v2/dailysummaries", start, end,
                                max_days=MAX_RANGE_DAYS, query_dates=True)


@mcp.tool(annotations=read_only)
def get_steps(start_date: str, end_date: str | None = None) -> Any:
    """Get daily step totals and step goals for a date range."""
    start, end = _range(start_date, end_date)
    return client().get_chunked("/usersummary-service/stats/steps/daily/{start}/{end}",
                                start, end, max_days=28)


@mcp.tool(annotations=read_only)
def get_stress(start_date: str, end_date: str | None = None) -> Any:
    """Get daily stress levels for a date range."""
    start, end = _range(start_date, end_date)
    return client().get_chunked("/usersummary-service/stats/stress/daily/{start}/{end}",
                                start, end, max_days=28)


@mcp.tool(annotations=read_only)
def get_heart_rate(date: str | None = None, include_samples: bool = False) -> Any:
    """Get one day's heart rate: resting, min, max, 7-day resting average.

    Set include_samples=true for the intraday heart rate time series (large).
    """
    data = client().get("/wellness-service/wellness/dailyHeartRate", {"date": _day(date).isoformat()})
    return data if include_samples else _omit_samples(data)


@mcp.tool(annotations=read_only)
def get_body_battery(start_date: str, end_date: str | None = None,
                     include_samples: bool = False) -> Any:
    """Get daily Body Battery reports (charged, drained, events) for a date range.

    Set include_samples=true for the intraday Body Battery values (large).
    """
    start, end = _range(start_date, end_date)
    data = client().get_chunked("/wellness-service/wellness/bodyBattery/reports/daily",
                                start, end, max_days=31, query_dates=True)
    return data if include_samples else _omit_samples(data)


@mcp.tool(annotations=read_only)
def get_spo2(date: str | None = None, include_samples: bool = False) -> Any:
    """Get one day's blood oxygen (SpO2): average, lowest, sleep average, 7-day average.

    Set include_samples=true for individual and hourly readings (large).
    """
    data = client().get(f"/wellness-service/wellness/daily/spo2acclimation/{_day(date).isoformat()}")
    return data if include_samples else _omit_samples(data)


@mcp.tool(annotations=read_only)
def get_hydration(start_date: str, end_date: str | None = None) -> Any:
    """Get daily hydration intake and goals for a date range."""
    start, end = _range(start_date, end_date)
    return client().get_chunked("/usersummary-service/stats/hydration/daily/{start}/{end}",
                                start, end, max_days=31)


@mcp.tool(annotations=read_only)
def get_wellness_activities(start_date: str, end_date: str | None = None) -> Any:
    """Get wellness activity summaries (e.g. auto-detected moves) for a date range."""
    start, end = _range(start_date, end_date)
    return client().get(
        f"/wellnessactivity-service/activity/summary/range/{start.isoformat()}/{end.isoformat()}")


# --- Sleep & recovery -------------------------------------------------------------------

@mcp.tool(annotations=read_only)
def get_sleep(date: str | None = None) -> Any:
    """Get one night's sleep: duration, stages, sleep score, SpO2, respiration, sleep stress.

    `date` is the calendar day the sleep ended on (the morning you woke up).
    """
    return client().get("/sleep-service/sleep/dailySleep", {"date": _day(date).isoformat()})


@mcp.tool(annotations=read_only)
def get_sleep_summaries(start_date: str, end_date: str | None = None) -> Any:
    """Get nightly sleep summaries for a date range. Best for sleep trends."""
    start, end = _range(start_date, end_date)
    return client().get_chunked("/sleep-service/sleep/dailySleepSummariesByDate",
                                start, end, max_days=31, query_dates=True)


@mcp.tool(annotations=read_only)
def get_hrv(date: str | None = None, include_samples: bool = False) -> Any:
    """Get one night's heart rate variability (HRV) summary and status.

    Set include_samples=true for the individual overnight HRV readings.
    """
    data = client().get(f"/hrv-service/hrv/{_day(date).isoformat()}")
    return data if include_samples else _omit_samples(data)


@mcp.tool(annotations=read_only)
def get_hrv_range(start_date: str, end_date: str | None = None) -> Any:
    """Get daily HRV summaries for a date range. Best for HRV trends."""
    start, end = _range(start_date, end_date)
    return client().get(f"/hrv-service/hrv/daily/{start.isoformat()}/{end.isoformat()}")


@mcp.tool(annotations=read_only)
def get_fitness_age(date: str | None = None) -> Any:
    """Get the latest Fitness Age as of a date, with the factors that drive it."""
    return client().get(f"/fitnessage-service/fitnessage/v2/{_day(date).isoformat()}")


# --- Body & profile ---------------------------------------------------------------------

@mcp.tool(annotations=read_only)
def get_weight(start_date: str, end_date: str | None = None) -> Any:
    """Get weight and body composition for a date range: daily latest weights and range average.

    Weights are in grams.
    """
    start, end = _range(start_date, end_date)
    return client().get(f"/weight-service/weight/range/{start.isoformat()}/{end.isoformat()}")


@mcp.tool(annotations=read_only)
def get_weight_goals(start_date: str, end_date: str | None = None) -> Any:
    """Get the weight goals in effect over a date range."""
    start, end = _range(start_date, end_date)
    return client().get(
        f"/goal-service/goal/user/effective/weightgoal/{start.isoformat()}/{end.isoformat()}")


@mcp.tool(annotations=read_only)
def get_heart_rate_zones() -> Any:
    """Get the user's configured heart rate zones per sport."""
    return client().get("/biometric-service/heartRateZones/v2")


@mcp.tool(annotations=read_only)
def get_profile_settings() -> Any:
    """Get profile settings: units, time zone, height, birth date, activity level, etc."""
    return client().get("/userprofile-service/userprofile/settings")


def main() -> None:
    if sys.argv[1:] == ["check"]:
        _check()
    else:
        mcp.run()


def _check() -> None:
    """Verify the API key works without printing any personal data or credentials."""
    try:
        settings = get_profile_settings()
        summary = get_daily_summary()
    except (GarminAPIError, ValueError) as exc:
        sys.exit(f"FAILED: {exc}")
    print("OK: token obtained and data endpoints reachable.")
    print(f"  profile settings fields: {len(settings or {})}")
    print(f"  today's summary fields: {len(summary or {})}")


if __name__ == "__main__":
    main()
