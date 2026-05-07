# Phase 5B — City Profiling: 80 Cities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate complete `CityData` seed JSON for 80 cities (up from 3) so the Phase 5 engine works globally at launch.

**Architecture:** A cities registry (`city/cities_registry.py`) defines all 80 targets with known metadata. A generator script (`city/generate_seeds.py`) uses the Anthropic SDK to produce a full `CityData` JSON per city in one batched prompt — skipping cities that already have seed files. Generated files land in `city/seed/{city_id}.json`, are validated against the schema on write, and are committed. The FastAPI startup handler is updated to dynamically discover all seed files instead of the hardcoded `["tokyo", "paris", "nyc"]` list.

**Tech Stack:** Python 3.11+, Anthropic SDK (`claude-sonnet-4-6`), existing `city/data_model.py` schema, pytest

---

## File Map

**Create:**
- `city/cities_registry.py` — list of 80 target cities with coordinates, timezone, tier, cultural notes
- `city/generate_seeds.py` — CLI script: reads registry, generates missing seed files via Claude API
- `tests/city/test_seed_validation.py` — schema-validates every file in `city/seed/`

**Modify:**
- `main.py` — update `seed_cities_and_start_sync()` to discover all files in `city/seed/` dynamically

**Populated by generator (77 new files):**
- `city/seed/{city_id}.json` — one per city not yet seeded

---

## Task 1: Cities registry (`city/cities_registry.py`)

**Files:**
- Create: `city/cities_registry.py`

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
Expected: `ImportError`

- [ ] **Step 3: Write `city/cities_registry.py`**

