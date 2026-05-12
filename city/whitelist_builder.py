#!/usr/bin/env python3
"""Whitelist builder: loads ~4,000 tourist-relevant cities into city_whitelist Supabase table.

Source: GeoNames cities15000.txt (cities with population > 15,000, ~26k total).
Filter: population >= 100,000 → ~4,000 cities.
Tier 1 cities (from cities_registry.py) are inserted with tier=1; all others tier=2.
The 80 Tier 1 cities are pre-seeded separately — whitelist just gates search.

Usage:
    python -m city.whitelist_builder               # load all (idempotent — uses upsert)
    python -m city.whitelist_builder --dry-run     # print first 20 rows, no DB write

Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in environment.
GeoNames data auto-downloaded from download.geonames.org (public domain).
"""

from __future__ import annotations
import argparse
import csv
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

from city.cities_registry import CITIES as TIER1_CITIES

_GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
_CACHE_PATH = Path(__file__).parent / "_geonames_cities15000.txt"
_MIN_POPULATION = 100_000
_BATCH_SIZE = 500

# GeoNames TSV column indices
_COL_NAME = 1  # asciiname
_COL_LAT = 4
_COL_LON = 5
_COL_COUNTRY = 8
_COL_POPULATION = 14
_COL_TIMEZONE = 17

_TIER1_IDS = {c["id"] for c in TIER1_CITIES}


def _slugify(name: str) -> str:
    slug = (
        name.lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("'", "")
        .replace(".", "")
    )
    return "".join(c for c in slug if c.isalnum() or c == "_")


def _download_geonames() -> list[dict]:
    if not _CACHE_PATH.exists():
        print("Downloading GeoNames cities15000.zip...")
        tmp = _CACHE_PATH.with_suffix(".zip")
        urllib.request.urlretrieve(_GEONAMES_URL, tmp)
        with zipfile.ZipFile(tmp) as z:
            z.extract("cities15000.txt", _CACHE_PATH.parent)
        (_CACHE_PATH.parent / "cities15000.txt").rename(_CACHE_PATH)
        tmp.unlink()
        print(f"Cached to {_CACHE_PATH}")
    else:
        print(f"Using cached {_CACHE_PATH}")

    cities = []
    with open(_CACHE_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 19:
                continue
            try:
                population = int(row[_COL_POPULATION])
            except ValueError:
                continue
            if population < _MIN_POPULATION:
                continue
            name = row[_COL_NAME].strip()
            country = row[_COL_COUNTRY].strip()
            lat = float(row[_COL_LAT])
            lon = float(row[_COL_LON])
            city_id = _slugify(name)
            # Prefer Tier 1 registry ID if this city matches by name
            tier1_match = next(
                (c for c in TIER1_CITIES if _slugify(c["name"]) == city_id), None
            )
            if tier1_match:
                city_id = tier1_match["id"]
            cities.append(
                {
                    "city_id": city_id,
                    "name": name,
                    "country_code": country,
                    "tier": 1 if city_id in _TIER1_IDS else 2,
                    "lat": lat,
                    "lon": lon,
                }
            )
    return cities


def _load_to_supabase(cities: list[dict]) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required", file=sys.stderr)
        sys.exit(1)
    from supabase import create_client

    sb = create_client(url, key)
    # Deduplicate by city_id — keep highest-population entry (first occurrence after sort)
    seen: dict[str, dict] = {}
    for c in cities:
        if c["city_id"] not in seen:
            seen[c["city_id"]] = c
    cities = list(seen.values())

    rows = [
        {
            "city_id": c["city_id"],
            "name": c["name"],
            "country_code": c["country_code"],
            "tier": c["tier"],
            "lat": c["lat"],
            "lon": c["lon"],
            "seeded": False,
        }
        for c in cities
    ]
    total = len(rows)
    inserted = 0
    for i in range(0, total, _BATCH_SIZE):
        batch = rows[i : i + _BATCH_SIZE]
        sb.table("city_whitelist").upsert(batch, on_conflict="city_id").execute()
        inserted += len(batch)
        print(f"  Upserted {inserted}/{total}...")
    print(f"\nDone: {total} cities loaded into city_whitelist")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load city whitelist into Supabase")
    parser.add_argument(
        "--dry-run", action="store_true", help="Print first 20 rows, no DB write"
    )
    args = parser.parse_args()
    cities = _download_geonames()
    print(f"Parsed {len(cities)} cities with population >= {_MIN_POPULATION:,}")
    if args.dry_run:
        for c in cities[:20]:
            print(
                f"  {c['city_id']:30s} {c['name']:25s} {c['country_code']} tier={c['tier']}"
            )
        print(f"  ... and {len(cities) - 20} more")
        return
    _load_to_supabase(cities)


if __name__ == "__main__":
    main()
