from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import re
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
        params = {"q": city, "format": "json", "limit": 1, "addressdetails": 1, "accept-language": "en"}
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
        addr = result.get("address", {})
        return {
            "city": result["display_name"],
            "lat": lat, "lon": lon,
            "bbox": [south, north, west, east],
            "country": addr.get("country", "")
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
def _overpass_map_data(clat: float, clon: float, radius_m: int) -> list:
    """OSM fallback via Overpass API — used when Google Nearby Search is unavailable."""
    query = f"""
[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|bar|food_court"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"="museum"]["name"](around:{radius_m},{clat},{clon});
  way["amenity"="museum"]["name"](around:{radius_m},{clat},{clon});
  node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:{radius_m},{clat},{clon});
  way["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:{radius_m},{clat},{clon});
  node["leisure"~"park|garden|nature_reserve"]["name"](around:{radius_m},{clat},{clon});
  way["leisure"~"park|garden|nature_reserve"]["name"](around:{radius_m},{clat},{clon});
  node["historic"]["name"](around:{radius_m},{clat},{clon});
  way["historic"]["name"](around:{radius_m},{clat},{clon});
);
out center 200;
"""
    data = fetch_overpass(query)
    places = []
    seen_names: set = set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = (
            tags.get("name:en") or tags.get("int_name") or
            tags.get("name:ja_rm") or tags.get("name:ko_rm") or
            tags.get("name", "")
        ).strip()
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        amenity = tags.get("amenity", "")
        tourism = tags.get("tourism", "")
        leisure = tags.get("leisure", "")
        historic = tags.get("historic", "")

        if amenity in ("restaurant", "bar", "food_court") or tags.get("cuisine"):
            cat = "restaurant"
        elif amenity == "cafe":
            cat = "cafe"
        elif amenity == "museum" or tourism == "museum":
            cat = "museum"
        elif leisure in ("park", "garden", "nature_reserve"):
            cat = "park"
        elif historic:
            cat = "historic"
        elif tourism in ("attraction", "artwork", "viewpoint", "gallery"):
            cat = "tourism"
        else:
            cat = "place"

        el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        el_lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if el_lat is None or el_lon is None:
            continue

        uid = f"osm-{el.get('type','n')}-{el.get('id', name)}"
        places.append({
            "id":       uid,
            "title":    name,
            "lat":      el_lat,
            "lon":      el_lon,
            "category": cat,
            "tags": {
                "opening_hours": tags.get("opening_hours", ""),
                "website":       tags.get("website", ""),
                "cuisine":       tags.get("cuisine", ""),
                "description":   tags.get("description", ""),
            },
        })
    return places


@app.get("/map-data")
def map_data(
    city:       str   = Query(""),
    lat:        float = Query(None),
    lon:        float = Query(None),
    center_lat: float = Query(None),
    center_lon: float = Query(None),
    radius_m:   int   = Query(3000),
    # legacy bbox params — ignored, kept for backward compat
    south: float = Query(None),
    west:  float = Query(None),
    north: float = Query(None),
    east:  float = Query(None),
):
    """
    Returns nearby places. Primary: Google Nearby Search (rich data).
    Fallback: Overpass OSM (when Google API key not configured or returns empty).
    Results cached in Supabase map_data_cache by ~5km tile key for MAP_DATA_CACHE_TTL_HOURS.
    """
    # Resolve search center
    clat = center_lat or lat
    clon = center_lon or lon

    if clat is None or clon is None:
        if not city:
            return []
        geo = geocode(city)
        if "error" in geo:
            return []
        clat, clon = geo["lat"], geo["lon"]

    radius_m = max(500, min(radius_m, 50000))

    # Tile key — snap to nearest 0.05° grid (~5km)
    tile_lat = round(round(clat / 0.05) * 0.05, 2)
    tile_lon = round(round(clon / 0.05) * 0.05, 2)
    tile_key = f"{tile_lat},{tile_lon}"

    # Check Supabase tile cache
    if _supabase:
        try:
            cached = (
                _supabase.table("map_data_cache")
                .select("places, fetched_at")
                .eq("tile_key", tile_key)
                .maybe_single()
                .execute()
            )
            if cached.data:
                fetched_at = datetime.fromisoformat(cached.data["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(hours=MAP_DATA_CACHE_TTL_HOURS):
                    print(f"MAP DATA: cache hit for tile {tile_key}")
                    return cached.data["places"]
        except Exception:
            pass

    places: list = []

    # ── Primary: Google Nearby Search ──
    if GOOGLE_PLACES_API_KEY:
        seen_place_ids: set = set()
        for gtype, category in _NEARBY_TYPE_TO_CATEGORY.items():
            try:
                resp = requests.get(
                    f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                    params={
                        "location": f"{clat},{clon}",
                        "radius":   radius_m,
                        "type":     gtype,
                        "key":      GOOGLE_PLACES_API_KEY,
                    },
                    timeout=8,
                )
                data = resp.json()
                status = data.get("status", "OK")
                if status not in ("OK", "ZERO_RESULTS"):
                    print(f"MAP DATA: nearbysearch {gtype} status={status}")
                    continue
                for r in data.get("results", []):
                    pid = r.get("place_id")
                    if not pid or pid in seen_place_ids:
                        continue
                    seen_place_ids.add(pid)
                    photo_ref = None
                    if r.get("photos"):
                        photo_ref = r["photos"][0]["photo_reference"]
                    loc = r.get("geometry", {}).get("location", {})
                    places.append({
                        "id":          pid,
                        "title":       r.get("name", ""),
                        "lat":         loc.get("lat"),
                        "lon":         loc.get("lng"),
                        "category":    category,
                        "place_id":    pid,
                        "rating":      r.get("rating"),
                        "open_now":    r.get("opening_hours", {}).get("open_now"),
                        "photo_ref":   photo_ref,
                        "price_level": r.get("price_level"),
                        "tags":        {"types": ",".join(r.get("types", []))},
                    })
            except Exception as e:
                print(f"MAP DATA: nearbysearch failed for type {gtype}: {e}")
                continue
    else:
        print("MAP DATA: GOOGLE_PLACES_API_KEY not set — using Overpass fallback")

    # ── Fallback: Overpass OSM ──
    if not places:
        print(f"MAP DATA: Google returned 0 places, trying Overpass fallback for {tile_key}")
        try:
            places = _overpass_map_data(clat, clon, radius_m)
            print(f"MAP DATA: Overpass returned {len(places)} places")
        except Exception as e:
            print(f"MAP DATA: Overpass fallback failed: {e}")

    # Store in Supabase tile cache
    if _supabase and places:
        try:
            _supabase.table("map_data_cache").upsert({
                "tile_key":   tile_key,
                "places":     places,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

    print(f"MAP DATA: returning {len(places)} places for tile {tile_key} ({city})")
    return places


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
# AI ITINERARY STREAM
# =========================================
@app.post("/ai-itinerary-stream")
def ai_itinerary_stream(body: dict):
    places    = body.get("selected_places", [])
    city      = body.get("city", "the city")
    days      = int(body.get("days", 1))
    pace      = body.get("pace", "moderate")
    persona   = body.get("persona", "")
    archetype = body.get("persona_archetype", "")
    trip_ctx  = body.get("trip_context", {})

    if not places:
        return {"itinerary": [], "summary": {}}
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    # Nearest-neighbour sort (same as /ai-itinerary)
    def _dist2(a, b):
        return (a.get('lat', 0) - b.get('lat', 0))**2 + (a.get('lon', 0) - b.get('lon', 0))**2

    def _nn_sort(pts, start_lat=None, start_lon=None):
        if len(pts) <= 1:
            return pts
        remaining = list(pts)
        sorted_pts = []
        if start_lat is not None:
            cur = {'lat': start_lat, 'lon': start_lon}
        else:
            clat = sum(p.get('lat', 0) for p in pts) / len(pts)
            clon = sum(p.get('lon', 0) for p in pts) / len(pts)
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
        f"- {p['title']} (category: {p.get('category', 'place')}, "
        f"lat: {p.get('lat')}, lon: {p.get('lon')})"
        for p in places
    ])

    # Conflict check (same as /ai-itinerary)
    conflict = body.get("conflict_resolution", {})
    if not conflict:
        try:
            persona_dict = {
                'archetype': body.get('persona_archetype', ''),
                'ritual': trip_ctx.get('ritual', '') or body.get('ritual', ''),
                'pace': body.get('pace', ''),
                'sensory': body.get('sensory', ''),
                'social': body.get('social', ''),
                'attractions': body.get('attractions', []),
            }
            travel_date = trip_ctx.get('travel_date') or body.get('date', '')
            conflict = run_conflict_check(
                city=body.get('city', ''),
                persona=persona_dict,
                travel_date=travel_date,
            )
        except Exception as e:
            print(f"CONFLICT CHECK ERROR: {e}")
            conflict = {"has_conflicts": False, "conflicts": []}

    conflict_str = ""
    if conflict.get("has_conflicts"):
        top_conflicts = [c for c in conflict.get("conflicts", [])
                         if c.get("severity") in ("high", "medium")][:3]
        if top_conflicts:
            instructions = " | ".join(
                c.get("instruction", "") for c in top_conflicts if c.get("instruction")
            )
            conflict_str = f"CONFLICT OVERRIDES (apply strictly):\n{instructions}\n"

    start_date = trip_ctx.get("travel_date", "")
    arrival_time = trip_ctx.get("arrival_time", "") or "not specified"
    location_note = ""
    if trip_ctx.get("location_name"):
        location_note = (
            f"- Starting location: {trip_ctx.get('location_name')} "
            f"(lat: {trip_ctx.get('location_lat', '?')}, lon: {trip_ctx.get('location_lon', '?')})"
        )

    # Build per-day date strings for the OUTPUT FORMAT block
    def _iso_plus(base: str, delta: int) -> str:
        try:
            from datetime import datetime, timedelta
            d = datetime.strptime(base, "%Y-%m-%d")
            return (d + timedelta(days=delta)).strftime("%Y-%m-%d")
        except Exception:
            return base

    day_dates = [_iso_plus(start_date, i) for i in range(days)]
    day_dates_str = ", ".join(f"day {i+1}: {d}" for i, d in enumerate(day_dates))

    output_format = f"""
OUTPUT FORMAT — FOLLOW EXACTLY:
- Output {days} lines total — one line per day, no other text
- Each line is a single compact JSON object with NO internal newlines
- Line format: {{"day_number":N,"date":"YYYY-MM-DD","itinerary":[...],"summary":{{...}}}}
- Dates: {day_dates_str}
- Do NOT wrap in an array. Do not add markdown, labels, or blank lines.
- Each "itinerary" array element: {{"day":N,"time":"H:MM AM","place":"Name","duration":"X hours","category":"type","tip":"One sentence","transit_to_next":"X min walk","tags":[]}}
- Each "summary" object: {{"total_places":N,"best_transport":"...","pro_tip":"...","conflict_notes":"...","suggested_start_time":"H:MM AM","day_narrative":"..."}}
"""

    prompt = f"""You are an expert travel planner creating a hyper-personalised multi-day itinerary.

CITY: {city}
TOTAL DAYS: {days}
PACE: {pace}

TRAVELLER PERSONA: {archetype or 'general traveller'}
{persona}

SELECTED PLACES (shared across all days — distribute sensibly):
{place_list}

{conflict_str}
TRIP CONTEXT:
- Travel dates start: {start_date}
- Starting from: {trip_ctx.get('start_type', 'hotel')}
- Arrival time day 1: {arrival_time}
- Flight time (if departure day): {trip_ctx.get('flight_time', '') or 'N/A'}
- Long-haul jet lag adjustment: {trip_ctx.get('is_long_haul', False)}
{location_note}

CRITICAL RULES — FOLLOW STRICTLY:
- Return ONLY the exact places listed in SELECTED PLACES above. Do NOT add, invent, or substitute any other venues.
- Distribute places across days logically (proximity, energy, venue type)
- Stops within each day are already ordered optimally — preserve order per day
- Assign realistic durations based on venue type (museum: 1.5-2h, café: 30-45min, park: 45-60min)
- ALL place names in the output MUST be in English. Never use local-script names.
- Start time logic for day 1 (subsequent days default to 09:00 AM):
    * If arrival_time 00:00-05:59: set day 1 start 09:00 AM, note rest in conflict_notes
    * If arrival_time 06:00-08:59: start 1 hour after arrival
    * If arrival_time 09:00-16:59: use arrival_time + 30 min for hotel/airport
    * If arrival_time 17:00-19:59: set day 1 start 09:00 AM; note evening is for settling in
    * If arrival_time 20:00+: set day 1 start 09:00 AM; note late-night arrival
    * If no arrival_time: default start 09:00 AM
- If jet lag is true, reduce day 1 intensity by 50% and add rest window 14:00-16:00
- transit_to_next must be a realistic walking/transit time string
- tip: ONE sentence, max 12 words, one specific insider detail
- day_narrative in summary: ONE sentence (max 8 words) capturing the day's rhythm

{output_format}"""

    def generate():
        buffer = ""
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                timeout=120,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    buffer += text
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = re.sub(r'\s+', ' ', line).strip()
                        if not line:
                            continue
                        try:
                            parsed = json.loads(line)
                            yield json.dumps(parsed) + '\n'
                        except json.JSONDecodeError:
                            pass  # malformed line — frontend detects missing day, auto-retries
            # flush remaining buffer
            if buffer.strip():
                try:
                    parsed = json.loads(re.sub(r'\s+', ' ', buffer).strip())
                    yield json.dumps(parsed) + '\n'
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            print(f"STREAM ERROR: {e}")
            # StreamingResponse has already started — cannot raise HTTPException here
            # Frontend detects incomplete stream by day count

    return StreamingResponse(generate(), media_type="application/x-ndjson")


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
# REFERENCE PINS — LLM-generated ghost pins
# =========================================
@app.post("/reference-pins")
def reference_pins_endpoint(body: dict):
    """
    Generate 8-10 reference pins for a city, persona-filtered.
    Optionally takes prev_city_context to chain multi-city recommendations.
    Returns: { pins: [...], storyCards: [...] }
    """
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    city = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Explorer")
    days = body.get("days", 1)
    prev_city = body.get("prev_city", "")
    prev_picks = body.get("prev_picks", [])  # list of place title strings

    if not city:
        return {"error": "city is required"}

    context_clause = ""
    if prev_city and prev_picks:
        picks_str = ", ".join(prev_picks[:5])
        context_clause = (
            f" The traveler is arriving from {prev_city} where they visited: {picks_str}."
            " Tailor recommendations to complement, not duplicate, their prior city."
        )

    prompt = f"""You are a travel intelligence engine. Generate exactly 8-10 reference pins for a {persona_archetype} traveler visiting {city} for {days} day(s).{context_clause}

Return a JSON object with this exact structure:
{{
  "pins": [
    {{
      "id": "ref-<short_slug>",
      "title": "Place Name",
      "lat": 35.1234,
      "lon": 139.5678,
      "category": "museum|historic|park|restaurant|cafe|tourism|place",
      "whyRec": "One sentence matching this persona's interests",
      "localTip": "One insider tip a local would share"
    }}
  ],
  "storyCards": [
    {{
      "imageUrl": "",
      "headline": "Short evocative headline about {city}",
      "body": "One fascinating fact about {city} relevant to a {persona_archetype}",
      "cityContext": "{prev_city + ' → ' + city if prev_city else city}"
    }}
  ]
}}

Rules:
- Coordinates must be accurate real-world lat/lon for {city}
- Pins must be real, well-known places
- whyRec must be persona-specific (persona: {persona_archetype})
- localTip must be practical and specific (e.g. "Enter from the east gate — shorter queue")
- Generate 2-3 story cards
- Return only valid JSON, no markdown fences"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if "```" in raw:
            import re
            raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        result = json.loads(raw)
        return result
    except json.JSONDecodeError as e:
        print(f"REFERENCE PINS JSON ERROR: {e}")
        return {"pins": [], "storyCards": []}
    except Exception as e:
        print(f"REFERENCE PINS ERROR: {e}")
        return {"error": str(e)}


# =========================================
# SIMILAR PLACES — LLM-generated similar pin set
# =========================================
@app.post("/similar-places")
def similar_places_endpoint(body: dict):
    """
    Generate 4 places similar to a given place in the same city.
    Returns: { places: [...] }
    """
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    place_name = body.get("place_name", "")
    city = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Explorer")
    category = body.get("category", "place")

    if not place_name or not city:
        return {"error": "place_name and city are required"}

    prompt = f"""You are a travel intelligence engine. A {persona_archetype} traveler just viewed {place_name} in {city} (category: {category}).

Generate exactly 4 nearby places that are similar — same category, close proximity, complementary vibe.

Return a JSON object:
{{
  "places": [
    {{
      "id": "ref-<short_slug>",
      "title": "Place Name",
      "lat": 35.1234,
      "lon": 139.5678,
      "category": "museum|historic|park|restaurant|cafe|tourism|place",
      "whyRec": "One sentence on why this is similar to {place_name}",
      "localTip": "One practical insider tip"
    }}
  ]
}}

Rules:
- Coordinates must be accurate real-world lat/lon in {city}, within 2km of {place_name} if possible
- All 4 places must be real, well-known locations
- Return only valid JSON, no markdown fences"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if "```" in raw:
            import re
            raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        result = json.loads(raw)
        return result
    except json.JSONDecodeError as e:
        print(f"SIMILAR PLACES JSON ERROR: {e}")
        return {"places": []}
    except Exception as e:
        print(f"SIMILAR PLACES ERROR: {e}")
        return {"error": str(e)}


# =========================================
# RECOMMENDED PLACES — LLM picks with persona + behaviour signals
# =========================================
@app.post("/recommended-places")
def recommended_places_endpoint(body: dict):
    """
    Generate 6-8 persona-matched place picks for the Our Picks filter.
    Uses both persona profile and browsing behaviour as signals.
    Returns: { picks: [{ title, category, lat, lon, whyRec, signal }] }
    """
    if not ANTHROPIC_API_KEY:
        return {"picks": []}

    city              = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Explorer")
    persona_desc      = body.get("persona_desc", "")
    venue_filters     = body.get("venue_filters", [])
    itinerary_bias    = body.get("itinerary_bias", [])
    viewed_categories = body.get("viewed_categories", [])

    if not city:
        return {"picks": []}

    interests_str = ", ".join(set(venue_filters + itinerary_bias)) or "general sightseeing"
    browsing_str  = ", ".join(set(viewed_categories)) if viewed_categories else "nothing yet"

    prompt = f"""You are a travel recommendation engine for the app Uncover Roads.

A "{persona_archetype}" traveler ({persona_desc}) is visiting {city}.
Their interests: {interests_str}.
They have been browsing these place types on the map: {browsing_str}.

Recommend exactly 6-8 real, specific, named places in {city} that are worth visiting.
For each place return a JSON object with:
- "title": exact place name (must be a real place)
- "category": one of [restaurant, cafe, park, museum, historic, tourism, place]
- "lat": latitude as a float (accurate real-world coordinates for {city})
- "lon": longitude as a float
- "whyRec": one sentence explaining why this specific place suits this traveler. Be direct and transparent.
- "signal": "persona" if this pick is primarily driven by their travel profile/interests, "behaviour" if driven by what they have been browsing

Rules:
- Never include events or temporary exhibitions
- Coordinates must be accurate for {city}
- whyRec must mention something specific about the place, not a generic statement
- Return only a valid JSON array of 6-8 objects. No markdown. No explanation.
"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            import re
            raw = re.sub(r"```(?:json)?\s*", "", raw).strip()

        picks = json.loads(raw)
        if not isinstance(picks, list):
            return {"picks": []}

        # Filter events, validate required fields
        valid = []
        for p in picks:
            if not isinstance(p, dict):
                continue
            if p.get("category") == "event":
                continue
            if not p.get("title") or not p.get("lat") or not p.get("lon"):
                continue
            # Geocode if coords are 0 or missing
            lat = float(p.get("lat", 0))
            lon = float(p.get("lon", 0))
            if (lat == 0 and lon == 0) and GOOGLE_PLACES_API_KEY:
                try:
                    geo_res = requests.get(
                        f"{GOOGLE_PLACES_BASE}/textsearch/json",
                        params={"query": f"{p['title']} {city}", "key": GOOGLE_PLACES_API_KEY},
                        timeout=5,
                    )
                    geo_data = geo_res.json()
                    if geo_data.get("results"):
                        loc = geo_data["results"][0]["geometry"]["location"]
                        lat, lon = loc["lat"], loc["lng"]
                except Exception:
                    pass  # skip geocode failure, keep original coords

            valid.append({
                "id":       f"rec-{p['title'].lower()[:20]}",
                "title":    p["title"],
                "category": p.get("category", "place"),
                "lat":      lat,
                "lon":      lon,
                "whyRec":   p.get("whyRec", ""),
                "signal":   p.get("signal", "persona"),
            })

        return {"picks": valid}

    except json.JSONDecodeError as e:
        print(f"RECOMMENDED PLACES JSON ERROR: {e}")
        return {"picks": []}
    except Exception as e:
        print(f"RECOMMENDED PLACES ERROR: {e}")
        return {"picks": []}


@app.post("/persona-insight")
def persona_insight_endpoint(body: dict):
    """
    Generate a short persona-matched insight for a single place.
    mode='map'       → 1 sentence, ≤20 words
    mode='itinerary' → 2-3 sentences with a practical tip
    Returns: { insight: str | null }
    """
    if not ANTHROPIC_API_KEY:
        return {"insight": None}

    place_title       = body.get("place_title", "")
    place_category    = body.get("place_category", "place")
    city              = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Traveller")
    persona_desc      = body.get("persona_desc", "")
    mode              = body.get("mode", "map")
    tags              = body.get("tags") or {}
    if not isinstance(tags, dict):
        tags = {}
    price_level       = body.get("price_level")

    # Validate mode
    if mode not in ("map", "itinerary"):
        mode = "map"

    if not place_title:
        return {"insight": None}

    # Sanitise string fields to prevent prompt injection
    MAX_TITLE = 200
    MAX_DESC = 500
    MAX_CITY = 100
    if not isinstance(place_title, str): place_title = str(place_title)
    if not isinstance(place_category, str): place_category = "place"
    if not isinstance(city, str): city = ""
    if not isinstance(persona_archetype, str): persona_archetype = "Traveller"
    if not isinstance(persona_desc, str): persona_desc = ""
    place_title       = place_title[:MAX_TITLE].replace('"', "'")
    place_category    = place_category[:50].replace('"', "'")
    city              = city[:MAX_CITY].replace('"', "'")
    persona_archetype = persona_archetype[:100].replace('"', "'")
    persona_desc      = persona_desc[:MAX_DESC].replace('"', "'")

    # Build context string from tags
    tag_parts = []
    opening_hours = tags.get("opening_hours", "")
    cuisine = tags.get("cuisine", "")
    if isinstance(opening_hours, str) and opening_hours:
        tag_parts.append(f"opening hours: {opening_hours[:100].replace(chr(34), chr(39))}")
    if isinstance(cuisine, str) and cuisine:
        tag_parts.append(f"cuisine: {cuisine[:50].replace(chr(34), chr(39))}")
    tag_str = "; ".join(tag_parts) if tag_parts else "no extra info"

    price_str = f"price level {price_level}/4" if isinstance(price_level, int) and price_level is not None else "unknown price"

    if mode == "map":
        system = (
            "You are a travel assistant. In exactly one sentence of 20 words or fewer, "
            "explain why this specific place suits this traveler. Be concrete and specific — "
            "mention something about the place itself, not just the archetype."
        )
    else:
        system = (
            "You are a travel assistant. In 2-3 sentences, explain why this specific place "
            "suits this traveler. Include one practical tip: best time to visit, what to order, "
            "or a heads-up if something may not suit them."
        )

    user_msg = (
        f'Place: "{place_title}" ({place_category}) in {city}. '
        f'{price_str}. {tag_str}.\n'
        f'Traveler: "{persona_archetype}" — {persona_desc}.\n'
        f'Write the insight now.'
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        insight = response.content[0].text.strip()
        return {"insight": insight if insight else None}
    except Exception as e:
        print(f"PERSONA INSIGHT ERROR: {e}")
        return {"insight": None}


@app.post("/recalibrate")
def recalibrate_endpoint(body: dict):
    """
    Day-of recalibration: given current stops, time, and live conditions,
    return only stops that benefit from a timing/routing adjustment.
    Returns: { swap_cards: [...] }
    """
    if not ANTHROPIC_API_KEY:
        return {"swap_cards": []}

    stops         = body.get("stops", [])
    current_time  = body.get("current_time", "09:00")
    persona       = body.get("persona", "explorer")
    pace          = body.get("pace", "balanced")
    city          = body.get("city", "")
    travel_date   = body.get("travel_date", "")

    if not stops or not city:
        return {"swap_cards": []}

    stops_text = "\n".join(
        f"{i+1}. {s.get('place','?')} | time: {s.get('time','?')} | duration: {s.get('duration','?')}"
        for i, s in enumerate(stops)
    )

    prompt = f"""You are a real-time travel advisor. A {persona} traveler with a {pace} pace
is currently in {city} on {travel_date}. The current local time is {current_time}.

Their planned itinerary:
{stops_text}

Identify ONLY stops that genuinely benefit from a change given the current time and typical
day-of conditions (opening times, crowds, sequencing efficiency). Do not suggest changes just
to change things.

For each stop that needs adjustment, return a swap card. Return an empty array if no changes
are needed.

Return JSON only:
{{
  "swap_cards": [
    {{
      "id": "swap-<stop_slug>",
      "stop_name": "Place Name",
      "stop_idx": 0,
      "current_summary": "2:00 PM · 2 hrs",
      "current_note": "optional note about current plan",
      "suggested_summary": "Move to 11:00 AM",
      "suggested_note": "Reason in 1-2 sentences. Be specific about why now is better."
    }}
  ]
}}

Rules:
- stop_idx is zero-based
- Return only valid JSON, no markdown fences
- Maximum 3 swap cards — prioritise the highest-impact changes only"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if "```" in raw:
            import re
            raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        result = json.loads(raw)
        # Normalise: ensure resolved/choice fields exist
        for card in result.get("swap_cards", []):
            card.setdefault("resolved", False)
            card.setdefault("choice", None)
        return result
    except json.JSONDecodeError as e:
        print(f"RECALIBRATE JSON ERROR: {e}")
        return {"swap_cards": []}
    except Exception as e:
        print(f"RECALIBRATE ERROR: {e}")
        return {"swap_cards": []}


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
            "startDateTime": f"{start_date}T00:00:00Z",
            "endDateTime":   f"{end_date}T23:59:59Z",
            "size":          20,
            "sort":          "date,asc",
            "locale":        "*",
            "includeTBA":    "no",
            "includeTBD":    "no",
        }
        # Prefer lat/lon over city name — more reliable for international cities
        if lat is not None and lon is not None:
            params["latlong"] = f"{lat},{lon}"
            params["radius"]  = "50"
            params["unit"]    = "km"
        else:
            params["city"] = city
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
    types: str = "",
):
    """
    Google Places Autocomplete with session tokens.
    All keystrokes in a session are FREE — billing only happens at Place Details.
    types: "" (no filter) returns cities + establishments; "(cities)" was too restrictive.
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
        "sessiontoken": session_token,
        "key": GOOGLE_PLACES_API_KEY,
    }
    if types:
        params["types"] = types
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
                    "main_text": p.get("structured_formatting", {}).get("main_text", p["description"]),
                    "secondary_text": p.get("structured_formatting", {}).get("secondary_text", ""),
                    "types": p.get("types", []),
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
    Resolve Google place_id from coordinates (primary) or name (fallback).

    Strategy:
      1. Check Supabase place_id_cache by coords_key — instant, free
      2. Google findplacefromtext with name + location bias — good for named places
      3. Google nearbysearch with 10m radius — coordinate-based, catches name mismatches
      4. Write resolved place_id to Supabase cache for all future taps

    Required Supabase table:
      CREATE TABLE place_id_cache (
        coords_key text PRIMARY KEY,
        place_id   text NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now()
      );
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"place_id": None}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    coords_key = f"{lat:.5f},{lon:.5f}"

    # 1. Supabase cache hit — no Google call needed
    if _supabase:
        try:
            cached = (
                _supabase.table("place_id_cache")
                .select("place_id")
                .eq("coords_key", coords_key)
                .maybe_single()
                .execute()
            )
            if cached.data and cached.data.get("place_id"):
                return {"place_id": cached.data["place_id"]}
        except Exception:
            pass

    place_id = None

    # 2. findplacefromtext with name + location bias
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/findplacefromtext/json",
            params={
                "input": name,
                "inputtype": "textquery",
                "locationbias": f"point:{lat},{lon}",
                "fields": "place_id,name",
                "key": GOOGLE_PLACES_API_KEY,
            },
            timeout=5,
        )
        candidates = resp.json().get("candidates", [])
        if candidates:
            place_id = candidates[0]["place_id"]
    except Exception:
        pass

    # 3. Fallback: nearbysearch with 10m radius (coordinate-based, ignores name)
    if not place_id:
        try:
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                params={
                    "location": f"{lat},{lon}",
                    "radius": 10,
                    "key": GOOGLE_PLACES_API_KEY,
                },
                timeout=5,
            )
            results = resp.json().get("results", [])
            if results:
                place_id = results[0]["place_id"]
        except Exception:
            pass

    # 4. Cache the resolved place_id
    if place_id and _supabase:
        try:
            _supabase.table("place_id_cache").upsert({
                "coords_key": coords_key,
                "place_id": place_id,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

    return {"place_id": place_id}


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


# Google Nearby Search types → app category (for map-data)
_NEARBY_TYPE_TO_CATEGORY = {
    "restaurant":        "restaurant",
    "cafe":              "cafe",
    "bar":               "restaurant",
    "museum":            "museum",
    "tourist_attraction": "tourism",
    "park":              "park",
    "night_club":        "restaurant",
}

MAP_DATA_CACHE_TTL_HOURS = int(os.getenv("MAP_DATA_CACHE_TTL_HOURS", "24"))

_CATEGORY_TO_GOOGLE_TYPE = {
    "restaurant": "restaurant",
    "cafe": "cafe",
    "park": "park",
    "museum": "museum",
    "historic": "tourist_attraction",
    "tourism": "tourist_attraction",
    "place": "point_of_interest",
    "event": "point_of_interest",
}

@app.get("/pin-details")
def pin_details(request: Request, lat: float = Query(...), lon: float = Query(...), name: str = Query(""), category: str = Query(""), place_id: str = Query("")):
    """
    Single-call endpoint: resolves place_id from coords + fetches full details.
    Replaces the two-step /find-place-id → /place-details round trip.

    Resolution order:
      0. Caller-supplied place_id (instant, free — skips all lookups)
      1. Supabase place_id_cache by coords (instant, free)
      2. Google findplacefromtext with name + location bias
      3. Google nearbysearch at 10m radius (coordinate-based fallback)
    Returns None place_id (and empty detail fields) if all lookups fail.
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"place_id": None}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    coords_key = f"{lat:.5f},{lon:.5f}"

    # ── 0. Caller already knows the place_id — skip all lookups ──
    resolved_id = place_id or None

    if not resolved_id:
        # ── 1. Coords cache → skip both lookups if place_id already known ──
        if _supabase:
            try:
                cached = (
                    _supabase.table("place_id_cache")
                    .select("place_id")
                    .eq("coords_key", coords_key)
                    .maybe_single()
                    .execute()
                )
                if cached.data and cached.data.get("place_id"):
                    resolved_id = cached.data["place_id"]
            except Exception:
                pass

        # ── 2. Name-based lookup ──
        if not resolved_id and name:
            try:
                resp = requests.get(
                    f"{GOOGLE_PLACES_BASE}/findplacefromtext/json",
                    params={
                        "input": name,
                        "inputtype": "textquery",
                        "locationbias": f"point:{lat},{lon}",
                        "fields": "place_id,name",
                        "key": GOOGLE_PLACES_API_KEY,
                    },
                    timeout=5,
                )
                candidates = resp.json().get("candidates", [])
                if candidates:
                    resolved_id = candidates[0]["place_id"]
            except Exception:
                pass

        # ── 3. Type-ranked nearbysearch — finds nearest matching type, no radius limit ──
        if not resolved_id:
            google_type = _CATEGORY_TO_GOOGLE_TYPE.get(category, "")
            if google_type:
                try:
                    resp = requests.get(
                        f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                        params={
                            "location": f"{lat},{lon}",
                            "rankby": "distance",
                            "type": google_type,
                            "key": GOOGLE_PLACES_API_KEY,
                        },
                        timeout=5,
                    )
                    results = resp.json().get("results", [])
                    if results:
                        resolved_id = results[0]["place_id"]
                except Exception:
                    pass

        # ── 4. Fixed-radius fallback — 100m catch-all ──
        if not resolved_id:
            try:
                resp = requests.get(
                    f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                    params={
                        "location": f"{lat},{lon}",
                        "radius": 100,
                        "key": GOOGLE_PLACES_API_KEY,
                    },
                    timeout=5,
                )
                results = resp.json().get("results", [])
                if results:
                    resolved_id = results[0]["place_id"]
            except Exception:
                pass

        # ── Cache the resolved place_id ──
        if resolved_id and _supabase:
            try:
                _supabase.table("place_id_cache").upsert({
                    "coords_key": coords_key,
                    "place_id": resolved_id,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception:
                pass

    if not resolved_id:
        return {"place_id": None}

    # ── Check place_details_cache ──
    if _supabase:
        try:
            cached_details = (
                _supabase.table("place_details_cache")
                .select("data, fetched_at")
                .eq("place_id", resolved_id)
                .maybe_single()
                .execute()
            )
            if cached_details.data:
                fetched_at = datetime.fromisoformat(cached_details.data["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(days=PLACE_CACHE_TTL_DAYS):
                    return cached_details.data["data"]
        except Exception:
            pass

    # ── 5. Fetch from Google Place Details ──
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/details/json",
            params={
                "place_id": resolved_id,
                "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types,editorial_summary,reviews",
                "key": GOOGLE_PLACES_API_KEY,
            },
            timeout=5,
        )
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return {"place_id": None, "error": data.get("status", "UNKNOWN")}

        result = data.get("result", {})
        photo_ref = None
        if result.get("photos"):
            photo_ref = result["photos"][0]["photo_reference"]

        details = {
            "place_id": resolved_id,
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
            "editorial_summary": result.get("editorial_summary", {}).get("overview"),
            "top_review": result["reviews"][0]["text"] if result.get("reviews") else None,
        }

        if _supabase:
            try:
                _supabase.table("place_details_cache").upsert({
                    "place_id": resolved_id,
                    "data": details,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception:
                pass

        return details
    except Exception as e:
        return {"place_id": None, "error": str(e)}


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
