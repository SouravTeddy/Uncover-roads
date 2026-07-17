"""Trend score orchestrator.

Fetches signals from all sources for every place in a city,
normalises within the city set, computes weighted composite,
maps to velocity_ratio, and upserts to place_dynamic_profiles.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from city.trend_fetcher import (
    fetch_youtube_score,
    fetch_foursquare_score,
    fetch_reddit_score,
    fetch_wikimedia_score,
)

# Weights must sum to 1.0
_W_YOUTUBE     = 0.35
_W_WIKIMEDIA   = 0.30
_W_FOURSQUARE  = 0.20
_W_REDDIT      = 0.15

TREND_STALENESS_DAYS    = 7
YOUTUBE_UNITS_PER_PLACE = 100   # YouTube Data API: 1 search request = 100 quota units
YOUTUBE_DAILY_BUDGET    = 8000  # 80% of 10k free tier; leaves 2k buffer


def _normalize(scores: list[float]) -> list[float]:
    """Min-max normalise a list of floats to [0, 1].

    All-zero input (no data from source) → 0.0 to avoid phantom trending scores.
    Uniform non-zero input → 0.5.
    """
    if len(scores) == 1:
        return [0.5]
    mn, mx = min(scores), max(scores)
    if mx == 0.0:
        return [0.0] * len(scores)
    if mx == mn:
        return [0.5] * len(scores)
    return [(s - mn) / (mx - mn) for s in scores]


def _composite(youtube: float, wikimedia: float, foursquare: float, reddit: float) -> float:
    return (
        youtube    * _W_YOUTUBE +
        wikimedia  * _W_WIKIMEDIA +
        foursquare * _W_FOURSQUARE +
        reddit     * _W_REDDIT
    )


def seed_trend_scores(
    city_id: str,
    places: list[dict],
    city_name: str,
    country_code: str,
    supabase,
    youtube_key: str = "",
    foursquare_key: str = "",
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> dict:
    """Fetch trend signals for all places, normalise, upsert velocity_ratio.

    Args:
        city_id: City identifier (e.g. "paris")
        places: List of dicts with keys: place_id, name, lat, lon
        city_name: Human-readable city name for search queries
        country_code: ISO 3166-1 alpha-2 (e.g. "FR") for future geo filter
        supabase: Supabase client
        youtube_key: YOUTUBE_API_KEY env var value
        foursquare_key: FOURSQUARE_API_KEY env var value
        reddit_client_id: REDDIT_CLIENT_ID env var value
        reddit_client_secret: REDDIT_CLIENT_SECRET env var value

    Returns:
        {"updated": int, "skipped": int, "fresh": int}
        fresh = places skipped because they were trend-seeded within TREND_STALENESS_DAYS
    """
    valid = [p for p in places if p.get("place_id")]
    skipped = len(places) - len(valid)

    if not valid:
        return {"updated": 0, "skipped": skipped, "fresh": 0}

    # Fetch existing profiles to preserve stage + crowd_ratio and check staleness
    place_ids = [p["place_id"] for p in valid]
    profiles_resp = (
        supabase.table("place_dynamic_profiles")
        .select("place_id, stage, signals, updated_at")
        .in_("place_id", place_ids)
        .execute()
    )
    existing: dict[str, dict] = {
        r["place_id"]: r for r in (profiles_resp.data or [])
    }

    # Skip places trend-seeded within TREND_STALENESS_DAYS
    cutoff = datetime.utcnow() - timedelta(days=TREND_STALENESS_DAYS)
    stale: list[dict] = []
    fresh_count = 0
    for place in valid:
        rec = existing.get(place["place_id"], {})
        sigs = rec.get("signals") or {}
        updated_str = rec.get("updated_at") or "2000-01-01T00:00:00"
        try:
            updated_dt = datetime.fromisoformat(updated_str.replace("Z", ""))
            updated_dt = updated_dt.replace(tzinfo=None)
        except (ValueError, AttributeError):
            updated_dt = datetime.min
        if sigs.get("trend_seeded") and updated_dt > cutoff:
            fresh_count += 1
        else:
            stale.append(place)

    if not stale:
        return {"updated": 0, "skipped": skipped, "fresh": fresh_count}

    # Gate YouTube on daily quota (100 units per place × stale count)
    _youtube_key = youtube_key
    if _youtube_key:
        today_str = datetime.utcnow().date().isoformat()
        budget_resp = (
            supabase.table("place_dynamic_profiles")
            .select("place_id", count="exact")
            .gte("updated_at", today_str)
            .execute()
        )
        units_used = (budget_resp.count or 0) * YOUTUBE_UNITS_PER_PLACE
        if units_used + len(stale) * YOUTUBE_UNITS_PER_PLACE > YOUTUBE_DAILY_BUDGET:
            _youtube_key = ""
            print(
                f"[trend_seeder] YouTube daily budget reached "
                f"({units_used}/{YOUTUBE_DAILY_BUDGET} units used today), "
                f"skipping YouTube — Wikimedia/Foursquare/Reddit still run"
            )

    # Fetch raw scores per source for each stale place
    raw_yt   = [fetch_youtube_score(p["name"], city_name, _youtube_key)                               for p in stale]
    raw_wiki = [fetch_wikimedia_score(p["name"])                                                       for p in stale]
    raw_fsq  = [fetch_foursquare_score(p["name"], p["lat"], p["lon"], foursquare_key)                  for p in stale]
    raw_red  = [fetch_reddit_score(p["name"], city_name, reddit_client_id, reddit_client_secret)       for p in stale]

    # Normalise each source within the city set
    norm_yt   = _normalize(raw_yt)
    norm_wiki = _normalize(raw_wiki)
    norm_fsq  = _normalize(raw_fsq)
    norm_red  = _normalize(raw_red)

    rows = []
    for i, place in enumerate(stale):
        composite = _composite(norm_yt[i], norm_wiki[i], norm_fsq[i], norm_red[i])
        velocity_ratio = round(max(0.3, min(5.0, 1.0 + composite * 4.0)), 3)

        prev = existing.get(place["place_id"], {})
        prev_signals = prev.get("signals") or {}

        rows.append({
            "place_id":   place["place_id"],
            "city_id":    city_id,
            "stage":      prev.get("stage", "mainstream"),
            "signals": {
                **prev_signals,
                "velocity_ratio":    velocity_ratio,
                "trend_seeded":      True,
                # Raw scores (unnormalised, source units)
                "youtube_score":     raw_yt[i],
                "wikimedia_score":   raw_wiki[i],
                "foursquare_score":  raw_fsq[i],
                "reddit_score":      raw_red[i],
                # Normalised scores (0–1, city-relative)
                "youtube_norm":      round(norm_yt[i], 4),
                "wikimedia_norm":    round(norm_wiki[i], 4),
                "foursquare_norm":   round(norm_fsq[i], 4),
                "reddit_norm":       round(norm_red[i], 4),
                "composite_score":   round(composite, 4),
                "trend_seeded_at":   datetime.utcnow().isoformat(),
            },
            "updated_at": datetime.utcnow().isoformat(),
        })

    supabase.table("place_dynamic_profiles").upsert(rows, on_conflict="place_id").execute()
    return {"updated": len(rows), "skipped": skipped, "fresh": fresh_count}