```python
"""Registry of 80 target cities for seed generation.

Each entry provides known-accurate metadata used to prompt the generator.
'notes' encodes cultural facts that affect engine_modifiers (siesta, meal timing, etc.)
"""

CITIES = [
    # ── ALREADY SEEDED (3) — generator skips these ──────────────────────────
    {"id": "tokyo",   "name": "Tokyo",          "lat": 35.6762, "lon": 139.6503, "timezone": "Asia/Tokyo",                       "tier": 1, "notes": "No siesta. Early dinner 18-19h. Exceptional transit. Shrine etiquette."},
    {"id": "paris",   "name": "Paris",           "lat": 48.8566, "lon":   2.3522, "timezone": "Europe/Paris",                     "tier": 1, "notes": "Strict 12:30-14:30 lunch window. Late dinner 20h+. Pharmacies close midday. No tipping culture."},
    {"id": "nyc",     "name": "New York City",   "lat": 40.7128, "lon": -74.0060, "timezone": "America/New_York",                 "tier": 1, "notes": "24h city. No siesta. High transit. Tipping 20% expected."},

    # ── FROM ip_engine.py PROFILES (38) ─────────────────────────────────────
    {"id": "singapore",      "name": "Singapore",        "lat":  1.3521, "lon": 103.8198, "timezone": "Asia/Singapore",          "tier": 1, "notes": "No siesta. Hawker culture. Strict litter/gum laws. Excellent transit. Hot year-round."},
    {"id": "dubai",          "name": "Dubai",             "lat": 25.2048, "lon":  55.2708, "timezone": "Asia/Dubai",              "tier": 1, "notes": "No alcohol in public. Ramadan affects daytime dining. Dress modestly. Extreme heat May-Sep. Low walkability."},
    {"id": "kyoto",          "name": "Kyoto",             "lat": 35.0116, "lon": 135.7681, "timezone": "Asia/Tokyo",              "tier": 1, "notes": "No siesta. Temple etiquette strict. Early dinner 18h. Moderate transit. Geisha districts off-limits to tourists."},
    {"id": "bangkok",        "name": "Bangkok",           "lat": 13.7563, "lon": 100.5018, "timezone": "Asia/Bangkok",            "tier": 1, "notes": "No siesta. Street food culture. Temple dress code. Hot Mar-Oct. Low walkability due to heat."},
    {"id": "mumbai",         "name": "Mumbai",            "lat": 19.0760, "lon":  72.8777, "timezone": "Asia/Kolkata",            "tier": 1, "notes": "Late dinner 21h+. Street food essential. Monsoon Jun-Sep. Ramadan affects some areas."},
    {"id": "delhi",          "name": "Delhi",             "lat": 28.7041, "lon":  77.1025, "timezone": "Asia/Kolkata",            "tier": 1, "notes": "Late dinner 21h+. Extreme heat Apr-Jun. Cultural sensitivity at religious sites. Ramadan affects old city."},
    {"id": "bengaluru",      "name": "Bengaluru",         "lat": 12.9716, "lon":  77.5946, "timezone": "Asia/Kolkata",            "tier": 2, "notes": "Mild year-round (900m elevation). Pub culture. Late dinner. IT district vs heritage areas."},
    {"id": "goa",            "name": "Goa",               "lat": 15.2993, "lon":  74.1240, "timezone": "Asia/Kolkata",            "tier": 2, "notes": "Beach-town rhythm. Late nights. Monsoon Jun-Sep closes beaches. Moped culture. Portuguese heritage."},
    {"id": "london",         "name": "London",            "lat": 51.5074, "lon":  -0.1278, "timezone": "Europe/London",           "tier": 1, "notes": "No siesta. Early dinner 18-19h. Pub culture. Excellent transit. Museums free. Left-side traffic."},
    {"id": "barcelona",      "name": "Barcelona",         "lat": 41.3851, "lon":   2.1734, "timezone": "Europe/Madrid",           "tier": 1, "notes": "Siesta 14:00-17:00. Very late dinner 21:30h. Lunch main meal. Pickpocket hotspot. Beach + city."},
    {"id": "rome",           "name": "Rome",              "lat": 41.9028, "lon":  12.4964, "timezone": "Europe/Rome",             "tier": 1, "notes": "Siesta 13:00-16:00. Late dinner 20:30h+. Religious site dress code. Tourist traps near major sights."},
    {"id": "amsterdam",      "name": "Amsterdam",         "lat": 52.3676, "lon":   4.9041, "timezone": "Europe/Amsterdam",        "tier": 1, "notes": "No siesta. Early dinner 18h. Cycling city. Canal-side culture. Liberal social policies."},
    {"id": "istanbul",       "name": "Istanbul",          "lat": 41.0082, "lon":  28.9784, "timezone": "Europe/Istanbul",         "tier": 1, "notes": "Ramadan affects dining. Late dinner 20h. Mosque dress code. Hilly terrain. Bosphorus crossings. Turkish tea culture."},
    {"id": "los_angeles",    "name": "Los Angeles",       "lat": 34.0522, "lon": -118.2437, "timezone": "America/Los_Angeles",   "tier": 1, "notes": "Car-dependent. No siesta. Brunch culture. Hot Jun-Oct. Vast spread — neighborhood choices critical."},
    {"id": "berlin",         "name": "Berlin",            "lat": 52.5200, "lon":  13.4050, "timezone": "Europe/Berlin",           "tier": 1, "notes": "No siesta. Early dinner 18h. Club culture (weekend nights only). Excellent transit. Former East/West divide."},
    {"id": "sydney",         "name": "Sydney",            "lat": -33.8688, "lon": 151.2093, "timezone": "Australia/Sydney",       "tier": 1, "notes": "No siesta. Early dinner 18:30h. Beach culture. Hilly. Reversed seasons (hot Dec-Feb). Ferry culture."},
    {"id": "bali",           "name": "Bali",              "lat":  -8.3405, "lon": 115.0920, "timezone": "Asia/Makassar",          "tier": 1, "notes": "Temple dress required. Nyepi day (city shutdown). Scooter culture. Ubud vs Seminyak very different vibes."},
    {"id": "hong_kong",      "name": "Hong Kong",         "lat": 22.3193, "lon": 114.1694, "timezone": "Asia/Hong_Kong",          "tier": 1, "notes": "No siesta. Early dinner 18:30h. Dim sum breakfast culture. Excellent MTR. Hilly. Harbor crossings."},
    {"id": "kuala_lumpur",   "name": "Kuala Lumpur",      "lat":  3.1390, "lon": 101.6869, "timezone": "Asia/Kuala_Lumpur",       "tier": 1, "notes": "Ramadan affects dining. Hot year-round. Halal food dominant. KLCC area vs old city."},
    {"id": "seoul",          "name": "Seoul",             "lat": 37.5665, "lon": 126.9780, "timezone": "Asia/Seoul",              "tier": 1, "notes": "No siesta. Late dinner culture. BBQ social dining. Excellent metro. Hilly with palace areas. K-culture hotspots."},
    {"id": "prague",         "name": "Prague",            "lat": 50.0755, "lon":  14.4378, "timezone": "Europe/Prague",           "tier": 1, "notes": "No siesta. Early dinner 18h. Beer culture. Cobblestone Old Town. Castle hill key. Tourists flood Old Town."},
    {"id": "lisbon",         "name": "Lisbon",            "lat": 38.7223, "lon":  -9.1393, "timezone": "Europe/Lisbon",           "tier": 1, "notes": "Siesta 13:00-15:00. Late dinner 21h. Hilly (trams essential). Fado music culture. Atlantic coast nearby."},
    {"id": "mexico_city",    "name": "Mexico City",       "lat": 19.4326, "lon": -99.1332, "timezone": "America/Mexico_City",     "tier": 1, "notes": "Late lunch 14h main meal. Late dinner 21h. High altitude (2240m). Safety awareness by neighborhood. Street food critical."},
    {"id": "rio_de_janeiro", "name": "Rio de Janeiro",    "lat": -22.9068, "lon": -43.1729, "timezone": "America/Sao_Paulo",      "tier": 1, "notes": "Beach-centric rhythm. Late dinner 20h. Carnival season transforms city. Safety awareness essential. Hilly."},
    {"id": "cape_town",      "name": "Cape Town",         "lat": -33.9249, "lon":  18.4241, "timezone": "Africa/Johannesburg",    "tier": 1, "notes": "No siesta. Early dinner 19h. Reversed seasons (summer Dec-Feb). Table Mountain dominates. Winelands nearby."},
    {"id": "marrakech",      "name": "Marrakech",         "lat": 31.6295, "lon":  -7.9811, "timezone": "Africa/Casablanca",      "tier": 1, "notes": "No alcohol widely available. Ramadan strict. Medina maze navigation. Haggling culture. Hot May-Sep. Riad stay culture."},
    {"id": "cairo",          "name": "Cairo",             "lat": 30.0444, "lon":  31.2357, "timezone": "Africa/Cairo",            "tier": 1, "notes": "Ramadan very strict. Late lunch 14h. Very late dinner 21h+. Pyramids require half-day. Traffic chaos. Limited alcohol."},
    {"id": "nairobi",        "name": "Nairobi",           "lat":  -1.2921, "lon":  36.8219, "timezone": "Africa/Nairobi",         "tier": 2, "notes": "Safari gateway. Mild year-round (1795m elevation). Security awareness by area. Matatu culture. English widely spoken."},
    {"id": "vienna",         "name": "Vienna",            "lat": 48.2082, "lon":  16.3738, "timezone": "Europe/Vienna",           "tier": 1, "notes": "No siesta. Early dinner 18h. Coffee house culture (Kaffeehäuser). Classical music city. Excellent transit."},
    {"id": "zurich",         "name": "Zurich",            "lat": 47.3769, "lon":   8.5417, "timezone": "Europe/Zurich",           "tier": 1, "notes": "No siesta. Early dinner 18:30h. Most expensive city. Swiss punctuality. Lake + old town. Very clean."},
    {"id": "osaka",          "name": "Osaka",             "lat": 34.6937, "lon": 135.5023, "timezone": "Asia/Tokyo",              "tier": 1, "notes": "No siesta. Street food capital of Japan. Dotonbori nightlife. Excellent transit. More casual than Tokyo."},
    {"id": "milan",          "name": "Milan",             "lat": 45.4654, "lon":   9.1859, "timezone": "Europe/Rome",             "tier": 1, "notes": "Siesta 13:00-15:30. Late dinner 20:30h. Fashion capital. Aperitivo culture 18-20h. Design week in April."},
    {"id": "athens",         "name": "Athens",            "lat": 37.9838, "lon":  23.7275, "timezone": "Europe/Athens",           "tier": 1, "notes": "Siesta 14:00-17:30. Very late dinner 21:30h. Acropolis morning visits essential. Hilly. Ouzo culture."},
    {"id": "kathmandu",      "name": "Kathmandu",         "lat": 27.7172, "lon":  85.3240, "timezone": "Asia/Kathmandu",          "tier": 2, "notes": "Religious sensitivity (Hindu + Buddhist). Trekking gateway. Altitude (1400m). Traffic chaos. Thamel tourist hub."},
    {"id": "colombo",        "name": "Colombo",           "lat":  6.9271, "lon":  79.8612, "timezone": "Asia/Colombo",            "tier": 2, "notes": "Hot year-round. Buddhist/Hindu/Muslim mixed culture. Sri Lankan spice cuisine. Tuk-tuk culture."},
    {"id": "abu_dhabi",      "name": "Abu Dhabi",         "lat": 24.4539, "lon":  54.3773, "timezone": "Asia/Dubai",              "tier": 2, "notes": "Ramadan strict. Modest dress required. Extreme heat May-Sep. Grand Mosque key attraction. Low walkability."},
    {"id": "taipei",         "name": "Taipei",            "lat": 25.0330, "lon": 121.5654, "timezone": "Asia/Taipei",             "tier": 1, "notes": "No siesta. Night market culture. Early dinner 18h. Excellent MRT. Mountain hikes accessible. Night markets essential."},
    {"id": "hanoi",          "name": "Hanoi",             "lat": 21.0285, "lon": 105.8542, "timezone": "Asia/Bangkok",            "tier": 1, "notes": "Early lunch 11:30h. Street food essential. Old Quarter maze. Motorbike crossings. Hot May-Sep."},

    # ── NEW ADDITIONS (39) ───────────────────────────────────────────────────
    {"id": "edinburgh",       "name": "Edinburgh",         "lat": 55.9533, "lon":  -3.1883, "timezone": "Europe/London",           "tier": 1, "notes": "No siesta. Early dinner 18h. Castle + Royal Mile. Festival Aug (city transforms). Hilly. Whisky culture."},
    {"id": "dublin",          "name": "Dublin",            "lat": 53.3498, "lon":  -6.2603, "timezone": "Europe/Dublin",           "tier": 1, "notes": "No siesta. Early dinner 18h. Pub culture central to social life. Craic. Coastal walks. Georgian architecture."},
    {"id": "copenhagen",      "name": "Copenhagen",        "lat": 55.6761, "lon":  12.5683, "timezone": "Europe/Copenhagen",       "tier": 1, "notes": "No siesta. Early dinner 18h. Cycling city. New Nordic cuisine. Hygge culture. Expensive. Canals central."},
    {"id": "stockholm",       "name": "Stockholm",         "lat": 59.3293, "lon":  18.0686, "timezone": "Europe/Stockholm",        "tier": 1, "notes": "No siesta. Early dinner 18h. Archipelago culture. Long summer daylight. Expensive. Design culture. Midsommar key."},
    {"id": "budapest",        "name": "Budapest",          "lat": 47.4979, "lon":  19.0402, "timezone": "Europe/Budapest",         "tier": 1, "notes": "No siesta. Early dinner 18h. Thermal bath culture. Ruin bars. Danube splits Buda/Pest. Budget-friendly."},
    {"id": "krakow",          "name": "Krakow",            "lat": 50.0647, "lon":  19.9450, "timezone": "Europe/Warsaw",           "tier": 2, "notes": "No siesta. Early dinner 18h. Old Town well-preserved. Wawel Castle key. Budget-friendly. Jewish Quarter Kazimierz."},
    {"id": "brussels",        "name": "Brussels",          "lat": 50.8503, "lon":   4.3517, "timezone": "Europe/Brussels",         "tier": 1, "notes": "No siesta. Early dinner 18:30h. Beer + frites + waffle culture. EU capital. Art Nouveau architecture. Multilingual."},
    {"id": "florence",        "name": "Florence",          "lat": 43.7696, "lon":  11.2558, "timezone": "Europe/Rome",             "tier": 1, "notes": "Siesta 13:00-15:30. Late dinner 20h. Renaissance art density highest in world. Museum reservation essential. Hot Jul-Aug."},
    {"id": "venice",          "name": "Venice",            "lat": 45.4408, "lon":  12.3155, "timezone": "Europe/Rome",             "tier": 1, "notes": "Siesta 13:00-15:00. Late dinner 20h. No cars. Vaporetto transit. Tourist tax at entry. Acqua alta (flooding) Nov-Dec."},
    {"id": "naples",          "name": "Naples",            "lat": 40.8518, "lon":  14.2681, "timezone": "Europe/Rome",             "tier": 1, "notes": "Siesta 13:00-16:30. Very late dinner 21h. Pizza birthplace. Chaotic traffic. Pompeii day trip. Street food raw."},
    {"id": "seville",         "name": "Seville",           "lat": 37.3891, "lon":  -5.9845, "timezone": "Europe/Madrid",           "tier": 1, "notes": "Long siesta 14:00-18:00. Very late dinner 22h. Hottest city in Europe (Jun-Aug). Flamenco culture. Tapas culture."},
    {"id": "porto",           "name": "Porto",             "lat": 41.1579, "lon":  -8.6291, "timezone": "Europe/Lisbon",           "tier": 1, "notes": "Siesta 13:00-15:00. Late dinner 20:30h. Port wine essential. Douro river culture. Hilly. Azulejo tile art."},
    {"id": "valencia",        "name": "Valencia",          "lat": 39.4699, "lon":  -0.3763, "timezone": "Europe/Madrid",           "tier": 1, "notes": "Siesta 14:00-17:00. Late dinner 21h. Paella birthplace. Beach + city. City of Arts and Sciences. Orange trees."},
    {"id": "lyon",            "name": "Lyon",              "lat": 45.7640, "lon":   4.8357, "timezone": "Europe/Paris",            "tier": 1, "notes": "Siesta varies. Late dinner 20h. Gastronomic capital of France. Bouchon culture. Two rivers (Rhône + Saône). Traboules."},
    {"id": "san_francisco",   "name": "San Francisco",     "lat": 37.7749, "lon": -122.4194, "timezone": "America/Los_Angeles",   "tier": 1, "notes": "No siesta. Fog culture (Karl). Brunch city. Cable cars. Very hilly. Microclimate by neighborhood. Tech culture."},
    {"id": "miami",           "name": "Miami",             "lat": 25.7617, "lon": -80.1918, "timezone": "America/New_York",        "tier": 1, "notes": "No siesta. Late dinner 20h+. Art Deco South Beach. Cuban coffee culture. Hot and humid Jun-Sep. Beach + nightlife."},
    {"id": "chicago",         "name": "Chicago",           "lat": 41.8781, "lon": -87.6298, "timezone": "America/Chicago",         "tier": 1, "notes": "No siesta. Early dinner 18h. Deep dish pizza. Architecture boat tours essential. Lakefront. Brutal winters."},
    {"id": "montreal",        "name": "Montreal",          "lat": 45.5017, "lon": -73.5673, "timezone": "America/Toronto",         "tier": 1, "notes": "No siesta. Late dinner 19:30h. Bilingual French/English. Underground city (winter). Festival capital. Bagels + poutine."},
    {"id": "toronto",         "name": "Toronto",           "lat": 43.6532, "lon": -79.3832, "timezone": "America/Toronto",         "tier": 1, "notes": "No siesta. Early dinner 18h. Multicultural food scene. Island ferry. Distillery District. CN Tower. Grid layout."},
    {"id": "vancouver",       "name": "Vancouver",         "lat": 49.2827, "lon": -123.1207, "timezone": "America/Vancouver",      "tier": 1, "notes": "No siesta. Early dinner 18h. Mountain + ocean. Stanley Park essential. Rain Nov-Mar. Asian food culture dominant."},
    {"id": "new_orleans",     "name": "New Orleans",       "lat": 29.9511, "lon": -90.0715, "timezone": "America/Chicago",         "tier": 1, "notes": "No siesta. Late dinner 19:30h. Jazz culture. Mardi Gras transforms city. Hot humid Apr-Sep. Bourbon St vs local spots."},
    {"id": "buenos_aires",    "name": "Buenos Aires",      "lat": -34.6037, "lon": -58.3816, "timezone": "America/Argentina/Buenos_Aires", "tier": 1, "notes": "Very late dinner 21:30h+. No siesta formalized. Tango culture. Steak + Malbec. Reversed seasons. Palermo vs San Telmo."},
    {"id": "medellin",        "name": "Medellín",          "lat":   6.2442, "lon": -75.5812, "timezone": "America/Bogota",          "tier": 2, "notes": "Spring climate year-round (1500m). Late dinner 20h. Cable car neighborhoods. Transformation city narrative. Cumbia culture."},
    {"id": "bogota",          "name": "Bogotá",            "lat":   4.7110, "lon": -74.0721, "timezone": "America/Bogota",          "tier": 2, "notes": "Cool year-round (2600m). Late lunch 13:30h. Ciclovía Sundays (streets for cyclists). Gold Museum essential. Zona Rosa."},
    {"id": "lima",            "name": "Lima",              "lat": -12.0464, "lon": -77.0428, "timezone": "America/Lima",            "tier": 1, "notes": "Gray fog Jun-Nov (La Garúa). Late lunch 13h main meal. World-class gastronomy. Ceviche culture. Miraflores vs Barranco."},
    {"id": "johannesburg",    "name": "Johannesburg",      "lat": -26.2041, "lon":  28.0473, "timezone": "Africa/Johannesburg",    "tier": 2, "notes": "No siesta. Early dinner 19h. Car essential. Safety awareness critical. Soweto history. Gold Reef City. Braai culture."},
    {"id": "accra",           "name": "Accra",             "lat":   5.6037, "lon":  -0.1870, "timezone": "Africa/Accra",            "tier": 2, "notes": "Hot year-round. No siesta. English widely spoken. Jollof rice culture. Beach bars. Labadi Beach. Creative arts scene growing."},
    {"id": "casablanca",      "name": "Casablanca",        "lat": 33.5731, "lon":  -7.5898, "timezone": "Africa/Casablanca",       "tier": 2, "notes": "Ramadan affects dining. Moderate dress. Late lunch 13:30h. Hassan II Mosque essential. More modern than Marrakech. Coastal."},
    {"id": "chiang_mai",      "name": "Chiang Mai",        "lat": 18.7883, "lon":  98.9853, "timezone": "Asia/Bangkok",            "tier": 1, "notes": "No siesta. Temple dress required. Hot Mar-May. Night Bazaar culture. Mountains accessible. Elephant sanctuary visits."},
    {"id": "ho_chi_minh_city","name": "Ho Chi Minh City",  "lat": 10.8231, "lon": 106.6297, "timezone": "Asia/Ho_Chi_Minh",         "tier": 1, "notes": "No siesta. Early lunch 11:30h. Motorbike crossing technique essential. War history museums. Rooftop bar culture. Pho culture."},
    {"id": "melbourne",       "name": "Melbourne",         "lat": -37.8136, "lon": 144.9631, "timezone": "Australia/Melbourne",    "tier": 1, "notes": "No siesta. Early dinner 18:30h. Coffee culture (flat white birthplace). Reversed seasons. Laneway culture. Sport obsessed."},
    {"id": "auckland",        "name": "Auckland",          "lat": -36.8509, "lon": 174.7645, "timezone": "Pacific/Auckland",        "tier": 1, "notes": "No siesta. Early dinner 18h. Volcanic terrain. Harbour culture. Maori culture. Reversed seasons. Wine regions nearby."},
    {"id": "warsaw",          "name": "Warsaw",            "lat": 52.2297, "lon":  21.0122, "timezone": "Europe/Warsaw",            "tier": 2, "notes": "No siesta. Early dinner 18h. WWII history key. Old Town rebuilt post-war. Vodka culture. Budget-friendly. Modern vs historic."},
    {"id": "reykjavik",       "name": "Reykjavik",         "lat": 64.1466, "lon": -21.9426, "timezone": "Atlantic/Reykjavik",       "tier": 1, "notes": "No siesta. Late dinner 19h. Midnight sun (Jun) vs 5h daylight (Dec). Northern Lights. Geothermal pools essential. Very expensive."},
    {"id": "tbilisi",         "name": "Tbilisi",           "lat": 41.6938, "lon":  44.8015, "timezone": "Asia/Tbilisi",             "tier": 2, "notes": "No siesta. Late dinner 20h. Georgian wine oldest in world. Sulfur bath culture. Old Town maze. Caucasus mountains gateway."},
    {"id": "amman",           "name": "Amman",             "lat": 31.9539, "lon":  35.9106, "timezone": "Asia/Amman",               "tier": 2, "notes": "Ramadan strict. Modest dress. Late dinner 20:30h. Petra day trip essential. Hilly. Mezze culture. Conservative vs liberal areas."},
    {"id": "cartagena",       "name": "Cartagena",         "lat": 10.3910, "lon": -75.4794, "timezone": "America/Bogota",           "tier": 2, "notes": "Hot year-round. Late dinner 19:30h. Walled Old City essential. Caribbean culture. Festival season Nov-Dec. Cumbia."},
    {"id": "zanzibar",        "name": "Zanzibar",          "lat":  -6.1659, "lon":  39.2026, "timezone": "Africa/Nairobi",          "tier": 2, "notes": "Ramadan affects dining in Stone Town. Modest dress in town. Spice island culture. Beach resort areas separate from town. Dhow sailing."},
    {"id": "tel_aviv",        "name": "Tel Aviv",          "lat": 32.0853, "lon":  34.7818, "timezone": "Asia/Jerusalem",           "tier": 1, "notes": "Shabbat (Fri sunset - Sat night) closes many businesses. Mediterranean beach culture. Late dinner 20h+. Falafel culture. Party city."},
]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_cities_registry.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/cities_registry.py tests/city/test_cities_registry.py && git commit -m "feat: cities registry — 80 target cities with coordinates, timezone, cultural notes"
```

