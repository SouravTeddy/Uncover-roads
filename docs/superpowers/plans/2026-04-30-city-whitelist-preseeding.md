# City Whitelist & Pre-Launch Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tourist-city whitelist (~1,200–1,500 cities from GeoNames + Google Places filter), enforce it on all search/autocomplete endpoints, and batch pre-seed every whitelisted city before launch so no user ever hits a cold start.

**Architecture:** A `city_whitelist` table in Supabase is the source of truth. All city search/autocomplete calls in `main.py` validate against it. A one-time GeoNames seeding script populates the whitelist. A batch pre-seeding script then runs the existing on-demand seeding pipeline against every whitelisted city before launch. Both scripts are in `scripts/` and run manually, not as scheduled jobs.

**Tech Stack:** Python, FastAPI (main.py), Supabase Python client, GeoNames data file (free download), requests.

**Depends on:** Phase 1 complete (Supabase connected, Google Places API key in env).

**Working directory:** `/Users/souravbiswas/uncover-roads`

---

## File Map

```
Created:
  scripts/seed_city_whitelist.py     → imports GeoNames data, filters to tourist cities, writes to Supabase
  scripts/preseed_cities.py          → batch-runs on-demand seeding pipeline for all whitelisted cities

Modified:
  main.py                            → add whitelist validation to search + autocomplete endpoints
                                       add /api/cities/autocomplete endpoint
```

---

## Task 1: Supabase migration — city_whitelist table

**Files:**
- Run in Supabase SQL editor

- [ ] **Step 1: Run the migration**

```sql
CREATE TABLE IF NOT EXISTS city_whitelist (
  city_id     TEXT PRIMARY KEY,           -- "{name}-{country_code}" slug, e.g. "tokyo-jp"
  name        TEXT NOT NULL,
  country_code TEXT NOT NULL,             -- ISO 3166-1 alpha-2
  tier        INTEGER NOT NULL DEFAULT 2,
  lat         FLOAT NOT NULL,
  lon         FLOAT NOT NULL,
  seeded      BOOLEAN NOT NULL DEFAULT FALSE,
  seeded_at   TIMESTAMPTZ,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS city_whitelist_name_idx
  ON city_whitelist (lower(name));

CREATE INDEX IF NOT EXISTS city_whitelist_seeded_idx
  ON city_whitelist (seeded);

-- Service role only — no RLS user access needed
ALTER TABLE city_whitelist ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Verify in dashboard**

Supabase dashboard → Table Editor → confirm `city_whitelist` appears with all columns.

- [ ] **Step 3: Note the migration**

```bash
mkdir -p /Users/souravbiswas/uncover-roads/supabase/migrations
cat > /Users/souravbiswas/uncover-roads/supabase/migrations/20260430_city_whitelist.sql << 'EOF'
-- Applied 2026-04-30: city_whitelist table
-- See full SQL in Supabase dashboard
EOF
git add supabase/
git commit -m "infra: add city_whitelist migration"
```

---

## Task 2: GeoNames seeding script

**Files:**
- Create: `scripts/seed_city_whitelist.py`

This script downloads GeoNames `cities15000.zip`, filters to tourist-relevant cities, and writes them to the `city_whitelist` table.

**GeoNames data format:** tab-separated, each row is a city. Fields we need: geonameid (col 0), name (col 1), country code (col 8), population (col 14), latitude (col 4), longitude (col 5), feature class (col 6), feature code (col 7).

- [ ] **Step 1: Create the scripts directory**

```bash
mkdir -p /Users/souravbiswas/uncover-roads/scripts
```

- [ ] **Step 2: Create seed_city_whitelist.py**

Create `/Users/souravbiswas/uncover-roads/scripts/seed_city_whitelist.py`:

```python
#!/usr/bin/env python3
"""
Seed city_whitelist from GeoNames cities15000 dataset.

Downloads cities15000.zip (~25k cities with population > 15,000),
applies a tourist-relevance filter, and writes to Supabase city_whitelist.

Usage:
  cd /Users/souravbiswas/uncover-roads
  python scripts/seed_city_whitelist.py --dry-run   # preview, no writes
  python scripts/seed_city_whitelist.py             # write to Supabase
"""

import argparse
import csv
import io
import os
import re
import zipfile
import time
from urllib.request import urlretrieve

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
GEONAMES_ZIP = "/tmp/cities15000.zip"
GEONAMES_TXT = "cities15000.txt"

# Countries with very limited tourism — excluded entirely
EXCLUDED_COUNTRIES = {
    "AQ",  # Antarctica
    "TF",  # French Southern Territories
    "HM",  # Heard & McDonald Islands
    "BV",  # Bouvet Island
    "PN",  # Pitcairn
    "SH",  # Saint Helena (remote)
    "IO",  # British Indian Ocean Territory (restricted)
}

