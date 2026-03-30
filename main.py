from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import time
import os
import json
import anthropic
from dotenv import load_dotenv
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

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENWEATHER_KEY   = os.environ.get("OPENWEATHER_KEY", "")

# ── Overpass endpoints (ordered by reliability) ──
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
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
                timeout=25
            )
            print(f"  Status: {res.status_code}, Body[:80]: {res.text[:80]}")

            if res.status_code == 429:
                print("  Rate limited — waiting 8s")
                time.sleep(8)
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
[out:json][timeout:15];
(
  node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"]({bbox_str});
  node["amenity"~"restaurant|cafe|bar|food_court"]["name"]({bbox_str});
  node["amenity"="museum"]["name"]({bbox_str});
  node["leisure"~"park|garden|nature_reserve"]["name"]({bbox_str});
  node["historic"]["name"]({bbox_str});
  node["amenity"="marketplace"]["name"]({bbox_str});
);
out center 40;
"""
        data = fetch_overpass(query)

        places = []
        seen   = set()

        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name", "").strip()
            if not name or name in seen:
                continue
            seen.add(name)

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
        # use lat/lon params if provided, else geocoded city centre, else bbox centre
        if lat is not None and lon is not None:
            city_lat, city_lon = lat, lon
        elif 'geo' in dir() and 'lat' in geo:
            city_lat, city_lon = geo["lat"], geo["lon"]
        else:
            city_lat = (south + north) / 2 if south is not None else 0
            city_lon = (west  + east)  / 2 if west  is not None else 0

        def dist(p):
            return ((p["lat"] - city_lat)**2 + (p["lon"] - city_lon)**2) ** 0.5

        places = [
            p for p in places
            if p["title"].lower() not in EXCLUDE
            and len(p["title"]) > 3
            and dist(p) < 0.18
        ]

        places = sorted(places, key=dist)[:30]

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
- Start time: use arrival_time if provided, otherwise 9:00 AM
- For half day: end by 14:00 unless arrival time says otherwise
- If conflict overrides exist, follow them strictly
- If jet lag adjustment is true, reduce day 1 intensity by 50% and add rest window 14:00-16:00
- If departure day with flight time, ensure last venue ends 3 hours before flight
- If arrival time is between 0:00-6:00 (late night/early morning): note in conflict_notes that ideal start is ~10:00 AM
- transit_to_next must be a realistic walking/transit time string like "12 min walk" or "8 min by metro"
- tip: ONE sentence only, max 12 words, one specific insider detail — not a paragraph
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
    "estimated_cost": "₹500-1000 per person",
    "best_transport": "Metro and walking",
    "pro_tip": "One overall trip tip",
    "conflict_notes": "Any adaptations made — thin/tight schedule, conflicts resolved"
  }}
}}"""

        client  = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1200,
            timeout=30,
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
        return {"error": "AI returned invalid JSON", "raw": raw[:300]}
    except Exception as e:
        print("AI ITINERARY ERROR:", e)
        return {"error": str(e)}


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
    try:
        base   = "https://en.wikipedia.org/w/api.php"
        search = requests.get(base, params={
            "action": "query", "list": "search",
            "srsearch": f"{name} {city}",
            "format": "json", "srlimit": 1
        }, timeout=8).json()

        results = search.get("query", {}).get("search", [])
        if not results:
            return {"image": None}

        title  = results[0]["title"]
        images = requests.get(base, params={
            "action": "query", "titles": title,
            "prop": "pageimages", "pithumbsize": 600,
            "format": "json"
        }, timeout=8).json()

        for page in images.get("query", {}).get("pages", {}).values():
            thumb = page.get("thumbnail", {})
            if thumb.get("source"):
                return {"image": thumb["source"], "title": title}

        return {"image": None}
    except Exception as e:
        print("PLACE IMAGE ERROR:", e)
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
# HEALTH CHECK
# =========================================
@app.get("/")
def root():
    return {"status": "ok", "service": "Uncover Roads API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
