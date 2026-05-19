#!/usr/bin/env python3
"""City photo seeder.

Fetches Unsplash photos for every city in city_whitelist where image_url IS NULL.
Stores the constructed Unsplash URL back to the same row.

Usage:
    python -m city.photo_seeder               # process all missing cities
    python -m city.photo_seeder --dry-run     # print matches, no DB writes
    python -m city.photo_seeder --batch-size 20 --delay 1.5

Requires:
    UNSPLASH_ACCESS_KEY in environment (from https://unsplash.com/developers)
    SUPABASE_URL and SUPABASE_SERVICE_KEY in environment

Rate limits:
    Unsplash demo: 50 req/hr  → with --delay 3 processes ~1200/hr safely
    Unsplash production: 5000 req/hr → no special delay needed
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.request
import urllib.parse
import json
from typing import Optional


_UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos"
_UNSPLASH_IMAGE_BASE = "https://images.unsplash.com"
_BATCH_SIZE = 50
_DEFAULT_DELAY = 2.5  # seconds between requests — safe for Unsplash demo (50/hr ≈ 1 per 72s; 2.5s targets ~24/min for production key)


def _unsplash_photo_url(city_name: str, country_code: str, access_key: str) -> Optional[str]:
    """Search Unsplash for the best city photo. Returns a full image URL or None."""
    query = f"{city_name} city"
    params = urllib.parse.urlencode({
        "query": query,
        "per_page": "3",
        "orientation": "landscape",
        "content_filter": "high",
    })
    url = f"{_UNSPLASH_SEARCH}?{params}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Client-ID {access_key}",
        "Accept-Version": "v1",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        results = data.get("results", [])
        if not results:
            return None
        photo_id = results[0]["id"]
        return f"{_UNSPLASH_IMAGE_BASE}/{photo_id}?w=800&q=80"
    except Exception as exc:
        print(f"    ⚠ Unsplash error for {city_name}: {exc}", file=sys.stderr)
        return None


def run(dry_run: bool, batch_size: int, delay: float) -> None:
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    access_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")

    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    if not access_key:
        sys.exit("UNSPLASH_ACCESS_KEY must be set (get one free at https://unsplash.com/developers)")

    supabase = create_client(url, key)

    offset = 0
    total_found = 0
    total_updated = 0

    print(f"{'[DRY RUN] ' if dry_run else ''}Starting city photo seeder…")

    while True:
        rows = (
            supabase.table("city_whitelist")
            .select("city_id, name, country_code")
            .is_("image_url", "null")
            .order("tier")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        batch = rows.data or []
        if not batch:
            break

        total_found += len(batch)
        print(f"\nBatch {offset // batch_size + 1}: {len(batch)} cities")

        for row in batch:
            city_id = row["city_id"]
            name = row["name"]
            country_code = row.get("country_code", "")

            photo_url = _unsplash_photo_url(name, country_code, access_key)
            if photo_url:
                print(f"  ✓ {name} ({country_code}) → {photo_url[:60]}…")
                if not dry_run:
                    supabase.table("city_whitelist").update(
                        {"image_url": photo_url}
                    ).eq("city_id", city_id).execute()
                    total_updated += 1
            else:
                print(f"  ✗ {name} ({country_code}) — no photo found")

            time.sleep(delay)

        offset += batch_size

    print(f"\nDone. Cities scanned: {total_found}, updated: {total_updated}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed city_whitelist.image_url from Unsplash")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    parser.add_argument("--batch-size", type=int, default=_BATCH_SIZE)
    parser.add_argument("--delay", type=float, default=_DEFAULT_DELAY, help="Seconds between Unsplash requests")
    args = parser.parse_args()
    run(dry_run=args.dry_run, batch_size=args.batch_size, delay=args.delay)
