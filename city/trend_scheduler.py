"""Trend Velocity Scheduler: weekly APScheduler job.

Runs every Sunday at 03:00 UTC (one hour after City Intelligence Sync).
Re-seeds trend velocity scores for every city that has been seeded before.
The 7-day staleness guard in seed_trend_scores means fresh cities are
skipped automatically — no wasted API quota.
"""
from __future__ import annotations

import asyncio
import logging
import re

from city.sync_job import scheduler  # reuse the shared AsyncIOScheduler

logger = logging.getLogger(__name__)


def _to_slug(city_id: str) -> str:
    """Normalise a city name or slug to the lowercase slug used in city_data.id."""
    return re.sub(r'[^a-z0-9]+', '_', city_id.lower().strip()).strip('_')


async def refresh_all_cities(
    supabase,
    youtube_key: str = "",
    foursquare_key: str = "",
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> dict:
    """Refresh trend scores for every city that has place_dynamic_profiles rows.

    Staleness guard (7 days) in seed_trend_scores ensures recently seeded
    cities are skipped without hitting any external APIs.
    """
    from city.data_model import load_city
    from city.trend_seeder import seed_trend_scores

    try:
        resp = supabase.table("place_dynamic_profiles").select("city_id").execute()
        city_ids = list({r["city_id"] for r in (resp.data or []) if r.get("city_id")})
    except Exception as exc:
        logger.exception("trend_refresh: failed to fetch city list: %s", exc)
        return {"cities_processed": 0, "total_updated": 0, "total_fresh": 0}

    if not city_ids:
        logger.info("trend_refresh: no cities to refresh")
        return {"cities_processed": 0, "total_updated": 0, "total_fresh": 0}

    logger.info("trend_refresh: refreshing %d cities", len(city_ids))
    total_updated = 0
    total_fresh = 0

    for city_id in city_ids:
        # place_dynamic_profiles.city_id may be a display name ("Paris") or slug ("paris")
        slug = _to_slug(city_id)
        city = None
        for attempt in ([slug] if slug == city_id else [slug, city_id]):
            try:
                city = load_city(attempt, supabase)
                break
            except Exception:
                pass
        if city is None:
            logger.warning("trend_refresh: could not load %s (tried slug=%s), skipping", city_id, slug)
            continue

        places = [
            {"place_id": ic.place_id, "name": ic.name, "lat": ic.lat, "lon": ic.lon}
            for ic in city.insert_candidates
            if ic.place_id
        ]
        if not places:
            continue

        try:
            result = await asyncio.to_thread(
                seed_trend_scores,
                city_id=city_id,
                places=places,
                city_name=city.name,
                country_code="",
                supabase=supabase,
                youtube_key=youtube_key,
                foursquare_key=foursquare_key,
                reddit_client_id=reddit_client_id,
                reddit_client_secret=reddit_client_secret,
            )
            logger.info(
                "trend_refresh: %s → updated=%d fresh=%d skipped=%d",
                city_id, result.get("updated", 0), result.get("fresh", 0), result.get("skipped", 0),
            )
            total_updated += result.get("updated", 0)
            total_fresh += result.get("fresh", 0)
        except Exception as exc:
            logger.exception("trend_refresh: error for %s: %s", city_id, exc)

    logger.info("trend_refresh: done — %d updated, %d fresh across %d cities",
                total_updated, total_fresh, len(city_ids))
    return {"cities_processed": len(city_ids), "total_updated": total_updated, "total_fresh": total_fresh}


def start_trend_scheduler(
    supabase,
    youtube_key: str = "",
    foursquare_key: str = "",
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> None:
    """Register weekly trend refresh on the shared scheduler (Sunday 03:00 UTC)."""
    scheduler.add_job(
        refresh_all_cities,
        "cron",
        hour=3,
        kwargs={
            "supabase": supabase,
            "youtube_key": youtube_key,
            "foursquare_key": foursquare_key,
            "reddit_client_id": reddit_client_id,
            "reddit_client_secret": reddit_client_secret,
        },
        id="trend_velocity_refresh",
        replace_existing=True,
    )
    logger.info("Trend Velocity Scheduler registered (daily 03:00 UTC)")
