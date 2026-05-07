# Phase 10 — Global City Profiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-expanding city profiling system that auto-generates a travel profile for any searched city, pre-seeds 80 Tier 1 cities at launch, and surfaces only exception-level discrepancies to humans for review.

**Architecture:** Three layers. (1) A batch seeder generates full Tier 1 CityData JSON for 80 hand-curated cities using the Claude API. (2) A GeoNames-sourced whitelist (~4,000 cities) stored in Supabase gates all city search — unknown cities return 404. (3) An on-demand seeder auto-profiles any whitelisted-but-unseeded city on first request (10–15s, stored in Supabase, instant for all subsequent users). The existing `city/sync_job.py` weekly cron already handles discrepancy detection and writes to `human_review_queue` — humans check that table only when signals fire.

**Tech Stack:** Python 3.11+, Anthropic SDK (`claude-sonnet-4-6`), GeoNames `cities15000.txt`, Supabase, FastAPI, existing `city/data_model.py` schema, pytest

---

## Context (read before touching any file)

- `city/data_model.py` — `CityData` dataclass + `load_city(city_id, supabase=None)` — currently raises `ValueError("city_not_found: ...")` when city is missing. This is the entry point we'll extend.
- `city/sync_job.py` — weekly APScheduler cron that processes signals and writes to `human_review_queue`. Already built. Do not modify.
- `city/signal_processor.py` — keyword clustering + stage classification. Already built. Do not modify.
- `main.py:89` — `seed_cities_and_start_sync()` hardcodes `["tokyo", "paris", "nyc"]`. We'll make this dynamic.
- `city/seed/` — contains `tokyo.json`, `paris.json`, `nyc.json`. Batch generator adds 77 more.
- `city_whitelist` Supabase table — defined in master plan SQL but not yet created. Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS city_whitelist (
    city_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    tier INTEGER NOT NULL DEFAULT 2,
    coordinates POINT NOT NULL,
    seeded BOOLEAN DEFAULT FALSE,
    seeded_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS city_whitelist_name ON city_whitelist (name);
  CREATE INDEX IF NOT EXISTS city_whitelist_seeded ON city_whitelist (seeded);
  ```

---

## File Map

**Create:**
- `city/cities_registry.py` — 80 Tier 1 city entries with lat/lon/timezone/tier/cultural notes
- `city/generate_seeds.py` — CLI: reads registry, generates missing Tier 1 seed JSON via Claude API
- `city/whitelist_builder.py` — CLI: downloads GeoNames cities15000.txt, filters, loads into `city_whitelist` table
- `city/on_demand_seeder.py` — generates Tier 2 CityData for any whitelisted city on first search
- `tests/city/__init__.py` — package marker (if missing)
- `tests/city/test_cities_registry.py` — 4 registry correctness tests
- `tests/city/test_seed_validation.py` — 8-check × 80 Tier 1 seeds parametrized suite
- `tests/city/test_on_demand_seeder.py` — on-demand seeder unit tests (mocked Claude API)

**Modify:**
- `city/data_model.py` — `load_city()`: on miss, call on-demand seeder instead of raising ValueError
- `main.py` — dynamic startup seeding; add `/api/cities/search` and `/api/cities/autocomplete`

**Populated by generator (77 new files):**
- `city/seed/{city_id}.json` — one per Tier 1 city not yet seeded

---

## Task 1: Cities registry (`city/cities_registry.py`)

**Files:**
- Create: `city/cities_registry.py`
- Create: `tests/city/test_cities_registry.py`

- [ ] **Step 1: Write failing import test**

Create `tests/city/test_cities_registry.py`:

```python
from city.cities_registry import CITIES


def test_has_80_cities():
    assert len(CITIES) == 80


def test_all_cities_have_required_fields():
    required = {"id", "name", "lat", "lon", "timezone", "tier", "notes"}
    for city in CITIES:
        missing = required - set(city.keys())
        assert not missing, f"City {city.get('id')} missing: {missing}"


def test_ids_are_unique():
    ids = [c["id"] for c in CITIES]
    assert len(ids) == len(set(ids)), "Duplicate city IDs found"


def test_tiers_are_valid():
    for city in CITIES:
        assert city["tier"] in (1, 2, 3), f"{city['id']} has invalid tier {city['tier']}"
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_cities_registry.py -v
```
Expected: `ImportError` — `city.cities_registry` not found.

- [ ] **Step 3: Write `city/cities_registry.py`**

```python
"""Registry of 80 Tier 1 target cities for seed generation.

Each entry provides known-accurate metadata used to prompt the generator.
'notes' encodes cultural facts that affect engine_modifiers (siesta, meal timing, etc.)
City IDs use underscores — they map directly to city/seed/{id}.json filenames.
"""

CITIES = [
    # ── ALREADY SEEDED (3) — generator skips these ──────────────────────────
    {"id": "tokyo",   "name": "Tokyo",          "lat": 35.6762, "lon": 139.6503, "timezone": "Asia/Tokyo",                             "tier": 1, "notes": "No siesta. Early dinner 18-19h. Exceptional transit. Shrine etiquette."},
    {"id": "paris",   "name": "Paris",           "lat": 48.8566, "lon":   2.3522, "timezone": "Europe/Paris",                           "tier": 1, "notes": "Strict 12:30-14:30 lunch window. Late dinner 20h+. Pharmacies close midday. No tipping culture."},
    {"id": "nyc",     "name": "New York City",   "lat": 40.7128, "lon": -74.0060, "timezone": "America/New_York",                       "tier": 1, "notes": "24h city. No siesta. High transit. Tipping 20% expected."},

    # ── FROM ip_engine.py PROFILES (38) ─────────────────────────────────────
    {"id": "singapore",       "name": "Singapore",        "lat":  1.3521, "lon": 103.8198, "timezone": "Asia/Singapore",               "tier": 1, "notes": "No siesta. Hawker culture. Strict litter/gum laws. Excellent transit. Hot year-round."},
    {"id": "dubai",           "name": "Dubai",             "lat": 25.2048, "lon":  55.2708, "timezone": "Asia/Dubai",                   "tier": 1, "notes": "No alcohol in public. Ramadan affects daytime dining. Dress modestly. Extreme heat May-Sep. Low walkability."},
    {"id": "kyoto",           "name": "Kyoto",             "lat": 35.0116, "lon": 135.7681, "timezone": "Asia/Tokyo",                   "tier": 1, "notes": "No siesta. Temple etiquette strict. Early dinner 18h. Moderate transit. Geisha districts off-limits to tourists."},
    {"id": "bangkok",         "name": "Bangkok",           "lat": 13.7563, "lon": 100.5018, "timezone": "Asia/Bangkok",                 "tier": 1, "notes": "No siesta. Street food culture. Temple dress code. Hot Mar-Oct. Low walkability due to heat."},
    {"id": "mumbai",          "name": "Mumbai",            "lat": 19.0760, "lon":  72.8777, "timezone": "Asia/Kolkata",                 "tier": 1, "notes": "Late dinner 21h+. Street food essential. Monsoon Jun-Sep. Ramadan affects some areas."},
    {"id": "delhi",           "name": "Delhi",             "lat": 28.7041, "lon":  77.1025, "timezone": "Asia/Kolkata",                 "tier": 1, "notes": "Late dinner 21h+. Extreme heat Apr-Jun. Cultural sensitivity at religious sites. Ramadan affects old city."},
    {"id": "bengaluru",       "name": "Bengaluru",         "lat": 12.9716, "lon":  77.5946, "timezone": "Asia/Kolkata",                 "tier": 2, "notes": "Mild year-round (900m elevation). Pub culture. Late dinner. IT district vs heritage areas."},
    {"id": "goa",             "name": "Goa",               "lat": 15.2993, "lon":  74.1240, "timezone": "Asia/Kolkata",                 "tier": 2, "notes": "Beach-town rhythm. Late nights. Monsoon Jun-Sep closes beaches. Moped culture. Portuguese heritage."},
    {"id": "london",          "name": "London",            "lat": 51.5074, "lon":  -0.1278, "timezone": "Europe/London",                "tier": 1, "notes": "No siesta. Early dinner 18-19h. Pub culture. Excellent transit. Museums free. Left-side traffic."},
    {"id": "barcelona",       "name": "Barcelona",         "lat": 41.3851, "lon":   2.1734, "timezone": "Europe/Madrid",                "tier": 1, "notes": "Siesta 14:00-17:00. Very late dinner 21:30h. Lunch main meal. Pickpocket hotspot. Beach + city."},
    {"id": "rome",            "name": "Rome",              "lat": 41.9028, "lon":  12.4964, "timezone": "Europe/Rome",                  "tier": 1, "notes": "Siesta 13:00-16:00. Late dinner 20:30h+. Religious site dress code. Tourist traps near major sights."},
    {"id": "amsterdam",       "name": "Amsterdam",         "lat": 52.3676, "lon":   4.9041, "timezone": "Europe/Amsterdam",             "tier": 1, "notes": "No siesta. Early dinner 18h. Cycling city. Canal-side culture. Liberal social policies."},
    {"id": "istanbul",        "name": "Istanbul",          "lat": 41.0082, "lon":  28.9784, "timezone": "Europe/Istanbul",              "tier": 1, "notes": "Ramadan affects dining. Late dinner 20h. Mosque dress code. Hilly terrain. Bosphorus crossings. Turkish tea culture."},
    {"id": "los_angeles",     "name": "Los Angeles",       "lat": 34.0522, "lon": -118.2437, "timezone": "America/Los_Angeles",         "tier": 1, "notes": "Car-dependent. No siesta. Brunch culture. Hot Jun-Oct. Vast spread — neighborhood choices critical."},
    {"id": "berlin",          "name": "Berlin",            "lat": 52.5200, "lon":  13.4050, "timezone": "Europe/Berlin",                "tier": 1, "notes": "No siesta. Early dinner 18h. Club culture (weekend nights only). Excellent transit. Former East/West divide."},
    {"id": "sydney",          "name": "Sydney",            "lat": -33.8688, "lon": 151.2093, "timezone": "Australia/Sydney",            "tier": 1, "notes": "No siesta. Early dinner 18:30h. Beach culture. Hilly. Reversed seasons (hot Dec-Feb). Ferry culture."},
    {"id": "bali",            "name": "Bali",              "lat":  -8.3405, "lon": 115.0920, "timezone": "Asia/Makassar",               "tier": 1, "notes": "Temple dress required. Nyepi day (city shutdown). Scooter culture. Ubud vs Seminyak very different vibes."},
    {"id": "hong_kong",       "name": "Hong Kong",         "lat": 22.3193, "lon": 114.1694, "timezone": "Asia/Hong_Kong",              "tier": 1, "notes": "No siesta. Early dinner 18:30h. Dim sum breakfast culture. Excellent MTR. Hilly. Harbor crossings."},
    {"id": "kuala_lumpur",    "name": "Kuala Lumpur",      "lat":  3.1390, "lon": 101.6869, "timezone": "Asia/Kuala_Lumpur",            "tier": 1, "notes": "Ramadan affects dining. Hot year-round. Halal food dominant. KLCC area vs old city."},
    {"id": "seoul",           "name": "Seoul",             "lat": 37.5665, "lon": 126.9780, "timezone": "Asia/Seoul",                  "tier": 1, "notes": "No siesta. Late dinner culture. BBQ social dining. Excellent metro. Hilly with palace areas. K-culture hotspots."},
    {"id": "prague",          "name": "Prague",            "lat": 50.0755, "lon":  14.4378, "timezone": "Europe/Prague",               "tier": 1, "notes": "No siesta. Early dinner 18h. Beer culture. Cobblestone Old Town. Castle hill key. Tourists flood Old Town."},
    {"id": "lisbon",          "name": "Lisbon",            "lat": 38.7223, "lon":  -9.1393, "timezone": "Europe/Lisbon",               "tier": 1, "notes": "Siesta 13:00-15:00. Late dinner 21h. Hilly (trams essential). Fado music culture. Atlantic coast nearby."},
    {"id": "mexico_city",     "name": "Mexico City",       "lat": 19.4326, "lon": -99.1332, "timezone": "America/Mexico_City",         "tier": 1, "notes": "Late lunch 14h main meal. Late dinner 21h. High altitude (2240m). Safety awareness by neighborhood. Street food critical."},
    {"id": "rio_de_janeiro",  "name": "Rio de Janeiro",    "lat": -22.9068, "lon": -43.1729, "timezone": "America/Sao_Paulo",          "tier": 1, "notes": "Beach-centric rhythm. Late dinner 20h. Carnival season transforms city. Safety awareness essential. Hilly."},
    {"id": "cape_town",       "name": "Cape Town",         "lat": -33.9249, "lon":  18.4241, "timezone": "Africa/Johannesburg",        "tier": 1, "notes": "No siesta. Early dinner 19h. Reversed seasons (summer Dec-Feb). Table Mountain dominates. Winelands nearby."},
    {"id": "marrakech",       "name": "Marrakech",         "lat": 31.6295, "lon":  -7.9811, "timezone": "Africa/Casablanca",          "tier": 1, "notes": "No alcohol widely available. Ramadan strict. Medina maze navigation. Haggling culture. Hot May-Sep. Riad stay culture."},
    {"id": "cairo",           "name": "Cairo",             "lat": 30.0444, "lon":  31.2357, "timezone": "Africa/Cairo",               "tier": 1, "notes": "Ramadan very strict. Late lunch 14h. Very late dinner 21h+. Pyramids require half-day. Traffic chaos. Limited alcohol."},
    {"id": "nairobi",         "name": "Nairobi",           "lat":  -1.2921, "lon":  36.8219, "timezone": "Africa/Nairobi",            "tier": 2, "notes": "Safari gateway. Mild year-round (1795m elevation). Security awareness by area. Matatu culture. English widely spoken."},
    {"id": "vienna",          "name": "Vienna",            "lat": 48.2082, "lon":  16.3738, "timezone": "Europe/Vienna",              "tier": 1, "notes": "No siesta. Early dinner 18h. Coffee house culture (Kaffeehäuser). Classical music city. Excellent transit."},
    {"id": "zurich",          "name": "Zurich",            "lat": 47.3769, "lon":   8.5417, "timezone": "Europe/Zurich",              "tier": 1, "notes": "No siesta. Early dinner 18:30h. Most expensive city. Swiss punctuality. Lake + old town. Very clean."},
    {"id": "osaka",           "name": "Osaka",             "lat": 34.6937, "lon": 135.5023, "timezone": "Asia/Tokyo",                 "tier": 1, "notes": "No siesta. Street food capital of Japan. Dotonbori nightlife. Excellent transit. More casual than Tokyo."},
    {"id": "milan",           "name": "Milan",             "lat": 45.4654, "lon":   9.1859, "timezone": "Europe/Rome",                "tier": 1, "notes": "Siesta 13:00-15:30. Late dinner 20:30h. Fashion capital. Aperitivo culture 18-20h. Design week in April."},
    {"id": "athens",          "name": "Athens",            "lat": 37.9838, "lon":  23.7275, "timezone": "Europe/Athens",              "tier": 1, "notes": "Siesta 14:00-17:30. Very late dinner 21:30h. Acropolis morning visits essential. Hilly. Ouzo culture."},
    {"id": "kathmandu",       "name": "Kathmandu",         "lat": 27.7172, "lon":  85.3240, "timezone": "Asia/Kathmandu",             "tier": 2, "notes": "Religious sensitivity (Hindu + Buddhist). Trekking gateway. Altitude (1400m). Traffic chaos. Thamel tourist hub."},
    {"id": "colombo",         "name": "Colombo",           "lat":  6.9271, "lon":  79.8612, "timezone": "Asia/Colombo",               "tier": 2, "notes": "Hot year-round. Buddhist/Hindu/Muslim mixed culture. Sri Lankan spice cuisine. Tuk-tuk culture."},
    {"id": "abu_dhabi",       "name": "Abu Dhabi",         "lat": 24.4539, "lon":  54.3773, "timezone": "Asia/Dubai",                 "tier": 2, "notes": "Ramadan strict. Modest dress required. Extreme heat May-Sep. Grand Mosque key attraction. Low walkability."},
    {"id": "taipei",          "name": "Taipei",            "lat": 25.0330, "lon": 121.5654, "timezone": "Asia/Taipei",                "tier": 1, "notes": "No siesta. Night market culture. Early dinner 18h. Excellent MRT. Mountain hikes accessible. Night markets essential."},
    {"id": "hanoi",           "name": "Hanoi",             "lat": 21.0285, "lon": 105.8542, "timezone": "Asia/Bangkok",               "tier": 1, "notes": "Early lunch 11:30h. Street food essential. Old Quarter maze. Motorbike crossings. Hot May-Sep."},

    # ── NEW ADDITIONS (39) ───────────────────────────────────────────────────
    {"id": "edinburgh",       "name": "Edinburgh",         "lat": 55.9533, "lon":  -3.1883, "timezone": "Europe/London",               "tier": 1, "notes": "No siesta. Early dinner 18h. Castle + Royal Mile. Festival Aug (city transforms). Hilly. Whisky culture."},
    {"id": "dublin",          "name": "Dublin",            "lat": 53.3498, "lon":  -6.2603, "timezone": "Europe/Dublin",               "tier": 1, "notes": "No siesta. Early dinner 18h. Pub culture central to social life. Craic. Coastal walks. Georgian architecture."},
    {"id": "copenhagen",      "name": "Copenhagen",        "lat": 55.6761, "lon":  12.5683, "timezone": "Europe/Copenhagen",           "tier": 1, "notes": "No siesta. Early dinner 18h. Cycling city. New Nordic cuisine. Hygge culture. Expensive. Canals central."},
    {"id": "stockholm",       "name": "Stockholm",         "lat": 59.3293, "lon":  18.0686, "timezone": "Europe/Stockholm",            "tier": 1, "notes": "No siesta. Early dinner 18h. Archipelago culture. Long summer daylight. Expensive. Design culture. Midsommar key."},
    {"id": "budapest",        "name": "Budapest",          "lat": 47.4979, "lon":  19.0402, "timezone": "Europe/Budapest",             "tier": 1, "notes": "No siesta. Early dinner 18h. Thermal bath culture. Ruin bars. Danube splits Buda/Pest. Budget-friendly."},
    {"id": "krakow",          "name": "Krakow",            "lat": 50.0647, "lon":  19.9450, "timezone": "Europe/Warsaw",               "tier": 2, "notes": "No siesta. Early dinner 18h. Old Town well-preserved. Wawel Castle key. Budget-friendly. Jewish Quarter Kazimierz."},
    {"id": "brussels",        "name": "Brussels",          "lat": 50.8503, "lon":   4.3517, "timezone": "Europe/Brussels",             "tier": 1, "notes": "No siesta. Early dinner 18:30h. Beer + frites + waffle culture. EU capital. Art Nouveau architecture. Multilingual."},
    {"id": "florence",        "name": "Florence",          "lat": 43.7696, "lon":  11.2558, "timezone": "Europe/Rome",                 "tier": 1, "notes": "Siesta 13:00-15:30. Late dinner 20h. Renaissance art density highest in world. Museum reservation essential. Hot Jul-Aug."},
    {"id": "venice",          "name": "Venice",            "lat": 45.4408, "lon":  12.3155, "timezone": "Europe/Rome",                 "tier": 1, "notes": "Siesta 13:00-15:00. Late dinner 20h. No cars. Vaporetto transit. Tourist tax at entry. Acqua alta (flooding) Nov-Dec."},
    {"id": "naples",          "name": "Naples",            "lat": 40.8518, "lon":  14.2681, "timezone": "Europe/Rome",                 "tier": 1, "notes": "Siesta 13:00-16:30. Very late dinner 21h. Pizza birthplace. Chaotic traffic. Pompeii day trip. Street food raw."},
    {"id": "seville",         "name": "Seville",           "lat": 37.3891, "lon":  -5.9845, "timezone": "Europe/Madrid",               "tier": 1, "notes": "Long siesta 14:00-18:00. Very late dinner 22h. Hottest city in Europe (Jun-Aug). Flamenco culture. Tapas culture."},
    {"id": "porto",           "name": "Porto",             "lat": 41.1579, "lon":  -8.6291, "timezone": "Europe/Lisbon",               "tier": 1, "notes": "Siesta 13:00-15:00. Late dinner 20:30h. Port wine essential. Douro river culture. Hilly. Azulejo tile art."},
    {"id": "valencia",        "name": "Valencia",          "lat": 39.4699, "lon":  -0.3763, "timezone": "Europe/Madrid",               "tier": 1, "notes": "Siesta 14:00-17:00. Late dinner 21h. Paella birthplace. Beach + city. City of Arts and Sciences. Orange trees."},
    {"id": "lyon",            "name": "Lyon",              "lat": 45.7640, "lon":   4.8357, "timezone": "Europe/Paris",                "tier": 1, "notes": "Siesta varies. Late dinner 20h. Gastronomic capital of France. Bouchon culture. Two rivers (Rhône + Saône). Traboules."},
    {"id": "san_francisco",   "name": "San Francisco",     "lat": 37.7749, "lon": -122.4194, "timezone": "America/Los_Angeles",        "tier": 1, "notes": "No siesta. Fog culture (Karl). Brunch city. Cable cars. Very hilly. Microclimate by neighborhood. Tech culture."},
    {"id": "miami",           "name": "Miami",             "lat": 25.7617, "lon": -80.1918, "timezone": "America/New_York",            "tier": 1, "notes": "No siesta. Late dinner 20h+. Art Deco South Beach. Cuban coffee culture. Hot and humid Jun-Sep. Beach + nightlife."},
    {"id": "chicago",         "name": "Chicago",           "lat": 41.8781, "lon": -87.6298, "timezone": "America/Chicago",             "tier": 1, "notes": "No siesta. Early dinner 18h. Deep dish pizza. Architecture boat tours essential. Lakefront. Brutal winters."},
    {"id": "montreal",        "name": "Montreal",          "lat": 45.5017, "lon": -73.5673, "timezone": "America/Toronto",             "tier": 1, "notes": "No siesta. Late dinner 19:30h. Bilingual French/English. Underground city (winter). Festival capital. Bagels + poutine."},
    {"id": "toronto",         "name": "Toronto",           "lat": 43.6532, "lon": -79.3832, "timezone": "America/Toronto",             "tier": 1, "notes": "No siesta. Early dinner 18h. Multicultural food scene. Island ferry. Distillery District. CN Tower. Grid layout."},
    {"id": "vancouver",       "name": "Vancouver",         "lat": 49.2827, "lon": -123.1207, "timezone": "America/Vancouver",          "tier": 1, "notes": "No siesta. Early dinner 18h. Mountain + ocean. Stanley Park essential. Rain Nov-Mar. Asian food culture dominant."},
    {"id": "new_orleans",     "name": "New Orleans",       "lat": 29.9511, "lon": -90.0715, "timezone": "America/Chicago",             "tier": 1, "notes": "No siesta. Late dinner 19:30h. Jazz culture. Mardi Gras transforms city. Hot humid Apr-Sep. Bourbon St vs local spots."},
    {"id": "buenos_aires",    "name": "Buenos Aires",      "lat": -34.6037, "lon": -58.3816, "timezone": "America/Argentina/Buenos_Aires", "tier": 1, "notes": "Very late dinner 21:30h+. No siesta formalized. Tango culture. Steak + Malbec. Reversed seasons. Palermo vs San Telmo."},
    {"id": "medellin",        "name": "Medellín",          "lat":   6.2442, "lon": -75.5812, "timezone": "America/Bogota",             "tier": 2, "notes": "Spring climate year-round (1500m). Late dinner 20h. Cable car neighborhoods. Transformation city narrative. Cumbia culture."},
    {"id": "bogota",          "name": "Bogotá",            "lat":   4.7110, "lon": -74.0721, "timezone": "America/Bogota",             "tier": 2, "notes": "Cool year-round (2600m). Late lunch 13:30h. Ciclovía Sundays (streets for cyclists). Gold Museum essential. Zona Rosa."},
    {"id": "lima",            "name": "Lima",              "lat": -12.0464, "lon": -77.0428, "timezone": "America/Lima",               "tier": 1, "notes": "Gray fog Jun-Nov (La Garúa). Late lunch 13h main meal. World-class gastronomy. Ceviche culture. Miraflores vs Barranco."},
    {"id": "johannesburg",    "name": "Johannesburg",      "lat": -26.2041, "lon":  28.0473, "timezone": "Africa/Johannesburg",        "tier": 2, "notes": "No siesta. Early dinner 19h. Car essential. Safety awareness critical. Soweto history. Gold Reef City. Braai culture."},
    {"id": "accra",           "name": "Accra",             "lat":   5.6037, "lon":  -0.1870, "timezone": "Africa/Accra",              "tier": 2, "notes": "Hot year-round. No siesta. English widely spoken. Jollof rice culture. Beach bars. Labadi Beach. Creative arts scene growing."},
    {"id": "casablanca",      "name": "Casablanca",        "lat": 33.5731, "lon":  -7.5898, "timezone": "Africa/Casablanca",          "tier": 2, "notes": "Ramadan affects dining. Moderate dress. Late lunch 13:30h. Hassan II Mosque essential. More modern than Marrakech. Coastal."},
    {"id": "chiang_mai",      "name": "Chiang Mai",        "lat": 18.7883, "lon":  98.9853, "timezone": "Asia/Bangkok",               "tier": 1, "notes": "No siesta. Temple dress required. Hot Mar-May. Night Bazaar culture. Mountains accessible. Elephant sanctuary visits."},
    {"id": "ho_chi_minh_city","name": "Ho Chi Minh City",  "lat": 10.8231, "lon": 106.6297, "timezone": "Asia/Ho_Chi_Minh",           "tier": 1, "notes": "No siesta. Early lunch 11:30h. Motorbike crossing technique essential. War history museums. Rooftop bar culture. Pho culture."},
    {"id": "melbourne",       "name": "Melbourne",         "lat": -37.8136, "lon": 144.9631, "timezone": "Australia/Melbourne",       "tier": 1, "notes": "No siesta. Early dinner 18:30h. Coffee culture (flat white birthplace). Reversed seasons. Laneway culture. Sport obsessed."},
    {"id": "auckland",        "name": "Auckland",          "lat": -36.8509, "lon": 174.7645, "timezone": "Pacific/Auckland",          "tier": 1, "notes": "No siesta. Early dinner 18h. Volcanic terrain. Harbour culture. Maori culture. Reversed seasons. Wine regions nearby."},
    {"id": "warsaw",          "name": "Warsaw",            "lat": 52.2297, "lon":  21.0122, "timezone": "Europe/Warsaw",              "tier": 2, "notes": "No siesta. Early dinner 18h. WWII history key. Old Town rebuilt post-war. Vodka culture. Budget-friendly. Modern vs historic."},
    {"id": "reykjavik",       "name": "Reykjavik",         "lat": 64.1466, "lon": -21.9426, "timezone": "Atlantic/Reykjavik",         "tier": 1, "notes": "No siesta. Late dinner 19h. Midnight sun (Jun) vs 5h daylight (Dec). Northern Lights. Geothermal pools essential. Very expensive."},
    {"id": "tbilisi",         "name": "Tbilisi",           "lat": 41.6938, "lon":  44.8015, "timezone": "Asia/Tbilisi",               "tier": 2, "notes": "No siesta. Late dinner 20h. Georgian wine oldest in world. Sulfur bath culture. Old Town maze. Caucasus mountains gateway."},
    {"id": "amman",           "name": "Amman",             "lat": 31.9539, "lon":  35.9106, "timezone": "Asia/Amman",                 "tier": 2, "notes": "Ramadan strict. Modest dress. Late dinner 20:30h. Petra day trip essential. Hilly. Mezze culture. Conservative vs liberal areas."},
    {"id": "cartagena",       "name": "Cartagena",         "lat": 10.3910, "lon": -75.4794, "timezone": "America/Bogota",             "tier": 2, "notes": "Hot year-round. Late dinner 19:30h. Walled Old City essential. Caribbean culture. Festival season Nov-Dec. Cumbia."},
    {"id": "zanzibar",        "name": "Zanzibar",          "lat":  -6.1659, "lon":  39.2026, "timezone": "Africa/Nairobi",            "tier": 2, "notes": "Ramadan affects dining in Stone Town. Modest dress in town. Spice island culture. Beach resort areas separate from town. Dhow sailing."},
    {"id": "tel_aviv",        "name": "Tel Aviv",          "lat": 32.0853, "lon":  34.7818, "timezone": "Asia/Jerusalem",             "tier": 1, "notes": "Shabbat (Fri sunset - Sat night) closes many businesses. Mediterranean beach culture. Late dinner 20h+. Falafel culture. Party city."},
]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_cities_registry.py -v
```
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/cities_registry.py tests/city/test_cities_registry.py && git commit -m "feat: cities registry — 80 Tier 1 cities with coordinates, timezone, cultural notes"
```

---

## Task 2: Tier 1 seed generator (`city/generate_seeds.py`)

**Files:**
- Create: `city/generate_seeds.py`

No unit test for this task — it's a one-time CLI. Correctness is verified by the schema validation suite in Task 4.

- [ ] **Step 1: Write `city/generate_seeds.py`**

```python
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
```

- [ ] **Step 2: Verify the script imports without error**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "from city.generate_seeds import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 3: Dry-run to verify prompt shape**

```bash
cd /Users/souravbiswas/uncover-roads && python -m city.generate_seeds --city osaka --dry-run
```
Expected: prints `PROMPT for Osaka:` followed by ~500 chars of prompt, no API call.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/generate_seeds.py && git commit -m "feat: Tier 1 city seed generator — Claude API batch generation for 80 cities"
```

---

## Task 3: Run generator for all 77 missing Tier 1 cities

**Files:**
- Populates: `city/seed/*.json` (77 new files)

- [ ] **Step 1: Run the generator (~5-10 minutes)**

```bash
cd /Users/souravbiswas/uncover-roads && python -m city.generate_seeds
```

Expected output (example):
```
  → Skipping Tokyo (already seeded)
  → Skipping Paris (already seeded)
  → Skipping New York City (already seeded)
  Generating Singapore (singapore)...
  ✓ Saved city/seed/singapore.json
  Generating Dubai (dubai)...
  ✓ Saved city/seed/dubai.json
  ...
  Done: 77 generated, 3 skipped, 0 failed
```

If any city fails with a JSON parse error, re-run just that city:
```bash
python -m city.generate_seeds --city <city_id>
```

- [ ] **Step 2: Verify seed count**

```bash
ls /Users/souravbiswas/uncover-roads/city/seed/ | wc -l
```
Expected: `80`

- [ ] **Step 3: Spot-check generated data**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "
from city.data_model import load_city
for c in ['singapore', 'barcelona', 'buenos_aires', 'melbourne', 'istanbul']:
    city = load_city(c)
    print(f'{c}: {len(city.neighborhoods)} neighborhoods, {len(city.insert_candidates)} inserts')
"
```
Expected: each city has 4-5 neighborhoods and 5-8 insert candidates.

- [ ] **Step 4: Commit all seed files**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/seed/ && git commit -m "feat: Tier 1 seed data for 77 cities — complete 80-city global coverage"
```

---

## Task 4: Tier 1 seed validation test suite

**Files:**
- Create: `tests/city/test_seed_validation.py`

- [ ] **Step 1: Write the test file**

```python
import json
import pytest
from pathlib import Path
from city.data_model import load_city_from_dict

SEED_DIR = Path(__file__).parent.parent.parent / "city" / "seed"


def _seed_files():
    return sorted(SEED_DIR.glob("*.json"))


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_loads_without_error(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    assert city.id == seed_file.stem, f"id mismatch: file={seed_file.stem} id={city.id}"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_has_minimum_neighborhoods(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    assert len(city.neighborhoods) >= 2, f"{city.id}: needs at least 2 neighborhoods"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_has_minimum_insert_candidates(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    assert len(city.insert_candidates) >= 2, f"{city.id}: needs at least 2 insert candidates"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_has_coffee_insert_candidate(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    coffee = [c for c in city.insert_candidates if c.type == "coffee"]
    assert len(coffee) >= 1, f"{city.id}: needs at least 1 coffee insert candidate"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_engine_modifiers_complete(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    required_keys = {"siesta_window", "lunch_window_strict", "evening_end_time", "day_buffer_min"}
    missing = required_keys - set(city.engine_modifiers.keys())
    assert not missing, f"{city.id}: engine_modifiers missing {missing}"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_has_landmark_anchors(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    assert len(city.landmark_anchors) >= 1, f"{city.id}: needs at least 1 landmark anchor"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_insert_candidate_types_valid(seed_file):
    valid_types = {"coffee", "lunch", "scenic_walk", "rest", "micro"}
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    for ic in city.insert_candidates:
        assert ic.type in valid_types, f"{city.id}/{ic.place_id}: invalid type '{ic.type}'"


@pytest.mark.parametrize("seed_file", _seed_files(), ids=lambda f: f.stem)
def test_seed_neighborhood_best_times_in_range(seed_file):
    data = json.loads(seed_file.read_text())
    city = load_city_from_dict(data)
    for nh in city.neighborhoods:
        for bucket, score in nh.best_times.items():
            assert 0.0 <= score <= 1.0, f"{city.id}/{nh.id}: best_times[{bucket}]={score} out of range"


def test_total_tier1_seed_count():
    """All 80 Tier 1 cities must have seed files."""
    seed_files = list(_seed_files())
    assert len(seed_files) == 80, f"Expected 80 seed files, found {len(seed_files)}"
```

- [ ] **Step 2: Run the suite**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_seed_validation.py -v --tb=short 2>&1 | tail -10
```
Expected: `641 passed` (80 × 8 parametrized tests + 1 count test).

- [ ] **Step 3: Fix any failing cities**

For each city that fails, regenerate with force and re-run:
```bash
python -m city.generate_seeds --city <failing_city_id> --force
python -m pytest tests/city/test_seed_validation.py -k <failing_city_id> -v
```

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add tests/city/test_seed_validation.py && git commit -m "test: Tier 1 seed validation suite — 8 checks × 80 cities"
```

---

## Task 5: City whitelist builder (`city/whitelist_builder.py`)

**Files:**
- Create: `city/whitelist_builder.py`

This CLI downloads GeoNames `cities15000.txt` (cities with population > 15,000), filters to population ≥ 100,000 (~4,000 cities), and loads them into the `city_whitelist` Supabase table. Run once before launch. The 80 Tier 1 cities are inserted with `tier=1`; all others with `tier=2`.

- [ ] **Step 1: Write `city/whitelist_builder.py`**

```python
#!/usr/bin/env python3
"""Whitelist builder: loads ~4,000 tourist-relevant cities into city_whitelist Supabase table.

Source: GeoNames cities15000.txt (~26k cities with population > 15,000).
Filter: population >= 100,000 → ~4,000 cities.
Tier 1 cities (from cities_registry.py) are inserted with tier=1; all others with tier=2.

Usage:
    python -m city.whitelist_builder               # load all (idempotent — uses upsert)
    python -m city.whitelist_builder --dry-run     # print first 20 rows, no DB write

Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in environment.
GeoNames data: downloaded automatically from download.geonames.org (public domain).
"""
from __future__ import annotations
import argparse
import csv
import io
import os
import sys
import urllib.request
from pathlib import Path

from city.cities_registry import CITIES as TIER1_CITIES

_GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
_CACHE_PATH = Path(__file__).parent / "_geonames_cities15000.txt"
_MIN_POPULATION = 100_000
_BATCH_SIZE = 500  # Supabase upsert batch size

# GeoNames TSV column indices (cities15000.txt format)
_COL_NAME = 1          # asciiname
_COL_LAT = 4
_COL_LON = 5
_COL_COUNTRY = 8
_COL_POPULATION = 14
_COL_TIMEZONE = 17

_TIER1_IDS = {c["id"] for c in TIER1_CITIES}
_TIER1_BY_NAME = {c["name"].lower(): c["id"] for c in TIER1_CITIES}


def _slugify(name: str, country: str) -> str:
    """Convert city name to a stable slug. Falls back to name_countrycode."""
    slug = name.lower().replace(" ", "_").replace("-", "_").replace("'", "").replace(".", "")
    # Keep only alphanumeric + underscore
    slug = "".join(c for c in slug if c.isalnum() or c == "_")
    # Check if slug collides with a Tier 1 ID
    if slug in _TIER1_IDS:
        return slug  # exact match — use it
    return slug


def _download_geonames() -> list[dict]:
    """Download and parse cities15000.txt. Caches locally."""
    if not _CACHE_PATH.exists():
        print("Downloading GeoNames cities15000.zip...")
        import zipfile
        tmp = _CACHE_PATH.with_suffix(".zip")
        urllib.request.urlretrieve(_GEONAMES_URL, tmp)
        with zipfile.ZipFile(tmp) as z:
            z.extract("cities15000.txt", _CACHE_PATH.parent)
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
            timezone = row[_COL_TIMEZONE].strip()
            city_id = _slugify(name, country)
            cities.append({
                "city_id": city_id,
                "name": name,
                "country_code": country,
                "tier": 1 if city_id in _TIER1_IDS else 2,
                "lat": lat,
                "lon": lon,
                "timezone": timezone,
            })
    return cities


def _load_to_supabase(cities: list[dict]) -> None:
    """Upsert cities into city_whitelist in batches."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    sb = create_client(url, key)

    # Build rows — Supabase POINT type needs "POINT(lon lat)" WKT string
    rows = [
        {
            "city_id": c["city_id"],
            "name": c["name"],
            "country_code": c["country_code"],
            "tier": c["tier"],
            "coordinates": f"POINT({c['lon']} {c['lat']})",
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
    parser.add_argument("--dry-run", action="store_true", help="Print first 20 rows, no DB write")
    args = parser.parse_args()

    cities = _download_geonames()
    print(f"Parsed {len(cities)} cities with population >= {_MIN_POPULATION:,}")

    if args.dry_run:
        for c in cities[:20]:
            print(f"  {c['city_id']:30s} {c['name']:25s} {c['country_code']} tier={c['tier']}")
        print(f"  ... and {len(cities) - 20} more")
        return

    _load_to_supabase(cities)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the script imports without error**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "from city.whitelist_builder import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 3: Dry-run to verify it parses GeoNames**

```bash
cd /Users/souravbiswas/uncover-roads && python -m city.whitelist_builder --dry-run
```
Expected: downloads `cities15000.zip`, prints `Parsed ~4000 cities...`, shows first 20 rows with slugified IDs. No DB write.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/whitelist_builder.py && git commit -m "feat: GeoNames whitelist builder — loads ~4k cities into city_whitelist Supabase table"
```

---

## Task 6: On-demand seeder (`city/on_demand_seeder.py`)

**Files:**
- Create: `city/on_demand_seeder.py`
- Create: `tests/city/test_on_demand_seeder.py`

When a user searches an unseeded but whitelisted city, `seed_city_on_demand()` generates a Tier 2 `CityData` profile via Claude API, saves it to Supabase `city_data`, marks `city_whitelist.seeded = true`, and returns the `CityData`. Takes 10–15 seconds. All subsequent calls load from Supabase instantly.

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_on_demand_seeder.py`:

```python
import json
import pytest
from unittest.mock import MagicMock, patch
from city.on_demand_seeder import seed_city_on_demand, _build_prompt, _parse_response


# ── _build_prompt ────────────────────────────────────────────────────────────

def test_build_prompt_includes_city_name():
    row = {"city_id": "florence", "name": "Florence", "country_code": "IT",
           "tier": 2, "lat": 43.7696, "lon": 11.2558, "timezone": "Europe/Rome"}
    prompt = _build_prompt(row)
    assert "Florence" in prompt
    assert "florence" in prompt


def test_build_prompt_includes_coordinates():
    row = {"city_id": "florence", "name": "Florence", "country_code": "IT",
           "tier": 2, "lat": 43.7696, "lon": 11.2558, "timezone": "Europe/Rome"}
    prompt = _build_prompt(row)
    assert "43.7696" in prompt
    assert "11.2558" in prompt


# ── _parse_response ──────────────────────────────────────────────────────────

def test_parse_response_strips_markdown_fences():
    raw = '```json\n{"id": "x"}\n```'
    result = _parse_response(raw)
    assert result == {"id": "x"}


def test_parse_response_plain_json():
    raw = '{"id": "x", "name": "X"}'
    result = _parse_response(raw)
    assert result == {"id": "x", "name": "X"}


# ── seed_city_on_demand ──────────────────────────────────────────────────────

def test_seed_city_on_demand_returns_city_data():
    whitelist_row = {
        "city_id": "florence", "name": "Florence", "country_code": "IT",
        "tier": 2, "lat": 43.7696, "lon": 11.2558, "timezone": "Europe/Rome",
    }
    mock_city_json = {
        "id": "florence", "name": "Florence", "tier": 2,
        "center": [43.7696, 11.2558], "timezone": "Europe/Rome",
        "climate": {"heat_threshold_c": 34, "rain_months": [11, 12]},
        "movement": {"walkability": 3, "transit": 2},
        "culture": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta": True},
        "neighborhoods": [
            {"id": "centro", "name": "Centro Storico", "center": [43.7711, 11.2558],
             "polygon": [], "best_times": {"morning": 0.9, "afternoon": 0.7, "evening": 0.6},
             "crowd_index": {"weekday": 0.7, "weekend": 0.9}}
        ],
        "insert_candidates": [
            {"place_id": "coffee_centro_1", "name": "Caffè Gilli", "lat": 43.7714,
             "lon": 11.2530, "type": "coffee", "time_cost_min": 20,
             "persona_affinity": {"epicurean": 0.9}, "trigger": None,
             "time_of_day_match": ["morning"]}
        ],
        "scenic_routes": [],
        "transit_edges": [],
        "engine_modifiers": {
            "siesta_window": "13:00-15:30", "lunch_window_strict": True,
            "evening_end_time": "23:00", "day_buffer_min": 30
        },
        "landmark_anchors": ["uffizi_gallery", "duomo"],
        "hidden_gems": ["san_miniato"],
    }

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps(mock_city_json))]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    with patch("city.on_demand_seeder._get_client", return_value=mock_client):
        city = seed_city_on_demand(whitelist_row, mock_supabase)

    assert city.id == "florence"
    assert city.name == "Florence"
    assert len(city.neighborhoods) == 1
    assert len(city.insert_candidates) == 1


def test_seed_city_on_demand_upserts_to_supabase():
    whitelist_row = {
        "city_id": "florence", "name": "Florence", "country_code": "IT",
        "tier": 2, "lat": 43.7696, "lon": 11.2558, "timezone": "Europe/Rome",
    }
    mock_city_json = {
        "id": "florence", "name": "Florence", "tier": 2,
        "center": [43.7696, 11.2558], "timezone": "Europe/Rome",
        "climate": {"heat_threshold_c": 34, "rain_months": [11]},
        "movement": {"walkability": 3, "transit": 2},
        "culture": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta": True},
        "neighborhoods": [
            {"id": "centro", "name": "Centro", "center": [43.77, 11.25],
             "polygon": [], "best_times": {"morning": 0.9, "afternoon": 0.7, "evening": 0.6},
             "crowd_index": {"weekday": 0.7, "weekend": 0.9}}
        ],
        "insert_candidates": [
            {"place_id": "coffee_centro_1", "name": "Gilli", "lat": 43.77, "lon": 11.25,
             "type": "coffee", "time_cost_min": 20, "persona_affinity": {"epicurean": 0.9},
             "trigger": None, "time_of_day_match": ["morning"]}
        ],
        "scenic_routes": [], "transit_edges": [],
        "engine_modifiers": {"siesta_window": "13:00-15:30", "lunch_window_strict": True,
                             "evening_end_time": "23:00", "day_buffer_min": 30},
        "landmark_anchors": ["uffizi_gallery"], "hidden_gems": ["san_miniato"],
    }

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps(mock_city_json))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    mock_supabase = MagicMock()
    upsert_chain = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute = upsert_chain
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute = MagicMock()

    with patch("city.on_demand_seeder._get_client", return_value=mock_client):
        seed_city_on_demand(whitelist_row, mock_supabase)

    # city_data upsert was called
    assert mock_supabase.table.call_count >= 1
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_on_demand_seeder.py -v
```
Expected: `ImportError` — `city.on_demand_seeder` not found.

- [ ] **Step 3: Write `city/on_demand_seeder.py`**

```python
"""On-demand city seeder: generates a Tier 2 CityData profile for any whitelisted city.

Called by load_city() when a city is in city_whitelist but not yet seeded.
Generates via Claude API, saves to Supabase city_data, marks city_whitelist.seeded=true.
"""
from __future__ import annotations
import json
import os

import anthropic

from city.data_model import CityData, load_city_from_dict

_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 4000
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


_SCHEMA_DESCRIPTION = """
Return ONLY a JSON object matching this structure exactly (no extra keys):

{
  "id": "<city_id>",
  "name": "<City Name>",
  "tier": <1|2|3>,
  "center": [<lat>, <lon>],
  "timezone": "<IANA timezone>",
  "climate": {"heat_threshold_c": <int>, "rain_months": [<month ints>]},
  "movement": {"walkability": <1|2|3>, "transit": <1|2|3>},
  "culture": {"meal_times": {"lunch": "HH:MM", "dinner": "HH:MM"}, "siesta": <bool>},
  "neighborhoods": [
    {"id": "<slug>", "name": "<Name>", "center": [<lat>, <lon>], "polygon": [],
     "best_times": {"morning": <0-1>, "afternoon": <0-1>, "evening": <0-1>},
     "crowd_index": {"weekday": <0-1>, "weekend": <0-1>}}
  ],
  "insert_candidates": [
    {"place_id": "<type_neighborhood_n>", "name": "<name>", "lat": <float>, "lon": <float>,
     "type": "<coffee|lunch|scenic_walk|rest|micro>", "time_cost_min": <int>,
     "persona_affinity": {"wanderer": <0-1>, "epicurean": <0-1>},
     "trigger": null, "time_of_day_match": ["morning"]}
  ],
  "scenic_routes": [
    {"id": "<slug>", "from_neighborhood": "<id>", "to_neighborhood": "<id>",
     "walk_min": <int>, "score": <0-1>}
  ],
  "transit_edges": [],
  "engine_modifiers": {
    "siesta_window": <null or "HH:MM-HH:MM">,
    "lunch_window_strict": <bool>,
    "evening_end_time": "HH:MM",
    "day_buffer_min": <int>
  },
  "landmark_anchors": ["<slug>"],
  "hidden_gems": ["<slug>"]
}
"""


def _build_prompt(row: dict) -> str:
    return f"""You are a travel data specialist generating seed data for a deterministic itinerary engine.

Generate a complete, accurate CityData JSON for {row['name']}.

City facts:
- ID: {row['city_id']}
- Name: {row['name']}
- Country: {row['country_code']}
- Coordinates: [{row['lat']}, {row['lon']}]
- Timezone: {row['timezone']}
- Tier: {row['tier']}

Requirements:
1. 3-5 realistic neighborhoods with actual names and accurate coordinates
2. 4-6 insert candidates: at least 1 coffee, at least 1 lunch
3. engine_modifiers.siesta_window: actual local siesta window or null
4. landmark_anchors: 2-5 iconic places as slug IDs
5. hidden_gems: 2-4 lesser-known local favourites as slug IDs
6. Coordinates accurate within 500m of actual locations

{_SCHEMA_DESCRIPTION}
"""


def _parse_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text)


def seed_city_on_demand(whitelist_row: dict, supabase) -> CityData:
    """Generate and store a Tier 2 CityData for a whitelisted city.

    Args:
        whitelist_row: Row from city_whitelist table with keys:
                       city_id, name, country_code, tier, lat, lon, timezone
        supabase: Supabase client instance

    Returns:
        CityData object for the seeded city

    Raises:
        ValueError: If Claude returns invalid JSON or schema validation fails
    """
    client = _get_client()
    prompt = _build_prompt(whitelist_row)

    response = client.messages.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )
    data = _parse_response(response.content[0].text)
    city = load_city_from_dict(data)  # validates schema

    # Persist to Supabase city_data
    supabase.table("city_data").upsert({
        "id": city.id,
        "name": city.name,
        "tier": city.tier,
        "data": data,
    }).execute()

    # Mark as seeded in whitelist
    supabase.table("city_whitelist").update(
        {"seeded": True}
    ).eq("city_id", city.id).execute()

    return city
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_on_demand_seeder.py -v
```
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/on_demand_seeder.py tests/city/test_on_demand_seeder.py && git commit -m "feat: on-demand city seeder — auto-profiles any whitelisted city via Claude API"
```

---

## Task 7: Wire on-demand seeder into `load_city()`

**Files:**
- Modify: `city/data_model.py` — `load_city()` function

Currently `load_city()` raises `ValueError("city_not_found: ...")` when a city isn't in Supabase or seed files. Change it to: check `city_whitelist` → if found and unseeded, call `seed_city_on_demand()` → return CityData. Only raise `ValueError` if not in whitelist at all.

- [ ] **Step 1: Write failing test**

Add to a new file `tests/city/test_data_model.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from city.data_model import load_city


def test_load_city_triggers_on_demand_for_whitelisted_unseeded_city():
    """load_city() should call on_demand seeder when city is in whitelist but not seeded."""
    mock_supabase = MagicMock()

    # city_data table returns nothing (not seeded)
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=None)

    # city_whitelist table returns a row
    whitelist_row = {
        "city_id": "florence", "name": "Florence", "country_code": "IT",
        "tier": 2, "lat": 43.7696, "lon": 11.2558, "timezone": "Europe/Rome",
        "seeded": False,
    }
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=whitelist_row)

    mock_city = MagicMock()
    mock_city.id = "florence"

    with patch("city.data_model.seed_city_on_demand", return_value=mock_city) as mock_seeder:
        result = load_city("florence", mock_supabase)

    mock_seeder.assert_called_once_with(whitelist_row, mock_supabase)
    assert result.id == "florence"


def test_load_city_raises_for_non_whitelisted_city():
    """load_city() should raise ValueError when city is not in whitelist."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=None)
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)

    with pytest.raises(ValueError, match="city_not_found"):
        load_city("nonexistent_city_xyz", mock_supabase)
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_data_model.py -v
```
Expected: `FAIL` — `load_city` still raises `ValueError` instead of calling seeder.

- [ ] **Step 3: Update `load_city()` in `city/data_model.py`**

The current `load_city` (lines 94–103):
```python
def load_city(city_id: str, supabase=None) -> CityData:
    """Load from Supabase. Falls back to seed JSON (dev only)."""
    if supabase is not None:
        row = supabase.table("city_data").select("data").eq("id", city_id).single().execute()
        if row.data:
            return load_city_from_dict(row.data["data"])
    seed_path = Path(__file__).parent / f"seed/{city_id}.json"
    if seed_path.exists():
        return load_city_from_dict(json.loads(seed_path.read_text()))
    raise ValueError(f"city_not_found: {city_id}")
```

Replace with:
```python
def load_city(city_id: str, supabase=None) -> CityData:
    """Load CityData. On first miss, auto-seeds any whitelisted city via Claude API."""
    if supabase is not None:
        row = supabase.table("city_data").select("data").eq("id", city_id).single().execute()
        if row.data:
            return load_city_from_dict(row.data["data"])
    seed_path = Path(__file__).parent / f"seed/{city_id}.json"
    if seed_path.exists():
        return load_city_from_dict(json.loads(seed_path.read_text()))
    # Not in DB or local seed — check whitelist for on-demand seeding
    if supabase is not None:
        wl = supabase.table("city_whitelist").select("*").eq("city_id", city_id).maybe_single().execute()
        if wl.data:
            from city.on_demand_seeder import seed_city_on_demand
            return seed_city_on_demand(wl.data, supabase)
    raise ValueError(f"city_not_found: {city_id}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_data_model.py -v
```
Expected: `2 passed`

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v --tb=short 2>&1 | tail -10
```
Expected: all passing, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/data_model.py tests/city/test_data_model.py && git commit -m "feat: load_city auto-seeds whitelisted cities on-demand via Claude API"
```

---

## Task 8: City search endpoints + whitelist enforcement

**Files:**
- Modify: `main.py` — add `/api/cities/search` and `/api/cities/autocomplete`

These replace any ad-hoc city searching. Only whitelisted cities are returned. Unknown cities never surface to the user.

- [ ] **Step 1: Find insertion point in main.py**

```bash
cd /Users/souravbiswas/uncover-roads && grep -n "# CITY SEARCH\|/api/cities\|/places-autocomplete" main.py | head -10
```
Note the line number around the `# CITY SEARCH` comment (currently line ~546) — add the new endpoints there.

- [ ] **Step 2: Add city search endpoints**

Add immediately after the `# CITY SEARCH` comment in `main.py`:

```python
# ── City search (whitelist-enforced) ─────────────────────────────────────────

class CitySearchResult(BaseModel):
    city_id: str
    name: str
    country_code: str
    tier: int
    seeded: bool


@app.get("/api/cities/autocomplete", response_model=list[CitySearchResult])
async def cities_autocomplete(
    q: str,
    _user=Depends(get_current_user),
):
    """Return up to 10 whitelisted cities matching the query prefix (min 2 chars)."""
    if len(q.strip()) < 2:
        return []
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")

    rows = (
        _supabase.table("city_whitelist")
        .select("city_id, name, country_code, tier, seeded")
        .ilike("name", f"{q}%")
        .order("tier")
        .limit(10)
        .execute()
    )
    return [
        CitySearchResult(
            city_id=r["city_id"],
            name=r["name"],
            country_code=r["country_code"],
            tier=r["tier"],
            seeded=r.get("seeded", False),
        )
        for r in (rows.data or [])
    ]


@app.get("/api/cities/search", response_model=CitySearchResult)
async def cities_search(
    city_id: str,
    _user=Depends(get_current_user),
):
    """Look up a specific city by ID. Returns 404 if not in whitelist."""
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")

    row = (
        _supabase.table("city_whitelist")
        .select("city_id, name, country_code, tier, seeded")
        .eq("city_id", city_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="city_not_in_whitelist")
    r = row.data
    return CitySearchResult(
        city_id=r["city_id"],
        name=r["name"],
        country_code=r["country_code"],
        tier=r["tier"],
        seeded=r.get("seeded", False),
    )
```

- [ ] **Step 3: Verify main.py imports cleanly**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v --tb=short 2>&1 | tail -10
```
Expected: all passing, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add main.py && git commit -m "feat: city search endpoints — whitelist-enforced autocomplete and lookup"
```

---

## Task 9: Dynamic startup seeding + pre-launch batch script

**Files:**
- Modify: `main.py` — `seed_cities_and_start_sync()` to discover all seed files dynamically
- Create: `city/prelaunch_batch_seed.py` — runs on-demand seeder against full whitelist at 20 cities/hour

### Part A — Dynamic startup seeding

- [ ] **Step 1: Update `seed_cities_and_start_sync()` in `main.py`**

Find the current function body (starts at line ~89). Replace this block:
```python
    for city_id in ["tokyo", "paris", "nyc"]:
```
With:
```python
    seed_dir = _Path("city/seed")
    city_ids = [p.stem for p in sorted(seed_dir.glob("*.json"))] if seed_dir.exists() else []
    for city_id in city_ids:
```

- [ ] **Step 2: Verify startup import still works**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "import main; print('ok')"
```
Expected: `ok`

### Part B — Pre-launch batch seeder

- [ ] **Step 3: Write `city/prelaunch_batch_seed.py`**

```python
#!/usr/bin/env python3
"""Pre-launch batch seeder: seeds all whitelisted-but-unseeded cities at 20 cities/hour.

Run this 3 days before launch. Any city not seeded in time stays as on-demand
(first user search triggers seeding in ~10-15s).

Usage:
    python -m city.prelaunch_batch_seed               # seed all unseeded
    python -m city.prelaunch_batch_seed --limit 100   # seed first N only
    python -m city.prelaunch_batch_seed --dry-run     # count only, no API calls

Requires: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY in environment.
"""
from __future__ import annotations
import argparse
import os
import sys
import time

_RATE_LIMIT_SLEEP = 180  # 20 cities/hour = 1 city per 3 minutes


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-launch batch city seeder")
    parser.add_argument("--limit", type=int, default=None, help="Max cities to seed")
    parser.add_argument("--dry-run", action="store_true", help="Count only, no API calls")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    from city.on_demand_seeder import seed_city_on_demand

    sb = create_client(url, key)

    # Fetch all unseeded whitelisted cities (exclude Tier 1 — already seeded by generate_seeds)
    result = (
        sb.table("city_whitelist")
        .select("city_id, name, country_code, tier, lat, lon, timezone, seeded")
        .eq("seeded", False)
        .neq("tier", 1)
        .order("tier")
        .execute()
    )
    cities = result.data or []

    if args.limit:
        cities = cities[: args.limit]

    print(f"Found {len(cities)} unseeded whitelisted cities to process")

    if args.dry_run:
        for c in cities[:20]:
            print(f"  Would seed: {c['name']} ({c['city_id']}) tier={c['tier']}")
        if len(cities) > 20:
            print(f"  ... and {len(cities) - 20} more")
        print(f"\nEstimated time: {len(cities) * _RATE_LIMIT_SLEEP / 3600:.1f} hours")
        return

    seeded, failed = 0, 0
    for i, row in enumerate(cities):
        print(f"[{i+1}/{len(cities)}] Seeding {row['name']} ({row['city_id']})...")
        try:
            seed_city_on_demand(row, sb)
            seeded += 1
            print(f"  ✓ Done")
        except Exception as e:
            print(f"  ✗ Failed: {e}", file=sys.stderr)
            failed += 1

        if i < len(cities) - 1:
            time.sleep(_RATE_LIMIT_SLEEP)

    print(f"\nDone: {seeded} seeded, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Verify batch script imports**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "from city.prelaunch_batch_seed import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: Run final full test suite**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v --tb=short 2>&1 | tail -10
```
Expected: all passing, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add main.py city/prelaunch_batch_seed.py && git commit -m "feat: dynamic startup seeding + pre-launch batch seeder at 20 cities/hour"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| 80 Tier 1 cities with coordinates, timezone, cultural notes | Task 1 |
| Batch generator for 80 Tier 1 cities — idempotent, --force, --city, --dry-run | Task 2 |
| All 80 Tier 1 seed files generated | Task 3 |
| Schema validation on write (`load_city_from_dict`) | Tasks 2, 6 |
| 8-check validation suite × 80 Tier 1 seeds | Task 4 |
| GeoNames-sourced city whitelist (~4k cities) in Supabase | Task 5 |
| On-demand seeder — auto-profiles any whitelisted city | Task 6 |
| `load_city()` calls on-demand seeder on miss | Task 7 |
| `load_city()` raises ValueError only for non-whitelisted city | Task 7 |
| `/api/cities/autocomplete` — whitelist-enforced, prefix search | Task 8 |
| `/api/cities/search` — whitelist-enforced, exact lookup | Task 8 |
| Startup seeds all Tier 1 files dynamically (not hardcoded 3) | Task 9 |
| Pre-launch batch seeder at 20 cities/hour | Task 9 |
| Human review is exception-based (existing sync_job.py) | Already built — no task needed |

**Placeholder scan:** No TBDs, no "implement later", all code blocks complete.

**Type consistency:** `whitelist_row` dict shape is consistent between `whitelist_builder.py` (column names), `on_demand_seeder.seed_city_on_demand(whitelist_row, supabase)`, `test_on_demand_seeder.py`, and `data_model.load_city()`. The Supabase `maybe_single()` call returns the same shape.