---

## Task 2: Seed generator script (`city/generate_seeds.py`)

**Files:**
- Create: `city/generate_seeds.py`

No unit test — this is a run-once CLI script. Correctness is verified by the schema validation test in Task 3.

- [ ] **Step 1: Write `city/generate_seeds.py`**

```python
#!/usr/bin/env python3
"""Seed generator: produces city/seed/{city_id}.json for each city in the registry.

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
    "heat_threshold_c": <int — temp above which outdoor stops get flagged>,
    "rain_months": [<list of month ints 1-12 for rainy/monsoon season>]
  },
  "movement": {
    "walkability": <1|2|3 — 1=car dependent, 2=moderate, 3=excellent>,
    "transit": <1|2|3 — 1=poor, 2=moderate, 3=excellent>
  },
  "culture": {
    "meal_times": {"lunch": "HH:MM", "dinner": "HH:MM"},
    "siesta": <true|false>
  },
  "neighborhoods": [
    {
      "id": "<slug e.g. old_town>",
      "name": "<Neighborhood Name>",
      "center": [<lat>, <lon>],
      "polygon": [],
      "best_times": {
        "morning": <0.0-1.0>,
        "afternoon": <0.0-1.0>,
        "evening": <0.0-1.0>
      },
      "crowd_index": {
        "weekday": <0.0-1.0>,
        "weekend": <0.0-1.0>
      }
    }
  ],
  "insert_candidates": [
    {
      "place_id": "<type_neighborhood_n e.g. coffee_old_town_1>",
      "name": "<Real or plausible business name>",
      "lat": <float>,
      "lon": <float>,
      "type": "<coffee|lunch|scenic_walk|rest|micro>",
      "time_cost_min": <int — minutes the visit takes>,
      "persona_affinity": {
        "<archetype>": <0.0-1.0>
        // archetypes: wanderer, voyager, epicurean, historian, pulse, slowtraveller, explorer
      },
      "trigger": <null or string describing special trigger condition>,
      "time_of_day_match": [<"morning"|"afternoon"|"evening">]
    }
  ],
  "scenic_routes": [
    {
      "id": "<slug>",
      "from_neighborhood": "<neighborhood_id>",
      "to_neighborhood": "<neighborhood_id>",
      "walk_min": <int>,
      "score": <0.0-1.0>
    }
  ],
  "transit_edges": [],
  "engine_modifiers": {
    "siesta_window": <null or "HH:MM-HH:MM" string>,
    "lunch_window_strict": <true|false>,
    "evening_end_time": "HH:MM",
    "day_buffer_min": <int — minutes of buffer between stops>
  },
  "landmark_anchors": ["<place_id_slug>", ...],
  "hidden_gems": ["<place_id_slug>", ...]
}
"""

_ARCHETYPE_GUIDE = """
Persona archetypes and their tendencies:
- wanderer: urban exploration, markets, getting lost, local neighborhoods
- voyager: curated, intentional, design/heritage/gastronomy, quality over quantity
- epicurean: food-focused, markets, restaurants, cafes — food is the journey
- historian: museums, heritage sites, monuments, cultural depth
- pulse: nightlife, rooftops, events, energy, people-watching
- slowtraveller: one neighborhood deep, cafes, parks, local daily life
- explorer: parks, museums, food, nightlife — wants everything
"""


def _build_prompt(city: dict) -> str:
    return f"""You are a travel data specialist generating seed data for a deterministic itinerary engine.

Generate a complete, accurate CityData JSON for {city['name']}.

City facts:
- ID: {city['id']}
- Name: {city['name']}
- Coordinates: [{city['lat']}, {city['lon']}]
- Timezone: {city['timezone']}
- Tier: {city['tier']}
- Cultural notes: {city['notes']}

{_ARCHETYPE_GUIDE}

Requirements:
1. Include exactly 4-5 realistic neighborhoods with actual names and accurate coordinates
2. Include 5-8 insert candidates:
   - At least 2 coffee shops (realistic names, correct coordinates)
   - At least 1 lunch spot
   - At least 1 scenic_walk if the city has walkable areas
   - 0-1 rest spots
3. Scenic routes: 1-3 if the city has walkable connections between neighborhoods
4. engine_modifiers: set siesta_window to the actual window (e.g. "14:00-17:00") for cities with siesta culture, null for others
5. landmark_anchors: 3-6 slug IDs of the city's most iconic places (e.g. "eiffel_tower", "louvre")
6. hidden_gems: 3-5 slug IDs of lesser-known but worthwhile places locals love

Use real place names where possible. Coordinates must be accurate (within 500m of actual location).

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
    # Strip markdown code fences if model adds them
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    data = json.loads(text)
    # Validate against schema — raises on bad data
    load_city_from_dict(data)
    return data


def _save_seed(city_id: str, data: dict) -> None:
    _SEED_DIR.mkdir(exist_ok=True)
    path = _SEED_DIR / f"{city_id}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  ✓ Saved {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate city seed JSON files")
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
Expected: prints prompt for Osaka, no API call.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/generate_seeds.py && git commit -m "feat: city seed generator — Claude API batch generation for 80 cities"
```