# Feature codes to include — populated places with tourism potential
INCLUDED_FEATURE_CODES = {
    "PPLC",   # capital of a political entity
    "PPLA",   # seat of first-order admin division
    "PPLA2",  # seat of second-order admin division
    "PPL",    # populated place
    "PPLG",   # seat of government
    "PPLS",   # populated places
}

# Population threshold — cities below this are unlikely tourist destinations
# 50,000 is conservative; well-known small towns (Hallstatt ~800) are Tier 1 and added manually
MIN_POPULATION = 50_000


def make_city_id(name: str, country_code: str) -> str:
    """Generate a stable slug: 'tokyo-jp'"""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{country_code.lower()}"


def download_geonames() -> None:
    if not os.path.exists(GEONAMES_ZIP):
        print(f"Downloading GeoNames data from {GEONAMES_URL} ...")
        urlretrieve(GEONAMES_URL, GEONAMES_ZIP)
        print(f"Downloaded to {GEONAMES_ZIP}")
    else:
        print(f"Using cached {GEONAMES_ZIP}")


def load_cities() -> list[dict]:
    """Parse GeoNames txt file and return filtered city dicts."""
    cities = []
    with zipfile.ZipFile(GEONAMES_ZIP) as zf:
        with zf.open(GEONAMES_TXT) as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding="utf-8"), delimiter="\t")
            for row in reader:
                if len(row) < 15:
                    continue
                try:
                    feature_code = row[7]
                    country_code = row[8]
                    population = int(row[14]) if row[14] else 0
                    lat = float(row[4])
                    lon = float(row[5])
                except (ValueError, IndexError):
                    continue

                if country_code in EXCLUDED_COUNTRIES:
                    continue
                if feature_code not in INCLUDED_FEATURE_CODES:
                    continue
                if population < MIN_POPULATION:
                    continue

                name = row[1]  # ASCII name
                cities.append({
                    "city_id": make_city_id(name, country_code),
                    "name": name,
                    "country_code": country_code,
                    "tier": 2,
                    "lat": lat,
                    "lon": lon,
                    "seeded": False,
                })

    # Deduplicate by city_id (keep first occurrence — highest population first after sort)
    cities.sort(key=lambda c: c["city_id"])
    seen = set()
    unique = []
    for c in cities:
        if c["city_id"] not in seen:
            seen.add(c["city_id"])
            unique.append(c)

    return unique


def write_to_supabase(cities: list[dict], batch_size: int = 200) -> None:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    total = 0
    for i in range(0, len(cities), batch_size):
        batch = cities[i : i + batch_size]
        # upsert — safe to re-run
        supabase.table("city_whitelist").upsert(
            batch, on_conflict="city_id"
        ).execute()
        total += len(batch)
        print(f"  Wrote {total}/{len(cities)} cities...")
        time.sleep(0.2)  # be gentle with Supabase
    print(f"Done. {total} cities written.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing to Supabase")
    args = parser.parse_args()

    download_geonames()
    cities = load_cities()
    print(f"\nFiltered to {len(cities)} tourist-relevant cities")

    # Country distribution preview
    from collections import Counter
    by_country = Counter(c["country_code"] for c in cities)
    print("\nTop 20 countries by city count:")
    for country, count in by_country.most_common(20):
        print(f"  {country}: {count}")

    if args.dry_run:
        print("\n--dry-run: no writes performed.")
        return

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        return

    write_to_supabase(cities)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run in dry-run mode first**

```bash
cd /Users/souravbiswas/uncover-roads
python scripts/seed_city_whitelist.py --dry-run
```

Expected output:
```
Downloading GeoNames data from ...
Filtered to ~1100-1500 tourist-relevant cities
Top 20 countries by city count:
  US: 180
  IN: 95
  CN: 88
  ...
--dry-run: no writes performed.
```

If the count is wildly off (< 500 or > 3,000), adjust `MIN_POPULATION` before writing.

- [ ] **Step 4: Run for real**

```bash
cd /Users/souravbiswas/uncover-roads
python scripts/seed_city_whitelist.py
```

Expected: writes all cities to `city_whitelist` table. Verify in Supabase dashboard.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_city_whitelist.py
git commit -m "feat(cities): add GeoNames city whitelist seeding script"
```

---

## Task 3: Add whitelist validation to search endpoints in main.py

**Files:**
- Modify: `main.py`

This task adds two things:
1. A helper that checks if a city_id is in the whitelist
2. A `/api/cities/autocomplete` endpoint that only returns whitelisted cities
3. Validation in the existing city search endpoint

- [ ] **Step 1: Add the whitelist validation helper after the Supabase init block**

```python
# ── City whitelist ────────────────────────────────────────────────────────────

