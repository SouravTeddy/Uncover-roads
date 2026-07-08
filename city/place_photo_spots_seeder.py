"""Place photo spots seeder.

Extracts viewing-angle and best-spot intelligence from Google cached reviews
and Reddit posts. Writes structured rows to place_photo_spots.

Phase 1 sources:
  - google_review: top_review already in place_details_cache (zero API cost)
  - reddit: fetches post content via existing OAuth credentials

One spot per source per place (UNIQUE place_id, source). Re-extracted
every PHOTO_STALENESS_DAYS days.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

from city.trend_fetcher import fetch_reddit_photo_snippets

PHOTO_STALENESS_DAYS = 30

_PHOTO_RE = re.compile(
    r"\b(photo\w*|shot|picture|pic|angle|view|viewpoint|vista|"
    r"best spot|best place|stand at|stand on|stand near|shoot from|"
    r"from here|from the top|from across|from behind|facing|overlooking|"
    r"overlook|rooftop|terrace|golden hour|blue hour|sunrise|sunset|"
    r"morning light|early morning|dusk|magic hour|best time|best angle)\b",
    re.IGNORECASE,
)

_TIMING_RE: list[tuple[str, re.Pattern]] = [
    ("Golden hour", re.compile(r"\bgolden hour\b", re.IGNORECASE)),
    ("Blue hour",   re.compile(r"\bblue hour\b",   re.IGNORECASE)),
    ("Sunrise",     re.compile(r"\b(sunrise|dawn)\b", re.IGNORECASE)),
    ("Sunset",      re.compile(r"\b(sunset|dusk|evening light)\b", re.IGNORECASE)),
    ("Morning",     re.compile(r"\b(early morning|morning light|before.{0,15}crowd)\b", re.IGNORECASE)),
    ("Night",       re.compile(r"\b(night|after dark|illuminated at night)\b", re.IGNORECASE)),
]


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 15]


def _detect_timing(text: str) -> str | None:
    for label, pat in _TIMING_RE:
        if pat.search(text):
            return label
    return None


def extract_photo_spot(text: str) -> dict | None:
    """Return the best photo-relevant sentence and timing from a block of text.

    Returns {"description": str, "timing": str | None} or None if no
    photo intelligence is found.
    """
    candidates = [s for s in _sentences(text) if _PHOTO_RE.search(s)]
    if not candidates:
        return None
    best = max(candidates, key=len)
    return {"description": best, "timing": _detect_timing(text)}


def seed_place_photo_spots(
    places: list[dict],
    city_id: str,
    city_name: str,
    supabase,
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> dict:
    """Extract and upsert photo spot rows for a list of places.

    Args:
        places: List of dicts with keys: place_id, name, lat, lon
        city_id: City identifier (e.g. "paris")
        city_name: Human-readable city name for search queries
        supabase: Supabase client
        reddit_client_id / reddit_client_secret: Reddit OAuth credentials

    Returns:
        {"inserted": int, "skipped": int, "no_spot": int}
        inserted = rows upserted (one per source per place that yielded a spot)
        skipped  = places with a fresh row already in the table
        no_spot  = stale places where neither source returned extractable content
    """
    valid = [p for p in places if p.get("place_id")]
    if not valid:
        return {"inserted": 0, "skipped": len(places), "no_spot": 0}

    place_ids = [p["place_id"] for p in valid]
    cutoff = (datetime.utcnow() - timedelta(days=PHOTO_STALENESS_DAYS)).isoformat()

    fresh_resp = (
        supabase.table("place_photo_spots")
        .select("place_id")
        .in_("place_id", place_ids)
        .gte("updated_at", cutoff)
        .execute()
    )
    fresh_ids = {r["place_id"] for r in (fresh_resp.data or [])}
    stale = [p for p in valid if p["place_id"] not in fresh_ids]

    skipped = len(valid) - len(stale)
    if not stale:
        return {"inserted": 0, "skipped": skipped, "no_spot": 0}

    stale_ids = [p["place_id"] for p in stale]

    cache_resp = (
        supabase.table("place_details_cache")
        .select("place_id, data")
        .in_("place_id", stale_ids)
        .execute()
    )
    review_by_id: dict[str, str] = {
        row["place_id"]: (row.get("data") or {}).get("top_review", "")
        for row in (cache_resp.data or [])
        if (row.get("data") or {}).get("top_review")
    }

    now = datetime.utcnow().isoformat()
    rows: list[dict] = []
    no_spot = 0

    for place in stale:
        pid = place["place_id"]
        found_any = False

        # Source 1: Google cached review (zero API cost)
        review = review_by_id.get(pid, "")
        if review:
            spot = extract_photo_spot(review)
            if spot:
                rows.append({
                    "place_id":    pid,
                    "city_id":     city_id,
                    "description": spot["description"],
                    "timing":      spot["timing"],
                    "source":      "google_review",
                    "source_url":  None,
                    "confidence":  0.5,
                    "updated_at":  now,
                })
                found_any = True

        # Source 2: Reddit — pick highest-upvoted snippet that yields a spot
        if reddit_client_id and reddit_client_secret:
            snippets = fetch_reddit_photo_snippets(
                place["name"], city_name, reddit_client_id, reddit_client_secret
            )
            best_row: dict | None = None
            best_upvotes = -1
            for snippet in snippets:
                spot = extract_photo_spot(snippet["text"])
                if spot and snippet["upvotes"] > best_upvotes:
                    best_upvotes = snippet["upvotes"]
                    upvote_boost = min(0.3, best_upvotes / 500 * 0.3)
                    best_row = {
                        "place_id":    pid,
                        "city_id":     city_id,
                        "description": spot["description"],
                        "timing":      spot["timing"],
                        "source":      "reddit",
                        "source_url":  snippet["url"],
                        "confidence":  round(0.5 + upvote_boost, 3),
                        "updated_at":  now,
                    }
            if best_row:
                rows.append(best_row)
                found_any = True

        if not found_any:
            no_spot += 1

    if rows:
        supabase.table("place_photo_spots").upsert(
            rows, on_conflict="place_id,source"
        ).execute()

    return {"inserted": len(rows), "skipped": skipped, "no_spot": no_spot}
