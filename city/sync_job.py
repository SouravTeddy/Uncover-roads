"""City Intelligence Sync: weekly APScheduler job.

Runs every Sunday at 02:00 UTC. Processes one city every 3 minutes
to respect Google Places quota (~20 cities/hour).
"""
from __future__ import annotations
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from city.signal_processor import classify_stage, needs_human_review
from city.place_photo_spots_seeder import seed_place_photo_spots

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def sync_city(
    city_id: str,
    supabase,
    google_places_key: str | None = None,
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> None:
    """Sync a single city: fetch signals, classify stage, queue human review if needed,
    and extract photo spot intelligence from cached reviews + Reddit."""
    logger.info("sync_city: %s", city_id)
    try:
        # Fetch current city data
        row = supabase.table("city_data").select("data").eq("id", city_id).single().execute()
        if not row.data:
            logger.warning("sync_city: city %s not found in Supabase", city_id)
            return

        city_data = row.data["data"]
        city_name = city_data.get("name", city_id)
        insert_candidates = city_data.get("insert_candidates", [])

        for candidate in insert_candidates:
            place_id = candidate.get("place_id")
            if not place_id:
                continue

            # In production: fetch reviews via Google Places API here.
            # For Phase 5 baseline, we read cached signals from Supabase if available.
            signals_row = (
                supabase.table("place_signals")
                .select("signals")
                .eq("place_id", place_id)
                .maybe_single()
                .execute()
            )
            if not signals_row.data:
                continue

            signals = signals_row.data["signals"]
            stage = classify_stage(signals)

            # Update stage on the candidate in city_data
            candidate["stage"] = stage

            # Queue for human review if flagged
            if needs_human_review(signals, stage):
                supabase.table("human_review_queue").upsert({
                    "place_id": place_id,
                    "city_id": city_id,
                    "stage": stage,
                    "signals": signals,
                    "flagged_at": "now()",
                }).execute()
                logger.info("sync_city: queued %s for human review (stage=%s)", place_id, stage)

        # Write updated city_data back
        supabase.table("city_data").update({"data": city_data}).eq("id", city_id).execute()

        # Extract photo spot intelligence from Google cached reviews + Reddit.
        # Runs after the main sync so a failure here doesn't block stage updates.
        places = [
            {"place_id": c.get("place_id"), "name": c.get("name", ""), "lat": c.get("lat"), "lon": c.get("lon")}
            for c in insert_candidates
            if c.get("place_id")
        ]
        if places:
            photo_result = seed_place_photo_spots(
                places, city_id, city_name, supabase,
                reddit_client_id=reddit_client_id,
                reddit_client_secret=reddit_client_secret,
            )
            logger.info(
                "sync_city: %s photo spots — inserted=%d skipped=%d no_spot=%d",
                city_id, photo_result["inserted"], photo_result["skipped"], photo_result["no_spot"],
            )

        logger.info("sync_city: %s complete", city_id)

    except Exception as exc:
        logger.exception("sync_city: error syncing %s: %s", city_id, exc)


async def sync_all_cities(
    supabase,
    google_places_key: str | None = None,
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> None:
    """Sync all cities in city_data table, 3 minutes apart."""
    cities_result = supabase.table("city_data").select("id").execute()
    cities = cities_result.data or []
    logger.info("sync_all_cities: syncing %d cities", len(cities))
    for city in cities:
        await sync_city(
            city["id"], supabase, google_places_key,
            reddit_client_id=reddit_client_id,
            reddit_client_secret=reddit_client_secret,
        )
        if len(cities) > 1:
            await asyncio.sleep(180)


def start_scheduler(
    supabase,
    google_places_key: str | None = None,
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> None:
    """Register weekly sync job and start the APScheduler."""
    scheduler.add_job(
        sync_all_cities,
        "cron",
        day_of_week="sun",
        hour=2,
        kwargs={
            "supabase": supabase,
            "google_places_key": google_places_key,
            "reddit_client_id": reddit_client_id,
            "reddit_client_secret": reddit_client_secret,
        },
        id="city_intelligence_sync",
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()
    logger.info("City Intelligence Sync scheduler started (weekly Sunday 02:00 UTC)")
