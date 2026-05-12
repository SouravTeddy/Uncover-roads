import sys
import asyncio
import pytest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from unittest.mock import AsyncMock, patch, MagicMock
from tests.conftest import make_stop, make_ctx
from engine import builder
from engine.types import EngineResult


@pytest.mark.asyncio
async def test_build_itinerary_returns_engine_result():
    stops = [
        make_stop(place_id="p1", neighborhood="shinjuku", lat=35.693, lon=139.703, duration_min=90),
        make_stop(place_id="p2", neighborhood="asakusa", lat=35.714, lon=139.796, duration_min=60),
    ]
    ctx = make_ctx()

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate:
        mock_narrate.return_value = []
        result = await builder.build_itinerary(stops, ctx)

    assert isinstance(result, EngineResult)
    assert result.generation_id  # non-empty UUID
    assert isinstance(result.days, list)
    assert isinstance(result.messages, list)


@pytest.mark.asyncio
async def test_build_itinerary_all_stops_assigned_scheduled_time():
    stops = [
        make_stop(place_id="p1", neighborhood="shinjuku", lat=35.693, lon=139.703),
        make_stop(place_id="p2", neighborhood="shinjuku", lat=35.695, lon=139.706),
    ]
    ctx = make_ctx()

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate:
        mock_narrate.return_value = []
        result = await builder.build_itinerary(stops, ctx)

    for day in result.days:
        for stop in day.stops:
            assert stop.scheduled_time is not None


@pytest.mark.asyncio
async def test_build_itinerary_narrator_failure_does_not_raise():
    """If narrator throws, build_itinerary still returns a valid EngineResult."""
    stops = [make_stop(place_id="p1", neighborhood="shinjuku")]
    ctx = make_ctx()

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate:
        mock_narrate.side_effect = Exception("LLM failure")
        result = await builder.build_itinerary(stops, ctx)

    assert isinstance(result, EngineResult)
