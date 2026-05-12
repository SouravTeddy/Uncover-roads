#!/usr/bin/env python3
"""Pre-launch batch seeder: seeds all whitelisted-but-unseeded cities at 20 cities/hour.

Run 3 days before launch. Any city not seeded stays as on-demand
(first user search seeds it in ~3–4s, instant for all after).

Usage:
    python -m city.prelaunch_batch_seed               # seed all unseeded
    python -m city.prelaunch_batch_seed --limit 100   # seed first N only
    python -m city.prelaunch_batch_seed --dry-run     # count + ETA only

Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_PLACES_API_KEY in environment.
FOURSQUARE_API_KEY is optional (hidden gems skipped if not set).
"""
from __future__ import annotations
import argparse
import os
import sys
import time

_RATE_LIMIT_SLEEP = 180  # 20 cities/hour = 1 per 3 minutes


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-launch batch city seeder")
    parser.add_argument("--limit", type=int, default=None, help="Max cities to seed")
    parser.add_argument("--dry-run", action="store_true", help="Count + ETA only, no API calls")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    from city.on_demand_seeder import seed_city_on_demand

    sb = create_client(url, key)

    result = (
        sb.table("city_whitelist")
        .select("city_id, name, country_code, tier, lat, lon, timezone, seeded")
        .eq("seeded", False)
        .order("tier")
        .execute()
    )
    cities = result.data or []
    if args.limit:
        cities = cities[: args.limit]

    print(f"Found {len(cities)} unseeded whitelisted cities")

    if args.dry_run:
        for c in cities[:20]:
            print(f"  Would seed: {c['name']} ({c['city_id']}) tier={c['tier']}")
        if len(cities) > 20:
            print(f"  ... and {len(cities) - 20} more")
        hours = len(cities) * _RATE_LIMIT_SLEEP / 3600
        print(f"\nEstimated time: {hours:.1f} hours at 20 cities/hour")
        return

    seeded, failed = 0, 0
    for i, row in enumerate(cities):
        print(f"[{i+1}/{len(cities)}] Seeding {row['name']} ({row['city_id']})...")
        try:
            seed_city_on_demand(row, sb)
            seeded += 1
            print(f"  Done")
        except Exception as e:
            print(f"  Failed: {e}", file=sys.stderr)
            failed += 1
        if i < len(cities) - 1:
            time.sleep(_RATE_LIMIT_SLEEP)

    print(f"\nDone: {seeded} seeded, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
