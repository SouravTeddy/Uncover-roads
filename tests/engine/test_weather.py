import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import date, timedelta
from unittest.mock import patch
from engine import weather


def _mock_forecast_response(dates, temps, precip):
    return {
        "daily": {
            "time": dates,
            "temperature_2m_max": temps,
            "precipitation_sum": precip,
        }
    }


def test_near_term_date_uses_real_forecast():
    """Travel date within the forecast window pulls a real forecasted temp/rain, not climatology."""
    travel_date = (date.today() + timedelta(days=3)).isoformat()
    mock_resp = _mock_forecast_response([travel_date], [38.5], [0.0])

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_resp
        mock_get.return_value.status_code = 200
        result = weather.resolve_travel_weather(
            lat=35.0, lon=139.0, travel_date=travel_date,
            heat_threshold_c=32, rain_months=[6, 7, 9],
        )

    assert result["source"] == "forecast"
    assert result["temp"] == 38.5
    assert result["is_hot"] is True
    assert result["rain_intensity"] == "none"


def test_far_future_date_falls_back_to_climatology_not_a_guessed_temp():
    """Date beyond the forecast window never gets a fabricated temperature."""
    travel_date = (date.today() + timedelta(days=90)).isoformat()
    travel_month = (date.today() + timedelta(days=90)).month

    with patch("requests.get") as mock_get:
        result = weather.resolve_travel_weather(
            lat=35.0, lon=139.0, travel_date=travel_date,
            heat_threshold_c=32, rain_months=[travel_month],
        )
        mock_get.assert_not_called()

    assert result["source"] == "climatology"
    assert result["temp"] is None
    assert result["is_hot"] is False
    assert result["rain_intensity"] == "moderate"


def test_far_future_date_within_hot_months_is_hot():
    """Climatology fallback still needs to flag heat for destinations with a
    known hot season — e.g. Marrakesh in September, booked well outside the
    16-day forecast window."""
    travel_date = (date.today() + timedelta(days=90)).isoformat()
    travel_month = (date.today() + timedelta(days=90)).month

    result = weather.resolve_travel_weather(
        lat=31.6, lon=-8.0, travel_date=travel_date,
        heat_threshold_c=30, rain_months=[], hot_months=[travel_month],
    )

    assert result["source"] == "climatology"
    assert result["is_hot"] is True


def test_far_future_date_outside_hot_months_is_not_hot():
    travel_date = (date.today() + timedelta(days=90)).isoformat()
    travel_month = (date.today() + timedelta(days=90)).month
    other_month = travel_month + 1 if travel_month < 12 else 1

    result = weather.resolve_travel_weather(
        lat=31.6, lon=-8.0, travel_date=travel_date,
        heat_threshold_c=30, rain_months=[], hot_months=[other_month],
    )

    assert result["is_hot"] is False


def test_far_future_date_outside_rain_months_reports_no_rain():
    travel_date = (date.today() + timedelta(days=90)).isoformat()
    travel_month = (date.today() + timedelta(days=90)).month
    other_month = travel_month + 1 if travel_month < 12 else 1

    result = weather.resolve_travel_weather(
        lat=35.0, lon=139.0, travel_date=travel_date,
        heat_threshold_c=32, rain_months=[other_month],
    )

    assert result["rain_intensity"] == "none"


def test_heavy_precipitation_forecast_reports_heavy_rain():
    travel_date = (date.today() + timedelta(days=2)).isoformat()
    mock_resp = _mock_forecast_response([travel_date], [22.0], [15.0])

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_resp
        result = weather.resolve_travel_weather(
            lat=35.0, lon=139.0, travel_date=travel_date,
            heat_threshold_c=32, rain_months=[],
        )

    assert result["rain_intensity"] == "heavy"


def test_light_precipitation_forecast_reports_moderate_rain():
    travel_date = (date.today() + timedelta(days=2)).isoformat()
    mock_resp = _mock_forecast_response([travel_date], [22.0], [5.0])

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_resp
        result = weather.resolve_travel_weather(
            lat=35.0, lon=139.0, travel_date=travel_date,
            heat_threshold_c=32, rain_months=[],
        )

    assert result["rain_intensity"] == "moderate"


def test_forecast_below_heat_threshold_is_not_hot():
    travel_date = (date.today() + timedelta(days=2)).isoformat()
    mock_resp = _mock_forecast_response([travel_date], [24.0], [0.0])

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_resp
        result = weather.resolve_travel_weather(
            lat=35.0, lon=139.0, travel_date=travel_date,
            heat_threshold_c=32, rain_months=[],
        )

    assert result["is_hot"] is False


def test_forecast_api_failure_falls_back_to_climatology():
    """If Open-Meteo errors or returns malformed data, degrade gracefully — never crash the build."""
    travel_date = (date.today() + timedelta(days=2)).isoformat()
    travel_month = (date.today() + timedelta(days=2)).month

    with patch("requests.get", side_effect=Exception("network error")):
        result = weather.resolve_travel_weather(
            lat=35.0, lon=139.0, travel_date=travel_date,
            heat_threshold_c=32, rain_months=[travel_month],
        )

    assert result["source"] == "climatology"
    assert result["temp"] is None
    assert result["rain_intensity"] == "moderate"
