"""Nightlife/walkability advisories moved out of engine/builder.py because they
need the FINAL per-day stop list — after main.py injects lunch/dinner/rest
recommendations — not the ~2-stop pre-reco list the engine's day-split
produces. Deciding "is this day busy?" before recos land systematically
under-fires, since almost every day gets bulked up with 3-4 more stops.
"""
from main import _nightlife_advisory_message, _walkability_advisory_message, _advisories_for_reco_stop


def _stop(category, title="Some Place"):
    return {"category": category, "title": title}


def test_walkability_fires_for_busy_day_in_low_walkability_city():
    stops = [_stop("museum"), _stop("cafe"), _stop("restaurant")]
    msg = _walkability_advisory_message(stops, {"walkability_score": "low"}, "2026-08-24")

    assert msg is not None
    assert msg["type"] == "walkability"
    assert msg["stopId"] is None
    assert msg["dayDate"] == "2026-08-24"


def test_walkability_silent_for_light_day():
    stops = [_stop("museum"), _stop("cafe")]
    msg = _walkability_advisory_message(stops, {"walkability_score": "low"}, "2026-08-24")

    assert msg is None


def test_walkability_silent_when_score_not_low():
    stops = [_stop("museum"), _stop("cafe"), _stop("restaurant")]
    msg = _walkability_advisory_message(stops, {"walkability_score": "moderate"}, "2026-08-24")

    assert msg is None


def test_walkability_counts_reco_injected_stops_too():
    """The whole point of the fix — a day with only 2 real stops but 4
    reco-injected fills (lunch/dinner/rest/culture) is genuinely busy."""
    stops = [_stop("museum"), _stop("tourism")] + [
        _stop("coffee"), _stop("restaurant"), _stop("cafe"), _stop("restaurant"),
    ]
    msg = _walkability_advisory_message(stops, {"walkability_score": "low"}, "2026-08-24")

    assert msg is not None


def test_nightlife_fires_when_day_has_bar_stop_in_low_nightlife_city():
    stops = [_stop("museum"), _stop("bar")]
    msg = _nightlife_advisory_message(stops, {"nightlife_score": "low"}, "2026-08-24")

    assert msg is not None
    assert msg["type"] == "nightlife"
    assert msg["stopId"] is None
    assert msg["dayDate"] == "2026-08-24"


def test_nightlife_silent_when_score_not_low():
    stops = [_stop("museum"), _stop("bar")]
    msg = _nightlife_advisory_message(stops, {"nightlife_score": "moderate"}, "2026-08-24")

    assert msg is None


def test_nightlife_silent_without_a_bar_or_nightlife_stop():
    stops = [_stop("museum"), _stop("cafe")]
    msg = _nightlife_advisory_message(stops, {"nightlife_score": "low"}, "2026-08-24")

    assert msg is None


def test_nightlife_detects_reco_injected_bar_stop():
    """A bar/lounge added by the dinner-reco trigger still counts."""
    stops = [_stop("museum")] + [_stop("bar", title="Anzeera Shisha Lounge")]
    msg = _nightlife_advisory_message(stops, {"nightlife_score": "low"}, "2026-08-24")

    assert msg is not None


# ── Per-stop advisories on reco-injected stops (alcohol/ramadan) ────────────
# Reco stops (lunch/dinner/rest fills from _resolve_reco_trigger) are plain
# dicts, never fed through engine/builder.py's _alcohol_advisories /
# _ramadan_advisories — so a dinner-reco'd bar in a dry city, or a lunch-reco'd
# restaurant during Ramadan, silently got no advisory at all.

def _reco_stop(category, time, place_id="reco_p1", title="Reco Place"):
    return {"category": category, "time": time, "placeId": place_id, "title": title}


def test_reco_bar_stop_gets_alcohol_advisory_in_dry_city():
    stop = _reco_stop("bar", "19:00")
    advisories = _advisories_for_reco_stop(stop, {"alcohol_restricted": True}, "2026-08-24")

    types = [a["type"] for a in advisories]
    assert "alcohol" in types


def test_reco_bar_stop_no_alcohol_advisory_when_not_restricted():
    stop = _reco_stop("bar", "19:00")
    advisories = _advisories_for_reco_stop(stop, {"alcohol_restricted": False}, "2026-08-24")

    assert advisories == []


def test_reco_restaurant_gets_ramadan_advisory_during_daytime_ramadan():
    stop = _reco_stop("restaurant", "12:30")
    advisories = _advisories_for_reco_stop(stop, {"ramadan_affected": True}, "2026-02-20")

    types = [a["type"] for a in advisories]
    assert "ramadan" in types


def test_reco_restaurant_no_ramadan_advisory_outside_ramadan_window():
    stop = _reco_stop("restaurant", "12:30")
    advisories = _advisories_for_reco_stop(stop, {"ramadan_affected": True}, "2026-06-01")

    assert advisories == []


def test_reco_restaurant_no_ramadan_advisory_for_evening_slot():
    stop = _reco_stop("restaurant", "20:00")
    advisories = _advisories_for_reco_stop(stop, {"ramadan_affected": True}, "2026-02-20")

    assert advisories == []


def test_reco_non_qualifying_category_gets_no_advisories():
    stop = _reco_stop("museum", "12:30")
    advisories = _advisories_for_reco_stop(
        stop, {"alcohol_restricted": True, "ramadan_affected": True}, "2026-02-20",
    )

    assert advisories == []
