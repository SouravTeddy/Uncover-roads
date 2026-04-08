from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import math
import time
import os
import json
import uuid
import anthropic
from collections import defaultdict
from time import time as _time
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client as SupabaseClient
from ip_engine import build_persona_response, get_city_profile, run_conflict_check, ARCHETYPES

load_dotenv()

app = FastAPI()

# CORS — only allow your Vercel frontend (update after deploying)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
OPENWEATHER_KEY    = os.environ.get("OPENWEATHER_KEY", "")
TICKETMASTER_KEY   = os.environ.get("TICKETMASTER_KEY", "")
YELP_API_KEY       = os.environ.get("YELP_API_KEY", "")

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Place details cache TTL — place hours/ratings/contact info changes infrequently
# Set via env var (days) or default to 30 days
PLACE_CACHE_TTL_DAYS = int(os.getenv("PLACE_CACHE_TTL_DAYS", "30"))

_supabase: SupabaseClient | None = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Session token store: maps session_id -> google_session_token
# Session tokens make autocomplete keystrokes FREE — only Place Details is billed
_session_tokens: dict[str, str] = {}
_SESSION_TOKEN_MAX = 10000  # max concurrent sessions to prevent unbounded growth

# Simple rate limiting: max 100 Google calls per IP per hour
_rate_limit: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 3600
RATE_LIMIT_MAX = 100

