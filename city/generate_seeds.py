#!/usr/bin/env python3
"""Seed generator: produces city/seed/{city_id}.json for each Tier 1 city in the registry.

Usage:
    python -m city.generate_seeds                   # generate all missing
    python -m city.generate_seeds --city osaka      # single city
    python -m city.generate_seeds --force           # regenerate all (overwrite)
    python -m city.generate_seeds --dry-run         # print prompt only, no write

Requires: ANTHROPIC_API_KEY in environment.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import time
from pathlib import Path

import anthropic

from city.cities_registry import CITIES
from city.data_model import load_city_from_dict

_SEED_DIR = Path(__file__).parent / "seed"
_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 4000
_SLEEP_BETWEEN_CITIES = 1.5  # seconds — stay within API rate limits

_SCHEMA_DESCRIPTION = """
The JSON must exactly match this structure (no extra keys):

{
  "id": "<city_id slug>",
  "name": "<City Name>",
  "tier": <1|2|3>,
  "center": [<lat float>, <lon float>],
  "timezone": "<IANA timezone string>",
  "climate": {
    "heat_threshold_c": <int>,
    "rain_months": [<list of month ints 1-12>]
  },
  "movement": {
    "walkability": <1|2|3>,
    "transit": <1|2|3>
  },
  "culture": {
    "meal_times": {"lunch": "HH:MM", "dinner": "HH:MM"},
    "siesta": <true|false>
  },
  "neighborhoods": [
    {
      "id": "<slug>",
      "name": "<Name>",
      "center": [<lat>, <lon>],
      "polygon": [],
      "best_times": {"morning": <0.0-1.0>, "afternoon": <0.0-1.0>, "evening": <0.0-1.0>},
      "crowd_index": {"weekday": <0.0-1.0>, "weekend": <0.0-1.0>}
    }
  ],
  "insert_candidates": [
    {
      "place_id": "<type_neighborhood_n>",
      "name": "<Real or plausible business name>",
      "lat": <float>,
      "lon": <float>,
      "type": "<coffee|lunch|scenic_walk|rest|micro>",
      "time_cost_min": <int>,
      "persona_affinity": {"wanderer": <0.0-1.0>, "voyager": <0.0-1.0>, "epicurean": <0.0-1.0>},
      "trigger": <null or string>,
      "time_of_day_match": [<"morning"|"afternoon"|"evening">]
    }
  ],
  "scenic_routes": [
    {"id": "<slug>", "from_neighborhood": "<id>", "to_neighborhood": "<id>", "walk_min": <int>, "score": <0.0-1.0>}
  ],
  "transit_edges": [],
  "engine_modifiers": {
    "siesta_window": <null or "HH:MM-HH:MM">,
    "lunch_window_strict": <true|false>,
    "evening_end_time": "HH:MM",
    "day_buffer_min": <int>
  },
  "landmark_anchors": ["<slug>"],
  "hidden_gems": ["<slug>"]
}
"""

_ARCHETYPE_GUIDE = """
Persona archetypes:
- wanderer: urban exploration, markets, local neighborhoods
- voyager: curated, heritage/gastronomy, quality over quantity
- epicurean: food-focused, markets, restaurants, cafes
- historian: museums, heritage sites, cultural depth
- pulse: nightlife, rooftops, events, energy
- slowtraveller: one neighborhood deep, cafes, parks, local daily life
- explorer: parks, museums, food, nightlife — wants everything
"""


def _build_prompt(city: dict) -> str:
    return f"""You are a travel data specialist generating seed data for a deterministic itinerary engine.

Generate a complete, accurate CityData JSON for {city['name']}.

City facts:
- ID: {city['id']}
- Coordinates: [{city['lat']}, {city['lon']}]
- Timezone: {city['timezone']}
- Tier: {city['tier']}
- Cultural notes: {city['notes']}

{_ARCHETYPE_GUIDE}

Requirements:
1. 4-5 realistic neighborhoods with actual names and accurate coordinates
2. 5-8 insert candidates: at least 2 coffee, at least 1 lunch, at least 1 scenic_walk if walkable
3. 1-3 scenic_routes if city has walkable neighborhood connections
4. engine_modifiers.siesta_window: actual window (e.g. "14:00-17:00") or null
5. landmark_anchors: 3-6 slug IDs of iconic places (e.g. "eiffel_tower")
6. hidden_gems: 3-5 slug IDs of lesser-known local favourites

Use real place names. Coordinates must be accurate (within 500m).

{_SCHEMA_DESCRIPTION}

Return ONLY the JSON object. No markdown fences, no explanation.
"""


def _generate_city(client: anthropic.Anthropic, city: dict, dry_run: bool = False) -> dict | None:
    prompt = _build_prompt(city)
    if dry_run:
        print(f"\n{'='*60}\nPROMPT for {city['name']}:\n{prompt[:500]}...\n")
        return None

    response = client.messages.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    data = json.loads(text)
    load_city_from_dict(data)  # validates schema — raises on bad data
    return data


def _save_seed(city_id: str, data: dict) -> None:
    _SEED_DIR.mkdir(exist_ok=True)
    path = _SEED_DIR / f"{city_id}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  ✓ Saved {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Tier 1 city seed JSON files")
    parser.add_argument("--city", help="Generate only this city ID")
    parser.add_argument("--force", action="store_true", help="Overwrite existing seed files")
    parser.add_argument("--dry-run", action="store_true", help="Print prompt only, no API call")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and not args.dry_run:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key) if not args.dry_run else None

    cities = CITIES
    if args.city:
        cities = [c for c in CITIES if c["id"] == args.city]
        if not cities:
            print(f"ERROR: city '{args.city}' not found in registry", file=sys.stderr)
            sys.exit(1)

    skipped, generated, failed = 0, 0, 0
    for city in cities:
        seed_path = _SEED_DIR / f"{city['id']}.json"
        if seed_path.exists() and not args.force and not args.dry_run:
            print(f"  → Skipping {city['name']} (already seeded)")
            skipped += 1
            continue

        print(f"  Generating {city['name']} ({city['id']})...")
        try:
            data = _generate_city(client, city, dry_run=args.dry_run)
            if data:
                _save_seed(city["id"], data)
                generated += 1
            if not args.dry_run and len(cities) > 1:
                time.sleep(_SLEEP_BETWEEN_CITIES)
        except json.JSONDecodeError as e:
            print(f"  ✗ JSON parse error for {city['name']}: {e}", file=sys.stderr)
            failed += 1
        except Exception as e:
            print(f"  ✗ Error for {city['name']}: {e}", file=sys.stderr)
            failed += 1

    print(f"\nDone: {generated} generated, {skipped} skipped, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
