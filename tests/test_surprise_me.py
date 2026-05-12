import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
import main as m
from city.data_model import load_city_from_dict

_FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _tokyo_city():
    data = json.loads((_FIXTURE_DIR / "cities" / "tokyo.json").read_text())
    return load_city_from_dict(data)

MOCK_CLAUDE_RESPONSE = """{
  "days": [
    {
      "city": "Tokyo",
      "date": "2026-06-01",
      "places": [
        {"name": "Senso-ji Temple", "category": "historic", "duration_min": 90, "lat": 35.7147, "lon": 139.7967},
        {"name": "Ueno Park", "category": "park", "duration_min": 60, "lat": 35.7146, "lon": 139.7732}
      ]
    }
  ]
}"""


@pytest.fixture(autouse=True)
def override_auth():
    """Bypass auth for all surprise-me tests."""
    m.app.dependency_overrides[m.require_auth_or_pack] = lambda: {"uid": "test-user"}
    yield
    m.app.dependency_overrides.pop(m.require_auth_or_pack, None)


def test_surprise_me_endpoint_exists(client):
    with patch("anthropic.Anthropic") as mock_anthropic, \
         patch.object(m, "ANTHROPIC_API_KEY", "fake_key"), \
         patch("main.load_city", return_value=_tokyo_city()), \
         patch("main.build_itinerary", new_callable=AsyncMock) as mock_build:

        mock_client = MagicMock()
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text=MOCK_CLAUDE_RESPONSE)]
        mock_client.messages.create.return_value = mock_msg
        mock_anthropic.return_value = mock_client

        from engine.types import EngineResult, EngineDay
        mock_build.return_value = EngineResult(
            days=[EngineDay(date="2026-06-01", stops=[], is_travel_day=False)],
            messages=[],
            generation_id="test-uuid",
            recommendations=None,
        )

        r = client.post("/api/surprise-me", json={
            "start_city_id": "tokyo",
            "end_city_id": "tokyo",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
            "persona": "explorer",
        })
        assert r.status_code == 200
        data = r.json()
        assert "days" in data
        assert "generation_id" in data

def test_surprise_me_calls_engine_with_claude_places(client):
    with patch("anthropic.Anthropic") as mock_anthropic, \
         patch.object(m, "ANTHROPIC_API_KEY", "fake_key"), \
         patch("main.load_city", return_value=_tokyo_city()), \
         patch("main.build_itinerary", new_callable=AsyncMock) as mock_build:

        mock_client = MagicMock()
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text=MOCK_CLAUDE_RESPONSE)]
        mock_client.messages.create.return_value = mock_msg
        mock_anthropic.return_value = mock_client

        from engine.types import EngineResult, EngineDay
        mock_build.return_value = EngineResult(
            days=[EngineDay(date="2026-06-01", stops=[], is_travel_day=False)],
            messages=[], generation_id="test-uuid", recommendations=None,
        )

        client.post("/api/surprise-me", json={
            "start_city_id": "tokyo",
            "end_city_id": "tokyo",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
            "persona": "explorer",
        })

        assert mock_build.called
        call_args = mock_build.call_args
        stops = call_args[0][0]
        assert len(stops) == 2
        assert stops[0].name == "Senso-ji Temple"

def test_surprise_me_requires_anthropic_key(client):
    with patch.object(m, "ANTHROPIC_API_KEY", ""):
        r = client.post("/api/surprise-me", json={
            "start_city_id": "tokyo",
            "end_city_id": "tokyo",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
            "persona": "explorer",
        })
        assert r.status_code in (400, 503)