---

## Task 3: Run generator for all 77 missing cities

**Files:**
- Populates: `city/seed/*.json` (77 new files, skips tokyo/paris/nyc)

- [ ] **Step 1: Run generator (this takes ~5-10 minutes)**

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

If any cities fail (JSON parse error), re-run just the failing one:
```bash
python -m city.generate_seeds --city <city_id>
```

- [ ] **Step 2: Verify seed count**

```bash
ls /Users/souravbiswas/uncover-roads/city/seed/ | wc -l
```
Expected: `80`

- [ ] **Step 3: Spot-check a few generated files**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "
from city.data_model import load_city
cities = ['singapore', 'barcelona', 'buenos_aires', 'melbourne']
for c in cities:
    city = load_city(c)
    print(f'{c}: {len(city.neighborhoods)} neighborhoods, {len(city.insert_candidates)} inserts')
"
```
Expected: each city has 4-5 neighborhoods and 5-8 insert candidates.

- [ ] **Step 4: Commit all seed files**

```bash
cd /Users/souravbiswas/uncover-roads && git add city/seed/ && git commit -m "feat: seed data for 77 cities — complete 80-city global coverage"
```

---

## Task 4: Seed validation test suite

**Files:**
- Create: `tests/city/test_seed_validation.py`

- [ ] **Step 1: Write failing test**

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
    """Every seed file must parse into a valid CityData object."""
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


def test_total_seed_count():
    """Ensure we have all 80 cities seeded."""
    seed_files = list(_seed_files())
    assert len(seed_files) == 80, f"Expected 80 seed files, found {len(seed_files)}"
```

