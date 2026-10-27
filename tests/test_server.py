import asyncio

import pytest

from garmin_mcp import server


def test_omit_samples_replaces_long_lists_only():
    data = {"restingHeartRate": 52, "heartRateValues": [[i, 60] for i in range(200)], "zones": [1, 2]}
    trimmed = server._omit_samples(data)
    assert trimmed["restingHeartRate"] == 52
    assert trimmed["zones"] == [1, 2]
    assert "200 samples omitted" in trimmed["heartRateValues"]


def test_range_validation():
    with pytest.raises(ValueError, match="YYYY-MM-DD"):
        server._range("2026/01/01", None)
    with pytest.raises(ValueError, match="before"):
        server._range("2026-02-01", "2026-01-01")
    with pytest.raises(ValueError, match="limited"):
        server._range("2024-01-01", "2026-01-01")


def test_all_tools_registered_read_only():
    tools = asyncio.run(server.mcp.list_tools())
    assert len(tools) == 21
    assert all(t.annotations and t.annotations.read_only_hint for t in tools)
