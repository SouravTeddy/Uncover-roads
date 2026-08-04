"""Day-aware weather resolution for a specific travel date.

Real forecast (Open-Meteo) for dates within the forecast window; climatology
fallback (rain_months only — heat has no honest monthly signal to fall back
on) for dates beyond it. Never fabricates a temperature for a date we can't
actually forecast.
"""
from __future__ import annotations
from datetime import date as _date, datetime as _datetime
import requests

_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_FORECAST_HORIZON_DAYS = 16

_HEAVY_RAIN_MM = 10.0
_MODERATE_RAIN_MM = 2.0


def resolve_travel_weather(
    lat: float,
    lon: float,
    travel_date: str,
    heat_threshold_c: float,
    rain_months: list[int],
) -> dict:
    """Returns {temp, rain_intensity, is_hot, source}.

    temp is None unless a real forecast was used — never a guess.
    """
    target = _datetime.strptime(travel_date, "%Y-%m-%d").date()
    days_out = (target - _date.today()).days

    if 0 <= days_out <= _FORECAST_HORIZON_DAYS:
        forecast = _fetch_forecast(lat, lon, travel_date)
        if forecast is not None:
            forecast["is_hot"] = forecast["temp"] >= heat_threshold_c
            return forecast

    month = target.month
    return {
        "temp": None,
        "rain_intensity": "moderate" if month in rain_months else "none",
        "is_hot": False,
        "source": "climatology",
    }


def _fetch_forecast(lat: float, lon: float, travel_date: str) -> dict | None:
    try:
        resp = requests.get(
            _FORECAST_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,precipitation_sum",
                "timezone": "auto",
                "start_date": travel_date,
                "end_date": travel_date,
            },
            timeout=8,
        )
        data = resp.json()
        times = data["daily"]["time"]
        idx = times.index(travel_date)
        temp = data["daily"]["temperature_2m_max"][idx]
        precip = data["daily"]["precipitation_sum"][idx]
    except Exception:
        return None

    if precip >= _HEAVY_RAIN_MM:
        rain_intensity = "heavy"
    elif precip >= _MODERATE_RAIN_MM:
        rain_intensity = "moderate"
    else:
        rain_intensity = "none"

    return {
        "temp": temp,
        "rain_intensity": rain_intensity,
        "is_hot": None,  # caller compares against city-specific heat_threshold_c
        "source": "forecast",
    }