def _check_rate_limit(ip: str) -> bool:
    now = _time()
    recent = [t for t in _rate_limit[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(recent) >= RATE_LIMIT_MAX:
        _rate_limit[ip] = recent
        return False
    recent.append(now)
    if recent:
        _rate_limit[ip] = recent
    elif ip in _rate_limit:
        del _rate_limit[ip]
    return True

# ── Overpass endpoints (ordered by current reliability) ──
OVERPASS_ENDPOINTS = [
    "https://overpass.openstreetmap.fr/api/interpreter",  # most reliable mirror
    "https://overpass.osm.ch/api/interpreter",            # Swiss mirror — fast
    "https://overpass-api.de/api/interpreter",            # main (occasionally slow)
    "https://overpass.private.coffee/api/interpreter",    # community mirror
]

# =========================================
# GEOCODE
# =========================================
@app.get("/geocode")
def geocode(city: str = Query(...)):
    try:
        url    = "https://nominatim.openstreetmap.org/search"
        params = {"q": city, "format": "json", "limit": 1, "accept-language": "en"}
        headers = {"User-Agent": "UncoverRoads/1.0"}
        res  = requests.get(url, params=params, headers=headers, timeout=10)
        data = res.json()
        if not data:
            return {"error": f"City '{city}' not found"}
        result = data[0]
        lat = float(result["lat"])
        lon = float(result["lon"])
        # Use viewbox from Nominatim if available, else fixed offset
        bb = result.get("boundingbox")  # [south, north, west, east]
        if bb:
            south, north, west, east = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
            # Shrink bbox by 15% on each edge to target city centre
            lat_pad = (north - south) * 0.15
            lon_pad = (east  - west)  * 0.15
            south += lat_pad; north -= lat_pad
            west  += lon_pad; east  -= lon_pad
        else:
            offset = 0.12
            south, north = lat - offset, lat + offset
            west,  east  = lon - offset, lon + offset
        return {
            "city": result["display_name"],
            "lat": lat, "lon": lon,
            "bbox": [south, north, west, east]
        }
    except Exception as e:
        print("GEOCODE ERROR:", e)
        return {"error": str(e)}


# =========================================
# OVERPASS
# =========================================
def fetch_overpass(query: str) -> dict:
    headers = {
        "User-Agent": "UncoverRoads/1.0",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"Trying Overpass: {endpoint}")
            res = requests.post(
                endpoint,
                data={"data": query},
                headers=headers,
                timeout=15
            )
            print(f"  Status: {res.status_code}, Body[:80]: {res.text[:80]}")

            if res.status_code == 429:
                print("  Rate limited — waiting 3s before next mirror")
                time.sleep(3)
                continue

            if res.status_code == 200:
                text = res.text.strip()
                if text.startswith("{"):
                    return res.json()
                if "<html" in text[:200].lower():
                    print("  HTML error page returned — skipping endpoint")
                    continue

        except requests.exceptions.Timeout:
            print(f"  Timed out")
            continue
        except Exception as e:
            print(f"  Failed: {e}")
            continue

    raise Exception("All Overpass endpoints failed")


# =========================================
# MAP DATA
# =========================================
@app.get("/map-data")
def map_data(
    city: str = Query("Bangalore"),
    lat:   float = Query(None),
    lon:   float = Query(None),
    south: float = Query(None),
    west:  float = Query(None),
    north: float = Query(None),
    east:  float = Query(None),
):
    try:
        # Use bbox from frontend if provided (saves a geocode round-trip)
        if south is not None and west is not None and north is not None and east is not None:
            bbox_str = f"{south},{west},{north},{east}"
        else:
            geo = geocode(city)
            if "error" in geo:
                return {"error": geo["error"]}
            b = geo["bbox"]  # [south, north, west, east]
            bbox_str = f"{b[0]},{b[2]},{b[1]},{b[3]}"

        query = f"""
[out:json][timeout:25];
(
  node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"]({bbox_str});
  way["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"]({bbox_str});
  node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name:en"]({bbox_str});
  way["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name:en"]({bbox_str});
  node["amenity"~"restaurant|cafe|bar|food_court"]["name"]({bbox_str});
  node["amenity"~"restaurant|cafe|bar|food_court"]["name:en"]({bbox_str});
  node["amenity"="museum"]["name"]({bbox_str});
  way["amenity"="museum"]["name"]({bbox_str});
  node["amenity"="museum"]["name:en"]({bbox_str});
  way["amenity"="museum"]["name:en"]({bbox_str});
  node["leisure"~"park|garden|nature_reserve"]["name"]({bbox_str});
  way["leisure"~"park|garden|nature_reserve"]["name"]({bbox_str});
  node["leisure"~"park|garden|nature_reserve"]["name:en"]({bbox_str});
  way["leisure"~"park|garden|nature_reserve"]["name:en"]({bbox_str});
  node["historic"]["name"]({bbox_str});
  way["historic"]["name"]({bbox_str});
  node["historic"]["name:en"]({bbox_str});
  way["historic"]["name:en"]({bbox_str});
  node["amenity"="marketplace"]["name"]({bbox_str});
  node["amenity"="cafe"]["name"]({bbox_str});
);
out center 200;
"""
        data = fetch_overpass(query)

        places = []
        seen_ids  = set()  # dedupe by OSM element id (handles duplicate results from name + name:en queries)
        seen_names = set() # dedupe by resolved name

        for el in data.get("elements", []):
            el_id = f"{el.get('type','')}-{el.get('id','')}"
            if el_id in seen_ids:
                continue
            seen_ids.add(el_id)

            tags = el.get("tags", {})
            # Prefer English / Latin-script names in priority order
            name = (
                tags.get("name:en") or
                tags.get("int_name") or       # international name (often Latin)
                tags.get("name:ja_rm") or     # Japanese romanized
                tags.get("name:ko_rm") or     # Korean romanized
                tags.get("name:zh_pinyin") or # Chinese pinyin
                tags.get("name:ar_rm") or     # Arabic romanized
                tags.get("name:th_rm") or     # Thai romanized
                tags.get("name", "")
            ).strip()
            if not name or name in seen_names:
                continue
            seen_names.add(name)

            # Category resolution
            amenity = tags.get("amenity", "")
            tourism = tags.get("tourism", "")
            leisure = tags.get("leisure", "")
            historic = tags.get("historic", "")

            if amenity in ("restaurant", "cafe", "bar", "food_court") or tags.get("cuisine"):
                cat = "restaurant"
            elif amenity == "museum" or tourism == "museum":
                cat = "museum"
            elif leisure in ("park", "garden", "nature_reserve"):
                cat = "park"
            elif historic:
                cat = "historic"
            elif tourism in ("attraction", "artwork", "viewpoint", "gallery"):
                cat = "tourism"
            elif amenity == "marketplace" or tags.get("shop") == "mall":
                cat = "markets"
            else:
                cat = "place"

            el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
            el_lon = el.get("lon") or (el.get("center") or {}).get("lon")
            if el_lat is None or el_lon is None:
                continue
            places.append({
                "title":    name,
                "lat":      el_lat,
                "lon":      el_lon,
                "type":     "place",
                "category": cat,
                "tags": {
                    "opening_hours": tags.get("opening_hours", ""),
                    "website":       tags.get("website", ""),
                    "cuisine":       tags.get("cuisine", ""),
                    "description":   tags.get("description", ""),
                }
            })

        # ── Quality + distance filter ──
        EXCLUDE = {
            "hooters","mcdonalds","kfc","subway","starbucks","burger king",
            "7-eleven","cheers","fairprice","cold storage","giant","ntuc",
            "mixue","gong cha","koi","liho","tiger sugar","playmade",
            "watson","guardian","popular bookstore","courts","harvey norman"
        }

        # Centre point for distance filter:
        # When a bbox is provided (Search Here), use the bbox centre so the
        # distance filter stays relative to what the user is actually viewing.
        # Only fall back to city lat/lon for the initial city-wide load.
        if south is not None and north is not None and west is not None and east is not None:
            center_lat = (south + north) / 2
            center_lon = (west  + east)  / 2
        elif lat is not None and lon is not None:
            center_lat, center_lon = lat, lon
        elif 'geo' in dir() and 'lat' in geo:
            center_lat, center_lon = geo["lat"], geo["lon"]
        else:
            center_lat, center_lon = 0, 0

        def dist(p):
            return ((p["lat"] - center_lat)**2 + (p["lon"] - center_lon)**2) ** 0.5

        # Radius: half the bbox diagonal, capped at 0.22 deg (~25 km) for city loads
        # and expanded to fit the viewport for Search Here
        if south is not None and north is not None and west is not None and east is not None:
            radius = max((north - south) / 2, (east - west) / 2) * 1.1
        else:
            radius = 0.22

        places = [
            p for p in places
            if p["title"].lower() not in EXCLUDE
            and len(p["title"]) > 3
            and dist(p) < radius
        ]

        places = sorted(places, key=dist)[:80]

        print(f"MAP DATA: {len(places)} filtered places for {city}")
        return places

    except Exception as e:
        print("MAP DATA ERROR:", e)
        return {"error": str(e)}


# =========================================
# CITY SEARCH (autocomplete dropdown)
# =========================================
@app.get("/city-search")
def city_search(q: str = Query(...)):
    try:
        url    = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": q,
            "format": "json",
            "limit": 8,
            "featuretype": "city",
            "addressdetails": 1,
            "accept-language": "en",
        }
        headers = {"User-Agent": "UncoverRoads/1.0"}
        res  = requests.get(url, params=params, headers=headers, timeout=8)
        data = res.json()

        results = []
        seen    = set()
        for item in data:
            addr    = item.get("address", {})
            name    = (addr.get("city") or addr.get("town") or
                       addr.get("municipality") or item.get("name", "")).strip()
            country = addr.get("country", "")
            if not name or name in seen:
                continue
            seen.add(name)
            results.append({"name": name, "country": country})

        return results
    except Exception as e:
        print("CITY SEARCH ERROR:", e)
        return []


# =========================================
# ROUTE
# =========================================
@app.post("/route")
def route(body: dict):
    try:
        points = body.get("points", [])
        if len(points) < 2:
            return {"error": "Need at least 2 points"}
        coords  = ";".join([f"{p['lon']},{p['lat']}" for p in points])
        url     = f"http://router.project-osrm.org/route/v1/driving/{coords}"
        params  = {"overview": "full", "geometries": "geojson", "steps": "true"}
        res     = requests.get(url, params=params, timeout=15)
        data    = res.json()
        if data.get("code") != "Ok":
            return {"error": "OSRM routing failed", "detail": data}
        r = data["routes"][0]
        steps_text = []
        for leg in r.get("legs", []):
            for step in leg.get("steps", []):
                t = step.get("maneuver", {}).get("type", "")
                n = step.get("name", "")
                if n:
                    steps_text.append(f"{t} onto {n}")
        return {
            "routes": data["routes"],
            "summary": {
                "distance_km":  round(r["distance"] / 1000, 2),
                "duration_min": round(r["duration"] / 60, 2),
                "steps": steps_text
            }
        }
    except Exception as e:
        print("ROUTE ERROR:", e)
        return {"error": str(e)}


# =========================================
# AI ITINERARY
# =========================================
@app.post("/ai-itinerary")
def ai_itinerary(body: dict):
    try:
        places   = body.get("selected_places", [])
        city     = body.get("city", "the city")
        days     = body.get("days", 1)  # can be 0.5 for half day
        day_num  = body.get("day_number", 1)
        pace     = body.get("pace", "moderate")
        persona  = body.get("persona", "")
        archetype = body.get("persona_archetype", "")
        ctx      = body.get("persona_context", {})
        conflict = body.get("conflict_resolution", {})
        trip_ctx = body.get("trip_context", {})

        if not conflict:
            try:
                persona_dict = {
                    'archetype': body.get('persona_archetype', ''),
                    'ritual': body.get('trip_context', {}).get('ritual', '') or body.get('ritual', ''),
                    'pace': body.get('pace', ''),
                    'sensory': body.get('sensory', ''),
                    'social': body.get('social', ''),
                    'attractions': body.get('attractions', []),
                }
                travel_date = body.get('trip_context', {}).get('travel_date') or body.get('date', '')
                conflict = run_conflict_check(
                    city=body.get('city', ''),
                    persona=persona_dict,
                    travel_date=travel_date,
                )
            except Exception as e:
                print(f"CONFLICT CHECK ERROR: {e}")
                conflict = {"has_conflicts": False, "conflicts": []}

        if not places:
            return {"itinerary": [], "summary": {}}

        if not ANTHROPIC_API_KEY:
            return {"error": "No Anthropic API key configured"}

        # Nearest-neighbour sort — deterministic, no AI needed
        def _dist2(a, b):
            return (a.get('lat',0)-b.get('lat',0))**2 + (a.get('lon',0)-b.get('lon',0))**2

        def _nn_sort(pts, start_lat=None, start_lon=None):
            if len(pts) <= 1:
                return pts
            remaining = list(pts)
            sorted_pts = []
            # Start from user's location if provided, else first point
            if start_lat is not None:
                cur = {'lat': start_lat, 'lon': start_lon}
            else:
                # start from centroid to avoid bias
                clat = sum(p.get('lat',0) for p in pts) / len(pts)
                clon = sum(p.get('lon',0) for p in pts) / len(pts)
                cur = {'lat': clat, 'lon': clon}
            while remaining:
                nearest = min(remaining, key=lambda p: _dist2(cur, p))
                sorted_pts.append(nearest)
                remaining.remove(nearest)
                cur = nearest
            return sorted_pts

        start_lat = trip_ctx.get('location_lat')
        start_lon = trip_ctx.get('location_lon')
        places = _nn_sort(places, start_lat, start_lon)

        place_list = "\n".join([
            f"- {p['title']} (category: {p.get('category','place')}, "
            f"lat: {p.get('lat')}, lon: {p.get('lon')})"
            for p in places
        ])

        # Build conflict instructions string
        conflict_str = ""
        if conflict.get("has_conflicts"):
            # Only send high+medium severity conflicts, max 3, condensed
            top_conflicts = [c for c in conflict.get("conflicts", [])
                           if c.get("severity") in ("high", "medium")][:3]
            if top_conflicts:
                instructions = " | ".join(
                    c.get("instruction", "")
                    for c in top_conflicts
                    if c.get("instruction")
                )
                conflict_str = f"CONFLICT OVERRIDES (apply strictly):\n{instructions}\n"

        # Build trip context string
        trip_str = ""
        if trip_ctx.get("travel_date"):
            trip_str = f"""
TRIP CONTEXT:
- Travel date: {trip_ctx.get('travel_date')}
- Day {trip_ctx.get('day_number',1)} of {trip_ctx.get('total_days',1)}
- Starting from: {trip_ctx.get('start_type','hotel')}
- Arrival time: {trip_ctx.get('arrival_time','') or 'not specified'}
- Flight time (if departure day): {trip_ctx.get('flight_time','') or 'N/A'}
- Long-haul jet lag adjustment: {trip_ctx.get('is_long_haul', False)}
"""

        # Human-readable duration label
        if days == 0.5:
            days_label = "half day (roughly 4-5 hours, 9am to 2pm unless arrival time specified)"
        elif days == 1:
            days_label = "1 full day"
        else:
            days_label = f"{int(days)} days"

        # Thin/tight signal for AI
        n_places = len(places)
        if days == 0.5 and n_places > 5:
            balance_note = f"NOTE: {n_places} places in a half day is tight. Prioritise by proximity and flag in conflict_notes that the schedule is packed."
        elif days > 0 and n_places < days:
            balance_note = f"NOTE: Only {n_places} place{'s' if n_places!=1 else ''} for {days_label}. Build a relaxed itinerary around these anchors and suggest neighbourhoods to explore between them."
        else:
            balance_note = ""

        # Location context for conflict engine
        location_note = ""
        if trip_ctx.get("location_name"):
            location_note = f"- Starting location: {trip_ctx.get('location_name')} (lat: {trip_ctx.get('location_lat','?')}, lon: {trip_ctx.get('location_lon','?')})"

        prompt = f"""You are an expert travel planner creating a hyper-personalised itinerary.

CITY: {city}
DURATION: {days_label} (day {day_num} of {days})
PACE: {pace}

TRAVELLER PERSONA: {archetype or 'general traveller'}
{persona}

SELECTED PLACES:
{place_list}

{conflict_str}
{trip_str}
{location_note}
{balance_note}

CRITICAL RULES — FOLLOW STRICTLY:
- Return ONLY the exact places listed in SELECTED PLACES above. Do NOT add, invent, or substitute any other venues.
- Stops are already ordered optimally — preserve this exact order
- Assign realistic durations based on venue type (museum: 1.5-2h, café: 30-45min, park: 45-60min)
- ALL place names in the output MUST be in English. Never use local-script names (Japanese, Arabic, Thai, etc).
- Start time logic:
    * If arrival_time is between 00:00-05:59 (late night / very early): set itinerary start to 09:00 AM, note rest in conflict_notes
    * If arrival_time is between 06:00-08:59: start 1 hour after arrival
    * If arrival_time is between 09:00-16:59: use arrival_time + 30 min for hotel/airport, or arrival_time directly for other start types
    * If arrival_time is between 17:00-19:59 (evening arrival): this is an evening arrival — set start to 09:00 AM. Note in conflict_notes that the evening is for settling in and dinner nearby
    * If arrival_time is 20:00 or later (very late / night arrival): rest is essential. Set start to 09:00 AM. Note in conflict_notes that Day 1 begins fresh after a late-night arrival
    * If no arrival_time: default start is 09:00 AM
- For half day: end by 14:00 unless arrival time says otherwise
- If conflict overrides exist, follow them strictly
- If jet lag adjustment is true, reduce day 1 intensity by 50% and add rest window 14:00-16:00
- If departure day with flight time, ensure last venue ends 3 hours before flight
- transit_to_next must be a realistic walking/transit time string like "12 min walk" or "8 min by metro"
- tip: ONE sentence only, max 12 words, one specific insider detail — not a paragraph
- day_narrative in summary: ONE sentence (max 8 words) capturing the day's rhythm, e.g. "Art-heavy morning, leisurely lunch, golden close."
- Add tags to each stop when relevant: use short labels from this set:
  heat (hot weather), jetlag (long-haul arrival), ramadan (religious observance period),
  altitude (high elevation venue). Only add tags when they actually apply.

Return ONLY a valid JSON object, no markdown, no explanation:
{{
  "itinerary": [
    {{
      "day": 1,
      "time": "9:00 AM",
      "place": "Place Name",
      "duration": "2 hours",
      "category": "museum",
      "tip": "Specific insider tip",
      "transit_to_next": "10 min walk",
      "tags": ["optional", "array", "of", "short", "conflict-aware", "labels"]
    }}
  ],
  "summary": {{
    "total_places": 5,
    "best_transport": "Metro and walking",
    "pro_tip": "One overall trip tip",
    "conflict_notes": "Any adaptations made — thin/tight schedule, conflicts resolved",
    "suggested_start_time": "9:00 AM",
    "day_narrative": "Cultural morning, slow lunch, golden-hour finish"
  }}
}}"""

        client  = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3500,
            timeout=45,
            messages=[{"role": "user", "content": prompt}]
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if model adds them
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw   = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        raw = raw.strip()

        result = json.loads(raw)
        return result

    except json.JSONDecodeError as e:
        print("AI JSON PARSE ERROR:", e, "| Raw:", raw[:300])
        raise HTTPException(status_code=422, detail="AI returned invalid JSON")
    except Exception as e:
        print("AI ITINERARY ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))


# =========================================
# WEATHER
# =========================================
@app.get("/weather")
def weather(city: str = Query(...)):
    try:
        if not OPENWEATHER_KEY:
            return {"error": "No weather API key set"}
        url    = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": city, "appid": OPENWEATHER_KEY, "units": "metric"}
        res    = requests.get(url, params=params, timeout=10)
        data   = res.json()
        if res.status_code != 200:
            return {"error": data.get("message", "Weather fetch failed")}
        return {
            "city":        data["name"],
            "condition":   data["weather"][0]["main"],
            "description": data["weather"][0]["description"],
            "temp":        round(data["main"]["temp"]),
            "icon":        data["weather"][0]["icon"],
            "sunrise":     data["sys"]["sunrise"],
            "sunset":      data["sys"]["sunset"],
            "humidity":    data["main"]["humidity"],
            "wind":        data["wind"]["speed"]
        }
    except Exception as e:
        print("WEATHER ERROR:", e)
        return {"error": str(e)}


# =========================================
# PLACE IMAGE
# =========================================
@app.get("/place-image")
def place_image(name: str = Query(...), city: str = Query(...)):
    VALID_EXTS = (".jpg", ".jpeg", ".png", ".webp")
    wiki_base    = "https://en.wikipedia.org/w/api.php"
    commons_base = "https://commons.wikimedia.org/w/api.php"

    # 1. Wikipedia article thumbnail
    try:
        search = requests.get(wiki_base, params={
            "action": "query", "list": "search",
            "srsearch": f"{name} {city}",
            "format": "json", "srlimit": 1
        }, timeout=4).json()
        results = search.get("query", {}).get("search", [])
        if results:
            title = results[0]["title"]
            images = requests.get(wiki_base, params={
                "action": "query", "titles": title,
                "prop": "pageimages", "pithumbsize": 600,
                "format": "json"
            }, timeout=4).json()
            for page in images.get("query", {}).get("pages", {}).values():
                thumb = page.get("thumbnail", {})
                if thumb.get("source"):
                    return {"image": thumb["source"]}
    except Exception as e:
        print("PLACE IMAGE wikipedia error:", e)

    # 2. Wikimedia Commons image search (broader: covers landmarks without Wikipedia articles)
    try:
        commons = requests.get(commons_base, params={
            "action": "query", "generator": "search",
            "gsrsearch": f"{name} {city}",
            "gsrnamespace": "6",          # File namespace only
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 600,
            "format": "json", "gsrlimit": 5
        }, timeout=4).json()
        for page in commons.get("query", {}).get("pages", {}).values():
            info_list = page.get("imageinfo", [])
            for info in info_list:
                url = info.get("thumburl") or info.get("url", "")
                if url and any(url.lower().split("?")[0].endswith(ext) for ext in VALID_EXTS):
                    return {"image": url}
    except Exception as e:
        print("PLACE IMAGE commons error:", e)

    return {"image": None}


# =========================================
# PERSONA ENGINE (protected — logic in ip_engine.py)
# =========================================
@app.post("/persona")
def persona_endpoint(body: dict):
    """
    Takes OB answers, returns archetype + conflict payload + city profile.
    All scoring logic is server-side — not exposed to browser.
    """
    try:
        ob_answers  = body.get("ob_answers", {})
        city        = body.get("city", "")
        travel_date = body.get("travel_date")
        result = build_persona_response(ob_answers, city, travel_date)
        return result
    except Exception as e:
        print("PERSONA ERROR:", e)
        return {"error": str(e)}


@app.get("/city-profile")
def city_profile_endpoint(city: str = Query(...)):
    """Returns city profile data for a given city."""
    try:
        profile = get_city_profile(city)
        return {"city": city, "profile": profile, "found": bool(profile)}
    except Exception as e:
        return {"error": str(e)}


# =========================================
# EVENTS (Ticketmaster Discovery API)
# =========================================
@app.get("/events")
def events(
    city:       str   = Query(...),
    lat:        float = Query(None),
    lon:        float = Query(None),
    start_date: str   = Query(...),   # YYYY-MM-DD
    end_date:   str   = Query(...),   # YYYY-MM-DD
):
    if not TICKETMASTER_KEY:
        return {"error": "No Ticketmaster API key configured"}
    try:
        params = {
            "apikey":        TICKETMASTER_KEY,
            "city":          city,
            "startDateTime": f"{start_date}T00:00:00Z",
            "endDateTime":   f"{end_date}T23:59:59Z",
            "size":          20,
            "sort":          "date,asc",
            "locale":        "*",
            "includeTBA":    "no",
            "includeTBD":    "no",
        }
        res  = requests.get(
            "https://app.ticketmaster.com/discovery/v2/events.json",
            params=params,
            timeout=10,
        )
        data = res.json()

        raw_events = (
            data.get("_embedded", {}).get("events", [])
            if res.status_code == 200 else []
        )

        places = []
        for ev in raw_events:
            venues = ev.get("_embedded", {}).get("venues", [])
            if not venues:
                continue
            venue = venues[0]
            loc   = venue.get("location", {})
            try:
                ev_lat = float(loc.get("latitude",  0))
                ev_lon = float(loc.get("longitude", 0))
            except (TypeError, ValueError):
                continue
            if ev_lat == 0 and ev_lon == 0:
                continue

            # Pick best image (prefer 16_9 ratio, then largest)
            images    = ev.get("images", [])
            img_url   = None
            preferred = [i for i in images if i.get("ratio") == "16_9" and not i.get("fallback")]
            if preferred:
                img_url = max(preferred, key=lambda i: i.get("width", 0)).get("url")
            elif images:
                img_url = max(images, key=lambda i: i.get("width", 0)).get("url")

            dates      = ev.get("dates", {})
            start      = dates.get("start", {})
            event_date = start.get("localDate", start_date)
            event_time = start.get("localTime", "")

            segment = ""
            cls     = ev.get("classifications", [])
            if cls:
                segment = cls[0].get("segment", {}).get("name", "")

            places.append({
                "id":       f"tm-{ev.get('id', '')}",
                "title":    ev.get("name", "Event"),
                "lat":      ev_lat,
                "lon":      ev_lon,
                "category": "event",
                "imageUrl": img_url,
                "tags": {
                    "event_date": event_date,
                    "event_time": event_time,
                    "venue":      venue.get("name", ""),
                    "genre":      segment,
                    "website":    ev.get("url", ""),
                },
            })

        # ── Yelp Events (merged in if key is configured) ──
        if YELP_API_KEY:
            try:
                from datetime import datetime as _dt
                start_ts = int(_dt.strptime(start_date, "%Y-%m-%d").timestamp())
                end_ts   = int(_dt.strptime(end_date,   "%Y-%m-%d").replace(hour=23, minute=59, second=59).timestamp())

                yelp_params = {
                    "location":   city,
                    "start_date": start_ts,
                    "end_date":   end_ts,
                    "limit":      50,
                    "sort_on":    "time_start",
                    "sort_by":    "asc",
                }
                if lat is not None and lon is not None:
                    yelp_params["latitude"]  = lat
                    yelp_params["longitude"] = lon
                    yelp_params["radius"]    = 20000   # 20 km

                yelp_res  = requests.get(
                    "https://api.yelp.com/v3/events",
                    params=yelp_params,
                    headers={"Authorization": f"Bearer {YELP_API_KEY}"},
                    timeout=10,
                )
                yelp_data = yelp_res.json()
                existing_titles = {p["title"].lower() for p in places}

                for ev in yelp_data.get("events", []):
                    ev_lat = ev.get("latitude")
                    ev_lon = ev.get("longitude")
                    if not ev_lat or not ev_lon:
                        continue
                    name = ev.get("name", "Event")
                    if name.lower() in existing_titles:
                        continue   # skip duplicates already from Ticketmaster
                    existing_titles.add(name.lower())

                    time_start = ev.get("time_start", "")
                    event_date = time_start[:10] if time_start else start_date
                    event_time = time_start[11:16] if len(time_start) > 10 else ""

                    loc       = ev.get("location", {})
                    venue_str = ", ".join(filter(None, [loc.get("address1", ""), loc.get("city", "")]))

                    places.append({
                        "id":       f"yelp-{ev.get('id', '')}",
                        "title":    name,
                        "lat":      ev_lat,
                        "lon":      ev_lon,
                        "category": "event",
                        "imageUrl": ev.get("image_url"),
                        "tags": {
                            "event_date": event_date,
                            "event_time": event_time,
                            "venue":      venue_str,
                            "genre":      ev.get("category", "").replace("_", " ").title(),
                            "website":    ev.get("event_site_url", ""),
                        },
                    })
                print(f"EVENTS (Yelp): added {len(yelp_data.get('events', []))} Yelp events")
            except Exception as ye:
                print(f"EVENTS Yelp error (non-fatal): {ye}")

        print(f"EVENTS: {len(places)} total events for {city} ({start_date}–{end_date})")
        return places

    except Exception as e:
        print("EVENTS ERROR:", e)
        return {"error": str(e)}


# =========================================
# HEALTH CHECK
# =========================================
@app.get("/")
def root():
    return {"status": "ok", "service": "Uncover Roads API"}


# =========================================
# GOOGLE PLACES AUTOCOMPLETE
# =========================================
@app.get("/places-autocomplete")
def places_autocomplete(
    request: Request,
    query: str,
    session_id: str,
    types: str = "(cities)",
):
    """
    Google Places Autocomplete with session tokens.
    All keystrokes in a session are FREE — billing only happens at Place Details.
    types: "(cities)" for city search, "establishment" for POI search.
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"predictions": []}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    if session_id not in _session_tokens:
        if len(_session_tokens) >= _SESSION_TOKEN_MAX:
            # Evict oldest 10% of sessions when at capacity
            evict_count = _SESSION_TOKEN_MAX // 10
            for k in list(_session_tokens.keys())[:evict_count]:
                del _session_tokens[k]
        _session_tokens[session_id] = str(uuid.uuid4())
    session_token = _session_tokens[session_id]

    params = {
        "input": query,
        "types": types,
        "sessiontoken": session_token,
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/autocomplete/json", params=params, timeout=5)
        data = resp.json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            return {"predictions": [], "error": status or "UNKNOWN_ERROR"}
        return {
            "predictions": [
                {
                    "place_id": p["place_id"],
                    "description": p["description"],
                    "main_text": p.get("structured_formatting", {}).get("main_text", p["description"]),
                    "secondary_text": p.get("structured_formatting", {}).get("secondary_text", ""),
                }
                for p in data.get("predictions", [])
            ]
        }
    except Exception as e:
        return {"predictions": [], "error": str(e)}


# =========================================
# GEOCODE PLACE
# =========================================
@app.get("/geocode-place")
def geocode_place(request: Request, place_id: str, session_id: str):
    """
    Get lat/lon + name from a place_id after autocomplete selection.
    This ENDS the session token (billing event: $0.017).
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"lat": None, "lon": None}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    session_token = _session_tokens.pop(session_id, None)

    params = {
        "place_id": place_id,
        "fields": "geometry,name,formatted_address",
        "key": GOOGLE_PLACES_API_KEY,
    }
    if session_token:
        params["sessiontoken"] = session_token

    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/details/json", params=params, timeout=5)
        data = resp.json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            return {"lat": None, "lon": None, "error": status or "UNKNOWN_ERROR"}
        result = data.get("result", {})
        loc = result.get("geometry", {}).get("location", {})
        return {
            "lat": loc.get("lat"),
            "lon": loc.get("lng"),
            "name": result.get("name"),
            "address": result.get("formatted_address"),
        }
    except Exception as e:
        return {"lat": None, "lon": None, "error": str(e)}


# =========================================
# FIND PLACE ID
# =========================================
@app.get("/find-place-id")
def find_place_id(request: Request, name: str, lat: float, lon: float):
    """
    Resolve Google place_id from an OSM place name + coordinates.
    Called once per unique pin tap — result cached client-side.
    Cost: $0.017/call (Find Place Basic Data).
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"place_id": None}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    params = {
        "input": name,
        "inputtype": "textquery",
        "locationbias": f"point:{lat},{lon}",
        "fields": "place_id,name",
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/findplacefromtext/json", params=params, timeout=5)
        data = resp.json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            return {"place_id": None, "error": status or "UNKNOWN_ERROR"}
        candidates = data.get("candidates", [])
        if candidates:
            return {"place_id": candidates[0]["place_id"], "name": candidates[0].get("name")}
        return {"place_id": None}
    except Exception as e:
        return {"place_id": None, "error": str(e)}


# =========================================
# PLACE DETAILS
# =========================================
@app.get("/place-details")
def place_details(request: Request, place_id: str):
    """
    Fetch Google Place Details. Cost: $0.017/call.
    Checks Supabase cache first (24hr TTL) — cache hit = $0.
    """
    if not GOOGLE_PLACES_API_KEY:
        return {
            "place_id": place_id, "name": None, "address": None,
            "lat": None, "lon": None, "rating": None, "rating_count": None,
            "phone": None, "website": None, "price_level": None,
            "open_now": None, "weekday_text": [], "photo_ref": None, "types": []
        }

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # 1. Check Supabase cache
    if _supabase:
        try:
            cached = (
                _supabase.table("place_details_cache")
                .select("data, fetched_at")
                .eq("place_id", place_id)
                .maybe_single()
                .execute()
            )
            if cached.data:
                fetched_at = datetime.fromisoformat(cached.data["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(days=PLACE_CACHE_TTL_DAYS):
                    return cached.data["data"]  # cache hit — no Google call
        except Exception:
            pass  # cache failure is non-fatal

    # 2. Cache miss — call Google
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types",
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/details/json", params=params, timeout=5)
        data = resp.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            status = data.get("status", "UNKNOWN_ERROR")
            return {
                "place_id": place_id, "name": None, "address": None,
                "lat": None, "lon": None, "rating": None, "rating_count": None,
                "phone": None, "website": None, "price_level": None,
                "open_now": None, "weekday_text": [], "photo_ref": None,
                "types": [], "error": status
            }

        result = data.get("result", {})
        photo_ref = None
        if result.get("photos"):
            photo_ref = result["photos"][0]["photo_reference"]

        details = {
            "place_id": place_id,
            "name": result.get("name"),
            "address": result.get("formatted_address"),
            "lat": result.get("geometry", {}).get("location", {}).get("lat"),
            "lon": result.get("geometry", {}).get("location", {}).get("lng"),
            "rating": result.get("rating"),
            "rating_count": result.get("user_ratings_total"),
            "phone": result.get("formatted_phone_number"),
            "website": result.get("website"),
            "price_level": result.get("price_level"),
            "open_now": result.get("opening_hours", {}).get("open_now"),
            "weekday_text": result.get("opening_hours", {}).get("weekday_text", []),
            "photo_ref": photo_ref,
            "types": result.get("types", []),
        }

        # 3. Write to cache
        if _supabase:
            try:
                _supabase.table("place_details_cache").upsert({
                    "place_id": place_id,
                    "data": details,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception:
                pass  # cache write failure is non-fatal

        return details
    except Exception as e:
        return {
            "place_id": place_id, "name": None, "address": None,
            "lat": None, "lon": None, "rating": None, "rating_count": None,
            "phone": None, "website": None, "price_level": None,
            "open_now": None, "weekday_text": [], "photo_ref": None,
            "types": [], "error": str(e)
        }


@app.get("/place-photo")
def place_photo(request: Request, photo_ref: str = Query(...), max_width: int = Query(800)):
    """Proxy Google Place Photos — keeps API key off the client."""
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not configured")
    url = (
        f"https://maps.googleapis.com/maps/api/place/photo"
        f"?photo_reference={photo_ref}&maxwidth={max_width}&key={GOOGLE_PLACES_API_KEY}"
    )
    return RedirectResponse(url=url, status_code=302)


@app.get("/nearby")
def nearby(
    request: Request,
    response: Response,
    lat: float = Query(...),
    lon: float = Query(...),
    type: str = Query(...),
    radius: int = Query(500),
    limit: int = Query(3),
):
    """
    Google Places Nearby Search — called only on expand chip tap.
    Cost: ~$0.032 per request. Rate-limited per IP.
    """
    if not GOOGLE_PLACES_API_KEY:
        return []
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    response.headers["Cache-Control"] = "max-age=300"

    params = {
        "location": f"{lat},{lon}",
        "radius": radius,
        "type": type,
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
            params=params,
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return []

        results = []
        for place in data.get("results", [])[:limit]:
            loc = place.get("geometry", {}).get("location", {})
            place_lat = loc.get("lat", 0)
            place_lon = loc.get("lng", 0)
            dlat = math.radians(place_lat - lat)
            dlon = math.radians(place_lon - lon)
            a = (math.sin(dlat / 2) ** 2
                 + math.cos(math.radians(lat))
                 * math.cos(math.radians(place_lat))
                 * math.sin(dlon / 2) ** 2)
            distance_m = int(6371000 * 2 * math.asin(math.sqrt(a)))
            results.append({
                "name": place.get("name", ""),
                "address": place.get("vicinity", ""),
                "rating": place.get("rating"),
                "distance_m": distance_m,
                "lat": place_lat,
                "lon": place_lon,
                "place_id": place.get("place_id", ""),
            })
        return results
    except Exception:
        return []


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