- [ ] **Step 2: Run test (will fail if seeds not yet generated)**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_seed_validation.py -v --tb=short 2>&1 | tail -20
```

If Task 3 is complete (80 seed files exist): Expected 80×8 = 641 tests pass (parametrized).
If Task 3 is not yet complete: skip and return after Task 3.

- [ ] **Step 3: Fix any failing cities**

For each city that fails validation, regenerate with force:
```bash
python -m city.generate_seeds --city <failing_city_id> --force
```

Then re-run the failing test:
```bash
python -m pytest tests/city/test_seed_validation.py::test_seed_has_coffee_insert_candidate[<city_id>] -v
```

- [ ] **Step 4: Confirm full suite passes**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/city/test_seed_validation.py -v --tb=short 2>&1 | tail -5
```
Expected: `641 passed` (80 cities × 8 tests + 1 count test).

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add tests/city/test_seed_validation.py && git commit -m "test: seed validation suite — 8 checks × 80 cities"
```

---

## Task 5: Dynamic startup seeding in `main.py`

**Files:**
- Modify: `main.py` — `seed_cities_and_start_sync()` function

Currently main.py hardcodes `["tokyo", "paris", "nyc"]`. Change it to discover all seed files dynamically so every city in `city/seed/` is seeded at startup.

- [ ] **Step 1: Find the current startup handler**

```bash
cd /Users/souravbiswas/uncover-roads && grep -n "seed_cities_and_start_sync\|for city_id in" main.py | head -10
```

Note the line numbers for the function and the hardcoded list.

- [ ] **Step 2: Replace hardcoded list with dynamic discovery**

Find this pattern in `seed_cities_and_start_sync()`:
```python
    for city_id in ["tokyo", "paris", "nyc"]:
```

Replace it with:
```python
    seed_dir = _Path("city/seed")
    city_ids = [p.stem for p in sorted(seed_dir.glob("*.json"))] if seed_dir.exists() else []
    for city_id in city_ids:
```

- [ ] **Step 3: Verify import still works**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v --tb=short 2>&1 | tail -5
```
Expected: all pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add main.py && git commit -m "feat: dynamic city seeding — startup discovers all 80 cities from city/seed/ automatically"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| 80 city target list with coordinates + timezone | Task 1 |
| Cultural notes embedded in registry (siesta, meal times, Ramadan) | Task 1 |
| Generator script — idempotent, skips existing | Task 2 |
| Generator — dry-run mode | Task 2 |
| Generator — single city mode (`--city`) | Task 2 |
| Generator — force overwrite (`--force`) | Task 2 |
| Schema validation on write (load_city_from_dict) | Task 2 |
| All 80 seed files generated | Task 3 |
| Spot-check generated data | Task 3 |
| 8-check validation suite × 80 cities | Task 4 |
| coffee insert ≥ 1 per city | Task 4 |
| engine_modifiers complete keys | Task 4 |
| total_seed_count = 80 | Task 4 |
| Startup seeding discovers all seed files dynamically | Task 5 |

**Placeholder scan:** None found. All steps have exact commands and code.

**Type consistency:** `load_city_from_dict` is the same function used in Task 2 (generator validation) and Task 4 (test suite) — consistent.