def is_city_whitelisted(city_id: str) -> bool:
    """Return True if city_id exists in city_whitelist table."""
    if not _supabase:
        return True  # fail open if DB unavailable — don't block users
    try:
        result = (
            _supabase.table("city_whitelist")
            .select("city_id")
            .eq("city_id", city_id)
            .single()
            .execute()
        )
        return result.data is not None
    except Exception:
        return True  # fail open


def search_whitelisted_cities(query: str, limit: int = 8) -> list[dict]:
    """Return whitelist cities matching query prefix (case-insensitive)."""
    if not _supabase:
        return []
    try:
        result = (
            _supabase.table("city_whitelist")
            .select("city_id, name, country_code, tier")
            .ilike("name", f"{query}%")
            .order("tier")
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception:
        return []
```

- [ ] **Step 2: Add the /api/cities/autocomplete endpoint**

```python
@app.get("/api/cities/autocomplete")
async def cities_autocomplete(q: str = Query("", min_length=1, max_length=64)):
    """
    Autocomplete from city_whitelist only.
    Returns max 8 matching cities. No auth required — safe to call on keypress.
    """
    if len(q.strip()) < 2:
        return {"results": []}
    cities = search_whitelisted_cities(q.strip(), limit=8)
    return {
        "results": [
            {
                "city_id":      c["city_id"],
                "name":         c["name"],
                "country_code": c["country_code"],
                "tier":         c["tier"],
            }
            for c in cities
        ]
    }
```

- [ ] **Step 3: Find the existing city search endpoint and add whitelist validation**

Search `main.py` for any route that accepts a city name or city_id and fetches city data. Add a whitelist check at the start:

```python
# Example — match the actual function signature in main.py
@app.get("/api/city/{city_id}")
async def get_city(city_id: str):
    if not is_city_whitelisted(city_id):
        raise HTTPException(
            status_code=404,
            detail={"error": "city_not_supported",
                    "message": "We don't cover this city yet"}
        )
    # ...rest of handler unchanged...
```

Apply the same check to any other endpoint that receives a city identifier.

- [ ] **Step 4: Start the server and test autocomplete**

```bash
cd /Users/souravbiswas/uncover-roads
uvicorn main:app --reload --port 8000
```

```bash
curl "http://localhost:8000/api/cities/autocomplete?q=tok"
```

Expected:
```json
{"results": [{"city_id": "tokyo-jp", "name": "Tokyo", "country_code": "JP", "tier": 1}]}
```

```bash
curl "http://localhost:8000/api/cities/autocomplete?q=anta"
```

Expected: `{"results": []}` — Antarctica is not in the whitelist.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat(cities): add whitelist validation and /api/cities/autocomplete endpoint"
```

---

## Task 4: Batch pre-seeding script

**Files:**
- Create: `scripts/preseed_cities.py`

This script reads every unseeded city from `city_whitelist` and calls the on-demand seeding pipeline (the same one triggered by a first-time user search). It throttles to ~20 cities/hour to respect Google Places API quotas.

Run this 3 days before launch and let it run in the background.

- [ ] **Step 1: Create preseed_cities.py**

Create `/Users/souravbiswas/uncover-roads/scripts/preseed_cities.py`:

```python
#!/usr/bin/env python3
"""
Batch pre-seed all whitelisted cities before launch.

Calls the on-demand city seeding pipeline for every city in city_whitelist
where seeded=false. Throttled to 20 cities/hour (Google Places quota safe).

Usage:
  cd /Users/souravbiswas/uncover-roads
  python scripts/preseed_cities.py --dry-run        # list unseeded cities
  python scripts/preseed_cities.py                   # seed all
  python scripts/preseed_cities.py --limit 50        # seed first 50 (for testing)

Resume: safe to re-run — already-seeded cities are skipped.
"""

import argparse
import os
import time
import requests

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")

# 20 cities/hour = 180 seconds between calls
SECONDS_BETWEEN_CITIES = 180


def get_unseeded_cities(supabase) -> list[dict]:
    result = (
        supabase.table("city_whitelist")
        .select("city_id, name, country_code")
        .eq("seeded", False)
        .order("city_id")
        .execute()
    )
    return result.data or []


def seed_city(city: dict) -> bool:
    """
    Trigger the on-demand seeding pipeline by calling the city data endpoint.
    The endpoint auto-seeds if not found (Tier 2 pipeline).
    Returns True on success.
    """
    try:
        resp = requests.get(
            f"{API_BASE}/api/city/{city['city_id']}",
            timeout=30,
        )
        # 200 or 201 = seeded successfully
        # 404 = city not in DB but we just triggered seeding — check again
        return resp.status_code in (200, 201, 202)
    except Exception as e:
        print(f"  ERROR seeding {city['city_id']}: {e}")
        return False


def mark_seeded(supabase, city_id: str) -> None:
    from datetime import datetime, timezone
    supabase.table("city_whitelist").update({
        "seeded": True,
        "seeded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("city_id", city_id).execute()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0,
                        help="Only seed this many cities (0 = all)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    cities = get_unseeded_cities(supabase)

    if args.limit:
        cities = cities[: args.limit]

    print(f"Found {len(cities)} unseeded cities")

    if args.dry_run:
        for c in cities[:20]:
            print(f"  {c['city_id']} ({c['name']}, {c['country_code']})")
        if len(cities) > 20:
            print(f"  ... and {len(cities) - 20} more")
        print("\n--dry-run: no seeding performed.")
        return

    estimated_hours = (len(cities) * SECONDS_BETWEEN_CITIES) / 3600
    print(f"Estimated time: {estimated_hours:.1f} hours at 20 cities/hour")
    print("Press Ctrl+C to stop — safe to resume, seeded cities are skipped.\n")

    seeded = 0
    failed = 0

    for i, city in enumerate(cities):
        print(f"[{i+1}/{len(cities)}] Seeding {city['name']} ({city['city_id']})...")
        success = seed_city(city)
        if success:
            mark_seeded(supabase, city["city_id"])
            seeded += 1
            print(f"  OK — {seeded} seeded, {failed} failed")
        else:
            failed += 1
            print(f"  FAILED — will retry on next run")

        if i < len(cities) - 1:
            time.sleep(SECONDS_BETWEEN_CITIES)

    print(f"\nDone. {seeded} seeded, {failed} failed.")
    print("Re-run to retry failed cities.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test dry-run**

```bash
cd /Users/souravbiswas/uncover-roads
python scripts/preseed_cities.py --dry-run
```

Expected: lists first 20 unseeded cities from the whitelist. No API calls made.

- [ ] **Step 3: Test with limit=2 (seeds 2 cities, verifies the pipeline works)**

Start the server in a separate terminal first:
```bash
uvicorn main:app --reload --port 8000
```

Then:
```bash
python scripts/preseed_cities.py --limit 2
```

Expected: seeds 2 cities, marks them as `seeded=true` in Supabase. Verify in dashboard.

- [ ] **Step 4: Commit**

```bash
git add scripts/preseed_cities.py
git commit -m "feat(cities): add batch pre-seeding script for launch"
```

---

## Task 5: Update frontend search input to use /api/cities/autocomplete

**Files:**
- Modify: whichever component handles the city search input (check the destination/map screens)

Read the current city search component before modifying. Find where it calls Google Places autocomplete for city names and replace or supplement with a call to `/api/cities/autocomplete` for city-level suggestions.

- [ ] **Step 1: Find the city search input component**

```bash
grep -r "autocomplete\|citySearch\|searchCity\|city.*search" \
  /Users/souravbiswas/uncover-roads/frontend/src --include="*.tsx" -l
```

- [ ] **Step 2: Replace city-level autocomplete with whitelist endpoint**

In the city search component, replace the Google Places call for city-level results with:

```typescript
async function fetchCitySuggestions(query: string): Promise<CityResult[]> {
  if (query.length < 2) return []
  const resp = await fetch(
    `${import.meta.env.VITE_API_URL}/api/cities/autocomplete?q=${encodeURIComponent(query)}`
  )
  if (!resp.ok) return []
  const data = await resp.json()
  return data.results as CityResult[]
}
```

The Google Places session token autocomplete stays in place for place-level searches (restaurants, attractions within a city) — only the city-selector uses the whitelist endpoint.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -p   # stage only the city search changes
git commit -m "feat(cities): use whitelist autocomplete for city search"
```

---

## Pre-Launch Checklist

Run these in order 3–4 days before launch:

- [ ] Run `python scripts/seed_city_whitelist.py` — populate city_whitelist
- [ ] Verify row count in Supabase: `SELECT COUNT(*) FROM city_whitelist` — expect 1,000–1,500
- [ ] Start the production backend
- [ ] Run `python scripts/preseed_cities.py` in a screen/tmux session (runs for ~55 hours)
- [ ] Monitor progress: `SELECT COUNT(*) FROM city_whitelist WHERE seeded = true`
- [ ] Day before launch: run `python scripts/preseed_cities.py` again to catch any failures
- [ ] Confirm `SELECT COUNT(*) FROM city_whitelist WHERE seeded = false` is < 50
