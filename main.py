from fastapi import FastAPI, Query, HTTPException, Request, Response, Depends, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Optional
from fastapi.responses import RedirectResponse, StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import re
import requests
import math
import time
import os
import json
import uuid
import logging
import anthropic

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
from collections import defaultdict
from time import time as _time
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client as SupabaseClient
from ip_engine import build_persona_response, get_city_profile, run_conflict_check, ARCHETYPES

# Phase 5 — Intelligence Engine
import json as _json
from pathlib import Path as _Path
from engine.builder import build_itinerary
from engine.types import EngineStop, EngineContext
from engine.signals import compute_stop_signals, DaySignalState
from city.data_model import load_city, CityData, _maybe_single_data
from city.sync_job import start_scheduler as _start_sync_scheduler
from city.trend_scheduler import start_trend_scheduler as _start_trend_scheduler, refresh_all_cities as _refresh_all_cities
from city.persona_affinity import get_persona_affinity
from pydantic import BaseModel

load_dotenv()

# ── Restricted locations ────────────────────────────────────────────────────
_BLOCKED_CITY_KEYWORDS = frozenset([
    # North Korea
    'north korea', 'dprk', 'pyongyang',
    # Syria
    'syria', 'damascus', 'aleppo', 'homs',
    # Iran
    'iran', 'tehran', 'isfahan',
    # Cuba
    'cuba', 'havana',
    # Myanmar
    'myanmar', 'burma', 'yangon', 'rangoon', 'naypyidaw',
    # Afghanistan
    'afghanistan', 'kabul',
    # Libya
    'libya', 'tripoli',
    # Yemen
    'yemen', 'sanaa',
    # Sudan
    'sudan', 'khartoum',
])


def _is_restricted_city(city: str) -> bool:
    """Return True if the city name matches a restricted destination."""
    normalized = city.lower().strip()
    return any(kw in normalized for kw in _BLOCKED_CITY_KEYWORDS)


app = FastAPI()

# CORS origins — web PWA + Capacitor native WebViews (Android/iOS)
_DEFAULT_ORIGINS = [
    "https://uncover-roads.vercel.app",
    "capacitor://localhost",   # iOS Capacitor native WebView
    "http://localhost",         # Android Capacitor native WebView
    "http://localhost:5173",    # local Vite dev server
]
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", ",".join(_DEFAULT_ORIGINS)).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
OPENWEATHER_KEY    = os.environ.get("OPENWEATHER_KEY", "")
TICKETMASTER_KEY   = os.environ.get("TICKETMASTER_KEY", "")
EVENTBRITE_API_KEY = os.environ.get("EVENTBRITE_API_KEY", "")
YELP_API_KEY       = os.environ.get("YELP_API_KEY", "")
YOUTUBE_API_KEY        = os.environ.get("YOUTUBE_API_KEY", "")
REDDIT_CLIENT_ID       = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET   = os.environ.get("REDDIT_CLIENT_SECRET", "")
FOURSQUARE_API_KEY     = os.environ.get("FOURSQUARE_API_KEY", "")

# In-memory event cache — keyed by "city|start_date|end_date", expires after 1 hour
_events_cache: dict[str, tuple[float, list]] = {}
_EVENTS_CACHE_TTL = 3600  # seconds

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

ORS_API_KEY = os.getenv("ORS_API_KEY", "")
ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Place details cache TTL — place hours/ratings/contact info changes infrequently
# Set via env var (days) or default to 30 days
PLACE_CACHE_TTL_DAYS = int(os.getenv("PLACE_CACHE_TTL_DAYS", "30"))

_supabase: SupabaseClient | None = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── Phase 5 Request Models ────────────────────────────────────────────────────

class ItineraryStopRequest(BaseModel):
    place_id: str
    name: str
    lat: float
    lon: float
    category: str
    duration_min: int = 90
    opening_hours: list[dict] = []
    price_level: int = 1
    rating: float = 4.0
    neighborhood: str | None = None

class ItineraryBuildRequest(BaseModel):
    stops: list[ItineraryStopRequest]
    city_id: str
    travel_dates: list[str]
    persona: dict
    discovery_mode: str = "standard"


class EngineItineraryPlace(BaseModel):
    id: str
    place_id: Optional[str] = None
    title: str
    lat: float
    lon: float
    category: str
    rating: Optional[float] = None
    photo_ref: Optional[str] = None
    city: Optional[str] = None  # city context stamped on selection


class EngineItineraryPayload(BaseModel):
    city: str
    lat: float
    lon: float
    days: int
    startDate: str
    selectedPlaces: list[EngineItineraryPlace]
    personaArchetype: str = "explorer"
    engineWeights: Optional[dict] = None
    cities: Optional[list[str]] = None  # ordered city list for multi-city trips
    arrivalTime: Optional[str] = None   # user's actual arrival time for day-1 adjustment
    departureTime: Optional[str] = None  # user's departure time on last day
    startType: Optional[str] = "hotel"  # 'airport' | 'hotel' | 'custom'
    rawOBAnswers: Optional[dict] = None


# ── Phase 5 Startup: City Seed + Sync Scheduler ──────────────────────────────

@app.on_event("startup")
async def seed_cities_and_start_sync():
    """Seed Tokyo/Paris/NYC into city_data if not present; start weekly sync."""
    if _supabase is None:
        return
    seed_dir = _Path("city/seed")
    city_ids = [p.stem for p in sorted(seed_dir.glob("*.json"))] if seed_dir.exists() else []
    for city_id in city_ids:
        try:
            existing = _supabase.table("city_data").select("id").eq("id", city_id).execute()
            if not existing.data:
                seed_path = _Path("city/seed") / f"{city_id}.json"
                if seed_path.exists():
                    seed = _json.loads(seed_path.read_text())
                    _supabase.table("city_data").insert({"id": city_id, "data": seed}).execute()
        except Exception as exc:
            print(f"[startup] Failed to seed {city_id}: {exc}")
    # Start City Intelligence Sync
    google_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    _start_sync_scheduler(
        _supabase, google_key,
        reddit_client_id=REDDIT_CLIENT_ID,
        reddit_client_secret=REDDIT_CLIENT_SECRET,
    )
    print("[startup] City Intelligence Sync scheduler registered (weekly Sunday 02:00 UTC)")
    # Start daily Trend Velocity Refresh (03:00 UTC)
    _start_trend_scheduler(
        _supabase,
        youtube_key=YOUTUBE_API_KEY,
        foursquare_key=FOURSQUARE_API_KEY,
        reddit_client_id=REDDIT_CLIENT_ID,
        reddit_client_secret=REDDIT_CLIENT_SECRET,
    )
    yt_status = "YES" if YOUTUBE_API_KEY else "NO KEY SET"
    print(f"[startup] Trend Velocity Scheduler registered (daily 03:00 UTC) — YouTube: {yt_status}")


# ── Auth ─────────────────────────────────────────────────────────────────────

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Extract and validate Supabase JWT. Raises 401 if missing or invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_token")
    if not _supabase:
        raise HTTPException(status_code=503, detail="auth_unavailable")
    token = authorization.split(" ")[1]
    try:
        import asyncio
        response = await asyncio.to_thread(_supabase.auth.get_user, token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")

    if not response.user:
        raise HTTPException(status_code=401, detail="invalid_token")
    return response.user


async def require_pro(user=Depends(get_current_user)):
    """Raises 403 if user does not have pro or unlimited subscription."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="auth_unavailable")
    result = (
        _supabase.table("user_subscriptions")
        .select("status, expires_at")
        .eq("user_id", str(user.id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="subscription_required")
    sub = result.data
    if sub["status"] not in ("pro", "unlimited"):
        raise HTTPException(status_code=403, detail="subscription_required")
    if sub.get("expires_at") and sub["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=403, detail="subscription_expired")
    return user


async def require_auth_or_pack(user=Depends(get_current_user)):
    """Allows: pro/unlimited subscribers, pack holders with trips left, free-tier users under the 3-trip limit."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="auth_unavailable")

    # Check subscription first (maybe_single avoids exception when no row exists)
    try:
        sub_result = (
            _supabase.table("user_subscriptions")
            .select("status, pack_trips_remaining, expires_at")
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
        sub = sub_result.data if sub_result else None
    except Exception:
        sub = None

    if sub:
        if sub["status"] in ("pro", "unlimited"):
            if sub.get("expires_at") and sub["expires_at"] < datetime.now(timezone.utc).isoformat():
                raise HTTPException(status_code=403, detail="subscription_expired")
            return user
        if sub["status"] == "pack" and sub.get("pack_trips_remaining", 0) > 0:
            return user

    # Free-tier fallback: allow if generation_count < 3
    try:
        profile_result = (
            _supabase.table("profiles")
            .select("generation_count")
            .eq("id", str(user.id))
            .maybe_single()
            .execute()
        )
        profile = profile_result.data if profile_result else None
        count = (profile.get("generation_count") or 0) if profile else 0
    except Exception:
        count = 0

    if count < 3:
        return user

    raise HTTPException(status_code=403, detail="generation_limit_reached")


# ── Per-user rate limiting ────────────────────────────────────────────────────

_user_rate_buckets: dict[str, list[float]] = defaultdict(list)

RATE_LIMITS: dict[str, tuple[int, int]] = {
    # route_group: (max_requests, window_seconds)
    "auth":      (10,  60),
    "search":    (30,  60),
    "itinerary": (20,  60),
    "events":    (100, 60),
    "default":   (60,  60),
}


def check_user_rate_limit(user_id: str, route_group: str) -> None:
    """Raises 429 if user exceeds the rate limit for this route group."""
    max_req, window = RATE_LIMITS.get(route_group, RATE_LIMITS["default"])
    key = f"{user_id}:{route_group}"
    now = _time()
    _user_rate_buckets[key] = [t for t in _user_rate_buckets[key] if now - t < window]
    if len(_user_rate_buckets[key]) >= max_req:
        raise HTTPException(
            status_code=429,
            detail="rate_limit_exceeded",
            headers={"Retry-After": str(window)},
        )
    _user_rate_buckets[key].append(now)


# ── PostHog ───────────────────────────────────────────────────────────────────

import posthog as _posthog

_POSTHOG_KEY  = os.getenv("POSTHOG_API_KEY", "")
_POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://app.posthog.com")

if _POSTHOG_KEY:
    _posthog.api_key = _POSTHOG_KEY
    _posthog.host    = _POSTHOG_HOST
    _posthog.on_error = lambda error, items: None  # fail silently


def _ph_capture(user_id: str, event: str, props: dict) -> None:
    """Fire-and-forget PostHog event. Never raises."""
    if not _POSTHOG_KEY:
        return
    try:
        _posthog.capture(distinct_id=user_id, event=event, properties=props)
    except Exception:
        pass


# Session token store: maps session_id -> google_session_token
# Session tokens make autocomplete keystrokes FREE — only Place Details is billed
_session_tokens: dict[str, str] = {}
_SESSION_TOKEN_MAX = 10000  # max concurrent sessions to prevent unbounded growth

# Rate limiting for Google Places API calls per IP per hour
_rate_limit: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 3600
RATE_LIMIT_MAX = 100

def _validate_coords(*pairs: tuple[float, float]) -> None:
    """Raise 422 if any lat/lon pair is out of valid range."""
    for lat, lon in pairs:
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise HTTPException(status_code=422, detail=f"invalid_coordinates: lat={lat}, lon={lon}")


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

def _sanitise(text: str | None) -> str | None:
    """Strip control characters that Google Places sometimes embeds in review/summary text.
    Unescaped control chars (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F) produce invalid JSON."""
    if not text:
        return text
    import re as _re
    return _re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)

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
def geocode(request: Request, city: str = Query(...)):
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip):
        raise HTTPException(status_code=429, detail="rate_limit_exceeded", headers={"Retry-After": str(RATE_LIMIT_WINDOW)})
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
OVERPASS_CACHE_TTL_HOURS = int(os.getenv("OVERPASS_CACHE_TTL_HOURS", "24"))


def _overpass_query_hash(query: str) -> str:
    import hashlib
    return hashlib.sha256(query.encode()).hexdigest()[:32]


def fetch_overpass(query: str) -> dict:
    query_hash = _overpass_query_hash(query)

    if _supabase:
        try:
            cached = (
                _supabase.table("overpass_cache")
                .select("result,fetched_at")
                .eq("query_hash", query_hash)
                .maybe_single()
                .execute()
            )
            row = _maybe_single_data(cached)
            if row:
                age = datetime.now(timezone.utc) - datetime.fromisoformat(row["fetched_at"])
                if age < timedelta(hours=OVERPASS_CACHE_TTL_HOURS):
                    print(f"[Overpass] cache hit {query_hash}")
                    return row["result"]
        except Exception as e:
            print(f"[Overpass] cache read failed: {e}")

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
                    data = res.json()
                    if _supabase and data.get("elements"):
                        try:
                            _supabase.table("overpass_cache").upsert({
                                "query_hash": query_hash,
                                "result":     data,
                                "fetched_at": datetime.now(timezone.utc).isoformat(),
                            }).execute()
                        except Exception as e:
                            print(f"[Overpass] cache write failed: {e}")
                    return data
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
  node["amenity"~"restaurant|food_court"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"="cafe"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"~"bar|pub|nightclub"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"="museum"]["name"](around:{radius_m},{clat},{clon});
  way["amenity"="museum"]["name"](around:{radius_m},{clat},{clon});
  node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:{radius_m},{clat},{clon});
  way["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:{radius_m},{clat},{clon});
  node["leisure"~"park|garden|nature_reserve"]["name"](around:{radius_m},{clat},{clon});
  way["leisure"~"park|garden|nature_reserve"]["name"](around:{radius_m},{clat},{clon});
  node["historic"]["name"](around:{radius_m},{clat},{clon});
  way["historic"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"="marketplace"]["name"](around:{radius_m},{clat},{clon});
  way["amenity"="marketplace"]["name"](around:{radius_m},{clat},{clon});
  node["natural"="beach"]["name"](around:{radius_m},{clat},{clon});
  way["natural"="beach"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"~"library|cinema|spa"]["name"](around:{radius_m},{clat},{clon});
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

        amenity  = tags.get("amenity", "")
        tourism  = tags.get("tourism", "")
        leisure  = tags.get("leisure", "")
        historic = tags.get("historic", "")
        natural  = tags.get("natural", "")

        if amenity in ("bar", "pub", "nightclub"):
            cat = "bar"
        elif amenity in ("restaurant", "food_court") or tags.get("cuisine"):
            cat = "restaurant"
        elif amenity == "cafe":
            cat = "cafe"
        elif amenity == "museum" or tourism == "museum":
            cat = "museum"
        elif amenity == "marketplace":
            cat = "market"
        elif amenity == "library":
            cat = "library"
        elif amenity == "cinema":
            cat = "cinema"
        elif amenity == "spa":
            cat = "spa"
        elif natural == "beach":
            cat = "beach"
        elif leisure in ("park", "nature_reserve"):
            cat = "park"
        elif leisure == "garden":
            cat = "park"
        elif historic:
            cat = "historic"
        elif tourism == "artwork":
            cat = "street_art"
        elif tourism == "viewpoint":
            cat = "viewpoint"
        elif tourism == "gallery":
            cat = "gallery"
        elif tourism == "attraction":
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


def _refresh_map_data_tile(tile_key: str, clat: float, clon: float, radius_m: int, city: str) -> list:
    """Fetch fresh map data from Google/Overpass and write to cache. Safe to call from background."""
    places: list = []
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
                    print(f"MAP DATA BG: nearbysearch {gtype} status={status}")
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
                print(f"MAP DATA BG: nearbysearch failed for type {gtype}: {e}")
                continue

    if not places:
        try:
            places = _overpass_map_data(clat, clon, radius_m)
            print(f"MAP DATA BG: Overpass returned {len(places)} places")
        except Exception as e:
            print(f"MAP DATA BG: Overpass fallback failed: {e}")

    if _supabase and places:
        try:
            _supabase.table("map_data_cache").upsert({
                "tile_key":   tile_key,
                "places":     places,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            print(f"MAP DATA BG: refreshed tile {tile_key} with {len(places)} places")
        except Exception as e:
            print(f"MAP DATA BG: cache write failed: {e}")

    return places


@app.get("/map-data")
def map_data(
    background_tasks: BackgroundTasks,
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
    if city and _is_restricted_city(city):
        raise HTTPException(status_code=403, detail="Travel planning not available for this destination.")

    # Validate any provided coordinates before using them
    if lat is not None and lon is not None:
        _validate_coords((lat, lon))
    if center_lat is not None and center_lon is not None:
        _validate_coords((center_lat, center_lon))

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
    stale_places: list | None = None
    if _supabase:
        try:
            cached = (
                _supabase.table("map_data_cache")
                .select("places, fetched_at")
                .eq("tile_key", tile_key)
                .maybe_single()
                .execute()
            )
            cached_row = _maybe_single_data(cached)
            if cached_row:
                fetched_at = datetime.fromisoformat(cached_row["fetched_at"])
                age = datetime.now(timezone.utc) - fetched_at
                if age < timedelta(hours=MAP_DATA_CACHE_TTL_HOURS):
                    print(f"MAP DATA: cache hit for tile {tile_key}")
                    return cached_row["places"]
                else:
                    # Stale but exists — return it immediately, refresh in background
                    stale_places = cached_row["places"]
                    print(f"MAP DATA: stale cache for tile {tile_key}, scheduling background refresh")
                    background_tasks.add_task(
                        _refresh_map_data_tile, tile_key, clat, clon, radius_m, city
                    )
                    return stale_places
        except Exception as _e:
            logging.warning("MAP DATA: cache read failed for tile %s: %s", tile_key, _e)

    # Auto-seed city_data for cities we haven't seen before.
    # For new cities: write a minimal stub synchronously then kick off a full
    # build_city_seed in a background thread so insert_candidates are ready
    # by the time the user taps Build (typically minutes later).
    if _supabase and city and clat is not None and clon is not None:
        import errno as _errno
        city_id = re.sub(r'[^a-z0-9]+', '_', city.lower().strip()).strip('_')
        _is_new_city = False
        for _attempt in range(2):
            try:
                existing = _supabase.table("city_data").select("id").eq("id", city_id).maybe_single().execute()
                existing_data = existing.data if hasattr(existing, "data") else existing
                if existing_data is None:
                    minimal = {
                        "id": city_id, "name": city, "tier": 2,
                        "center": [clat, clon], "timezone": "UTC",
                        "climate": {}, "movement": {}, "culture": {},
                        "neighborhoods": [], "insert_candidates": [],
                        "scenic_routes": [], "transit_edges": [],
                        "engine_modifiers": {}, "landmark_anchors": [], "hidden_gems": [],
                    }
                    _supabase.table("city_data").insert({
                        "id": city_id, "name": city, "tier": 2,
                        "country_code": "", "data": minimal,
                    }).execute()
                    _is_new_city = True
                    print(f"MAP DATA: registered new city {city_id}, triggering background seed")
                break
            except OSError as e:
                if e.errno == _errno.EAGAIN and _attempt == 0:
                    import time as _time; _time.sleep(0.2)
                    continue
                print(f"MAP DATA: city_data auto-seed skipped for {city}: {e}")
                break
            except Exception as e:
                print(f"MAP DATA: city_data auto-seed skipped for {city}: {e}")
                break

        if _is_new_city:
            import threading as _threading
            def _bg_seed_city(cid: str, cname: str, lat: float, lon: float) -> None:
                try:
                    from city.seed_builder import build_city_seed as _build_city_seed
                    _seeded = _build_city_seed({
                        "city_id": cid, "name": cname, "lat": lat, "lon": lon,
                        "country_code": "", "timezone": "UTC", "tier": 2,
                    })
                    if _seeded.insert_candidates and _supabase:
                        _cd = {
                            "id": cid, "name": cname, "tier": 2,
                            "center": [lat, lon], "timezone": "UTC",
                            "climate": _seeded.climate, "movement": _seeded.movement,
                            "culture": _seeded.culture,
                            "neighborhoods": [
                                {"id": n.id, "name": n.name, "center": list(n.center),
                                 "polygon": [list(p) for p in n.polygon],
                                 "best_times": n.best_times, "crowd_index": n.crowd_index}
                                for n in _seeded.neighborhoods
                            ],
                            "insert_candidates": [
                                {"place_id": ic.place_id, "name": ic.name,
                                 "lat": ic.lat, "lon": ic.lon, "type": ic.type,
                                 "time_cost_min": ic.time_cost_min,
                                 "persona_affinity": ic.persona_affinity,
                                 "trigger": ic.trigger,
                                 "time_of_day_match": ic.time_of_day_match}
                                for ic in _seeded.insert_candidates
                            ],
                            "scenic_routes": _seeded.scenic_routes,
                            "engine_modifiers": _seeded.engine_modifiers,
                            "landmark_anchors": [],
                            "hidden_gems": [],
                        }
                        _supabase.table("city_data").update({"data": _cd}).eq("id", cid).execute()
                        print(f"MAP DATA BG: seeded {len(_seeded.insert_candidates)} candidates for {cid}")
                except Exception as _e:
                    print(f"MAP DATA BG: seed failed for {cid}: {_e}")
            _threading.Thread(target=_bg_seed_city, args=(city_id, city, clat, clon), daemon=True).start()

    # No cache at all — first visit, must fetch synchronously
    if not _supabase:
        # No Supabase — fetch and return directly (local dev path)
        fetched_places = _refresh_map_data_tile(tile_key, clat, clon, radius_m, city)
        print(f"MAP DATA: no-Supabase path, returning {len(fetched_places)} places for tile {tile_key} ({city})")
        return fetched_places

    fetched_places = _refresh_map_data_tile(tile_key, clat, clon, radius_m, city)

    # Read back from cache
    try:
        cached = (
            _supabase.table("map_data_cache")
            .select("places")
            .eq("tile_key", tile_key)
            .maybe_single()
            .execute()
        )
        row = _maybe_single_data(cached)
        if row:
            print(f"MAP DATA: returning {len(row['places'])} places for tile {tile_key} ({city})")
            return row["places"]
    except Exception as _e:
        logging.warning("MAP DATA: post-fetch cache read failed for tile %s: %s", tile_key, _e)

    # Cache read failed — fall back to what we just fetched
    return fetched_places


# =========================================
# HEATMAP SEED
# =========================================
@app.get("/heatmap-seed")
def heatmap_seed(lat: float, lon: float, radius_km: int = 80):
    """Lightweight city-wide heatmap anchor points.

    Returns tourism/leisure node coordinates for heatmap rendering only.
    Uses a 20km radius per tile — fast and reliable on Overpass.
    The frontend re-fetches as the user pans, so the city fills in incrementally.
    Cache key snaps to 0.15-degree grid (~17km) to maximise tile reuse.
    """
    # Snap to 0.15-degree grid (~17km) — matches the 20km fetch radius well
    grid_lat = round(round(lat / 0.15) * 0.15, 2)
    grid_lon = round(round(lon / 0.15) * 0.15, 2)
    tile_key = f"hseed_{grid_lat}_{grid_lon}"

    if _supabase:
        try:
            cached = (
                _supabase.table("map_data_cache")
                .select("places,fetched_at")
                .eq("tile_key", tile_key)
                .maybe_single()
                .execute()
            )
            row = _maybe_single_data(cached)
            if row:
                fetched_at = datetime.fromisoformat(row["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(days=14):
                    print(f"HEATMAP SEED: cache hit {tile_key} ({len(row['places'])} pts)")
                    return {"points": row["places"]}
        except Exception:
            pass

    # Node-only, 20km radius, lean tag set — completes in <5s on Overpass
    radius_m = 20_000
    query = f"""
[out:json][timeout:20][maxsize:512000];
(
  node["tourism"~"attraction|museum|viewpoint|artwork|gallery|monument"](around:{radius_m},{lat},{lon});
  node["leisure"~"park|garden|nature_reserve|playground"](around:{radius_m},{lat},{lon});
  node["amenity"~"theatre|cinema|place_of_worship"](around:{radius_m},{lat},{lon});
  node["historic"~"monument|memorial|castle|ruins|archaeological_site"](around:{radius_m},{lat},{lon});
);
out 100;
"""
    points: list = []
    try:
        data = fetch_overpass(query)
        for el in data.get("elements", []):
            if el.get("lat") and el.get("lon"):
                points.append({"lat": el["lat"], "lon": el["lon"]})
        print(f"HEATMAP SEED: {len(points)} pts for {tile_key}")
    except Exception as e:
        print(f"HEATMAP SEED: failed for {tile_key}: {e}")

    if _supabase and points:
        try:
            _supabase.table("map_data_cache").upsert({
                "tile_key":   tile_key,
                "places":     points,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

    return {"points": points}


# =========================================
# CITY SEARCH (autocomplete dropdown)
# =========================================
@app.get("/city-search")
def city_search(request: Request, q: str = Query(...)):
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip):
        raise HTTPException(status_code=429, detail="rate_limit_exceeded", headers={"Retry-After": str(RATE_LIMIT_WINDOW)})
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
            results.append({
                "name": name,
                "country": country,
                "lat": float(item.get("lat", 0)),
                "lon": float(item.get("lon", 0)),
            })

        return results
    except Exception as e:
        print("CITY SEARCH ERROR:", e)
        return []


# =========================================
# ROUTE
# =========================================
@app.post("/route")
def route(body: dict):
    points = body.get("points", [])
    if len(points) < 2:
        return {"error": "Need at least 2 points"}

    # Primary: OpenRouteService
    if ORS_API_KEY:
        try:
            coordinates = [[p["lon"], p["lat"]] for p in points]
            ors_resp = requests.post(
                ORS_DIRECTIONS_URL,
                headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
                json={"coordinates": coordinates, "format": "geojson", "instructions": True},
                timeout=15,
            ).json()
            if ors_resp.get("features"):
                feat    = ors_resp["features"][0]
                props   = feat["properties"]
                summary = props.get("summary", {})
                steps_text = [
                    f"{s.get('instruction', '')} onto {s.get('name', '')}"
                    for seg in props.get("segments", [])
                    for s in seg.get("steps", [])
                    if s.get("name")
                ]
                # Normalise to OSRM-compatible shape so callers work unchanged
                return {
                    "routes": [{
                        "geometry": feat["geometry"],
                        "distance": summary.get("distance", 0),
                        "duration": summary.get("duration", 0),
                        "legs": [{"steps": [
                            {"name": s.get("name", ""), "maneuver": {"type": s.get("type", "")}}
                            for seg in props.get("segments", [])
                            for s in seg.get("steps", [])
                        ]}],
                    }],
                    "summary": {
                        "distance_km":  round(summary.get("distance", 0) / 1000, 2),
                        "duration_min": round(summary.get("duration", 0) / 60, 2),
                        "steps": steps_text,
                    },
                }
        except Exception as e:
            print(f"ROUTE ORS: {e}")

    # Fallback: OSRM public demo
    try:
        coords = ";".join([f"{p['lon']},{p['lat']}" for p in points])
        data = requests.get(
            f"http://router.project-osrm.org/route/v1/driving/{coords}",
            params={"overview": "full", "geometries": "geojson", "steps": "true"},
            timeout=15,
        ).json()
        if data.get("code") != "Ok":
            return {"error": "routing failed"}
        r = data["routes"][0]
        steps_text = [
            f"{s.get('maneuver', {}).get('type', '')} onto {s.get('name', '')}"
            for leg in r.get("legs", []) for s in leg.get("steps", []) if s.get("name")
        ]
        return {
            "routes": data["routes"],
            "summary": {
                "distance_km":  round(r["distance"] / 1000, 2),
                "duration_min": round(r["duration"] / 60, 2),
                "steps": steps_text,
            },
        }
    except Exception as e:
        print(f"ROUTE OSRM fallback: {e}")
        return {"error": str(e)}


# =========================================
# ROUTE PROFILE
# =========================================

def _route_profile_key(olat: float, olon: float, dlat: float, dlon: float) -> str:
    return f"{round(olat,3)}_{round(olon,3)}_{round(dlat,3)}_{round(dlon,3)}"


def _sample_linestring(coords: list[list[float]], n: int = 20) -> list[tuple[float, float]]:
    """Return n evenly-spaced (lat, lon) points sampled from a GeoJSON linestring."""
    if len(coords) <= n:
        return [(c[1], c[0]) for c in coords]
    step = (len(coords) - 1) / (n - 1)
    return [(coords[round(i * step)][1], coords[round(i * step)][0]) for i in range(n)]


def _fetch_uv_index(lat: float, lon: float) -> float | None:
    """Fetch current UV index. Returns None on any failure."""
    try:
        resp = requests.get(
            "https://currentuvindex.com/api/v1/uvi",
            params={"lat": lat, "lng": lon},
            timeout=8,
        )
        resp.raise_for_status()
        return float(resp.json()["now"]["uvi"])
    except Exception:
        return None


def _route_condition_multiplier(lat: float, lon: float, visit_time: datetime) -> float:
    """Compute a real-time condition multiplier [0.5, 1.5] for scenic scoring.

    Uses pysolar for sun altitude (primary) and UV index for comfort.
    NEVER cached — always computed fresh.
    """
    from pysolar.solar import get_altitude

    # Sun altitude → multiplier
    sun_alt = get_altitude(lat, lon, visit_time)
    if sun_alt >= 45:
        sun_mult = 1.0   # peak day
    elif sun_alt >= 6:
        sun_mult = 1.2   # golden hour
    elif sun_alt >= 0:
        sun_mult = 1.3   # civil twilight — highest scenic boost
    else:
        sun_mult = 0.7   # night penalty

    # UV index → multiplier
    try:
        uv = _fetch_uv_index(lat, lon)
    except Exception:
        uv = None
    if uv is None:
        uv_mult = 1.0    # unknown — neutral
    elif uv <= 3:
        uv_mult = 1.1    # pleasant
    elif uv <= 6:
        uv_mult = 1.0    # neutral
    else:
        uv_mult = 0.85   # harsh

    return max(0.5, min(1.5, sun_mult * uv_mult))


def _fetch_elevations(points: list[tuple[float, float]]) -> list[int | None]:
    """Batch-query Open-Meteo for elevation at a list of (lat, lon) pairs."""
    if not points:
        return []
    try:
        lats = ",".join(str(round(p[0], 6)) for p in points)
        lons = ",".join(str(round(p[1], 6)) for p in points)
        res = requests.get(
            "https://api.open-meteo.com/v1/elevation",
            params={"latitude": lats, "longitude": lons},
            timeout=10,
        )
        elevs = res.json().get("elevation", [])
        return [int(e) if e is not None else None for e in elevs]
    except Exception as e:
        print(f"ELEVATION (open-meteo): {e}")
        # Fallback: opentopodata
        try:
            latlons = "|".join(f"{p[0]},{p[1]}" for p in points)
            res2 = requests.get(
                "https://api.opentopodata.org/v1/srtm90m",
                params={"locations": latlons},
                timeout=10,
            )
            results = res2.json().get("results", [])
            return [int(r["elevation"]) if r.get("elevation") is not None else None for r in results]
        except Exception as e2:
            print(f"ELEVATION (opentopodata fallback): {e2}")
            return [None] * len(points)


def _compute_elevation_stats(elevations: list[int | None]) -> dict:
    clean = [e for e in elevations if e is not None]
    if len(clean) < 2:
        return {"gain": None, "loss": None, "peak": None}
    gain = sum(max(0, clean[i] - clean[i - 1]) for i in range(1, len(clean)))
    loss = sum(max(0, clean[i - 1] - clean[i]) for i in range(1, len(clean)))
    return {"gain": int(gain), "loss": int(loss), "peak": max(clean)}


def _road_character_score(steps: list[dict]) -> float:
    """0 = all high-speed motorway, 1 = all scenic/residential.

    Uses average speed per step as a proxy for road classification.
    Steps faster than 80 km/h are treated as highway-grade.
    """
    total_dist = sum(s.get("distance", 0) for s in steps)
    if total_dist == 0:
        return 0.5
    highway_dist = 0.0
    for s in steps:
        d = s.get("distance", 0)
        t = s.get("duration", 0)
        if t > 0 and (d / t) > 22.2:  # > 80 km/h → motorway/trunk
            highway_dist += d
    return round(1.0 - (highway_dist / total_dist), 3)


def _fetch_walk_route(lat1: float, lon1: float, lat2: float, lon2: float) -> dict | None:
    """Call Google Routes API for real walking distance and duration between two points.
    Returns {distanceMeters, durationSeconds} or None on failure/no key."""
    if not GOOGLE_PLACES_API_KEY:
        return None
    try:
        resp = requests.post(
            GOOGLE_ROUTES_URL,
            headers={
                "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
                "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
                "Content-Type": "application/json",
            },
            json={
                "origin":      {"location": {"latLng": {"latitude": lat1, "longitude": lon1}}},
                "destination": {"location": {"latLng": {"latitude": lat2, "longitude": lon2}}},
                "travelMode": "WALK",
            },
            timeout=5,
        )
        if resp.status_code == 200:
            routes = resp.json().get("routes", [])
            if routes:
                r = routes[0]
                dist_m = r.get("distanceMeters", 0)
                dur_str = r.get("duration", "0s")
                dur_s = int(dur_str.rstrip("s")) if isinstance(dur_str, str) and dur_str.endswith("s") else 0
                if dist_m > 0:
                    return {"distanceMeters": dist_m, "durationSeconds": dur_s}
    except Exception:
        pass
    return None


def _fetch_route_profile(olat: float, olon: float, dlat: float, dlon: float) -> dict:
    key = _route_profile_key(olat, olon, dlat, dlon)

    # Cache read
    if _supabase:
        try:
            row = _supabase.table("route_profile_cache").select("*").eq("corridor_key", key).execute()
            if row.data:
                r = row.data[0]
                fetched = datetime.fromisoformat(r["fetched_at"].replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - fetched < timedelta(days=30):
                    return {k: r.get(k) for k in (
                        "distance_km", "duration_min", "elevation_gain_m", "elevation_loss_m",
                        "peak_elevation_m", "road_character", "sample_elevations",
                        "character_scores", "top_character", "path_names",
                        "landmark_peeks", "route_type",
                    )}
        except Exception as e:
            print(f"ROUTE PROFILE CACHE READ: {e}")

    result: dict = {
        "distance_km": None, "duration_min": None,
        "elevation_gain_m": None, "elevation_loss_m": None,
        "peak_elevation_m": None, "road_character": None,
        "sample_elevations": None,
        "character_scores": None, "top_character": None, "path_names": None,
        "landmark_peeks": None, "route_type": None,
    }

    route_json = None

    # Primary: OpenRouteService (SLA-backed, rate-limited to 2000/day free)
    if ORS_API_KEY:
        try:
            ors_resp = requests.post(
                ORS_DIRECTIONS_URL,
                headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
                json={
                    "coordinates": [[olon, olat], [dlon, dlat]],
                    "format": "geojson",
                    "instructions": True,
                    "extra_info": ["surface", "waytypes", "suitability"],
                },
                timeout=15,
            ).json()
            if ors_resp.get("features"):
                feat    = ors_resp["features"][0]
                props   = feat["properties"]
                summary = props.get("summary", {})
                # Store full ORS response for _ors_surface_score
                ors_response_full = {
                    "routes": [{"extras": props.get("extras", {})}]
                }
                route_json = {
                    "distance_km":  round(summary.get("distance", 0) / 1000, 1),
                    "duration_min": max(1, round(summary.get("duration", 0) / 60)),
                    "geom_coords":  feat["geometry"]["coordinates"],
                    "steps": [
                        s for seg in props.get("segments", [])
                        for s in seg.get("steps", [])
                    ],
                    "ors_response": ors_response_full,
                }
        except Exception as e:
            print(f"ROUTE PROFILE ORS: {e}")

    # Fallback: OSRM public demo
    if not route_json:
        try:
            coords = f"{olon},{olat};{dlon},{dlat}"
            osrm = requests.get(
                f"http://router.project-osrm.org/route/v1/driving/{coords}",
                params={"overview": "full", "geometries": "geojson", "steps": "true"},
                timeout=15,
            ).json()
            if osrm.get("code") == "Ok":
                r = osrm["routes"][0]
                route_json = {
                    "distance_km":  round(r["distance"] / 1000, 1),
                    "duration_min": max(1, round(r["duration"] / 60)),
                    "geom_coords":  r["geometry"]["coordinates"],
                    "steps": [s for leg in r.get("legs", []) for s in leg.get("steps", [])],
                }
        except Exception as e:
            print(f"ROUTE PROFILE OSRM fallback: {e}")

    if not route_json:
        return result

    try:
        result["distance_km"]  = route_json["distance_km"]
        result["duration_min"] = route_json["duration_min"]
        result["road_character"] = _road_character_score(route_json["steps"])
        result["ors_surface_score"] = _ors_surface_score(route_json.get("ors_response", {}))

        sample_pts = _sample_linestring(route_json["geom_coords"], n=20)
        elevations = _fetch_elevations(sample_pts)
        stats = _compute_elevation_stats(elevations)
        result["elevation_gain_m"] = stats["gain"]
        result["elevation_loss_m"] = stats["loss"]
        result["peak_elevation_m"] = stats["peak"]
        clean_elev = [e for e in elevations if e is not None]
        result["sample_elevations"] = clean_elev if clean_elev else None
    except Exception as e:
        print(f"ROUTE PROFILE BUILD: {e}")

    # Cache write — exclude ors_surface_score (no DB column)
    if _supabase:
        try:
            result_to_cache = {k: v for k, v in result.items() if k != "ors_surface_score"}
            _supabase.table("route_profile_cache").upsert({
                "corridor_key":    key,
                **result_to_cache,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            print(f"ROUTE PROFILE CACHE WRITE: {e}")

    return result


def _cache_route_character(corridor_key: str, scores: dict) -> None:
    """Write character scoring results to route_profile_cache."""
    if not _supabase:
        return
    try:
        _supabase.table("route_profile_cache").upsert({
            "corridor_key":      corridor_key,
            "character_scores":  scores.get("character_scores"),
            "top_character":     scores.get("top_character"),
            "path_names":        scores.get("path_names"),
            "landmark_peeks":    scores.get("landmark_peeks"),
            "route_type":        scores.get("route_type"),
            "route_computed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"ROUTE CHARACTER CACHE WRITE: {e}")


@app.get("/route-profile")
def route_profile(
    origin_lat: float = Query(...),
    origin_lon: float = Query(...),
    dest_lat:   float = Query(...),
    dest_lon:   float = Query(...),
):
    """
    Returns road elevation and character profile between two coordinates.
    Backed by OSRM routing + Open-Elevation sampling (free, no key required).
    Cached 30 days in route_profile_cache.
    """
    _validate_coords((origin_lat, origin_lon), (dest_lat, dest_lon))
    return _fetch_route_profile(origin_lat, origin_lon, dest_lat, dest_lon)


# =========================================
# AI ITINERARY
# =========================================
@app.post("/ai-itinerary")
def ai_itinerary(body: dict, user=Depends(require_auth_or_pack)):
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
def ai_itinerary_stream(body: dict, user=Depends(require_auth_or_pack)):
    places     = body.get("selected_places", [])
    city       = body.get("city", "the city")
    days       = int(body.get("days", 1))
    pace       = body.get("pace", "moderate")
    persona    = body.get("persona", "")
    archetype  = body.get("persona_archetype", "")
    trip_ctx   = body.get("trip_context", {})
    is_rebuild = bool(body.get("is_rebuild", False))

    if not places:
        return {"itinerary": [], "summary": {}}
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    # Increment generation count server-side for fresh generations only
    if not is_rebuild and _supabase:
        try:
            _supabase.rpc("increment_generation_count", {"uid": str(user.id)}).execute()
        except Exception:
            pass

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
def _cache_photo_ref_bg(pid: str, photo_ref: str) -> None:
    """Write a resolved photo_ref back into map_data_cache via RPC (background thread)."""
    if not _supabase:
        return
    try:
        _supabase.rpc("patch_place_photo_ref", {"p_place_id": pid, "p_photo_ref": photo_ref}).execute()
    except Exception as e:
        print(f"PLACE IMAGE cache-back failed for {pid}: {e}")


@app.get("/place-image")
def place_image(name: str = Query(...), city: str = Query(...), pid: str = Query(default="")):
    """
    Resolve an image for a named place.
    Resolution order:
      1. New Places API by place_id (exact match — no name ambiguity)
      2. Old Places Text Search (fallback when no pid or step 1 fails)
      3. Wikipedia thumbnail
      4. Wikimedia Commons
    When a pid is known, step 1 guarantees we fetch photos for THAT specific place,
    preventing wrong images from name-based text search collisions.
    """
    VALID_EXTS = (".jpg", ".jpeg", ".png", ".webp")

    # 1. New Places API by place_id — exact, no name-collision risk
    if pid and GOOGLE_PLACES_API_KEY:
        try:
            details = requests.get(
                f"https://places.googleapis.com/v1/places/{pid}",
                params={"fields": "photos"},
                headers={"X-Goog-Api-Key": GOOGLE_PLACES_API_KEY},
                timeout=5,
            ).json()
            photos = details.get("photos", [])
            if photos:
                fresh_name = photos[0]["name"]
                import threading
                threading.Thread(target=_cache_photo_ref_bg, args=(pid, fresh_name), daemon=True).start()
                return {"image": f"/place-photo?photo_ref={fresh_name}&max_width=800"}
        except Exception as e:
            print(f"[place-image] new Places API by pid failed for {pid}: {e}")

    # 2. Google Places Text Search — fallback when no pid or step 1 returned no photos
    if GOOGLE_PLACES_API_KEY:
        try:
            ts = requests.get(
                f"{GOOGLE_PLACES_BASE}/textsearch/json",
                params={"query": f"{name} {city}", "key": GOOGLE_PLACES_API_KEY},
                timeout=5,
            ).json()
            results = ts.get("results", [])
            if results and results[0].get("photos"):
                ref = results[0]["photos"][0]["photo_reference"]
                result_pid = pid or results[0].get("place_id", "")
                if len(ref) > 300:
                    # New-format token from old API — use new Places API to get proper photo
                    if result_pid:
                        try:
                            new_details = requests.get(
                                f"https://places.googleapis.com/v1/places/{result_pid}",
                                params={"fields": "photos"},
                                headers={"X-Goog-Api-Key": GOOGLE_PLACES_API_KEY},
                                timeout=5,
                            ).json()
                            new_photos = new_details.get("photos", [])
                            if new_photos:
                                fresh_name = new_photos[0]["name"]
                                if pid:
                                    import threading
                                    threading.Thread(target=_cache_photo_ref_bg, args=(pid, fresh_name), daemon=True).start()
                                return {"image": f"/place-photo?photo_ref={fresh_name}&max_width=800"}
                        except Exception as e:
                            print(f"[place-image] new Places API failed for {result_pid}: {e}")
                    # New API also failed — skip to Wikipedia below
                    raise ValueError("new-format ref, falling back to Wikipedia")
                if pid:
                    import threading
                    threading.Thread(target=_cache_photo_ref_bg, args=(pid, ref), daemon=True).start()
                return {"image": f"/place-photo?photo_ref={ref}&max_width=800"}
        except Exception as e:
            print("PLACE IMAGE google error:", e)

    wiki_base    = "https://en.wikipedia.org/w/api.php"
    commons_base = "https://commons.wikimedia.org/w/api.php"

    # 2. Wikipedia article thumbnail
    try:
        search = requests.get(wiki_base, params={
            "action": "query", "list": "search",
            "srsearch": f"{name} {city}",
            "format": "json", "srlimit": 1
        }, timeout=8).json()
        results = search.get("query", {}).get("search", [])
        if results:
            title = results[0]["title"]
            images = requests.get(wiki_base, params={
                "action": "query", "titles": title,
                "prop": "pageimages", "pithumbsize": 600,
                "format": "json"
            }, timeout=8).json()
            for page in images.get("query", {}).get("pages", {}).values():
                thumb = page.get("thumbnail", {})
                if thumb.get("source"):
                    return {"image": thumb["source"]}
    except Exception as e:
        print("PLACE IMAGE wikipedia error:", e)

    # 3. Wikimedia Commons image search (broader: covers landmarks without Wikipedia articles)
    try:
        commons = requests.get(commons_base, params={
            "action": "query", "generator": "search",
            "gsrsearch": f"{name} {city}",
            "gsrnamespace": "6",          # File namespace only
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 600,
            "format": "json", "gsrlimit": 5
        }, timeout=8).json()
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


# ── Persona scoring engine ─────────────────────────────────────────────────
# Uses city/persona_affinity.py which covers all 15 archetypes.
# _ARCHETYPE_AFFINITY below is kept for _pick_reason copy generation only (legacy 7 archetypes).
_ARCHETYPE_AFFINITY_COPY: dict[str, dict[str, float]] = {
    'wanderer':      {'park': 0.9, 'historic': 0.8, 'museum': 0.7, 'tourism': 0.6, 'viewpoint': 0.8},
    'historian':     {'historic': 0.9, 'museum': 0.9, 'tourism': 0.7, 'gallery': 0.7, 'library': 0.6},
    'epicurean':     {'restaurant': 0.9, 'cafe': 0.8, 'bar': 0.7, 'market': 0.8, 'bakery': 0.7},
    'pulse':         {'nightlife': 0.9, 'bar': 0.8, 'restaurant': 0.7, 'stadium': 0.7},
    'slowtraveller': {'cafe': 0.9, 'park': 0.8, 'museum': 0.7, 'gallery': 0.7, 'spa': 0.6},
    'voyager':       {'tourism': 0.9, 'viewpoint': 0.9, 'park': 0.8, 'historic': 0.7, 'beach': 0.8},
    'explorer':      {'park': 0.9, 'beach': 0.8, 'viewpoint': 0.8, 'historic': 0.7, 'amusement_park': 0.6},
}

def _score_place(place: dict, archetype: str, all_filters: list[str]) -> float:
    from city.persona_affinity import get_persona_affinity
    cat = place.get("category", "")
    rating = place.get("rating")
    # Full 15-archetype table; falls back to NEUTRAL (0.5) for unknown category
    affinity   = get_persona_affinity(cat).get(archetype, 0.5)
    filter_hit = 1.0 if cat in all_filters else 0.0
    rating_val = (min(float(rating), 5.0) / 5.0) if rating is not None else 0.5
    # Affinity weighted higher than filter so persona fit beats tag matching
    return affinity * 0.5 + filter_hit * 0.3 + rating_val * 0.2

def _pick_reason(archetype: str, category: str, all_filters: list[str], score: float) -> str:
    if category in all_filters:
        label = category.replace("_", " ")
        return f"Matches your taste for {label}s"
    affinity = _ARCHETYPE_AFFINITY_COPY.get(archetype, {}).get(category, 0.0)
    if affinity >= 0.8:
        label = category.replace("_", " ")
        return f"A top pick for {archetype} travellers — great {label}"
    if score >= 0.5:
        return "Highly rated and well suited to your style"
    return "A solid pick for your travel style"

# =========================================
# RECOMMENDED PLACES — deterministic persona scoring engine
# =========================================
@app.post("/recommended-places")
def recommended_places_endpoint(body: dict):
    """Score map places by persona affinity. Deterministic — no LLM."""
    archetype      = body.get("persona_archetype", "explorer").lower()
    venue_filters  = [v.lower() for v in body.get("venue_filters", [])]
    itinerary_bias = [v.lower() for v in body.get("itinerary_bias", [])]
    places         = body.get("places", [])

    if not places:
        return {"picks": []}

    all_filters = list(set(venue_filters + itinerary_bias))
    non_events  = [p for p in places if p.get("category") != "event"]

    scored = sorted(
        [(p, _score_place(p, archetype, all_filters)) for p in non_events],
        key=lambda x: x[1],
        reverse=True,
    )

    picks = []
    for p, s in scored[:15]:
        picks.append({
            "id":       p.get("id", ""),
            "title":    p.get("title", ""),
            "category": p.get("category", "place"),
            "lat":      p.get("lat", 0),
            "lon":      p.get("lon", 0),
            "whyRec":   _pick_reason(archetype, p.get("category", ""), all_filters, s),
            "signal":   "persona",
        })

    return {"picks": picks}


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


def _fetch_eventbrite(
    city: str, start_date: str, end_date: str,
    lat: float | None, lon: float | None,
) -> list[dict]:
    if not EVENTBRITE_API_KEY:
        return []
    params: dict = {
        "q":                      city,
        "start_date.range_start": f"{start_date}T00:00:00",
        "start_date.range_end":   f"{end_date}T23:59:59",
        "expand":                 "venue",
        "page_size":              20,
    }
    if lat is not None and lon is not None:
        params["location.latitude"]  = lat
        params["location.longitude"] = lon
        params["location.within"]    = "10km"
    try:
        r = requests.get(
            "https://www.eventbriteapi.com/v3/events/search/",
            params=params,
            headers={"Authorization": f"Bearer {EVENTBRITE_API_KEY}"},
            timeout=8,
        )
        r.raise_for_status()
        return r.json().get("events", [])
    except Exception as e:
        print(f"EVENTS Eventbrite error (non-fatal): {e}")
        return []


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
    cache_key = f"{city}|{start_date}|{end_date}"
    cached = _events_cache.get(cache_key)
    if cached and (_time() - cached[0]) < _EVENTS_CACHE_TTL:
        return {"places": cached[1]}
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

        # ── Eventbrite Events ──
        eb_raw = _fetch_eventbrite(city, start_date, end_date, lat, lon)
        existing_titles = {p["title"].lower() for p in places}
        for ev in eb_raw:
            venue = ev.get("venue") or {}
            try:
                ev_lat = float(venue.get("latitude") or 0)
                ev_lon = float(venue.get("longitude") or 0)
            except (TypeError, ValueError):
                continue
            if ev_lat == 0 and ev_lon == 0:
                continue
            name = (ev.get("name") or {}).get("text", "Event")
            if name.lower() in existing_titles:
                continue
            existing_titles.add(name.lower())
            start_local = (ev.get("start") or {}).get("local", "")
            event_date = start_local[:10] if start_local else start_date
            event_time = start_local[11:16] if len(start_local) > 10 else ""
            logo = ev.get("logo") or {}
            places.append({
                "id":       f"eb-{ev.get('id', '')}",
                "title":    name,
                "lat":      ev_lat,
                "lon":      ev_lon,
                "category": "event",
                "imageUrl": logo.get("url"),
                "tags": {
                    "event_date": event_date,
                    "event_time": event_time,
                    "venue":      venue.get("name", ""),
                    "genre":      "",
                    "website":    ev.get("url", ""),
                },
            })
        print(f"EVENTS (Eventbrite): added {len(eb_raw)} raw events")

        print(f"EVENTS: {len(places)} total events for {city} ({start_date}–{end_date})")
        _events_cache[cache_key] = (_time(), places)
        return {"places": places}

    except Exception as e:
        print("EVENTS ERROR:", e)
        return {"error": str(e)}


# =========================================
# BEHAVIOR CAPTURE
# =========================================
@app.post("/api/events", status_code=204)
async def track_event(request: Request, user=Depends(get_current_user)):
    """Receive behavioral events from frontend. Writes to Supabase + PostHog."""
    check_user_rate_limit(str(user.id), "events")
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=204)

    event_type = str(body.get("event_type", ""))[:64]
    session_id = str(body.get("session_id", ""))[:64]
    payload    = body.get("payload", {})

    if not event_type:
        return Response(status_code=204)

    if _supabase:
        try:
            _supabase.table("user_events").insert({
                "user_id":    str(user.id),
                "session_id": session_id,
                "event_type": event_type,
                "payload":    payload,
            }).execute()
        except Exception:
            pass

    _ph_capture(str(user.id), event_type, payload)

    return Response(status_code=204)


# =========================================
# ADMIN USAGE DASHBOARD
# =========================================

_RAILWAY_TOKEN      = os.getenv("RAILWAY_TOKEN",      "")
_RAILWAY_PROJECT_ID = os.getenv("RAILWAY_PROJECT_ID", "")
_RAILWAY_SERVICE_ID = os.getenv("RAILWAY_SERVICE_ID", "")

# Google Places API pricing (USD per 1000 requests, as of 2024)
_GOOGLE_PRICES = {
    "place_details_cache":  17.00,   # Place Details — $17/1000
    "place_id_cache":        3.00,   # Place Search / Find Place — $3/1000  (formerly $5, now $3 with new pricing)
    "map_data_cache":        2.00,   # Nearby Search — $2/1000
}

def _dashboard_supabase() -> dict:
    """Query Supabase for usage stats. Returns a flat dict of metrics."""
    out: dict = {}
    if not _supabase:
        return out
    try:
        from datetime import date as _date_only
        today = datetime.now(timezone.utc).date().isoformat()
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

        # ── Subscription breakdown ──────────────────────────────
        try:
            subs = _supabase.table("user_subscriptions").select("status").execute()
            rows = subs.data or []
            out["sub_free"]  = sum(1 for r in rows if r.get("status") == "free")
            out["sub_pack"]  = sum(1 for r in rows if r.get("status") == "pack")
            out["sub_pro"]   = sum(1 for r in rows if r.get("status") in ("pro", "unlimited"))
            out["sub_total"] = len(rows)
        except Exception:
            pass

        # ── Event counts ────────────────────────────────────────
        try:
            ev_today = _supabase.table("user_events").select("event_type", count="exact").gte("created_at", today).execute()
            out["events_today"] = ev_today.count or 0
        except Exception:
            pass
        try:
            ev_month = _supabase.table("user_events").select("event_type", count="exact").gte("created_at", month_start).execute()
            out["events_month"] = ev_month.count or 0
        except Exception:
            pass

        # Trip builds (look for any itinerary-related event)
        try:
            trips_today = _supabase.table("user_events").select("event_type", count="exact")\
                .gte("created_at", today)\
                .ilike("event_type", "%itinerary%")\
                .execute()
            out["trips_today"] = trips_today.count or 0
        except Exception:
            pass
        try:
            trips_month = _supabase.table("user_events").select("event_type", count="exact")\
                .gte("created_at", month_start)\
                .ilike("event_type", "%itinerary%")\
                .execute()
            out["trips_month"] = trips_month.count or 0
        except Exception:
            pass

        # ── Cache table sizes (proxy for Google API calls saved) ─
        for tbl in ("place_details_cache", "place_id_cache", "map_data_cache"):
            try:
                r = _supabase.table(tbl).select("id", count="exact").execute()
                out[f"cache_{tbl}"] = r.count or 0
            except Exception:
                pass

        # ── City coverage ────────────────────────────────────────
        try:
            cities = _supabase.table("city_data").select("id", count="exact").execute()
            out["cities_profiled"] = cities.count or 0
        except Exception:
            pass

    except Exception:
        pass
    return out


def _dashboard_railway() -> dict:
    """Query Railway GraphQL API for service metrics."""
    out: dict = {}
    if not _RAILWAY_TOKEN:
        return out
    try:
        query = """
        query ServiceMetrics($projectId: String!, $serviceId: String!) {
          project(id: $projectId) {
            id
            name
            services {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
        """
        resp = requests.post(
            "https://backboard.railway.app/graphql/v2",
            json={"query": query, "variables": {"projectId": _RAILWAY_PROJECT_ID, "serviceId": _RAILWAY_SERVICE_ID}},
            headers={"Authorization": f"Bearer {_RAILWAY_TOKEN}", "Content-Type": "application/json"},
            timeout=8,
        )
        data = resp.json()
        if "data" in data and data["data"].get("project"):
            proj = data["data"]["project"]
            out["railway_project"] = proj.get("name", "")
            services = [e["node"]["name"] for e in proj.get("services", {}).get("edges", [])]
            out["railway_services"] = ", ".join(services)
    except Exception:
        pass

    # Usage / spend via Railway billing API
    try:
        usage_query = """
        query Usage($projectId: String!) {
          project(id: $projectId) {
            usage {
              estimatedMonthlyCostUSD
              currentMonthCostUSD
            }
          }
        }
        """
        resp2 = requests.post(
            "https://backboard.railway.app/graphql/v2",
            json={"query": usage_query, "variables": {"projectId": _RAILWAY_PROJECT_ID}},
            headers={"Authorization": f"Bearer {_RAILWAY_TOKEN}", "Content-Type": "application/json"},
            timeout=8,
        )
        d2 = resp2.json()
        if "data" in d2 and d2["data"].get("project", {}).get("usage"):
            u = d2["data"]["project"]["usage"]
            out["railway_cost_month"]     = u.get("currentMonthCostUSD")
            out["railway_cost_projected"] = u.get("estimatedMonthlyCostUSD")
    except Exception:
        pass

    return out


def _estimate_google_spend(sb: dict) -> dict:
    """Estimate cumulative Google API spend from cache row counts."""
    total = 0.0
    lines = []
    for tbl, price_per_k in _GOOGLE_PRICES.items():
        count = sb.get(f"cache_{tbl}", 0)
        cost  = count / 1000 * price_per_k
        total += cost
        lines.append({"table": tbl, "count": count, "cost": round(cost, 2)})
    return {"lines": lines, "total": round(total, 2)}


_ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")

@app.get("/admin/dashboard", response_class=HTMLResponse)
def admin_dashboard(token: str = Query(default="")):
    if not _ADMIN_SECRET or token != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="forbidden")
    sb      = _dashboard_supabase()
    rail    = _dashboard_railway()
    google  = _estimate_google_spend(sb)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # ── Google cost breakdown rows ───────────────────────────────
    google_rows = ""
    for l in google["lines"]:
        label = {"place_details_cache": "Place Details", "place_id_cache": "Place Search", "map_data_cache": "Nearby Search"}.get(l["table"], l["table"])
        google_rows += f"""
        <tr>
          <td>{label}</td>
          <td class="num">{l['count']:,}</td>
          <td class="num">${l['cost']:.2f}</td>
        </tr>"""

    # ── Railway rows ─────────────────────────────────────────────
    rail_cost_month     = f"${rail['railway_cost_month']:.2f}"     if rail.get("railway_cost_month")     is not None else "—"
    rail_cost_projected = f"${rail['railway_cost_projected']:.2f}" if rail.get("railway_cost_projected") is not None else "—"
    rail_project        = rail.get("railway_project", "—")
    rail_services       = rail.get("railway_services", "—")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>Uncover Roads — Usage Dashboard</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:#0f0d0c;color:#f5f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 24px;min-height:100vh}}
  h1{{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}}
  .sub{{font-size:12px;color:rgba(255,255,255,.38);margin-bottom:32px}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:32px}}
  .card{{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px}}
  .card .label{{font-size:10px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:8px}}
  .card .value{{font-size:28px;font-weight:700;color:#f5f0ea;line-height:1}}
  .card .hint{{font-size:11px;color:rgba(255,255,255,.35);margin-top:6px}}
  .card.gold{{border-color:rgba(212,168,83,.25);background:rgba(212,168,83,.06)}}
  .card.gold .value{{color:#d4a853}}
  .card.sky{{border-color:rgba(79,143,171,.25);background:rgba(79,143,171,.06)}}
  .card.sky .value{{color:#4f8fab}}
  .card.sage{{border-color:rgba(107,148,112,.25);background:rgba(107,148,112,.06)}}
  .card.sage .value{{color:#6b9470}}
  section{{margin-bottom:32px}}
  section h2{{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07)}}
  table{{width:100%;border-collapse:collapse}}
  th{{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.35);text-align:left;padding:0 0 10px}}
  td{{font-size:13px;color:rgba(255,255,255,.75);padding:8px 0;border-top:1px solid rgba(255,255,255,.05)}}
  td.num{{text-align:right;font-variant-numeric:tabular-nums;color:#f5f0ea}}
  .pill{{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700}}
  .pill.free{{background:rgba(255,255,255,.07);color:rgba(255,255,255,.5)}}
  .pill.pack{{background:rgba(79,143,171,.15);color:#4f8fab}}
  .pill.pro{{background:rgba(212,168,83,.15);color:#d4a853}}
  .footer{{font-size:11px;color:rgba(255,255,255,.2);margin-top:16px}}
</style>
</head>
<body>

<h1>Uncover Roads · Usage Dashboard</h1>
<div class="sub">Auto-refreshes every 60s &nbsp;·&nbsp; Last updated: {now_str}</div>

<!-- ── USERS ── -->
<section>
  <h2>Users</h2>
  <div class="grid">
    <div class="card">
      <div class="label">Total registered</div>
      <div class="value">{sb.get('sub_total', '—')}</div>
    </div>
    <div class="card">
      <div class="label">Free tier</div>
      <div class="value">{sb.get('sub_free', '—')}</div>
    </div>
    <div class="card sky">
      <div class="label">Pack buyers</div>
      <div class="value">{sb.get('sub_pack', '—')}</div>
    </div>
    <div class="card gold">
      <div class="label">Pro subscribers</div>
      <div class="value">{sb.get('sub_pro', '—')}</div>
    </div>
  </div>
</section>

<!-- ── ACTIVITY ── -->
<section>
  <h2>Activity</h2>
  <div class="grid">
    <div class="card sage">
      <div class="label">Trip builds today</div>
      <div class="value">{sb.get('trips_today', '—')}</div>
    </div>
    <div class="card sage">
      <div class="label">Trip builds this month</div>
      <div class="value">{sb.get('trips_month', '—')}</div>
    </div>
    <div class="card">
      <div class="label">All events today</div>
      <div class="value">{sb.get('events_today', '—')}</div>
    </div>
    <div class="card">
      <div class="label">All events this month</div>
      <div class="value">{sb.get('events_month', '—')}</div>
    </div>
    <div class="card">
      <div class="label">Cities profiled</div>
      <div class="value">{sb.get('cities_profiled', '—')}</div>
      <div class="hint">in city_data table</div>
    </div>
  </div>
</section>

<!-- ── GOOGLE API ── -->
<section>
  <h2>Google Places API — cumulative spend estimate</h2>
  <table>
    <thead><tr><th>API</th><th style="text-align:right">Cached rows</th><th style="text-align:right">Est. cost</th></tr></thead>
    <tbody>
      {google_rows}
      <tr>
        <td><strong>Total</strong></td>
        <td></td>
        <td class="num" style="color:#d4a853;font-weight:700">${google['total']:.2f}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer" style="margin-top:12px">Estimate = cached rows × API list price. Each row = one billable call that won't be repeated. Actual spend may vary.</div>
</section>

<!-- ── RAILWAY ── -->
<section>
  <h2>Railway compute</h2>
  <div class="grid">
    <div class="card">
      <div class="label">Project</div>
      <div class="value" style="font-size:16px">{rail_project}</div>
      <div class="hint">{rail_services}</div>
    </div>
    <div class="card gold">
      <div class="label">Spend this month</div>
      <div class="value">{rail_cost_month}</div>
    </div>
    <div class="card">
      <div class="label">Projected month-end</div>
      <div class="value">{rail_cost_projected}</div>
    </div>
  </div>
</section>

<div class="footer">Supabase data is live · Railway data via GraphQL API · Google costs estimated from cache table row counts</div>
</body>
</html>"""
    return HTMLResponse(content=html)


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
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_m: int = 20000,
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
    if lat is not None and lon is not None:
        params["location"] = f"{lat},{lon}"
        params["radius"] = radius_m
        params["strictbounds"] = "true"
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
# REVERSE GEOCODE (city lookup from lat/lon)
# =========================================
_reverse_geocode_cache: dict[str, dict] = {}

@app.get("/api/geocode/reverse")
async def reverse_geocode(lat: float, lon: float):
    """
    Returns {city, state, country} for a coordinate pair.
    Uses Google Geocoding API (same key as Places). Falls back to Nominatim.
    Results are cached in-process by rounded coordinate (4dp ≈ 11m precision).
    """
    _validate_coords((lat, lon))
    cache_key = f"{lat:.4f},{lon:.4f}"
    if cache_key in _reverse_geocode_cache:
        return _reverse_geocode_cache[cache_key]

    result = {"city": None, "state": None, "country": None}

    # ── Google Geocoding API (preferred) ──────────────────────────
    if GOOGLE_PLACES_API_KEY:
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"latlng": f"{lat},{lon}", "key": GOOGLE_PLACES_API_KEY, "language": "en"},
                timeout=5,
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                components = data["results"][0].get("address_components", [])
                for c in components:
                    types = c.get("types", [])
                    if "locality" in types:
                        result["city"] = c["long_name"]
                    elif "administrative_area_level_1" in types:
                        result["state"] = c["long_name"]
                    elif "country" in types:
                        result["country"] = c["long_name"]
                # If locality missing, fall back to administrative_area_level_2 then level_1
                if not result["city"]:
                    for c in components:
                        types = c.get("types", [])
                        if "administrative_area_level_2" in types:
                            result["city"] = c["long_name"]
                            break
                if not result["city"] and result["state"]:
                    result["city"] = result["state"]
        except Exception:
            pass

    # ── Nominatim fallback ────────────────────────────────────────
    if not result["city"]:
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": "UncoverRoads/1.0", "Accept-Language": "en"},
                timeout=5,
            )
            addr = resp.json().get("address", {})
            result["city"] = (
                addr.get("city") or addr.get("town") or addr.get("village")
                or addr.get("county") or addr.get("state")
            )
            result["state"] = addr.get("state")
            result["country"] = addr.get("country")
        except Exception:
            pass

    _reverse_geocode_cache[cache_key] = result
    return result


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
            cached_row = _maybe_single_data(cached)
            if cached_row and cached_row.get("place_id"):
                return {"place_id": cached_row["place_id"]}
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


# ── Transit corridor cache ──────────────────────────────────────────────────

def _extract_walk_route_points(steps: list) -> list[tuple[float, float]]:
    """Decode step polylines from Google Directions walking response, sample to 20 points.

    Each step must have a ``polyline.points`` encoded polyline string (Google format).
    Returns a list of (lat, lon) tuples sampled evenly along the full walking route.
    """
    import polyline as _pl
    all_coords: list[list[float]] = []
    for step in steps:
        encoded = (step.get("polyline") or {}).get("points")
        if not encoded:
            continue
        try:
            decoded = _pl.decode(encoded)           # returns [(lat, lon), ...]
            # Convert to [lon, lat] for _sample_linestring (GeoJSON convention)
            all_coords.extend([[p[1], p[0]] for p in decoded])
        except Exception:
            continue
    if not all_coords:
        return []
    return _sample_linestring(all_coords, n=20)


_DIM_KEYWORDS: dict[str, list[str]] = {
    "natural":    ["canal", "riverside", "waterfront", "park", "garden", "trail", "forest",
                   "woods", "promenade", "esplanade", "lakeside", "greenway"],
    "viewpoint":  ["viewpoint", "overlook", "observatory", "panorama", "deck", "rooftop", "observation"],
    "historic":   ["temple", "shrine", "palace", "castle", "heritage", "old town", "historic",
                   "cathedral", "monastery", "ancient", "ruins"],
    "vibrant":    ["market", "bazaar", "street food", "shopping", "arcade", "strip",
                   "nightlife", "bar street", "food hall"],
    "photogenic": ["mural", "street art", "gallery", "mosaic", "sculpture", "installation"],
    "waterfront": ["harbour", "harbor", "port", "pier", "seafront", "bay", "beach",
                   "embankment", "quay", "boardwalk"],
    "local":      ["lane", "alley", "neighbourhood", "neighborhood", "backstreet", "residential", "passage"],
}

def _score_instructions_by_dimension(steps: list[dict]) -> dict[str, float]:
    """Score Google Directions walking steps against 7 character dimensions.

    Each keyword match in html_instructions is weighted by step distance so
    longer steps carry proportionally more signal. Returns 0–1 per dimension.
    """
    scores: dict[str, float] = {dim: 0.0 for dim in _DIM_KEYWORDS}
    total_dist = sum(s.get("distance", {}).get("value", 0) for s in steps) or 1

    for step in steps:
        html = step.get("html_instructions", "")
        text = re.sub(r"<[^>]+>", " ", html).lower()
        dist_weight = step.get("distance", {}).get("value", 0) / total_dist

        for dim, keywords in _DIM_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    # weight by distance (km), multiply by 2.0 to map ~0.5 km average step → ~1.0 unit
                    scores[dim] = min(1.0, scores[dim] + dist_weight * 2.0)
                    break  # one match per step per dimension is enough

    return scores


# ORS surface type codes → scenic quality score (0.0–1.0)
_ORS_SURFACE_SCORES: dict[int, float] = {
    0:  0.5,  # Unknown
    1:  0.3,  # Paved
    2:  0.7,  # Unpaved
    3:  0.2,  # Asphalt
    4:  0.3,  # Concrete
    5:  0.5,  # Cobblestone
    6:  0.4,  # Metal
    7:  0.5,  # Wood
    8:  0.8,  # Compacted gravel
    9:  0.8,  # Fine gravel
    10: 0.85, # Gravel
    11: 0.85, # Dirt
    12: 0.9,  # Ground
    13: 0.3,  # Ice
    14: 0.4,  # Paving stones
    15: 0.6,  # Sand
    16: 0.7,  # Woodchips
    17: 1.0,  # Grass
    18: 0.7,  # Grass paver
}

def _ors_surface_score(ors_response: dict) -> float:
    """Return a scenic surface quality score 0.0–1.0 from an ORS walking route response.

    Uses ORS extras.surface.values — each entry [from_idx, to_idx, surface_code].
    Weighted average by segment length. Returns 0.5 if surface data unavailable.
    """
    try:
        values = ors_response["routes"][0]["extras"]["surface"]["values"]
    except (KeyError, IndexError, TypeError):
        return 0.5  # neutral when data unavailable
    if not values:
        return 0.5
    total_weight = 0.0
    weighted_sum = 0.0
    for segment in values:
        from_idx, to_idx, surface_code = segment[0], segment[1], segment[2]
        length = to_idx - from_idx
        if length <= 0:
            continue
        score = _ORS_SURFACE_SCORES.get(surface_code, 0.5)
        weighted_sum += score * length
        total_weight += length
    return weighted_sum / total_weight if total_weight > 0 else 0.5


def _fetch_route_character(
    route_points: list[tuple[float, float]],
    city_pop: int,
    city_id: str = "",
) -> dict[str, float]:
    """Query Overpass for amenities along a walking route and return 7 character dimension scores.

    Returns all-0.5 neutral dict if city_pop < 50_000 or on any Overpass error.
    """
    _neutral = {d: 0.5 for d in ("natural", "viewpoint", "historic", "vibrant", "photogenic", "waterfront", "local")}

    if city_pop < 50_000:
        return _neutral
    if not route_points:
        return _neutral

    # ── Check city-level OSM cache ────────────────────────────────────────────
    if city_id and _supabase:
        try:
            _cr = (
                _supabase.table("city_osm_features")
                .select("elements, cached_at")
                .eq("city_id", city_id)
                .execute()
            )
            _city_rows = _cr.data or []
            if _city_rows:
                from datetime import datetime as _dt, timezone as _tz, timedelta as _tdd
                _cached_at = _dt.fromisoformat(_city_rows[0]["cached_at"].replace("Z", "+00:00"))
                _fresh = (_dt.now(_tz.utc) - _cached_at) < _tdd(days=7)
                if _fresh:
                    _all_elements = _city_rows[0].get("elements") or []
                    # Filter elements to corridor bounding box
                    lats = [p[0] for p in route_points]
                    lons = [p[1] for p in route_points]
                    _s = min(lats) - 0.05
                    _n = max(lats) + 0.05
                    _w = min(lons) - 0.05
                    _e = max(lons) + 0.05
                    _elements = [
                        el for el in _all_elements
                        if _s <= float(el.get("lat", 0)) <= _n
                        and _w <= float(el.get("lon", 0)) <= _e
                    ]
                    # Reuse existing scoring logic with filtered elements
                    threshold = max(5, min(50, city_pop // 100_000 * 5 + 5))
                    dim_counts: dict[str, int] = {d: 0 for d in _neutral}
                    for _el in _elements:
                        tags = _el.get("tags") or {}
                        nat = tags.get("natural", "")
                        if nat in ("wood", "water", "wetland", "tree", "grassland", "scrub", "beach"):
                            dim_counts["natural"] += 1
                        if tags.get("tourism") == "viewpoint":
                            dim_counts["viewpoint"] += 1
                        if tags.get("historic") in ("monument", "memorial", "castle", "ruins", "building"):
                            dim_counts["historic"] += 1
                        if tags.get("amenity") in ("bar", "nightclub", "restaurant", "cafe", "marketplace"):
                            dim_counts["vibrant"] += 1
                        if tags.get("tourism") in ("artwork", "gallery", "museum", "attraction"):
                            dim_counts["photogenic"] += 1
                        if tags.get("waterway") in ("river", "stream", "canal"):
                            dim_counts["waterfront"] += 1
                        if tags.get("amenity") in ("community_centre", "social_facility", "library"):
                            dim_counts["local"] += 1
                    return {d: min(1.0, dim_counts[d] / threshold) for d in _neutral}
        except Exception:
            pass  # Fall through to live Overpass
    # ── Live Overpass (cold cache fallback) ───────────────────────────────────

    # Build bounding box with 0.05° buffer
    lats = [p[0] for p in route_points]
    lons = [p[1] for p in route_points]
    s = min(lats) - 0.05
    n = max(lats) + 0.05
    w = min(lons) - 0.05
    e = max(lons) + 0.05

    query = f"""[out:json][timeout:15][bbox:{s},{w},{n},{e}];
(
  node["natural"~"wood|water|wetland|tree|grassland|scrub|beach"];
  node["tourism"="viewpoint"];
  node["historic"~"monument|memorial|castle|ruins|building"];
  node["amenity"~"bar|nightclub|restaurant|cafe|marketplace"];
  node["tourism"~"artwork|gallery|museum|attraction"];
  node["waterway"~"river|stream|canal"];
  node["amenity"~"community_centre|social_facility|library"];
);
out tags;"""

    try:
        elements = fetch_overpass(query).get("elements", [])
    except Exception:
        return _neutral

    # Threshold for normalisation — scales with city size
    threshold = max(5, min(50, city_pop // 100_000 * 5 + 5))

    dim_counts: dict[str, int] = {d: 0 for d in _neutral}

    _TAG_DIM_MAP = [
        (("natural", ("wood", "water", "wetland", "tree", "grassland", "scrub", "beach")), "natural"),
        (("tourism", ("viewpoint",)), "viewpoint"),
        (("historic", ("monument", "memorial", "castle", "ruins", "building")), "historic"),
        (("amenity", ("bar", "nightclub", "restaurant", "cafe", "marketplace")), "vibrant"),
        (("tourism", ("artwork", "gallery", "museum", "attraction")), "photogenic"),
        (("waterway", ("river", "stream", "canal")), "waterfront"),
        (("amenity", ("community_centre", "social_facility", "library")), "local"),
    ]

    for el in elements:
        tags = el.get("tags", {})
        for (key, vals), dim in _TAG_DIM_MAP:
            if tags.get(key) in vals:
                dim_counts[dim] += 1

    return {d: min(1.0, dim_counts[d] / threshold) for d in dim_counts}


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compass bearing in degrees 0–360 from (lat1,lon1) to (lat2,lon2)."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _resolve_landmark_coords(stop: dict) -> tuple[float, float] | None:
    """Extract (lat, lon) from a landmark stop dict. No DB calls."""
    lat = stop.get("lat")
    lon = stop.get("lon")
    if lat is None or lon is None:
        return None
    try:
        return (float(lat), float(lon))
    except (TypeError, ValueError):
        return None


def _check_landmark_peeks(
    route_points: list[tuple[float, float]],
    landmarks: list[dict],
) -> list[str]:
    """Return names of landmarks visible from any route segment (within ±45° of travel direction).

    landmark dict: {"name": str, "lat": float, "lon": float}
    Returns at most 3 landmark names.
    """
    if not route_points or not landmarks:
        return []

    hits: list[tuple[float, str]] = []  # (min_angle_diff, name) for sorting

    for lm in landmarks:
        coords = _resolve_landmark_coords(lm)
        if coords is None:
            continue
        lm_lat, lm_lon = coords
        name = lm.get("name", "")
        if not name:
            continue

        for i in range(len(route_points) - 1):
            a_lat, a_lon = route_points[i]
            b_lat, b_lon = route_points[i + 1]
            # Travel direction of this segment
            travel_bearing = _bearing(a_lat, a_lon, b_lat, b_lon)
            # Midpoint of segment
            mid_lat = (a_lat + b_lat) / 2
            mid_lon = (a_lon + b_lon) / 2
            # Bearing from midpoint to landmark
            to_lm_bearing = _bearing(mid_lat, mid_lon, lm_lat, lm_lon)
            # Angular difference (shortest arc)
            diff = abs(travel_bearing - to_lm_bearing) % 360
            if diff > 180:
                diff = 360 - diff
            if diff <= 45:
                hits.append((diff, name))
                break  # count this landmark once

    # Sort by how directly ahead the landmark is; return top 3 names
    hits.sort(key=lambda x: x[0])
    seen: list[str] = []
    for _, name in hits:
        if name not in seen:
            seen.append(name)
        if len(seen) == 3:
            break
    return seen


# Persona archetype → per-dimension adjustments
# "_threshold_delta" lowers the 0.55 threshold; "_historic_conditional_threshold" means
# threshold drops further only when historic > 0.4 (used by slowScholar).
# "_night_vibrant_mult" / "_night_natural_mult" applied on top of condition_multiplier night boost.
_PERSONA_ADJUSTMENTS: dict[str, dict[str, float]] = {
    "flaneur":            {"local": 0.20, "_threshold_delta": -0.05},
    "gastronaut":         {"vibrant": 0.20},
    "slowScholar":        {"historic": 0.20, "_threshold_delta": -0.05, "_historic_conditional_threshold": -0.05},
    "neighbourhoodLocal": {"local": 0.25, "vibrant": -0.10},
    "aesthete":           {"photogenic": 0.20, "viewpoint": 0.15},
    "nightCreature":      {"_night_vibrant_mult": 1.5, "_night_natural_mult": 0.3},
    "ritualSeeker":       {"local": 0.15, "vibrant": 0.15},
    "efficientExplorer":  {},   # efficiency handled via haversine comparison below
}


def _score_route_character(
    mode: str,
    instruction_scores: dict[str, float],
    ors_surface_score: float,
    overpass_character: dict,
    road_character: float,
    elevation_gain_m: float | None,
    condition_multiplier: float,
    landmark_peeks: list,
    persona_snapshot: dict,
    persona_attractions: list[str],
    persona_key: str,
    distance_km: float,
    haversine_km: float | None = None,   # straight-line origin→dest; used for efficiency penalty
) -> dict:
    """Combine all signal sources into final character scores with user preference weighting.

    Three-tier preference matching:
      1. EngineWeights (persona_snapshot) — primary, multiplicative
      2. Persona.attractions (onboarding answers) — secondary, additive
      3. PersonaKey (archetype) — tertiary, per-dimension adjustments
    """
    overpass_scores = overpass_character.get("character_scores", {d: 0.0 for d in _DIM_KEYWORDS})
    elevation_score = min(1.0, (elevation_gain_m or 0) / 500)
    character_scores: dict[str, float] = {}

    for dim in _DIM_KEYWORDS:
        if mode == "walk":
            raw = (
                overpass_scores.get(dim, 0.0) * 0.45
                + instruction_scores.get(dim, 0.0) * 0.35
                + ors_surface_score * 0.20
            )
        else:  # drive
            raw = (
                overpass_scores.get(dim, 0.0) * 0.40
                + road_character * 0.35
                + elevation_score * 0.25
            )
        character_scores[dim] = round(min(1.0, raw), 3)

    # Landmark peek bonus on Viewpoint dimension
    if landmark_peeks:
        character_scores["viewpoint"] = min(1.0, character_scores.get("viewpoint", 0.0) + 0.25)

    # Named features → path_names
    path_names = overpass_character.get("named_features", [])

    # ── Tier 1: EngineWeights ──────────────────────────────────────────────────
    w = persona_snapshot
    user_weights: dict[str, float] = {
        "natural":    1 + w.get("w_scenic", 0.5) * 0.6,
        "viewpoint":  1 + w.get("w_scenic", 0.5) * 0.6,
        "waterfront": 1 + w.get("w_scenic", 0.5) * 0.6,
        "vibrant":    1 + w.get("w_nightlife", 0.4) * 0.8 + w.get("w_food_density", 0.4) * 0.5,
        "historic":   1 + w.get("w_culture_depth", 0.5) * 0.6,
        "photogenic": 1 + w.get("w_nightlife", 0.4) * 0.5,
        "local":      1.0,
    }
    walk_mult = 1 + w.get("w_walk_affinity", 0.5) * 0.4 if mode == "walk" else 1.0
    threshold = max(0.3, 0.55 - w.get("w_spontaneity", 0.5) * 0.10)

    # w_efficiency penalty: multiplicative score penalty for very indirect routes
    # score × (1 - w_efficiency * 0.3) when route_distance_km > haversine_distance_km * 2.0
    efficiency_score_mult = 1.0
    if haversine_km is not None and distance_km > haversine_km * 2.0:
        efficiency_score_mult = max(0.3, 1.0 - w.get("w_efficiency", 0.5) * 0.3)

    # ── Tier 2: attractions ────────────────────────────────────────────────────
    attraction_boost: dict[str, float] = {}
    for attr in (persona_attractions or []):
        if attr == "nature":
            attraction_boost["natural"]    = attraction_boost.get("natural", 0) + 0.15
            attraction_boost["waterfront"] = attraction_boost.get("waterfront", 0) + 0.10
        elif attr == "historic":
            attraction_boost["historic"]   = attraction_boost.get("historic", 0) + 0.15
        elif attr == "culture":
            attraction_boost["historic"]   = attraction_boost.get("historic", 0) + 0.10
            attraction_boost["photogenic"] = attraction_boost.get("photogenic", 0) + 0.10
        elif attr == "markets":
            attraction_boost["vibrant"]    = attraction_boost.get("vibrant", 0) + 0.15

    # ── Tier 3: PersonaKey ────────────────────────────────────────────────────
    persona_adj = _PERSONA_ADJUSTMENTS.get(persona_key, {})
    threshold += persona_adj.get("_threshold_delta", 0)

    # Apply all weights to character scores
    weighted_scores: dict[str, float] = {}
    for dim in _DIM_KEYWORDS:
        score = character_scores[dim]
        score *= user_weights.get(dim, 1.0) * walk_mult * efficiency_score_mult
        score += attraction_boost.get(dim, 0.0)
        # Skip private keys (prefixed with "_") from per-dimension additions
        if not dim.startswith("_"):
            score += persona_adj.get(dim, 0.0)
        weighted_scores[dim] = round(min(1.0, score), 3)

    top_character = max(weighted_scores, key=weighted_scores.get)
    top_score = weighted_scores[top_character]

    # slowScholar: additional threshold reduction when historic scores strongly
    if persona_key == "slowScholar" and weighted_scores.get("historic", 0) > 0.4:
        threshold += persona_adj.get("_historic_conditional_threshold", 0)

    # nightCreature: apply persona-specific night multipliers on top of condition_multiplier
    if persona_key == "nightCreature":
        if top_character in ("vibrant", "photogenic"):
            top_score = min(1.0, top_score * persona_adj.get("_night_vibrant_mult", 1.0))
            weighted_scores[top_character] = top_score
        elif top_character in ("natural", "waterfront", "local"):
            top_score = min(1.0, top_score * persona_adj.get("_night_natural_mult", 1.0))
            weighted_scores[top_character] = top_score
        # Recompute top_character after night multipliers may have changed rankings
        top_character = max(weighted_scores, key=weighted_scores.get)
        top_score = weighted_scores[top_character]

    # Route type
    if mode == "drive":
        route_type = "ridge" if elevation_score > 0.4 else "drive"
    elif top_character == "waterfront":
        route_type = "coastal"
    else:
        route_type = "walk"

    passes = (
        top_score * condition_multiplier >= threshold
        and distance_km >= 0.5
        and condition_multiplier > 0.0
    )

    return {
        "character_scores": weighted_scores,
        "top_character":    top_character,
        "condition_multiplier": condition_multiplier,
        "landmark_peeks":   landmark_peeks,
        "path_names":       path_names,
        "route_type":       route_type,
        "passes_threshold": passes,
    }


# Character dimension → accent colours for scenic cards
_CHARACTER_LABELS: dict[str, str] = {
    "natural":    "Through green spaces",
    "viewpoint":  "Scenic viewpoint route",
    "historic":   "Historic district walk",
    "vibrant":    "Through the heart of the city",
    "photogenic": "Photogenic route",
    "waterfront": "Riverside path",
    "local":      "Local neighbourhood walk",
}


def _generate_scenic_card_for_corridor(
    origin: dict,
    dest: dict,
    route_profile: dict,
    visit_time,
    persona_snapshot: dict,
    persona_attractions: list,
    persona_key: str,
    weather: dict,
    city_landmarks: list,
    dest_velocity_ratio: float | None = None,
) -> dict | None:
    """Generate a ReelScenicCard dict for the corridor, or None if threshold not met.

    Assumes Phase 1 scheduling is complete (visit_time is authoritative).
    Hard blocks: distance < 0.5 km; road_character < 0.4 on routes > 1 km.
    """
    distance_km = route_profile.get("distance_km") or 0
    road_character = route_profile.get("road_character") or 0

    # Hard block: distance < 0.5 km
    if distance_km < 0.5:
        return None

    # Hard block: predominantly motorway (road_character < 0.4 on longer routes)
    if road_character < 0.4 and distance_km > 1.0:
        return None

    # Only generate scenic cards for walkable corridors
    if distance_km >= 5:
        return None
    mode = "walk"

    # Straight-line haversine for efficiency penalty
    _orig_lat = origin.get("lat") or 0.0
    _orig_lon = origin.get("lon") or 0.0
    _dest_lat = dest.get("lat") or 0.0
    _dest_lon = dest.get("lon") or 0.0

    def _hav_km(la1: float, lo1: float, la2: float, lo2: float) -> float:
        R = 6371
        dlat = math.radians(la2 - la1)
        dlon = math.radians(lo2 - lo1)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dlon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    haversine_km: float | None = (
        _hav_km(_orig_lat, _orig_lon, _dest_lat, _dest_lon)
        if _orig_lat is not None and _dest_lat is not None and _orig_lon is not None and _dest_lon is not None else None
    )

    # Corridor midpoint
    mid_lat = (_orig_lat + _dest_lat) / 2
    mid_lon = (_orig_lon + _dest_lon) / 2

    # Condition multiplier (always fresh — not cached)
    _vt = visit_time or datetime.now(timezone.utc)
    condition_multiplier = _route_condition_multiplier(mid_lat, mid_lon, _vt)
    if condition_multiplier == 0.0:
        return None

    # Retrieve character scores from route profile cache if available
    cached_chars = route_profile.get("character_scores")
    walk_steps: list = route_profile.get("walk_steps", [])
    instruction_scores: dict[str, float] = _score_instructions_by_dimension(walk_steps)
    ors_surface_score: float = _ors_surface_score(route_profile.get("ors_response", {}))
    overpass_character: dict = {
        "character_scores": {d: 0.0 for d in _DIM_KEYWORDS},
        "named_features": [],
        "viewpoints": [],
    }
    landmark_peeks: list = route_profile.get("landmark_peeks") or []
    path_names: list = route_profile.get("path_names") or []

    if cached_chars:
        overpass_character["character_scores"] = cached_chars

    scoring = _score_route_character(
        mode=mode,
        instruction_scores=instruction_scores,
        ors_surface_score=ors_surface_score,
        overpass_character=overpass_character,
        road_character=road_character,
        elevation_gain_m=route_profile.get("elevation_gain_m"),
        condition_multiplier=condition_multiplier,
        landmark_peeks=landmark_peeks,
        persona_snapshot=persona_snapshot,
        persona_attractions=persona_attractions,
        persona_key=persona_key,
        distance_km=distance_km,
        haversine_km=haversine_km,
    )

    if not scoring["passes_threshold"]:
        return None

    # Persist character scoring so future calls can skip Overpass
    # NOTE: Must cache BEFORE trend boost to avoid persisting inflated scores
    _cache_route_character(
        _corridor_key(_orig_lat, _orig_lon, _dest_lat, _dest_lon), scoring
    )

    # ── Trend velocity boost ──────────────────────────────────────────────────
    _is_trending = (dest_velocity_ratio or 0) >= 0.7
    if _is_trending:
        scoring["character_scores"]["vibrant"] = min(
            1.0, scoring["character_scores"].get("vibrant", 0.0) + 0.15
        )
        scoring["character_scores"]["local"] = min(
            1.0, scoring["character_scores"].get("local", 0.0) + 0.15
        )
    _trend_note = (
        "Trending spot — locals and travellers are buzzing about this right now"
        if _is_trending else None
    )

    top_char = scoring["top_character"]

    # Build route label
    first_path = (path_names[0] if path_names else None) or dest.get("title", "this route")
    route_label = _CHARACTER_LABELS.get(top_char, "Scenic route")

    # Accent colour per dimension
    accent_map = {
        "natural": "#6b9470", "viewpoint": "#4f8fab", "historic": "#8b7355",
        "vibrant": "#c87941", "photogenic": "#9b6b9e", "waterfront": "#4f8fab", "local": "#a08d80",
    }
    accent = accent_map.get(top_char, "#6b9470")

    # Condition note (harsh conditions advisory — derived from condition_multiplier)
    condition_note: str | None = None
    temp = (weather or {}).get("temp") or 20
    has_canopy = "natural" in [d for d, s in scoring["character_scores"].items() if s > 0.4]
    if temp > 32 and condition_multiplier < 0.9:
        condition_note = (
            "High UV today — this route has shade cover." if has_canopy
            else "High UV today — consider sun protection."
        )

    _trend_suffix = " Trending right now." if _is_trending else ""
    why = f"A {top_char} {mode} from {origin.get('title', '')} to {dest.get('title', '')}.{_trend_suffix}"

    return {
        "type": "scenic",
        "sceneType": scoring["route_type"],
        "accent": accent,
        "cardType": f"{mode.upper()} · {top_char.upper()}",
        "pos": 0,     # set by caller
        "total": 0,   # set by caller
        "timing": "",
        "metaRight": f"{distance_km} km",
        "place": first_path,
        "from": origin.get("title", ""),
        "to": dest.get("title", ""),
        "modeIcon": "walk" if mode == "walk" else "car",
        "tag": top_char.capitalize(),
        "vizType": "corridor",
        "persona": persona_key,
        "personaDisplay": persona_key,
        "personaIcon": "walk",
        "why": why,
        "sensory": "",
        "sensoryIcon": "waves",
        "reelPos": f"Between {origin.get('title', '')} and {dest.get('title', '')}",
        "photoUrl": None,
        "detourKm": round(distance_km, 1),
        "detourMin": route_profile.get("duration_min") or 0,
        "transitInfo": None,
        "routeLabel": route_label,
        "conditionNote": condition_note,
        "characterDimensions": {d: round(s, 3) for d, s in scoring["character_scores"].items() if s > 0.4},
        "landmarkPeek": landmark_peeks if landmark_peeks else None,
        "topCharacter": top_char,
        "conditionMultiplier": condition_multiplier,
        "fromStop": origin.get("title", ""),
        "toStop": dest.get("title", ""),
        "distanceKm": round(distance_km, 2),
        "isTrending": _is_trending,
        "trendNote": _trend_note,
    }


def _corridor_key(olat: float, olon: float, dlat: float, dlon: float) -> str:
    return f"{round(olat,4)}_{round(olon,4)}_{round(dlat,4)}_{round(dlon,4)}"


def _fetch_transit_corridor(olat: float, olon: float, dlat: float, dlon: float) -> dict:
    key = _corridor_key(olat, olon, dlat, dlon)

    # 1. Cache read — skip if walk_distance_m is missing (pre-migration rows need a refetch)
    if _supabase:
        try:
            row = _supabase.table("transit_corridor_cache") \
                .select("*").eq("corridor_key", key).execute()
            if row.data:
                r = row.data[0]
                fetched = datetime.fromisoformat(r["fetched_at"].replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - fetched < timedelta(days=30) and r.get("walk_distance_m") is not None:
                    return {k: r.get(k) for k in (
                        "has_transit","transit_type","duration_min","line_name",
                        "departure_stop","arrival_stop","transfers","walk_to_stop_min",
                        "walk_distance_m","walk_duration_min","walk_via",
                    )}
        except Exception as e:
            print(f"TRANSIT CACHE READ: {e}")

    # 2. Fire transit + walking Google Directions calls in parallel
    result = {"has_transit": False, "transit_type": None, "duration_min": None,
              "line_name": None, "departure_stop": None, "arrival_stop": None,
              "transfers": None, "walk_to_stop_min": None,
              "walk_distance_m": None, "walk_duration_min": None, "walk_via": None}

    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        _write_transit_cache(key, result)
        return result

    def _call_directions(mode: str):
        return requests.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={"origin": f"{olat},{olon}", "destination": f"{dlat},{dlon}",
                    "mode": mode, "key": api_key},
            timeout=12,
        ).json()

    from concurrent.futures import ThreadPoolExecutor, as_completed
    transit_data, walk_data = None, None
    try:
        with ThreadPoolExecutor(max_workers=2) as ex:
            fut_transit = ex.submit(_call_directions, "transit")
            fut_walk    = ex.submit(_call_directions, "walking")
            transit_data = fut_transit.result()
            walk_data    = fut_walk.result()
    except Exception as e:
        print(f"DIRECTIONS API: {e}")

    # 3. Parse transit response
    try:
        routes = (transit_data or {}).get("routes", [])
        if routes:
            leg = routes[0]["legs"][0]
            steps = leg.get("steps", [])
            total_sec = leg.get("duration", {}).get("value", 0)
            transit_steps = [s for s in steps if s.get("travel_mode") == "TRANSIT"]
            walk_steps    = [s for s in steps if s.get("travel_mode") == "WALKING"]
            if transit_steps:
                first_transit = transit_steps[0]
                td = first_transit.get("transit_details", {})
                line = td.get("line", {})
                result.update({
                    "has_transit":      True,
                    "transit_type":     line.get("vehicle", {}).get("type"),
                    "duration_min":     max(1, round(total_sec / 60)),
                    "line_name":        line.get("short_name") or line.get("name"),
                    "departure_stop":   td.get("departure_stop", {}).get("name"),
                    "arrival_stop":     td.get("arrival_stop", {}).get("name"),
                    "transfers":        max(0, len(transit_steps) - 1),
                    "walk_to_stop_min": max(1, round(sum(s.get("duration",{}).get("value",0) for s in walk_steps) / 60)) if walk_steps else 0,
                })
    except Exception as e:
        print(f"TRANSIT PARSE: {e}")

    # 4. Parse walking response — real footpath distance, duration, and street names
    _DIRECTION_WORDS = {
        "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
        "left", "right", "straight", "ahead", "destination", "turn", "continue", "head",
        "slight", "merge", "keep", "exit", "ramp", "roundabout",
    }

    def _extract_walk_via(steps: list) -> list[str]:
        """Extract meaningful street / path names from Google Directions walking steps."""
        import re
        seen: set[str] = set()
        names: list[str] = []
        for step in steps:
            html = step.get("html_instructions", "")
            # Pull every <b>…</b> token
            tokens = re.findall(r"<b>(.*?)</b>", html, re.IGNORECASE)
            for raw in tokens:
                # Strip any residual HTML tags inside the bold span
                clean = re.sub(r"<[^>]+>", "", raw).strip()
                if not clean:
                    continue
                lower = clean.lower()
                # Skip pure direction / cardinal words
                if lower in _DIRECTION_WORDS:
                    continue
                # Skip short tokens that are just ordinal/cardinal abbreviations
                if len(clean) <= 2:
                    continue
                key = lower
                if key not in seen:
                    seen.add(key)
                    names.append(clean)
            if len(names) >= 4:
                break
        return names[:4]

    try:
        walk_routes = (walk_data or {}).get("routes", [])
        if walk_routes:
            walk_leg = walk_routes[0]["legs"][0]
            dist_m   = walk_leg.get("distance", {}).get("value")   # metres
            dur_sec  = walk_leg.get("duration", {}).get("value")   # seconds
            if dist_m is not None and dur_sec is not None:
                result["walk_distance_m"]   = int(dist_m)
                result["walk_duration_min"] = max(1, round(dur_sec / 60))
            walk_steps = walk_leg.get("steps", [])
            via = _extract_walk_via(walk_steps)
            if via:
                result["walk_via"] = via
            route_pts = _extract_walk_route_points(walk_steps)
            if route_pts:
                result["walk_route_points"] = route_pts
    except Exception as e:
        print(f"WALK PARSE: {e}")

    _write_transit_cache(key, result)
    return result


def _write_transit_cache(key: str, result: dict) -> None:
    if not _supabase:
        return
    try:
        _supabase.table("transit_corridor_cache").upsert({
            "corridor_key": key,
            **result,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"TRANSIT CACHE WRITE: {e}")


@app.get("/transit-corridor")
def transit_corridor(
    origin_lat: float = Query(...),
    origin_lon: float = Query(...),
    dest_lat:   float = Query(...),
    dest_lon:   float = Query(...),
):
    """
    Returns transit options between two coordinates.
    Cached in transit_corridor_cache for 30 days.
    Used by the frontend scenic walk cards to show real transit data.
    """
    _validate_coords((origin_lat, origin_lon), (dest_lat, dest_lon))
    return _fetch_transit_corridor(origin_lat, origin_lon, dest_lat, dest_lon)


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

    # 1. Check Supabase cache — cache hits bypass rate limit entirely
    if _supabase:
        try:
            cached = (
                _supabase.table("place_details_cache")
                .select("data, fetched_at")
                .eq("place_id", place_id)
                .maybe_single()
                .execute()
            )
            cached_row = _maybe_single_data(cached)
            if cached_row:
                fetched_at = datetime.fromisoformat(cached_row["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(days=PLACE_CACHE_TTL_DAYS):
                    return cached_row["data"]
        except Exception:
            pass

    # Cache miss — check rate limit before calling Google
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # 2. Cache miss — call Google
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types,popular_times",
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
        old_photo_ref = result["photos"][0]["photo_reference"] if result.get("photos") else None

        # Fetch generative summary + proper photo name from Places API (New)
        # The old API now returns new-format photo_reference tokens that only work with
        # the new API. Request photos.name here to get a proper v1 resource name.
        review_summary = None
        photo_ref = old_photo_ref
        try:
            new_resp = requests.get(
                f"https://places.googleapis.com/v1/places/{place_id}",
                headers={
                    "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
                    "X-Goog-FieldMask": "generativeSummary,photos",
                },
                timeout=5,
            ).json()
            gen = new_resp.get("generativeSummary", {})
            review_summary = (
                gen.get("overview", {}).get("text")
                or gen.get("description", {}).get("text")
            )
            new_photos = new_resp.get("photos", [])
            if new_photos:
                photo_ref = new_photos[0]["name"]  # e.g. "places/{pid}/photos/{proper_token}"
            elif old_photo_ref and len(old_photo_ref) > 300:
                photo_ref = None  # old-format new token, unusable — let frontend skip
        except Exception as e:
            print(f"PLACE DETAILS new API error for {place_id}: {e}")
            # Fall back: nullify unusable new-format refs from old API
            if old_photo_ref and len(old_photo_ref) > 300:
                photo_ref = None

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
            "editorial_summary": _sanitise(result.get("editorial_summary", {}).get("overview")),
            "reviews": [
                {"text": r.get("text", ""), "author_name": r.get("author_name", ""), "rating": r.get("rating", 0)}
                for r in result.get("reviews", [])[:3]
            ],
            "review_summary": review_summary,
            "popular_times": result.get("popular_times"),
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
    "restaurant":         "restaurant",
    "cafe":               "cafe",
    "bar":                "bar",
    "museum":             "museum",
    "tourist_attraction": "tourism",
    "park":               "park",
    "night_club":         "nightlife",
    "bakery":             "bakery",
    "spa":                "spa",
    "church":             "spiritual",
    "mosque":             "spiritual",
    "hindu_temple":       "spiritual",
    "stadium":            "stadium",
    "zoo":                "zoo",
    "aquarium":           "aquarium",
    "library":            "library",
    "movie_theater":      "cinema",
    "amusement_park":     "amusement_park",
    "art_gallery":        "gallery",
}

MAP_DATA_CACHE_TTL_HOURS = int(os.getenv("MAP_DATA_CACHE_TTL_HOURS", "168"))

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
    _validate_coords((lat, lon))
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
                cached_row = _maybe_single_data(cached)
                if cached_row and cached_row.get("place_id"):
                    resolved_id = cached_row["place_id"]
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
            cached_details_row = _maybe_single_data(cached_details)
            if cached_details_row:
                fetched_at = datetime.fromisoformat(cached_details_row["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(days=PLACE_CACHE_TTL_DAYS):
                    return cached_details_row["data"]
        except Exception:
            pass

    # ── 5. Fetch from Google Place Details ──
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/details/json",
            params={
                "place_id": resolved_id,
                "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types,editorial_summary,reviews,popular_times",
                "key": GOOGLE_PLACES_API_KEY,
            },
            timeout=5,
        )
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return {"place_id": None, "error": data.get("status", "UNKNOWN")}

        result = data.get("result", {})
        raw_photos = result.get("photos") or []
        photo_refs = [p["photo_reference"] for p in raw_photos[:10] if p.get("photo_reference")]
        photo_ref = photo_refs[0] if photo_refs else None

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
            "photo_refs": photo_refs,
            "types": result.get("types", []),
            "editorial_summary": _sanitise(result.get("editorial_summary", {}).get("overview")),
            "top_review": _sanitise(result["reviews"][0]["text"]) if result.get("reviews") else None,
            "reviews": [
                {
                    "text": _sanitise(r.get("text", "")),
                    "author_name": r.get("author_name", ""),
                    "rating": r.get("rating", 5),
                }
                for r in (result.get("reviews") or [])[:3]
                if r.get("text")
            ],
            "popular_times": result.get("popular_times"),
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



# ── Photo byte cache: photo_ref → bytes, stored in memory (max 500 entries) ──
_photo_cache: dict[str, tuple[bytes, str]] = {}   # ref → (bytes, content_type)
_PHOTO_CACHE_MAX = 500

@app.get("/place-photo")
def place_photo(request: Request, photo_ref: str = Query(...), max_width: int = Query(800)):
    """Proxy Google Place Photos — fetches and caches bytes server-side.
    Handles both old-format photo_reference (CmRa…) and new Places API v1
    resource names (places/{id}/photos/{token}).
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not configured")

    cache_key = f"{photo_ref}:{max_width}"
    if cache_key in _photo_cache:
        data, ct = _photo_cache[cache_key]
        return Response(content=data, media_type=ct,
                        headers={"Cache-Control": "public, max-age=86400"})

    use_new_api = photo_ref.startswith("places/")

    def _fetch_new_api_photo(name: str) -> Optional[requests.Response]:
        """Fetch image bytes via Places API v1: use skipHttpRedirect to get photoUri, then fetch it."""
        try:
            # skipHttpRedirect=true returns JSON {photoUri: "..."} instead of a redirect
            meta = requests.get(
                f"https://places.googleapis.com/v1/{name}/media",
                params={"maxWidthPx": max_width, "skipHttpRedirect": "true"},
                headers={"X-Goog-Api-Key": GOOGLE_PLACES_API_KEY},
                timeout=8,
            )
            print(f"[place-photo] new API status={meta.status_code} name={name[:60]}")
            if meta.ok:
                photo_uri = meta.json().get("photoUri")
                if photo_uri:
                    img = requests.get(photo_uri, timeout=10)
                    return img if img.ok and img.content else None
            return None
        except Exception as e:
            print(f"[place-photo] _fetch_new_api_photo error: {e}")
            return None

    def _get_fresh_place_photo(place_id: str) -> Optional[requests.Response]:
        """Call Places API v1 to get a fresh photo name for place_id, then fetch it."""
        try:
            details = requests.get(
                f"https://places.googleapis.com/v1/places/{place_id}",
                params={"fields": "photos"},
                headers={"X-Goog-Api-Key": GOOGLE_PLACES_API_KEY},
                timeout=5,
            ).json()
            photos = details.get("photos", [])
            print(f"[place-photo] fresh details for {place_id}: {len(photos)} photos")
            if not photos:
                return None
            return _fetch_new_api_photo(photos[0]["name"])
        except Exception as e:
            print(f"[place-photo] fresh photo fetch error for {place_id}: {e}")
            return None

    try:
        r: Optional[requests.Response] = None
        if use_new_api:
            r = _fetch_new_api_photo(photo_ref)
            if r is None:
                # Old-API token is incompatible with new API — get a fresh token via place_id
                place_id = photo_ref.split('/')[1] if photo_ref.count('/') >= 2 else None
                if place_id:
                    print(f"[place-photo] stale token, fetching fresh photo for place_id={place_id}")
                    r = _get_fresh_place_photo(place_id)
        else:
            resp = requests.get(
                f"https://maps.googleapis.com/maps/api/place/photo"
                f"?photo_reference={photo_ref}&maxwidth={max_width}&key={GOOGLE_PLACES_API_KEY}",
                timeout=10, allow_redirects=True,
            )
            r = resp if resp.ok else None

        if r is None or not r.content:
            print(f"[place-photo] all attempts failed: ref={photo_ref[:80]}")
            raise HTTPException(status_code=404, detail="Photo not found")

        ct = r.headers.get("Content-Type", "image/jpeg")
        data = r.content
        if len(_photo_cache) >= _PHOTO_CACHE_MAX:
            _photo_cache.pop(next(iter(_photo_cache)))
        _photo_cache[cache_key] = (data, ct)
        return Response(content=data, media_type=ct,
                        headers={"Cache-Control": "public, max-age=86400"})
    except HTTPException:
        raise
    except requests.RequestException as e:
        print(f"[place-photo] request error: {e} ref={photo_ref[:80]}")
        raise HTTPException(status_code=502, detail=f"Photo fetch error: {e}")


# ── Reel Recommendations ─────────────────────────────────────────────────────

_TRIGGER_TYPES: dict[str, list[str]] = {
    "lunch":             ["restaurant", "food"],
    "dinner":            ["restaurant", "bar"],
    "evening":           ["bar", "night_club"],
    "culture":           ["museum", "art_gallery"],
    "rest":              ["cafe", "coffee_shop"],
    "weather":           ["museum", "art_gallery", "shopping_mall", "cafe"],
    "closing_conflict":  ["tourist_attraction", "museum", "art_gallery", "park"],
    "walking_gap":       ["cafe", "restaurant"],
    "crowd_peak":        ["museum", "art_gallery", "cafe"],
    "famous_spots":      ["tourist_attraction", "museum", "point_of_interest"],
}

_TRIGGER_RADIUS: dict[str, int] = {
    "lunch":             600,
    "dinner":            800,
    "evening":           1000,
    "culture":           1000,
    "rest":              400,
    "weather":           1200,
    "closing_conflict":  1000,
    "walking_gap":       400,
    "crowd_peak":        800,
    "famous_spots":      2000,
}

def _reel_match_reasons(affinity: float, rating: float | None, distance_m: int, price_level: int | None) -> list[str]:
    reasons = []
    if distance_m < 250:
        reasons.append("3-min walk")
    elif distance_m < 450:
        reasons.append("5-min walk")
    elif distance_m < 800:
        reasons.append("10-min walk")
    if affinity >= 0.85:
        reasons.append("Strong match for your taste")
    elif affinity >= 0.65:
        reasons.append("Fits your style")
    if rating is not None:
        if rating >= 4.5:
            reasons.append(f"Rated {rating}")
        elif rating >= 4.0:
            reasons.append(f"Rated {rating}")
    if price_level is not None:
        if price_level <= 2:
            reasons.append("Budget-friendly")
        elif price_level == 4:
            reasons.append("Upscale")
    return reasons[:3]


class ReelRecoRequest(BaseModel):
    lat: float
    lon: float
    trigger: str
    archetype: str
    existing_place_ids: list[str] = []
    radius: int = 600


@app.post("/reel-reco")
def reel_reco(body: ReelRecoRequest, request: Request, response: Response):
    """Persona-scored nearby recommendations for reel reco cards. No LLM."""
    if not GOOGLE_PLACES_API_KEY:
        return {"places": []}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    response.headers["Cache-Control"] = "max-age=300"

    google_types = _TRIGGER_TYPES.get(body.trigger, ["restaurant"])
    radius = _TRIGGER_RADIUS.get(body.trigger, body.radius)
    archetype = body.archetype.lower()

    seen_ids: set[str] = set(body.existing_place_ids)
    candidates: list[dict] = []

    for gtype in google_types:
        try:
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                params={
                    "location": f"{body.lat},{body.lon}",
                    "radius": radius,
                    "type": gtype,
                    "key": GOOGLE_PLACES_API_KEY,
                },
                timeout=5,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                continue
            for place in data.get("results", [])[:8]:
                pid = place.get("place_id", "")
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)
                loc = place.get("geometry", {}).get("location", {})
                plat, plon = loc.get("lat", 0.0), loc.get("lng", 0.0)
                dlat = math.radians(plat - body.lat)
                dlon = math.radians(plon - body.lon)
                a = (math.sin(dlat / 2) ** 2
                     + math.cos(math.radians(body.lat))
                     * math.cos(math.radians(plat))
                     * math.sin(dlon / 2) ** 2)
                dist_m = int(6371000 * 2 * math.asin(math.sqrt(a)))
                rating = place.get("rating")
                price_level = place.get("price_level")
                primary_type = (place.get("types") or [gtype])[0]
                affinity = get_persona_affinity(primary_type).get(archetype, 0.5)
                rating_norm = (min(float(rating), 5.0) / 5.0) if rating is not None else 0.5
                dist_norm = max(0.0, 1.0 - dist_m / (radius * 1.5))
                score = affinity * 0.5 + rating_norm * 0.3 + dist_norm * 0.2
                candidates.append({
                    "place_id":    pid,
                    "name":        place.get("name", ""),
                    "lat":         plat,
                    "lon":         plon,
                    "category":    gtype,
                    "rating":      rating,
                    "price_level": price_level,
                    "distance_m":  dist_m,
                    "affinity_score": round(affinity, 3),
                    "match_reasons": _reel_match_reasons(affinity, rating, dist_m, price_level),
                    "_score":      score,
                })
        except Exception:
            continue

    candidates.sort(key=lambda x: x["_score"], reverse=True)
    for c in candidates:
        c.pop("_score", None)

    return {"places": candidates[:4]}


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
    _validate_coords((lat, lon))
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


# ── Phase 5: Build Itinerary Endpoint ────────────────────────────────────────

@app.post("/api/itinerary/build")
async def build_itinerary_endpoint(
    body: ItineraryBuildRequest,
    user=Depends(require_auth_or_pack),
):
    """Build a deterministic 5-layer itinerary from user stops + persona."""
    # Load city data
    try:
        city = load_city(body.city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    # Convert request stops to EngineStop objects
    engine_stops = [
        EngineStop(
            place_id=s.place_id,
            name=s.name,
            lat=s.lat,
            lon=s.lon,
            category=s.category,
            duration_min=s.duration_min,
            opening_hours=s.opening_hours,
            price_level=s.price_level,
            rating=s.rating,
            neighborhood=s.neighborhood,
            is_user_added=True,
        )
        for s in body.stops
    ]

    ctx = EngineContext(
        persona=body.persona,
        city=city,
        travel_dates=body.travel_dates,
        weather=None,
    )

    result = await build_itinerary(engine_stops, ctx)
    from engine.plan_scrubber import scrub as _scrub
    result = _scrub(result, ctx)

    return {
        "generation_id": result.generation_id,
        "days": [
            {
                "date": day.date,
                "is_travel_day": day.is_travel_day,
                "stops": [
                    {
                        "place_id": s.place_id,
                        "name": s.name,
                        "lat": s.lat,
                        "lon": s.lon,
                        "category": s.category,
                        "duration_min": s.duration_min,
                        "scheduled_time": s.scheduled_time,
                        "transition_to_next": s.transition_to_next,
                        "type": s.type,
                        "is_user_added": s.is_user_added,
                        "outdoor": s.outdoor,
                        "tags": s.tags or [],
                    }
                    for s in day.stops
                ],
            }
            for day in result.days
        ],
        "messages": [
            {
                "type": m.type,
                "what": m.what,
                "why": m.why,
                "consequence": m.consequence,
                "dismissable": m.dismissable,
                "undo_key": m.undo_key,
            }
            for m in result.messages
        ],
        "recommendations": result.recommendations,
    }


# ── Frontend-facing build itinerary endpoint ─────────────────────────────────

_ARCHETYPE_PERSONA: dict[str, dict] = {
    # ── Legacy archetypes ──────────────────────────────────────────────────────
    "explorer":           {"archetype": "explorer",           "day_buffer_min": 30, "weights": {"w_walk_affinity": 0.6, "w_scenic": 0.6, "w_efficiency": 0.5, "w_food_density": 0.5, "w_culture_depth": 0.7, "w_nightlife": 0.4, "w_budget_sensitivity": 0.4, "w_crowd_aversion": 0.5, "w_spontaneity": 0.6, "w_rest_need": 0.4}},
    "wanderer":           {"archetype": "wanderer",           "day_buffer_min": 40, "weights": {"w_walk_affinity": 0.8, "w_scenic": 0.7, "w_efficiency": 0.3, "w_food_density": 0.6, "w_culture_depth": 0.5, "w_nightlife": 0.3, "w_budget_sensitivity": 0.5, "w_crowd_aversion": 0.7, "w_spontaneity": 0.8, "w_rest_need": 0.5}},
    "historian":          {"archetype": "historian",          "day_buffer_min": 25, "weights": {"w_walk_affinity": 0.5, "w_scenic": 0.5, "w_efficiency": 0.6, "w_food_density": 0.4, "w_culture_depth": 0.9, "w_nightlife": 0.2, "w_budget_sensitivity": 0.4, "w_crowd_aversion": 0.4, "w_spontaneity": 0.3, "w_rest_need": 0.4}},
    "epicurean":          {"archetype": "epicurean",          "day_buffer_min": 35, "weights": {"w_walk_affinity": 0.5, "w_scenic": 0.5, "w_efficiency": 0.5, "w_food_density": 0.9, "w_culture_depth": 0.5, "w_nightlife": 0.7, "w_budget_sensitivity": 0.2, "w_crowd_aversion": 0.4, "w_spontaneity": 0.5, "w_rest_need": 0.3}},
    "pulse":              {"archetype": "pulse",              "day_buffer_min": 30, "weights": {"w_walk_affinity": 0.6, "w_scenic": 0.4, "w_efficiency": 0.5, "w_food_density": 0.6, "w_culture_depth": 0.4, "w_nightlife": 0.9, "w_budget_sensitivity": 0.3, "w_crowd_aversion": 0.2, "w_spontaneity": 0.7, "w_rest_need": 0.3}},
    "slowtraveller":      {"archetype": "slowtraveller",      "day_buffer_min": 50, "weights": {"w_walk_affinity": 0.7, "w_scenic": 0.7, "w_efficiency": 0.2, "w_food_density": 0.6, "w_culture_depth": 0.6, "w_nightlife": 0.3, "w_budget_sensitivity": 0.5, "w_crowd_aversion": 0.6, "w_spontaneity": 0.6, "w_rest_need": 0.7}},
    "voyager":            {"archetype": "voyager",            "day_buffer_min": 20, "weights": {"w_walk_affinity": 0.5, "w_scenic": 0.5, "w_efficiency": 0.9, "w_food_density": 0.4, "w_culture_depth": 0.6, "w_nightlife": 0.3, "w_budget_sensitivity": 0.5, "w_crowd_aversion": 0.3, "w_spontaneity": 0.3, "w_rest_need": 0.3}},
    # ── New frontend archetypes ────────────────────────────────────────────────
    "flaneur":            {"archetype": "flaneur",            "day_buffer_min": 45, "weights": {"w_walk_affinity": 0.9, "w_scenic": 0.8, "w_efficiency": 0.2, "w_food_density": 0.5, "w_culture_depth": 0.5, "w_nightlife": 0.3, "w_budget_sensitivity": 0.5, "w_crowd_aversion": 0.8, "w_spontaneity": 0.9, "w_rest_need": 0.5}},
    "gastronaut":         {"archetype": "gastronaut",         "day_buffer_min": 35, "weights": {"w_walk_affinity": 0.5, "w_scenic": 0.4, "w_efficiency": 0.5, "w_food_density": 0.95, "w_culture_depth": 0.4, "w_nightlife": 0.7, "w_budget_sensitivity": 0.2, "w_crowd_aversion": 0.3, "w_spontaneity": 0.6, "w_rest_need": 0.3}},
    "slowscholar":        {"archetype": "slowscholar",        "day_buffer_min": 45, "weights": {"w_walk_affinity": 0.6, "w_scenic": 0.5, "w_efficiency": 0.2, "w_food_density": 0.4, "w_culture_depth": 0.9, "w_nightlife": 0.2, "w_budget_sensitivity": 0.4, "w_crowd_aversion": 0.5, "w_spontaneity": 0.3, "w_rest_need": 0.75}},
    "neighbourhoodlocal": {"archetype": "neighbourhoodlocal", "day_buffer_min": 50, "weights": {"w_walk_affinity": 0.85, "w_scenic": 0.6, "w_efficiency": 0.2, "w_food_density": 0.7, "w_culture_depth": 0.4, "w_nightlife": 0.3, "w_budget_sensitivity": 0.6, "w_crowd_aversion": 0.85, "w_spontaneity": 0.7, "w_rest_need": 0.5}},
    "efficientexplorer":  {"archetype": "efficientexplorer",  "day_buffer_min": 20, "weights": {"w_walk_affinity": 0.55, "w_scenic": 0.55, "w_efficiency": 0.9, "w_food_density": 0.5, "w_culture_depth": 0.7, "w_nightlife": 0.3, "w_budget_sensitivity": 0.4, "w_crowd_aversion": 0.3, "w_spontaneity": 0.4, "w_rest_need": 0.25}},
    "aesthete":           {"archetype": "aesthete",           "day_buffer_min": 35, "weights": {"w_walk_affinity": 0.7, "w_scenic": 0.9, "w_efficiency": 0.35, "w_food_density": 0.45, "w_culture_depth": 0.85, "w_nightlife": 0.25, "w_budget_sensitivity": 0.3, "w_crowd_aversion": 0.6, "w_spontaneity": 0.5, "w_rest_need": 0.4}},
    "nightcreature":      {"archetype": "nightcreature",      "day_buffer_min": 30, "weights": {"w_walk_affinity": 0.5, "w_scenic": 0.3, "w_efficiency": 0.4, "w_food_density": 0.65, "w_culture_depth": 0.3, "w_nightlife": 0.95, "w_budget_sensitivity": 0.3, "w_crowd_aversion": 0.2, "w_spontaneity": 0.85, "w_rest_need": 0.35}},
    "ritualseeker":       {"archetype": "ritualseeker",       "day_buffer_min": 50, "weights": {"w_walk_affinity": 0.65, "w_scenic": 0.6, "w_efficiency": 0.3, "w_food_density": 0.55, "w_culture_depth": 0.75, "w_nightlife": 0.2, "w_budget_sensitivity": 0.45, "w_crowd_aversion": 0.6, "w_spontaneity": 0.2, "w_rest_need": 0.8}},
}


_WHY_FOR_YOU: dict[str, tuple[str, list[str]]] = {
    "museum":     ("w_culture_depth", [
        "One of the better collections in this part of the city.",
        "Significant holdings — worth more time than most visitors give it.",
        "Fits naturally between your other cultural stops today.",
        "Strong permanent collection; skip the temporary exhibitions if short on time.",
        "Early visit pays off — crowds build toward midday.",
    ]),
    "gallery":    ("w_culture_depth", [
        "One of the better-rated galleries in this area.",
        "Contemporary space — good contrast to the historic stops nearby.",
        "Smaller than a museum; usually 30–45 minutes is enough.",
        "Worth a look even if art isn’t the focus — good architecture.",
    ]),
    "historic":   ("w_culture_depth", [
        "Significant site — often skipped, rarely regretted.",
        "More layered than it looks from outside.",
        "Early in the day while the crowds are thin.",
        "Context here enriches everything else you’ll see today.",
    ]),
    "restaurant": ("w_food_density", [
        "Well-rated and fits the timing of your day.",
        "Solid local option — not a tourist trap.",
        "Matches the pace of the afternoon.",
        "Good for a longer sit if your feet need a break.",
        "Locals eat here. That’s usually a good sign.",
    ]),
    "cafe":       ("w_rest_need", [
        "Good pause point between the morning stops.",
        "Quieter than a restaurant — better for a slow hour.",
        "The afternoon stretch benefits from a sit-down.",
        "Natural break in the route here.",
    ]),
    "park":       ("w_scenic", [
        "Good open space at this point in the route.",
        "Useful reset after a stretch of indoor stops.",
        "Lends itself to an unplanned wander.",
        "Less crowded in the morning.",
    ]),
    "viewpoint":  ("w_scenic", [
        "High vantage point — clear views from here.",
        "Best in the morning before haze builds.",
        "Worth the climb; most visitors skip it.",
        "Good orientation point early in the day.",
    ]),
    "nightlife":  ("w_nightlife", [
        "Active later in the evening. Fits where your day ends.",
        "One of the better spots in this neighborhood after dark.",
        "Peaks around 22:00 — worth staying if energy allows.",
    ]),
    "bar":        ("w_nightlife", [
        "Well-reviewed. Good spot for this time of day.",
        "Neighborhood fixture — not on most tourist lists.",
        "Good wind-down option after the evening stops.",
    ]),
    "shopping":   ("w_spontaneity", [
        "Lively area — good for a wander between stops.",
        "More interesting than the main shopping strips.",
        "Local designers and independents, not chains.",
    ]),
    "market":     ("w_spontaneity", [
        "Best earlier in the day before it fills up.",
        "Local market — different character from tourist-facing shops.",
        "Weekday mornings have the best stall selection.",
    ]),
    "beach":      ("w_scenic", [
        "Open stretch at a natural break in your route.",
        "Less crowded on weekday mornings.",
        "Good reset before the afternoon stops.",
    ]),
    "spa":        ("w_rest_need", [
        "Scheduled after a long stretch of stops.",
        "Good call if today’s route is heavy on walking.",
        "Mid-afternoon slot tends to be quieter.",
    ]),
    "temple":     ("w_culture_depth", [
        "Active site — not just a tourist landmark.",
        "Early morning has a completely different atmosphere.",
        "Worth the detour even if culture isn’t your primary focus.",
    ]),
    "shrine":     ("w_culture_depth", [
        "Morning visits catch the ritual activity.",
        "Quieter than the main temples; worth the diversion.",
        "Often overlooked — the grounds are worth the time.",
    ]),
    "garden":     ("w_scenic", [
        "Designed for slow movement — plan at least an hour.",
        "Peak season matters here; off-season has its own character.",
        "Good middle-of-day stop when you need a slower pace.",
    ]),
}


def _nearest_neighborhood_name(city_data, lat: float, lon: float) -> str:
    """Return the name of the nearest neighborhood in city_data, or '' if none."""
    best_name = ""
    best_dist = float("inf")
    for nh in city_data.neighborhoods:
        nh_lat, nh_lon = nh.center[0], nh.center[1]
        dlat = math.radians(nh_lat - lat)
        dlon = math.radians(nh_lon - lon)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat)) * math.cos(math.radians(nh_lat))
             * math.sin(dlon / 2) ** 2)
        dist_km = 6371 * 2 * math.asin(math.sqrt(a))
        if dist_km < best_dist:
            best_dist = dist_km
            best_name = nh.name
    return best_name


_DAY_NAME_TO_WEEKDAY: dict[str, int] = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
_TIME_RE = re.compile(r"(\d{1,2}):(\d{2})\s*(AM|PM)", re.IGNORECASE)

def _parse_weekday_text(weekday_text: list[str]) -> list[dict]:
    """Parse Google Places weekday_text into [{day:0-6, open_min:int, close_min:int}].

    0=Monday … 6=Sunday, matching datetime.weekday().
    Closed days are omitted. 'Open 24 hours' → {open_min: 0, close_min: 1440}.
    """
    def _to_min(h: int, m: int, ampm: str) -> int:
        if ampm.upper() == "PM" and h != 12:
            h += 12
        elif ampm.upper() == "AM" and h == 12:
            h = 0
        return h * 60 + m

    result = []
    for text in weekday_text:
        colon_idx = text.find(":")
        if colon_idx < 0:
            continue
        day_name = text[:colon_idx].strip().lower()
        weekday = _DAY_NAME_TO_WEEKDAY.get(day_name)
        if weekday is None:
            continue
        rest = text[colon_idx + 1:].strip()
        if "closed" in rest.lower():
            continue
        if "open 24 hours" in rest.lower():
            result.append({"day": weekday, "open_min": 0, "close_min": 1440})
            continue
        times = _TIME_RE.findall(rest)
        if len(times) < 2:
            continue
        open_min = _to_min(int(times[0][0]), int(times[0][1]), times[0][2])
        close_min = _to_min(int(times[-1][0]), int(times[-1][1]), times[-1][2])
        if close_min == 0:   # 12:00 AM as close = midnight = end of day
            close_min = 1440
        result.append({"day": weekday, "open_min": open_min, "close_min": close_min})
    return result


def _batch_place_details(supabase_client, place_ids: list[str]) -> dict[str, dict]:
    """Fetch rich place data for a batch of place_ids from cache.
    Never calls Google — read-only from place_details_cache.
    Returns dict[place_id → {price_level, weekday_text, editorial_summary, top_review, rating_count, opening_hours_parsed, photo_ref}].
    """
    if not supabase_client or not place_ids:
        return {}
    try:
        resp = (
            supabase_client.table("place_details_cache")
            .select("place_id, data")
            .in_("place_id", place_ids)
            .execute()
        )
        rows = resp.data if hasattr(resp, "data") else (resp or [])
        return {
            row["place_id"]: {
                "price_level":         (row.get("data") or {}).get("price_level"),
                "weekday_text":        (row.get("data") or {}).get("weekday_text") or [],
                "editorial_summary":   (row.get("data") or {}).get("editorial_summary"),
                "website":             (row.get("data") or {}).get("website"),
                "top_review":          (row.get("data") or {}).get("top_review"),
                "reviews":             (row.get("data") or {}).get("reviews") or [],
                "rating_count":        (row.get("data") or {}).get("rating_count"),
                "photo_ref":           (row.get("data") or {}).get("photo_ref"),
                "popular_times":       (row.get("data") or {}).get("popular_times"),
                "opening_hours_parsed": _parse_weekday_text(
                    (row.get("data") or {}).get("weekday_text") or []
                ),
            }
            for row in (rows or [])
            if row.get("place_id")
        }
    except Exception:
        return {}


def _resolve_reco_trigger(
    trigger: dict,
    existing_place_ids: set[str],
    supabase_client,
    google_api_key: str | None,
    weights: dict,
    signal=None,   # RecoSignal | None — for persona-aware type selection
) -> dict | None:
    """
    Given a trigger dict from derive_day_recos, call Nearby Search + place_details_cache
    and return a stop dict ready to insert into stops_out, or None on failure.
    """
    if not google_api_key:
        return None

    lat, lon = trigger.get("lat"), trigger.get("lon")
    if lat is None or lon is None:
        return None

    from engine.reco_engine import TRIGGER_DEFAULTS, persona_google_types
    _TRIGGER_TYPES: dict[str, list[str]] = {
        "lunch":      ["restaurant"],
        "dinner":     ["restaurant"],
        "evening":    ["night_club", "bar"],
        "rest":       ["cafe"],
        "culture":    ["museum", "art_gallery"],
        "social_gap": ["bar"],
        "hidden_gem": ["point_of_interest", "establishment"],
        "local_food": ["restaurant"],
        "famous_spots": ["tourist_attraction", "landmark"],
    }
    _TRIGGER_RADIUS: dict[str, int] = {
        "famous_spots": 3000, "culture": 2000, "hidden_gem": 1500,
        "lunch": 1500, "dinner": 1500,
    }
    # Per-trigger [min_min, max_min] clamp for display time (avoids lunch at 7 PM)
    _TIME_CLAMP: dict[str, tuple[int, int]] = {
        "lunch":      (660,  870),   # 11:00 – 14:30
        "dinner":     (1020, 1260),  # 17:00 – 21:00
        "evening":    (1140, 1380),  # 19:00 – 23:00
        "rest":       (780,  1020),  # 13:00 – 17:00
        "social_gap": (960,  1200),  # 16:00 – 20:00
        "culture":    (540,  960),   # 09:00 – 16:00
        "famous_spots": (540, 960),
    }
    # Place types that should never be recommended — unless co-typed as tourist_attraction or landmark
    _EXCLUDED_TYPES = {
        # Admin / political
        "lodging", "local_government_office", "political", "community_center",
        "neighborhood", "sublocality",
        "administrative_area_level_1", "administrative_area_level_2",
        # Transportation
        "parking", "gas_station", "transit_station", "bus_station",
        "train_station", "subway_station", "taxi_stand", "airport",
        "car_rental", "car_repair", "car_wash", "car_dealer",
        # Home services / contractors
        "electrician", "plumber", "locksmith", "roofing_contractor",
        "moving_company", "painter", "general_contractor", "storage",
        # Professional services
        "accounting", "lawyer", "insurance_agency", "real_estate_agency",
        # Healthcare (non-tourist)
        "doctor", "dentist", "physiotherapist", "veterinary_care",
        "hospital", "pharmacy",
        # Finance
        "atm", "bank", "finance",
        # Non-destination retail
        "hardware_store", "home_goods_store", "furniture_store",
        "bicycle_store",
        # Other
        "funeral_home",
    }
    # Blocked types are allowed when the place is also tagged as a destination
    _DESTINATION_TYPES = {"tourist_attraction", "landmark", "point_of_interest"}

    _NAME_BLOCK_TERMS = {
        # Adult content
        "adult", "xxx", "erotic", " nude", "strip club",
        "gentleman's club", "bordello", "escort", "pornograph",
        # Industrial / corporate (space-prefixed to avoid false positives)
        " ltd", " limited", " pvt", " inc.", " corp.", " industries",
        " steelage", " steel works", " manufacturing", " factory",
        " cement", " chemicals", " petroleum", " refinery",
        # Weapons
        "gun shop", "firearms store", "ammunition store", "arms dealer",
        # Drug paraphernalia (dispensary intentionally excluded — legal in many destinations)
        "head shop",
    }

    def _place_is_allowed(place: dict) -> bool:
        place_types = set(place.get("types") or [])
        name = (place.get("name") or "").lower()
        # Industrial/adult name check — always blocks regardless of tourist tag
        if any(term in name for term in _NAME_BLOCK_TERMS):
            return False
        # Destination co-type bypass: a historic train station or famous hospital is fine
        if place_types & _EXCLUDED_TYPES:
            return bool(place_types & _DESTINATION_TYPES)
        return True

    trig = trigger["trigger"]
    # Persona-aware type selection when signal is available
    if signal is not None:
        google_types = persona_google_types(trig, signal)
    else:
        google_types = _TRIGGER_TYPES.get(trig, ["restaurant"])
    radius = _TRIGGER_RADIUS.get(trig, 1000)

    # Dietary keyword for food triggers — best-effort, not verified
    _FOOD_TRIGGERS = {"lunch", "dinner", "local_food", "rest"}
    _DIETARY_KEYWORD: dict[str, str] = {
        "halal":       "halal",
        "plant_based": "vegetarian",
        "kosher":      "kosher",
    }
    dietary_keyword: str | None = None
    if signal and signal.dietary and trig in _FOOD_TRIGGERS:
        for _d in signal.dietary:
            if _d in _DIETARY_KEYWORD:
                dietary_keyword = _DIETARY_KEYWORD[_d]
                break

    # Budget → price_level penalty thresholds
    _BUDGET_PENALTY: dict[str, dict[int, float]] = {
        "budget":    {3: 0.25, 4: 0.45},
        "mid_range": {4: 0.15},
    }

    best: dict | None = None
    best_score = -1.0

    print(f"[reco_resolve] trigger={trig} lat={lat} lon={lon} radius={radius} types={google_types} dietary_kw={dietary_keyword}")
    for gtype in google_types:
        try:
            params: dict = {"location": f"{lat},{lon}", "radius": radius,
                            "type": gtype, "key": google_api_key}
            if dietary_keyword:
                params["keyword"] = dietary_keyword
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                params=params,
                timeout=5,
            )
            data = resp.json()
            status = data.get("status")
            results = data.get("results", [])
            print(f"[reco_resolve]   gtype={gtype} status={status} results={len(results)}")
            if status not in ("OK", "ZERO_RESULTS"):
                continue
            for place in results[:8]:
                pid = place.get("place_id", "")
                if not pid or pid in existing_place_ids:
                    continue
                if not _place_is_allowed(place):
                    continue
                user_ratings = place.get("user_ratings_total") or 0
                if user_ratings < 5:
                    continue
                rating = place.get("rating") or 0
                # Persona affinity: take max affinity across all place types
                place_types_list = place.get("types") or []
                if signal:
                    affinity = max(
                        (get_persona_affinity(t).get(signal.archetype, 0.5) for t in place_types_list),
                        default=0.5,
                    )
                else:
                    affinity = 0.5
                score = (rating / 5.0) * 0.6 + affinity * 0.4
                # Budget soft penalty — reduces score but never hard-blocks
                price_level = place.get("price_level")
                if signal and signal.budget and price_level:
                    penalty = _BUDGET_PENALTY.get(signal.budget, {}).get(price_level, 0.0)
                    score -= penalty
                if score > best_score:
                    best_score = score
                    best = place
                    best["_gtype"] = gtype
        except Exception as _e:
            print(f"[reco_resolve]   gtype={gtype} exception={_e}")
            continue

    print(f"[reco_resolve] trigger={trig} best={'found:'+best.get('name','?') if best else 'NONE'}")
    if not best:
        return None

    pid = best.get("place_id", "")
    existing_place_ids.add(pid)

    # Fetch from cache (no Google call — read-only)
    details_map = _batch_place_details(supabase_client, [pid]) if supabase_client else {}
    details = details_map.get(pid, {})

    loc = best.get("geometry", {}).get("location", {})
    stop_lat = loc.get("lat", lat)
    stop_lon = loc.get("lng", lon)

    time_default, dur, cat_default = TRIGGER_DEFAULTS.get(trig, ("10:00", 60, "point_of_interest"))
    category = best.get("_gtype") or cat_default

    why_phrases: dict[str, str] = {
        "lunch": "A good spot for lunch near your route.",
        "dinner": "Worth stopping for dinner.",
        "evening": "A place to end the evening.",
        "rest": "A quiet spot to take a break.",
        "culture": "A cultural stop that fits the day.",
        "social_gap": "Somewhere to sit and watch the city.",
        "hidden_gem": "Off the main circuit — worth knowing about.",
        "local_food": "Local food that doesn't make the guidebooks.",
        "famous_spots": "A landmark worth seeing while you're here.",
    }

    import uuid as _uuid
    _nearby_photo_raw = (best.get("photos") or [{}])[0].get("photo_reference")

    def _wrap_photo(ref: str | None, place_id: str | None) -> str | None:
        """Wrap new-format raw tokens with full resource name; nullify if unwrappable."""
        if not ref:
            return None
        if len(ref) > 300 and not ref.startswith("places/"):
            return f"places/{place_id}/photos/{ref}" if place_id else None
        return ref

    _photo_ref = _wrap_photo(details.get("photo_ref"), pid) or _wrap_photo(_nearby_photo_raw, pid) or None
    _api_base = os.environ.get("API_BASE_URL", "")

    # Compute display time: anchor_end + 15 min transit, clamped to sensible range per trigger
    _anchor_end = trigger.get("anchor_end_min")
    if _anchor_end is not None:
        _lo, _hi = _TIME_CLAMP.get(trig, (540, 1260))
        _raw_min = _anchor_end + 15
        _clamped = max(_lo, min(_hi, _raw_min))
        _reco_time = f"{_clamped // 60:02d}:{_clamped % 60:02d}"
    else:
        _reco_time = time_default

    return {
        "id":          f"reco-{trig}-{_uuid.uuid4().hex[:8]}",
        "placeId":     pid,
        "title":       details.get("name") or best.get("name", ""),
        "area":        "",
        "city":        trigger.get("city", ""),
        "day":         trigger.get("_day_number", 1),
        "time":        _reco_time,
        "durationMin": dur,
        "category":    category,
        "lat":         stop_lat,
        "lon":         stop_lon,
        "priceLevel":  details.get("price_level") or best.get("price_level"),
        "rating":      details.get("rating") or best.get("rating"),
        "weekdayText": details.get("weekday_text") or None,
        "whyForYou":   why_phrases.get(trig, "An addition based on your plan."),
        "localTip":    details.get("review_summary") or details.get("editorial_summary") or None,
        "googleMapsUrl": f"https://www.google.com/maps/place/?q=place_id:{pid}",
        "website":     details.get("website") or None,
        "photoRef":    _photo_ref,
        "imageUrl":    f"{_api_base}/place-photo?photo_ref={_photo_ref}&max_width=800" if _photo_ref and _api_base else None,
        "tags":        [],
        "signals":     [],
        "stage":       None,
        "velocityRatio": None,
        "transitFromPrev": None,
        "walkFromPrev": None,
        "isUserAdded": False,
        "isEngineAdded": True,
    }


def _backfill_opening_hours(stops: list, place_details_map: dict) -> None:
    """Populate opening_hours for stops that bypass pre-engine fetch (e.g., inserts)."""
    for stop in stops:
        if stop.place_id and not stop.opening_hours:
            parsed = place_details_map.get(stop.place_id, {}).get("opening_hours_parsed", [])
            if stop.place_id and parsed:
                stop.opening_hours = parsed


def _why_for_you(
    category: str,
    weights: dict,
    scheduled_time: str | None = None,
    stop_index: int = 0,
    visit_date: str | None = None,
) -> str:
    cfg = _WHY_FOR_YOU.get(category)
    if not cfg:
        return ""
    weight_key, _phrases = cfg
    weight = weights.get(weight_key, 0.5)
    if weight < 0.4:
        return ""

    hour = int(scheduled_time.split(":")[0]) if scheduled_time else 10
    # TOD buckets: morning <12, afternoon 12-17, evening 17-21, night >21
    if hour < 12:
        tod = "morning"
    elif hour < 17:
        tod = "afternoon"
    elif hour < 21:
        tod = "evening"
    else:
        tod = "night"

    # TOD-aware, category-specific copy (≤15 words each)
    _TOD_COPY: dict[str, dict[str, list[str]]] = {
        "museum": {
            "morning":   ["Best visited now — crowds build toward midday.",
                          "Your explorer instinct will love the quiet this early."],
            "afternoon": ["Significant holdings — worth more time than most give it.",
                          "Good depth here; skip temporary exhibitions if short on time."],
            "evening":   ["Fewer visitors now — more room to move at your pace.",
                          "Evening light through the skylights is worth the timing."],
            "night":     ["Late opening hours make this a rare find.",
                          "Most visitors miss it at this hour — you won't."],
        },
        "gallery": {
            "morning":   ["Morning is the right time — space to think.",
                          "Quieter than a museum; 30 minutes is usually enough."],
            "afternoon": ["Good contrast to the historic stops nearby.",
                          "Contemporary space; worth a look even if art isn't the focus."],
            "evening":   ["Evening light changes how the work reads.",
                          "Smaller crowd means more time in front of what matters."],
            "night":     ["Late galleries draw a local crowd — different energy.",
                          "Worth pausing here before the night picks up."],
        },
        "historic": {
            "morning":   ["More layered than it looks — best explored slowly.",
                          "Early morning catches it before the tour groups arrive."],
            "afternoon": ["Context here enriches everything else you'll see today.",
                          "Often skipped, rarely regretted."],
            "evening":   ["The light at this hour changes the whole feel.",
                          "Significant site — worth a slower pass at dusk."],
            "night":     ["After dark it reads completely differently.",
                          "Floodlit and quiet — one of the better evening stops."],
        },
        "restaurant": {
            "morning":   ["Good early opening — solid local option.",
                          "Well-rated and fits the start of your day."],
            "afternoon": ["Fits the pace of the afternoon perfectly.",
                          "Locals eat here; that's usually a good sign."],
            "evening":   ["Ideal dinner timing — not too early, not too late.",
                          "Well-reviewed and off the tourist circuit."],
            "night":     ["Still buzzing at this hour — a good sign.",
                          "Night crowd here tends to be local, not tourist."],
        },
        "cafe": {
            "morning":   ["Perfect morning start — good coffee, low noise.",
                          "Sets the right pace before the heavier stops."],
            "afternoon": ["A perfect afternoon pause — matches the slower pace you prefer.",
                          "Natural break in the route here; your feet will agree."],
            "evening":   ["Quieter than a restaurant — better for winding down.",
                          "Good spot to sit before the evening picks up."],
            "night":     ["Late café — rarer than it sounds, worth the stop.",
                          "Good place to decompress before heading back."],
        },
        "park": {
            "morning":   ["Fewer people now — best version of this space.",
                          "Open stretch at the right moment in your morning."],
            "afternoon": ["Good reset after a stretch of indoor stops.",
                          "Lends itself to an unplanned wander mid-route."],
            "evening":   ["Evening in open space here is worth slowing down for.",
                          "The crowd thins out — better for a slow walk."],
            "night":     ["Lit pathways make this workable after dark.",
                          "Quieter than anywhere else on the route right now."],
        },
        "viewpoint": {
            "morning":   ["Best before haze builds — clear views this early.",
                          "Worth the climb; most visitors skip it."],
            "afternoon": ["Good orientation point mid-route.",
                          "High vantage — clear sight lines from here."],
            "evening":   ["Temples glow differently at dusk — worth the timing.",
                          "The city looks best from here at this hour."],
            "night":     ["City lights from up here — different experience entirely.",
                          "One of the better night vantage points in the area."],
        },
        "nightlife": {
            "morning":   ["Note this for tonight — it peaks around 22:00.",
                          "Worth returning to after the evening stops wrap up."],
            "afternoon": ["Quieter now, but worth scoping before tonight.",
                          "Best after 21:00 — bookmark it for later."],
            "evening":   ["Getting started now — right timing for you.",
                          "This is where the evening comes alive."],
            "night":     ["This is where the night comes alive — right up your alley.",
                          "Peaks now; one of the better spots in this neighbourhood."],
        },
        "bar": {
            "morning":   ["Neighbourhood fixture — worth knowing for the evening.",
                          "Good wind-down option; note for after dinner."],
            "afternoon": ["Quieter than the evening crowd — good for a slow drink.",
                          "Well-reviewed neighbourhood bar; not on tourist lists."],
            "evening":   ["Good evening stop — neighbourhood feel, solid drinks.",
                          "Local fixture; different from the tourist-facing options."],
            "night":     ["Active now — one of the better spots after dark.",
                          "Good wind-down after the evening stops."],
        },
        "shopping": {
            "morning":   ["Best stall selection earlier in the day.",
                          "Local designers and independents — not chains."],
            "afternoon": ["Lively area — good for a wander between stops.",
                          "More interesting than the main shopping strips."],
            "evening":   ["Evening shopping crowd is lighter — easier to browse.",
                          "Independent shops stay open later here."],
            "night":     ["Night market energy here — different from daytime.",
                          "Worth a pass even if you're not buying."],
        },
        "market": {
            "morning":   ["Best earlier — fullest stall selection right now.",
                          "Local market; different from tourist-facing shops."],
            "afternoon": ["Still lively — good mid-afternoon wander.",
                          "Weekday afternoons have decent stall variety."],
            "evening":   ["Evening market crowd is local — the better version.",
                          "Good stop before dinner; pick up something fresh."],
            "night":     ["Night market mode now — worth the stop.",
                          "Different crowd at this hour; more local than daytime."],
        },
        "beach": {
            "morning":   ["Open stretch at the right moment — fewest people now.",
                          "Less crowded on weekday mornings; good timing."],
            "afternoon": ["Good reset before the afternoon stops continue.",
                          "Natural break at a good point in the route."],
            "evening":   ["Evening light on the water here is worth pausing for.",
                          "The crowd thins out — better for a slow walk."],
            "night":     ["Quiet stretch at this hour — different from daytime.",
                          "Worth a brief pass before heading inland."],
        },
        "spa": {
            "morning":   ["Good early booking slot — quieter than midday.",
                          "Scheduled before the heavier stops; smart timing."],
            "afternoon": ["Mid-afternoon slot tends to be the quietest.",
                          "Scheduled after a long stretch of walking — good call."],
            "evening":   ["Good call if today's route has been heavy on walking.",
                          "Evening slot means you finish the day properly unwound."],
            "night":     ["Late slot available here — rarer than it sounds.",
                          "Good way to close out a full day of movement."],
        },
        "temple": {
            "morning":   ["Morning ritual activity is worth arriving for.",
                          "Early morning has a completely different atmosphere here."],
            "afternoon": ["Active site — not just a tourist landmark.",
                          "Worth the detour even if culture isn't your primary focus."],
            "evening":   ["Temples glow differently at dusk — worth timing your visit.",
                          "Evening puja makes this a different experience entirely."],
            "night":     ["Lit after dark — the grounds read differently at night.",
                          "One of the few sites worth visiting after sundown."],
        },
        "shrine": {
            "morning":   ["Morning visits catch the ritual activity.",
                          "Quieter than the main temples — worth the diversion."],
            "afternoon": ["Often overlooked — the grounds are worth the time.",
                          "Quieter than the major sites nearby."],
            "evening":   ["Evening light here is worth the timing.",
                          "Small but significant — the atmosphere changes at dusk."],
            "night":     ["Lit shrines are rarer — this one is worth it.",
                          "Quiet and atmospheric at this hour."],
        },
        "garden": {
            "morning":   ["Designed for slow movement — plan at least an hour.",
                          "Morning light through the canopy makes it worth the early start."],
            "afternoon": ["Good middle-of-day stop when you need a slower pace.",
                          "Peak season matters here; this timing works well."],
            "evening":   ["Evening in a formal garden — an underrated experience.",
                          "Crowd drops off; more space to move at your pace."],
            "night":     ["If lit at night, this one is worth seeing after dark.",
                          "Quiet at this hour — the off-season version of itself."],
        },
    }

    cat_tod = _TOD_COPY.get(category, {})
    phrases = cat_tod.get(tod) or _phrases  # fall back to original lookup if missing
    idx = stop_index % len(phrases)
    phrase = phrases[idx]

    # Replace "now" / "right now" with the actual day name when visit_date is available
    if visit_date:
        try:
            from datetime import datetime as _dt
            day_name = _dt.strptime(visit_date, "%Y-%m-%d").strftime("%A")
            phrase = phrase.replace("right now", f"on {day_name}")
            phrase = phrase.replace(" now", f" on {day_name}")
        except Exception:
            pass

    return phrase


@app.post("/engine-itinerary")
async def engine_itinerary(body: EngineItineraryPayload, request: Request, user=Depends(get_current_user)):
    """Build an itinerary from user-selected places. Called from MapScreen Build button."""
    from datetime import date as _date, timedelta as _td

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="rate_limit_exceeded")

    if _is_restricted_city(body.city):
        raise HTTPException(status_code=403, detail="Travel planning not available for this destination.")

    days = max(body.days, 1)
    start = _date.fromisoformat(body.startDate)
    travel_dates = [(start + _td(days=i)).isoformat() for i in range(days)]

    archetype = body.personaArchetype.lower().replace(" ", "").replace("-", "").replace("_", "")
    persona = dict(_ARCHETYPE_PERSONA.get(archetype, _ARCHETYPE_PERSONA["explorer"]))

    # Try to load city seed data; fall back to a minimal stub so the engine still runs
    city_slug = body.city.lower().replace(" ", "_")
    try:
        city_data = load_city(city_slug, _supabase)
    except Exception:
        city_data = CityData(
            id=city_slug, name=body.city, tier=1,
            center=(body.lat, body.lon), timezone="UTC",
            climate={}, movement={}, culture={},
            neighborhoods=[], insert_candidates=[],
            scenic_routes=[], transit_edges=[],
            engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
        )

    # Auto-seed when city has no insert candidates, or is missing dinner candidates
    # (stale seeds have only lunch-typed restaurants; seed_builder now emits both)
    _has_dinner = any(ic.type == "dinner" for ic in city_data.insert_candidates)
    if not city_data.insert_candidates or not _has_dinner:
        try:
            from city.seed_builder import build_city_seed as _build_city_seed
            _seeded = _build_city_seed({
                "city_id": city_slug, "name": body.city,
                "lat": body.lat, "lon": body.lon,
                "country_code": "", "timezone": "UTC", "tier": 2,
            })
            if _seeded.insert_candidates:
                city_data = _seeded
                if _supabase:
                    try:
                        from dataclasses import asdict as _dc_asdict
                        _cd_dict = {
                            "id": city_slug, "name": body.city, "tier": 2,
                            "center": [body.lat, body.lon], "timezone": "UTC",
                            "climate": _seeded.climate, "movement": _seeded.movement,
                            "culture": _seeded.culture,
                            "neighborhoods": [
                                {"id": n.id, "name": n.name, "center": list(n.center),
                                 "polygon": [list(p) for p in n.polygon],
                                 "best_times": n.best_times, "crowd_index": n.crowd_index}
                                for n in _seeded.neighborhoods
                            ],
                            "insert_candidates": [
                                {"place_id": ic.place_id, "name": ic.name,
                                 "lat": ic.lat, "lon": ic.lon, "type": ic.type,
                                 "time_cost_min": ic.time_cost_min,
                                 "persona_affinity": ic.persona_affinity,
                                 "trigger": ic.trigger,
                                 "time_of_day_match": ic.time_of_day_match}
                                for ic in _seeded.insert_candidates
                            ],
                            "scenic_routes": _seeded.scenic_routes,
                            "transit_edges": _seeded.transit_edges,
                            "engine_modifiers": _seeded.engine_modifiers,
                            "landmark_anchors": _seeded.landmark_anchors,
                            "hidden_gems": _seeded.hidden_gems,
                        }
                        _supabase.table("city_data").upsert({"id": city_slug, "data": _cd_dict}).execute()
                    except Exception:
                        pass
        except Exception as _seed_err:
            print(f"[engine_itinerary] on-demand seed failed for {body.city}: {_seed_err}")

    # Build per-city city_data map for area lookup and insert_candidates merging.
    # For secondary cities missing dinner candidates, run build_city_seed synchronously
    # (same as primary city above). Use selectedPlaces to derive each city's lat/lon.
    _city_data_map: dict[str, object] = {city_slug: city_data}
    if body.cities and len(body.cities) > 1:
        from dataclasses import replace as _dc_replace
        # Build city → representative lat/lon from selected places
        _city_latlon: dict[str, tuple[float, float]] = {}
        for _p in body.selectedPlaces:
            _pcity = (_p.city or "").lower().replace(" ", "_")
            if _pcity and _pcity not in _city_latlon:
                _city_latlon[_pcity] = (_p.lat, _p.lon)

        from dataclasses import replace as _ic_replace
        # Stamp primary-city slug on every insert candidate so the insert engine
        # can distinguish candidates by city, not just proximity.
        _all_ics = [_ic_replace(ic, city=city_slug) for ic in city_data.insert_candidates]
        _seen_pids = {ic.place_id for ic in _all_ics}
        for _other_city in body.cities:
            _other_slug = _other_city.lower().replace(" ", "_")
            if _other_slug == city_slug:
                continue
            try:
                _other_data = load_city(_other_slug, _supabase)
                # Re-seed if missing dinner candidates (same logic as primary city)
                _other_has_dinner = any(ic.type == "dinner" for ic in _other_data.insert_candidates)
                if not _other_data.insert_candidates or not _other_has_dinner:
                    _o_lat, _o_lon = _city_latlon.get(_other_slug, (body.lat, body.lon))
                    try:
                        _other_seeded = _build_city_seed({
                            "city_id": _other_slug, "name": _other_city,
                            "lat": _o_lat, "lon": _o_lon,
                            "country_code": "", "timezone": "UTC", "tier": 2,
                        })
                        if _other_seeded.insert_candidates:
                            _other_data = _other_seeded
                            if _supabase:
                                try:
                                    _o_cd = {
                                        "id": _other_slug, "name": _other_city, "tier": 2,
                                        "center": [_o_lat, _o_lon], "timezone": "UTC",
                                        "insert_candidates": [
                                            {"place_id": ic.place_id, "name": ic.name,
                                             "lat": ic.lat, "lon": ic.lon, "type": ic.type,
                                             "time_cost_min": ic.time_cost_min,
                                             "persona_affinity": ic.persona_affinity,
                                             "trigger": ic.trigger,
                                             "time_of_day_match": ic.time_of_day_match}
                                            for ic in _other_seeded.insert_candidates
                                        ],
                                        "scenic_routes": _other_seeded.scenic_routes,
                                        "engine_modifiers": _other_seeded.engine_modifiers,
                                        "climate": _other_seeded.climate,
                                        "movement": _other_seeded.movement,
                                        "culture": _other_seeded.culture,
                                        "neighborhoods": [
                                            {"id": n.id, "name": n.name, "center": list(n.center),
                                             "polygon": [list(p) for p in n.polygon],
                                             "best_times": n.best_times, "crowd_index": n.crowd_index}
                                            for n in _other_seeded.neighborhoods
                                        ],
                                        "landmark_anchors": [], "hidden_gems": [],
                                    }
                                    _supabase.table("city_data").upsert({"id": _other_slug, "data": _o_cd}).execute()
                                except Exception:
                                    pass
                    except Exception as _e:
                        print(f"[engine_itinerary] secondary seed failed for {_other_city}: {_e}")
                _city_data_map[_other_slug] = _other_data
                for ic in _other_data.insert_candidates:
                    if ic.place_id not in _seen_pids:
                        _all_ics.append(_ic_replace(ic, city=_other_slug))
                        _seen_pids.add(ic.place_id)
            except Exception:
                pass
        if len(_all_ics) > len(city_data.insert_candidates):
            city_data = _dc_replace(city_data, insert_candidates=_all_ics)

    # Build a place_id → city map for day.city assignment after splitting
    _place_city_map: dict[str, str] = {
        (p.place_id or p.id): (p.city or body.city)
        for p in body.selectedPlaces
    }

    _CATEGORY_DURATION: dict[str, int] = {
        "museum": 100, "gallery": 60, "historic": 75, "landmark": 60,
        "temple": 60, "shrine": 45, "castle": 90, "monument": 30,
        "park": 50, "garden": 55, "beach": 60, "viewpoint": 30, "nature_reserve": 75,
        "restaurant": 70, "cafe": 35, "coffee": 30, "bar": 50, "nightlife": 90,
        "market": 55, "shopping": 60, "store": 40,
        "spa": 90, "wellness": 75, "massage": 60,
        "hotel": 20, "hostel": 20,
        "theater": 120, "concert": 120, "stadium": 120,
    }

    # Pre-engine detail fetch — opening hours for user-selected stops only
    _pre_place_ids = list({p.place_id or p.id for p in body.selectedPlaces if p.place_id or p.id})
    _pre_details_map = _batch_place_details(_supabase, _pre_place_ids)

    engine_stops = [
        EngineStop(
            place_id=p.place_id or p.id,
            name=p.title,
            lat=p.lat,
            lon=p.lon,
            category=p.category,
            duration_min=_CATEGORY_DURATION.get(p.category.lower(), 75),
            opening_hours=_pre_details_map.get(
                p.place_id or p.id, {}
            ).get("opening_hours_parsed", []),
            price_level=1,
            rating=p.rating or 4.0,
            neighborhood=None,
            is_user_added=True,
            city=p.city or body.city,
            rating_count=_pre_details_map.get(p.place_id or p.id, {}).get("rating_count"),
        )
        for p in body.selectedPlaces
    ]

    ctx = EngineContext(
        persona=persona,
        city=city_data,
        travel_dates=travel_dates,
        weather=None,
        user_arrival_time=body.arrivalTime or None,
        user_departure_time=body.departureTime or None,
        user_start_type=body.startType or "hotel",
    )

    result = await build_itinerary(engine_stops, ctx)
    from engine.plan_scrubber import scrub as _scrub
    result = _scrub(result, ctx)

    # Inject short-trip warning when selected stops clearly underfill the trip
    _stops_per_day = len(engine_stops) / max(days, 1)
    if _stops_per_day < 1.5 and days > 1:
        _needed = days * 2 - len(engine_stops)
        from engine.types import EngineMessage as _EM
        result.messages.append(_EM(
            type="advisory",
            what=f"Your {days}-day trip has {len(engine_stops)} stop{'s' if len(engine_stops) != 1 else ''} — that's light.",
            why=f"Most {days}-day trips work well with {days * 2}–{days * 3} stops.",
            consequence=f"Add {_needed} more place{'s' if _needed != 1 else ''} from the map to fill the itinerary.",
            dismissable=True,
            undo_key=None,
            stop_id=None,
        ))

    # Batch-fetch price level and opening hours from cache — no Google API calls
    # Include inserted stops from result so signals have access to their details
    _all_result_stops = [s for day in result.days for s in day.stops]
    all_place_ids = list({s.place_id for s in _all_result_stops if s.place_id})
    place_details_map = _batch_place_details(_supabase, all_place_ids)

    # Backfill opening_hours for inserted stops (inserts.detect adds stops that bypass pre-engine fetch)
    _backfill_opening_hours(_all_result_stops, place_details_map)

    # Post-scheduling passes: enforce opening hours (A), then swap unfixables (C)
    from engine.builder import enforce_opening_hours as _enforce_hours, apply_swapper as _apply_swapper
    result.days, _hour_msgs, _conflicted = _enforce_hours(result.days, ctx)
    result.days, _swap_msgs = _apply_swapper(result.days, ctx, _conflicted)
    result.messages.extend(_hour_msgs + _swap_msgs)

    # Fetch details for any stops newly introduced by apply_swapper
    _post_swap_place_ids = [
        s.place_id for day in result.days for s in day.stops
        if s.place_id and s.place_id not in place_details_map
    ]
    if _post_swap_place_ids:
        _swap_details = _batch_place_details(_supabase, _post_swap_place_ids)
        place_details_map.update(_swap_details)
        # Also update all_place_ids for subsequent queries (e.g., place_dynamic_profiles)
        all_place_ids = list(set(all_place_ids) | set(_post_swap_place_ids))

    # Photo backfill for inserted stops is intentionally omitted from the request path.
    # The reel card fetches photos on-demand (ReelStopCard fetchPlaceDetails fallback),
    # so blocking here with sequential Google NearbySearch calls is unnecessary latency.

    # Fetch discovery stage (hidden_gem / rising / mainstream) from place_dynamic_profiles
    _stage_map: dict[str, dict] = {}
    if _supabase and all_place_ids:
        try:
            _sr = (
                _supabase.table("place_dynamic_profiles")
                .select("place_id, stage, signals")
                .in_("place_id", all_place_ids)
                .execute()
            )
            for _r in ((_sr.data if hasattr(_sr, "data") else _sr) or []):
                if _r.get("place_id"):
                    _stage_map[_r["place_id"]] = {
                        "stage":         _r.get("stage"),
                        "velocity_ratio": (_r.get("signals") or {}).get("velocity_ratio"),
                    }
        except Exception:
            pass

    # Auto-seed place_dynamic_profiles for user-selected stops not yet in the table
    _unseed_ids = [pid for pid in all_place_ids if pid and pid not in _stage_map]
    if _unseed_ids and _supabase:
        # Build fallback: place_id → stop rating (for places not in place_details_cache)
        _stop_rating_map: dict[str, float | None] = {
            s.place_id: s.rating
            for day in result.days for s in day.stops
            if s.place_id and s.rating
        }
        _seed_rows = []
        for _pid in _unseed_ids:
            _d = place_details_map.get(_pid, {})
            _rating = _d.get("rating") or _stop_rating_map.get(_pid) or None
            _rating_count = _d.get("rating_count") or None
            if _rating is None:
                continue
            _stage, _signals = _stage_and_signals(_rating, _rating_count)
            _seed_rows.append({
                "place_id": _pid,
                "city_id": body.city,
                "stage": _stage,
                "signals": _signals,
                "updated_at": datetime.utcnow().isoformat(),
            })
        if _seed_rows:
            try:
                _supabase.table("place_dynamic_profiles").upsert(
                    _seed_rows, on_conflict="place_id"
                ).execute()
                for _row in _seed_rows:
                    _stage_map[_row["place_id"]] = {
                        "stage": _row["stage"],
                        "velocity_ratio": (_row.get("signals") or {}).get("velocity_ratio"),
                    }
            except Exception:
                pass  # signals degrade gracefully if seed fails

    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    # Build lookup: place_id → photo_ref (from submitted places)
    _photo_ref_lookup: dict[str, str] = {
        p.place_id or p.id: p.photo_ref
        for p in body.selectedPlaces
        if p.photo_ref
    }
    weights_for_why = persona.get("weights", {})

    # Deduplicate messages by (type, stop_id) — keep first occurrence
    _seen_msg_keys: set[tuple[str, str | None]] = set()
    _deduped_messages = []
    for m in result.messages:
        key = (m.type, m.stop_id)
        if key not in _seen_msg_keys:
            _seen_msg_keys.add(key)
            _deduped_messages.append(m)

    all_messages = [
        {
            "id": str(uuid.uuid4()),
            "type": m.type,
            "what": m.what,
            "why": m.why,
            "consequence": m.consequence,
            "dismissable": m.dismissable,
            "undo_action": m.undo_key,
            "stopId": m.stop_id,
        }
        for m in _deduped_messages
    ]

    # Build lookup: stop_id → first insert/swap message for that stop (for orderReason/orderConsequence)
    _stop_order_msg: dict[str, dict] = {}
    for m in all_messages:
        sid = m.get("stopId")
        if sid and sid not in _stop_order_msg and m["type"] in ("insert", "swap", "resequence"):
            _stop_order_msg[sid] = m


    # Build persona_snapshot here so it's available inside the days loop for scenic card insertion
    weights = persona.get("weights", {})
    persona_snapshot = {
        "w_walk_affinity":      weights.get("w_walk_affinity", 0.5),
        "w_scenic":             weights.get("w_scenic", 0.5),
        "w_efficiency":         weights.get("w_efficiency", 0.5),
        "w_food_density":       weights.get("w_food_density", 0.5),
        "w_culture_depth":      weights.get("w_culture_depth", 0.5),
        "w_nightlife":          weights.get("w_nightlife", 0.4),
        "w_budget_sensitivity": weights.get("w_budget_sensitivity", 0.4),
        "w_crowd_aversion":     weights.get("w_crowd_aversion", 0.5),
        "w_spontaneity":        weights.get("w_spontaneity", 0.5),
        "w_rest_need":          weights.get("w_rest_need", 0.4),
    }

    # Assign messages to days based on stop_id match; day-level (stop_id=None) go to day 1
    is_first_non_travel_day = True
    days_out = []
    # Track per-category stop index so _why_for_you rotates phrases across same-category stops
    _category_counters: dict[str, int] = {}
    for i, day in enumerate(result.days):
        day_messages: list[dict] = []
        if not day.is_travel_day:
            day_place_ids = {s.place_id for s in day.stops if s.place_id}
            stop_matched = [m for m in all_messages if m["stopId"] and m["stopId"] in day_place_ids]
            day_level = [m for m in all_messages if not m["stopId"]] if is_first_non_travel_day else []
            day_messages = stop_matched + day_level
            is_first_non_travel_day = False
        # Derive day city from user-added stops only (inserts inherit their city via inserts.py,
        # so s.city is reliable for all stops that have it set)
        day_city_candidates = [s.city for s in day.stops if s.city]
        day_city = max(set(day_city_candidates), key=day_city_candidates.count) if day_city_candidates else body.city

        stops_out = []
        _day_sig_state = DaySignalState()
        _cumulative_mins = 0

        # Pre-fetch walk routes for all close stop pairs in parallel so the
        # serialization loop below doesn't block serially on each Google Routes call.
        _walk_route_cache: dict[tuple, dict | None] = {}
        if GOOGLE_PLACES_API_KEY and len(day.stops) > 1:
            from concurrent.futures import ThreadPoolExecutor as _WR_TPE, as_completed as _wrac
            _wr_pairs: list[tuple] = []
            for _wi in range(1, len(day.stops)):
                _wa = day.stops[_wi - 1]
                _wb = day.stops[_wi]
                _wd = math.hypot(
                    (_wb.lat - _wa.lat) * 110.574,
                    (_wb.lon - _wa.lon) * 111.320 * math.cos(math.radians(_wb.lat)),
                )
                if _wd < 4.0:
                    _wr_pairs.append((_wa.lat, _wa.lon, _wb.lat, _wb.lon))
            if _wr_pairs:
                def _do_walk(p):
                    return p, _fetch_walk_route(*p)
                with _WR_TPE(max_workers=min(8, len(_wr_pairs))) as _wrpool:
                    for _wrf in _wrac([_wrpool.submit(_do_walk, p) for p in _wr_pairs]):
                        try:
                            _wrk, _wrv = _wrf.result()
                            _walk_route_cache[_wrk] = _wrv
                        except Exception:
                            pass

        for s_idx, s in enumerate(day.stops):
            cat_idx = _category_counters.get(s.category, 0)
            _category_counters[s.category] = cat_idx + 1
            order_msg = _stop_order_msg.get(s.place_id or "")
            _stop_city = s.city or day_city
            _stop_city_slug = _stop_city.lower().replace(" ", "_") if _stop_city else city_slug
            _area_city_data = _city_data_map.get(_stop_city_slug, city_data)

            _pd = place_details_map.get(s.place_id or "", {})
            _sd = _stage_map.get(s.place_id or "", {})
            _signals = compute_stop_signals(
                stop=s,
                stop_idx=s_idx,
                day_stops=day.stops,
                ctx=ctx,
                place_details=_pd,
                date_str=day.date if day.date != "unknown" else None,
                day_state=_day_sig_state,
                cumulative_mins=_cumulative_mins,
                stage=_sd.get("stage"),
                velocity_ratio=_sd.get("velocity_ratio"),
                max_signals=5,
            )
            _cumulative_mins += s.duration_min

            # transitFromPrev: distance + mode from previous stop
            _transit_from_prev = None
            _walk_from_prev = None
            if s_idx > 0:
                _prev = day.stops[s_idx - 1]
                _dist_km = math.hypot(
                    (s.lat - _prev.lat) * 110.574,
                    (s.lon - _prev.lon) * 111.320 * math.cos(math.radians(s.lat)),
                )
                _mode = _prev.transition_to_next or "walk"
                _transit_from_prev = {"mode": _mode, "distanceKm": round(_dist_km, 2)}
                if _dist_km < 4.0:
                    _walk_from_prev = _walk_route_cache.get((_prev.lat, _prev.lon, s.lat, s.lon))

            stops_out.append({
                "id": str(uuid.uuid4()),
                "placeId": s.place_id,
                "title": s.name,
                "area": _nearest_neighborhood_name(_area_city_data, s.lat, s.lon),
                "city": _stop_city,
                "day": i + 1,
                "time": s.scheduled_time or "09:00",
                "durationMin": s.duration_min,
                "category": s.category,
                "lat": s.lat,
                "lon": s.lon,
                "priceLevel": _pd.get("price_level"),
                "rating": s.rating if s.rating != 4.0 else None,
                "weekdayText": _pd.get("weekday_text") or None,
                "whyForYou": _why_for_you(s.category, weights_for_why, s.scheduled_time, cat_idx, day.date),
                "orderReason": order_msg["why"] if order_msg else None,
                "orderConsequence": order_msg["consequence"] if order_msg else None,
                "localTip": _pd.get("editorial_summary") or None,
                "googleMapsUrl": f"https://www.google.com/maps/search/?api=1&query={s.lat},{s.lon}",
                "website": _pd.get("website") or None,
                "photoRef": (lambda _r:
                    _r if not _r else
                    _r if not (len(_r) > 300 and not _r.startswith("places/")) else  # already wrapped or old-format
                    f"places/{s.place_id}/photos/{_r}" if s.place_id else None  # wrap or nullify
                )(
                    _photo_ref_lookup.get(s.place_id or "") or _pd.get("photo_ref") or None
                ),
                "tags": s.tags or [],
                "signals": _signals,
                "stage": _sd.get("stage"),
                "velocityRatio": _sd.get("velocity_ratio"),
                "transitFromPrev": _transit_from_prev,
                "walkFromPrev": _walk_from_prev,
                "isUserAdded": s.is_user_added,
                "isEngineAdded": not s.is_user_added,
            })

        # ── Inject reco stops for this day ──────────────────────────────
        try:
            from engine.reco_engine import derive_day_recos, RecoSignal, _archetype_group as _ag
            _pace_map = {"slow": "slow", "balanced": "moderate", "pack": "fast", "spontaneous": "moderate"}
            _raw = body.rawOBAnswers or {}
            _pace = _pace_map.get((_raw.get("pace") or ["moderate"])[0], "moderate") if _raw else "moderate"
            _group = _raw.get("group") or "solo"
            _is_family = _group == "family"
            _mood = _raw.get("mood") or []
            _budget = _raw.get("budget") or None
            _evening_pref = _raw.get("evening") or None
            _dietary = _raw.get("dietary") or []
            _reco_signal = RecoSignal(
                weights=persona,
                archetype=archetype,
                archetype_group=_ag(archetype),
                pace=_pace,
                city=day_city,
                is_first_day=(i == 0),
                is_last_day=(i == len(result.days) - 1),
                arrival_time=body.arrivalTime or None,
                departure_time=body.departureTime or None,
                group=_group,
                is_family=_is_family,
                mood=_mood,
                budget=_budget,
                evening_pref=_evening_pref,
                dietary=_dietary,
            )
            from concurrent.futures import ThreadPoolExecutor, as_completed as _as_completed
            _base_pids: set[str] = {s.get("placeId", "") for s in stops_out if s.get("placeId")}
            _reco_triggers = derive_day_recos(stops_out, _reco_signal)
            print(f"[reco_inject] day {i+1} stops={len(stops_out)} triggers={[t['trigger'] for t in _reco_triggers]}")

            def _resolve_one(trig_dict):
                trig_dict["_day_number"] = i + 1
                return trig_dict, _resolve_reco_trigger(
                    trig_dict, set(_base_pids), _supabase, GOOGLE_PLACES_API_KEY, persona,
                    signal=_reco_signal,
                )

            # Resolve all triggers in parallel (each gets its own pids snapshot)
            _results: dict[str, dict] = {}
            with ThreadPoolExecutor(max_workers=6) as _pool:
                _futures = {_pool.submit(_resolve_one, t): t for t in _reco_triggers}
                for _fut in _as_completed(_futures):
                    try:
                        _td, _reco_stop = _fut.result()
                        if _reco_stop:
                            _results[_td["trigger"]] = (_td, _reco_stop)
                    except Exception as _e:
                        print(f"[reco_inject] day {i+1}: {_e}")

            # Insert in trigger order; deduplicate by placeId
            _seen_pids = set(_base_pids)
            for _trigger in _reco_triggers:
                if _trigger["trigger"] not in _results:
                    continue
                _td, _reco_stop = _results[_trigger["trigger"]]
                _pid = _reco_stop.get("placeId", "")
                if _pid and _pid in _seen_pids:
                    continue
                _seen_pids.add(_pid)
                _anchor_id = _td.get("after_stop_id")
                _anchor_idx = next(
                    (idx for idx, s in enumerate(stops_out) if s.get("id") == _anchor_id), -1
                )
                if _anchor_idx >= 0:
                    stops_out.insert(_anchor_idx + 1, _reco_stop)
                else:
                    stops_out.append(_reco_stop)
        except Exception as _reco_err:
            print(f"[reco_inject] day {i+1} setup error: {_reco_err}")
            # Non-fatal: reco injection failure doesn't break the itinerary

        # Fix up whyForYou for reco-injected stops: the trigger phrase (e.g. "A place to
        # end the evening") is assigned at trigger-fire time, but the scheduler may place
        # the stop at a different time of day. Re-derive from actual scheduled time.
        _RECO_STATIC = {
            "A good spot for lunch near your route.", "Worth stopping for dinner.",
            "A place to end the evening.", "A quiet spot to take a break.",
            "A cultural stop that fits the day.", "Somewhere to sit and watch the city.",
            "Off the main circuit — worth knowing about.", "Local food that doesn't make the guidebooks.",
            "A landmark worth seeing while you're here.", "An addition based on your plan.",
        }
        for _s in stops_out:
            if _s.get("whyForYou") in _RECO_STATIC and _s.get("time"):
                _new_why = _why_for_you(_s.get("category", "place"), weights_for_why, _s["time"], 0, day.date or "")
                if _new_why:
                    _s["whyForYou"] = _new_why

        # Build scenic corridor cards keyed by origin stop id.
        # Kept SEPARATE from stops_out so the frontend can insert them precisely
        # between their stop pair without mixing them into the stop list (which
        # caused the reel-builder to crash on missing time/title/id fields).

        # Pre-fetch route profiles for all stop pairs in parallel — the serial
        # fallback (ORS 15s + OSRM 15s per pair) was the primary cause of
        # 10-minute build hangs on cold cities with many stops.
        _rp_prefetch: dict[tuple, dict] = {}
        if len(stops_out) > 1:
            from concurrent.futures import ThreadPoolExecutor as _RP_TPE, as_completed as _rpac
            _rp_input_pairs = [
                (_s2.get("lat"), _s2.get("lon"), stops_out[_pi + 1].get("lat"), stops_out[_pi + 1].get("lon"))
                for _pi, _s2 in enumerate(stops_out[:-1])
                if all(v is not None for v in [_s2.get("lat"), _s2.get("lon"), stops_out[_pi + 1].get("lat"), stops_out[_pi + 1].get("lon")])
            ]
            if _rp_input_pairs:
                def _do_rp(p):
                    return p, _fetch_route_profile(*p)
                with _RP_TPE(max_workers=min(8, len(_rp_input_pairs))) as _rppool:
                    for _rpf in _rpac([_rppool.submit(_do_rp, p) for p in _rp_input_pairs]):
                        try:
                            _rpk, _rpv = _rpf.result()
                            _rp_prefetch[_rpk] = _rpv
                        except Exception:
                            pass

        scenic_corridors_out: list[dict] = []
        scenic_pos = 0
        for _i, _s in enumerate(stops_out):
            if _i < len(stops_out) - 1:
                _next_s = stops_out[_i + 1]
                _orig_lat = _s.get("lat")
                _orig_lon = _s.get("lon")
                _dest_lat = _next_s.get("lat")
                _dest_lon = _next_s.get("lon")
                if all(v is not None for v in [_orig_lat, _orig_lon, _dest_lat, _dest_lon]):
                    try:
                        _rp = _rp_prefetch.get((_orig_lat, _orig_lon, _dest_lat, _dest_lon)) or _fetch_route_profile(_orig_lat, _orig_lon, _dest_lat, _dest_lon)
                        _visit_time = None
                        try:
                            from datetime import date as _date
                            _visit_date_str = day.date if (day.date and day.date != "unknown") else _date.today().isoformat()
                            _time_str = _s.get("time", "09:00")
                            _visit_time = datetime.fromisoformat(f"{_visit_date_str}T{_time_str}:00+00:00")
                        except Exception:
                            pass
                        _dest_pid = _next_s.get("place_id", "")
                        _dest_vr = (_stage_map.get(_dest_pid) or {}).get("velocity_ratio")
                        _scenic = _generate_scenic_card_for_corridor(
                            origin=_s,
                            dest=_next_s,
                            route_profile=_rp,
                            visit_time=_visit_time,
                            persona_snapshot=persona_snapshot,
                            persona_attractions=list(persona.get("attractions") or []),
                            persona_key=persona.get("archetype", ""),
                            weather=getattr(ctx, "weather_map", {}).get(day_city) or {},
                            city_landmarks=getattr(city_data, "landmark_anchors", []),
                            dest_velocity_ratio=_dest_vr,
                        )
                        if _scenic:
                            scenic_pos += 1
                            _scenic["pos"] = scenic_pos
                            # Tag with origin/dest stop ids so the reel-builder can
                            # insert them between the right stop pair.
                            _scenic["originStopId"] = _s.get("id", "")
                            _scenic["destStopId"] = _next_s.get("id", "")
                            scenic_corridors_out.append(_scenic)
                    except Exception as _e:
                        print(f"SCENIC CARD ERROR: {_e}")
                        scenic_corridors_out.append({
                            "type": "scenic_pending",
                            "from": _s.get("title", ""),
                            "to":   _next_s.get("title", ""),
                            "originStopId": _s.get("id", ""),
                            "destStopId": _next_s.get("id", ""),
                        })
        for _card in scenic_corridors_out:
            if _card.get("type") == "scenic":
                _card["total"] = scenic_pos

        _day_city_data = _city_data_map.get(day_city.lower().replace(" ", "_"), city_data) if day_city else city_data
        days_out.append({
            "day": i + 1,
            "date": day.date,
            "city": day_city,
            "isTravel": day.is_travel_day,
            "stops": stops_out,
            "scenicCorridors": scenic_corridors_out,
            "messages": day_messages,
            "walkBaseKm": _day_city_data.movement.get("walk_base_km", 2.0),
        })

    # Re-order days to match body.cities order (TSP may cluster Melbourne before Sydney)
    if body.cities and len(body.cities) > 1:
        _city_order = {c.lower(): i for i, c in enumerate(body.cities)}
        def _day_city_rank(d: dict) -> int:
            return _city_order.get((d["city"] or "").lower(), len(body.cities))
        days_out = sorted(days_out, key=_day_city_rank)
        # Re-number days sequentially after reorder
        for _di, _d in enumerate(days_out):
            _d["day"] = _di + 1
            for _s in _d["stops"]:
                _s["day"] = _di + 1

    # Build ordered unique city list — use explicit cities from request if provided,
    # else derive from per-day cities in output order
    if body.cities and len(body.cities) > 1:
        all_cities = body.cities
    else:
        seen: list[str] = []
        for d in days_out:
            c = d["city"]
            if c not in seen:
                seen.append(c)
        all_cities = seen or [body.city]

    return {
        "id": result.generation_id,
        "generatedAt": now_str,
        "cities": all_cities,
        "city": all_cities[0],
        "days": days_out,
        "personaSnapshot": persona_snapshot,
        "archetypeSnapshot": archetype,
    }


# ── Background itinerary build ─────────────────────────────────────────────

async def _run_itinerary_build(
    build_id: str,
    user_id: str,
    body: "EngineItineraryPayload",
) -> None:
    """Run the full engine + scenic enrichment, writing status to itinerary_builds."""
    from datetime import timezone as _tz

    def _update(status: str, result=None, error: str | None = None) -> None:
        if not _supabase:
            return
        patch: dict = {
            "status": status,
            "updated_at": datetime.now(_tz.utc).isoformat(),
        }
        if result is not None:
            patch["result"] = result
        if error is not None:
            patch["error"] = error
        try:
            _supabase.table("itinerary_builds").update(patch).eq("id", build_id).execute()
        except Exception as _e:
            logging.warning("[build] status update failed for %s: %s", build_id, _e)

    try:
        _update("running")
        # engine_itinerary uses synchronous `requests` calls (Overpass, ORS, elevation)
        # throughout its call stack. Running it directly in this async background task
        # blocks the entire event loop for the duration of the build (3-8 min for Tokyo).
        # Fix: run the blocking engine in a thread pool so the event loop stays free to
        # handle status polls and other requests while the build is in progress.
        import asyncio as _asyncio

        from fastapi import Request as _Req
        scope = {"type": "http", "headers": [], "client": ("127.0.0.1", 0)}
        fake_request = _Req(scope)  # type: ignore[arg-type]
        fake_user = type("U", (), {"id": user_id})()

        def _run_engine_sync() -> dict:
            """Run the async engine_itinerary in a fresh event loop inside a thread."""
            loop = _asyncio.new_event_loop()
            try:
                result_response = loop.run_until_complete(
                    engine_itinerary(body, fake_request, fake_user)
                )
                if hasattr(result_response, "body"):
                    import json as _json
                    return _json.loads(result_response.body)
                return result_response  # type: ignore[return-value]
            finally:
                loop.close()

        result_dict = await _asyncio.to_thread(_run_engine_sync)
        _update("done", result=result_dict)
    except Exception as _exc:
        logging.error("[build] failed for %s: %s", build_id, _exc, exc_info=True)
        _update("failed", error=str(_exc))


@app.post("/engine-itinerary/start")
async def engine_itinerary_start(
    body: EngineItineraryPayload,
    background_tasks: BackgroundTasks,
    request: Request,
    user=Depends(get_current_user),
):
    """Start a background itinerary build. Returns {buildId, status} immediately (non-blocking)."""
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="rate_limit_exceeded")

    if _is_restricted_city(body.city):
        raise HTTPException(status_code=403, detail="Travel planning not available for this destination.")

    # Clean up any builds orphaned by dyno restarts (stuck pending/running > 15 min)
    if _supabase:
        try:
            stale_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
            _supabase.table("itinerary_builds").update({
                "status": "failed",
                "error": "Build timed out — server was restarted. Please try again.",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("user_id", str(user.id)).in_("status", ["pending", "running"]).lt("updated_at", stale_cutoff).execute()
        except Exception:
            pass  # Non-fatal

    # Reject if user already has an active (non-stale) build
    if _supabase:
        try:
            active = (
                _supabase.table("itinerary_builds")
                .select("id, status")
                .eq("user_id", str(user.id))
                .in_("status", ["pending", "running"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if active.data:
                raise HTTPException(status_code=409, detail={
                    "code": "build_in_progress",
                    "buildId": active.data[0]["id"],
                })
        except HTTPException:
            raise
        except Exception:
            pass  # DB unavailable — proceed anyway

    # Create build record
    build_id: str = ""
    if _supabase:
        try:
            row = _supabase.table("itinerary_builds").insert({
                "user_id": str(user.id),
                "status": "pending",
                "city": body.city,
            }).execute()
            build_id = row.data[0]["id"]
        except Exception as _e:
            raise HTTPException(status_code=500, detail=f"Could not create build record: {_e}")

    # Enforce free-tier generation limit and increment — atomic to prevent race conditions
    if _supabase:
        try:
            result = _supabase.rpc("check_and_increment_generation", {"uid": str(user.id)}).execute()
            outcome = result.data if result else None
            if outcome and not outcome.get("allowed"):
                reason = outcome.get("reason", "limit_reached")
                if reason == "limit_reached":
                    if build_id:
                        _supabase.table("itinerary_builds").delete().eq("id", build_id).execute()
                    raise HTTPException(status_code=403, detail="generation_limit_reached")
                elif reason == "profile_not_found":
                    logging.warning("check_and_increment_generation: profile not found for user %s", user.id)
        except HTTPException:
            raise
        except Exception as _e:
            logging.error("check_and_increment_generation failed for user %s: %s", user.id, _e)

    background_tasks.add_task(_run_itinerary_build, build_id, str(user.id), body)
    return JSONResponse(status_code=202, content={"buildId": build_id, "status": "pending"})


@app.get("/engine-itinerary/status/{build_id}")
async def engine_itinerary_status(build_id: str, user=Depends(get_current_user)):
    """Poll build status. Returns status + full result once done."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="DB unavailable")
    try:
        row = (
            _supabase.table("itinerary_builds")
            .select("id, status, result, error, updated_at")
            .eq("id", build_id)
            .eq("user_id", str(user.id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Build not found")
    d = row.data
    return {
        "buildId": d["id"],
        "status":  d["status"],
        "result":  d.get("result"),
        "updatedAt": d["updated_at"],
    }


# ── City search + map data (Phase 10) ────────────────────────────────────────

class CitySearchResult(BaseModel):
    city_id: str
    name: str
    country_code: str
    tier: int
    seeded: bool
    image_url: Optional[str] = None


class MapPin(BaseModel):
    place_id: str
    name: str
    lat: float
    lon: float
    category: str
    neighborhood: Optional[str]
    is_landmark: bool


class PlacePick(BaseModel):
    place_id: str
    name: str
    lat: float
    lon: float
    category: str
    rating: Optional[float]
    stage: str
    badge: Optional[str]        # 'trending' | 'getting_busy' | 'hidden_gem' | None
    badge_reason: Optional[str]


@app.get("/api/cities/autocomplete", response_model=list[CitySearchResult])
async def cities_autocomplete(q: str, _user=Depends(get_current_user)):
    """Whitelist prefix search. Free tier. Min 2 chars, max 10 results."""
    if len(q.strip()) < 2:
        return []
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    rows = (
        _supabase.table("city_whitelist")
        .select("city_id, name, country_code, tier, seeded, image_url")
        .ilike("name", f"{q}%")
        .order("tier")
        .limit(10)
        .execute()
    )
    return [
        CitySearchResult(
            city_id=r["city_id"], name=r["name"],
            country_code=r["country_code"], tier=r["tier"],
            seeded=r.get("seeded", False),
            image_url=r.get("image_url"),
        )
        for r in (rows.data or [])
    ]


@app.get("/api/cities/search", response_model=CitySearchResult)
async def cities_search(city_id: str, _user=Depends(get_current_user)):
    """Exact whitelist lookup. Free tier. Returns 404 if not whitelisted."""
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    row = (
        _supabase.table("city_whitelist")
        .select("city_id, name, country_code, tier, seeded, image_url")
        .eq("city_id", city_id)
        .maybe_single()
        .execute()
    )
    r = _maybe_single_data(row)
    if not r:
        raise HTTPException(status_code=404, detail="city_not_in_whitelist")
    return CitySearchResult(
        city_id=r["city_id"], name=r["name"],
        country_code=r["country_code"], tier=r["tier"],
        seeded=r.get("seeded", False),
        image_url=r.get("image_url"),
    )


def _fetch_city_photo_ref(city_name: str) -> Optional[str]:
    """Call Google Places Text Search and return the first photo_reference (wrapped if new-format)."""
    if not GOOGLE_PLACES_API_KEY:
        return None
    try:
        r = requests.get(
            f"{GOOGLE_PLACES_BASE}/textsearch/json",
            params={"query": city_name, "type": "locality", "key": GOOGLE_PLACES_API_KEY},
            timeout=8,
        )
        for result in (r.json().get("results") or []):
            photos = result.get("photos") or []
            if photos:
                ref = photos[0].get("photo_reference")
                if ref:
                    pid = result.get("place_id", "")
                    if len(ref) > 300 and not ref.startswith("places/") and pid:
                        ref = f"places/{pid}/photos/{ref}"
                    elif len(ref) > 300 and not ref.startswith("places/"):
                        continue  # can't wrap without place_id, try next result
                    return ref
    except Exception:
        pass
    return None


def _fetch_city_wiki_photo(city_name: str) -> Optional[str]:
    """Fetch a city thumbnail from Wikipedia. Returns absolute URL or None."""
    wiki_base = "https://en.wikipedia.org/w/api.php"
    try:
        search = requests.get(wiki_base, params={
            "action": "query", "list": "search",
            "srsearch": city_name,
            "format": "json", "srlimit": 1,
        }, timeout=8).json()
        results = search.get("query", {}).get("search", [])
        if not results:
            return None
        title = results[0]["title"]
        images = requests.get(wiki_base, params={
            "action": "query", "titles": title,
            "prop": "pageimages", "pithumbsize": 800,
            "format": "json",
        }, timeout=8).json()
        for page in images.get("query", {}).get("pages", {}).values():
            src = page.get("thumbnail", {}).get("source")
            if src:
                return src
    except Exception:
        pass
    return None


@app.get("/api/cities/photos")
async def cities_photos(names: str):
    """Batch image URL lookup by city name. Returns {name: proxy_path|null}.

    DB miss → auto-fetch from Google Places and persist.
    names: comma-separated city names, max 20, case-insensitive exact match.
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    name_list = [n.strip() for n in names.split(",") if n.strip()][:20]
    if not name_list:
        return {}
    rows = (
        _supabase.table("city_whitelist")
        .select("name, image_url")
        .in_("name", name_list)
        .execute()
    )
    def _is_stale_photo_url(url: Optional[str]) -> bool:
        """Returns True if the cached URL contains a raw new-format token (unwrappable)."""
        if not url:
            return True
        if "photo_ref=" not in url:
            return False
        ref_part = url.split("photo_ref=")[1].split("&")[0]
        return len(ref_part) > 300 and not ref_part.startswith("places%2F") and not ref_part.startswith("places/")

    result: dict[str, Optional[str]] = {n: None for n in name_list}
    db_name_map: dict[str, str] = {}  # canonical DB name → original request name
    for r in (rows.data or []):
        db_name_map[r["name"]] = r["name"]
        url = r.get("image_url")
        result[r["name"]] = None if _is_stale_photo_url(url) else url
    # Second pass: case-insensitive match for unresolved names
    unmatched = [n for n in name_list if result[n] is None]
    for uname in unmatched:
        try:
            row = _supabase.table("city_whitelist").select("name, image_url").ilike("name", uname).limit(1).execute()
            if row.data:
                db_name = row.data[0]["name"]
                result[uname] = row.data[0].get("image_url")
                db_name_map[uname] = db_name
        except Exception:
            pass
    # Third pass: for cities still without an image, fetch from Google → Wikipedia fallback
    still_missing = [n for n in name_list if not result.get(n)]
    for city in still_missing:
        ref = _fetch_city_photo_ref(city)
        city_url: Optional[str] = f"/place-photo?photo_ref={ref}&max_width=800" if ref else None
        if not city_url:
            # Google Places returned nothing usable — fall back to Wikipedia thumbnail
            city_url = _fetch_city_wiki_photo(city)
            print(f"[city-photos] wiki fallback for {city}: {city_url and city_url[:60]}")
        result[city] = city_url
        if city_url:
            try:
                canonical = db_name_map.get(city, city)
                _supabase.table("city_whitelist").update({"image_url": city_url}).ilike("name", canonical).execute()
            except Exception:
                pass
    return result


@app.get("/api/cities/map-pins", response_model=list[MapPin])
async def cities_map_pins(city_id: str, _user=Depends(get_current_user)):
    """Pre-seeded basic map pins. Free tier. No live API calls.
    Returns insert candidates from city_data seed.
    If city is unseeded, triggers on-demand seeding (~3-4s first caller only).
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    try:
        city = load_city(city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")
    landmark_set = set(city.landmark_anchors)
    return [
        MapPin(
            place_id=ic.place_id, name=ic.name,
            lat=ic.lat, lon=ic.lon,
            category=ic.type,
            neighborhood=None,
            is_landmark=ic.place_id in landmark_set,
        )
        for ic in city.insert_candidates
    ]


@app.post("/api/cities/seed")
def ensure_city_seeded(city_id: str = Query(...)):
    """Ensures city_data row exists for city_id. Called by frontend on map load.
    No auth required — seeding is idempotent and read-only from the user's perspective.
    """
    if _supabase is None:
        return {"status": "unavailable"}
    try:
        # load_city writes to Supabase when loading from a local seed file
        load_city(city_id, _supabase)
        return {"status": "ok"}
    except ValueError:
        # City not found in seed files or whitelist — try direct seed file upsert as last resort
        seed_path = _Path(f"city/seed/{city_id}.json")
        if seed_path.exists():
            try:
                seed = _json.loads(seed_path.read_text())
                _supabase.table("city_data").upsert({
                    "id": city_id,
                    "name": seed.get("name", city_id),
                    "tier": seed.get("tier", 1),
                    "country_code": seed.get("country_code", ""),
                    "data": seed,
                }).execute()
                return {"status": "ok"}
            except Exception as exc2:
                print(f"[ensure_city_seeded] upsert fallback failed for {city_id}: {exc2}")
        return {"status": "not_found"}
    except Exception as exc:
        print(f"[ensure_city_seeded] error for {city_id}: {exc}")
        return {"status": "error", "detail": str(exc)}


@app.get("/api/cities/picks", response_model=list[PlacePick])
async def cities_picks(city_id: str, lat: float = None, lon: float = None, background_tasks: BackgroundTasks = None):
    """Pro: curated picks with trend stage badges.
    Uses pre-seeded data enriched with stage signals from place_dynamic_profiles.

    Badge logic:
      trending     — stage=rising AND velocity_ratio >= 2.0
      getting_busy — stage=rising with crowd_ratio >= 0.4
      hidden_gem   — stage=hidden_gem
      None         — mainstream or no signal data
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    city_slug = re.sub(r'[^a-z0-9]+', '_', city_id.lower().strip()).strip('_')
    try:
        city = load_city(city_slug, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    # On-demand seed: if no candidates and caller provided coords, build now (~3-4s)
    if not city.insert_candidates and lat and lon:
        try:
            from city.seed_builder import build_city_seed as _build_city_seed
            _seeded = _build_city_seed({
                "city_id": city_slug, "name": city_id,
                "lat": lat, "lon": lon,
                "country_code": "", "timezone": "UTC", "tier": 2,
            })
            if _seeded.insert_candidates:
                city = _seeded
                if _supabase:
                    try:
                        _cd_dict = {
                            "id": city_slug, "name": city_id, "tier": 2,
                            "center": [lat, lon], "timezone": "UTC",
                            "climate": _seeded.climate, "movement": _seeded.movement,
                            "culture": _seeded.culture,
                            "neighborhoods": [
                                {"id": n.id, "name": n.name, "center": list(n.center),
                                 "polygon": [list(p) for p in n.polygon],
                                 "best_times": n.best_times, "crowd_index": n.crowd_index}
                                for n in _seeded.neighborhoods
                            ],
                            "insert_candidates": [
                                {"place_id": ic.place_id, "name": ic.name,
                                 "lat": ic.lat, "lon": ic.lon, "type": ic.type,
                                 "time_cost_min": ic.time_cost_min,
                                 "persona_affinity": ic.persona_affinity,
                                 "trigger": ic.trigger,
                                 "time_of_day_match": ic.time_of_day_match}
                                for ic in _seeded.insert_candidates
                            ],
                            "scenic_routes": _seeded.scenic_routes,
                            "transit_edges": _seeded.transit_edges,
                            "engine_modifiers": _seeded.engine_modifiers,
                            "landmark_anchors": _seeded.landmark_anchors,
                            "hidden_gems": _seeded.hidden_gems,
                        }
                        _supabase.table("city_data").upsert({
                            "id": city_slug, "name": city_id,
                            "tier": 2, "country_code": "",
                            "data": _cd_dict,
                        }).execute()
                        # Fire trend seeding in background — does not block picks response
                        if background_tasks:
                            from city.trend_seeder import seed_trend_scores as _seed_trends
                            _trend_places = [
                                {"place_id": ic.place_id, "name": ic.name,
                                 "lat": ic.lat, "lon": ic.lon}
                                for ic in _seeded.insert_candidates if ic.place_id
                            ]
                            background_tasks.add_task(
                                _seed_trends,
                                city_id=city_slug,
                                places=_trend_places,
                                city_name=_seeded.name,
                                country_code="",
                                supabase=_supabase,
                                youtube_key=YOUTUBE_API_KEY,
                                foursquare_key=FOURSQUARE_API_KEY,
                                reddit_client_id=REDDIT_CLIENT_ID,
                                reddit_client_secret=REDDIT_CLIENT_SECRET,
                            )
                    except Exception as _db_err:
                        print(f"[cities_picks] DB upsert failed for {city_slug}: {_db_err}")
        except Exception as _e:
            print(f"[cities_picks] on-demand seed failed for {city_id}: {_e}")

    place_ids = [ic.place_id for ic in city.insert_candidates]
    profiles_row = (
        _supabase.table("place_dynamic_profiles")
        .select("place_id, stage, signals")
        .in_("place_id", place_ids)
        .execute()
    )
    profiles: dict[str, dict] = {
        r["place_id"]: r for r in (profiles_row.data or [])
    }

    # Auto-seed on first access — no manual step required
    if not profiles and place_ids:
        details = _batch_place_details(_supabase, place_ids)
        seed_rows = []
        for ic in city.insert_candidates:
            if not ic.place_id:
                continue
            d = details.get(ic.place_id, {})
            _rating = float(getattr(ic, "rating", None) or 0.0)
            stage, signals = _stage_and_signals(_rating, d.get("rating_count"))
            seed_rows.append({
                "place_id": ic.place_id, "city_id": city_id,
                "stage": stage, "signals": signals,
                "updated_at": datetime.utcnow().isoformat(),
            })
        if seed_rows:
            try:
                _supabase.table("place_dynamic_profiles").upsert(seed_rows, on_conflict="place_id").execute()
                profiles = {r["place_id"]: r for r in seed_rows}
            except Exception:
                pass  # badges degrade gracefully if seed fails

    def _badge(place_id: str) -> tuple[Optional[str], Optional[str]]:
        p = profiles.get(place_id)
        if not p:
            return None, None
        stage = p.get("stage", "unknown")
        signals = p.get("signals") or {}
        velocity = float(signals.get("velocity_ratio", 1.0) or 1.0)
        crowd = float(signals.get("crowd_ratio", 0.0) or 0.0)
        if stage == "rising" and velocity >= 2.0:
            return "trending", f"Reviews up {int(velocity)}x this month"
        if stage == "rising" and crowd >= 0.4:
            return "getting_busy", "Getting busy — locals say go early"
        if stage == "hidden_gem":
            return "hidden_gem", "Still off the tourist trail"
        return None, None

    picks = []
    for ic in city.insert_candidates:
        badge, badge_reason = _badge(ic.place_id)
        p = profiles.get(ic.place_id, {})
        picks.append(PlacePick(
            place_id=ic.place_id, name=ic.name,
            lat=ic.lat, lon=ic.lon,
            category=ic.type, rating=None,
            stage=p.get("stage", "unknown"),
            badge=badge, badge_reason=badge_reason,
        ))
    return picks


def _stage_and_signals(
    rating: float | None,
    rating_count: int | None,
) -> tuple[str, dict]:
    """Derive discovery stage and proxy signals from rating + rating_count alone.

    Stage:
      hidden_gem — high quality (≥4.3), still obscure (<500 reviews)
      rising     — quality above bracket baseline (≥4.2), moderate visibility (500–4000)
      mainstream — everything else

    velocity_ratio:
      Represents how far above the expected mean this place sits for its popularity tier.
      Baseline rating regresses toward 4.0 as review count grows.
        baseline = 4.0 + max(0, (2000 - count) / 2000 * 0.35)
        → 4.35 at count=0, 4.0 at count≥2000
      velocity_ratio = clamp(0.3, 5.0, 1.0 + (rating - baseline) × 6.0)
        → 4.5★ / count=600: baseline≈4.24, ratio≈2.46 (→ trending badge fires at ≥2.0)

    crowd_ratio:
      Normalised popularity proxy. 5 000 reviews ≈ city-famous landmark.
        crowd_ratio = min(0.95, count / 5000)
        → 2 000 reviews → 0.40 (→ getting_busy badge fires at ≥0.40)
    """
    r   = float(rating or 0.0)
    cnt = int(rating_count or 0)

    baseline = 4.0 + max(0.0, (2000 - cnt) / 2000 * 0.35)
    velocity_ratio = max(0.3, min(5.0, 1.0 + (r - baseline) * 6.0))
    crowd_ratio    = min(0.95, cnt / 5000)

    if r >= 4.3 and cnt < 500:
        stage = "hidden_gem"
    elif r >= 4.2 and 500 <= cnt < 4000:
        stage = "rising"
    else:
        stage = "mainstream"

    return stage, {
        "velocity_ratio": round(velocity_ratio, 3),
        "crowd_ratio":    round(crowd_ratio, 3),
    }


@app.post("/api/places/seed-profiles")
async def seed_place_profiles(city_id: str = Query(...)):
    """Seed place_dynamic_profiles for all insert_candidates in a city.

    Reads rating + rating_count from place_details_cache (no Google API calls).
    Upserts stage + signals derived via _stage_and_signals().
    Idempotent — safe to call repeatedly as cache fills in.
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    try:
        city = load_city(city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    place_ids = [ic.place_id for ic in city.insert_candidates if ic.place_id]
    if not place_ids:
        return {"seeded": 0}

    details = _batch_place_details(_supabase, place_ids)

    # Fetch existing profiles to preserve trend-derived velocity_ratio
    existing_resp = (
        _supabase.table("place_dynamic_profiles")
        .select("place_id, signals")
        .in_("place_id", place_ids)
        .execute()
    )
    existing_signals: dict[str, dict] = {
        r["place_id"]: (r.get("signals") or {}) for r in (existing_resp.data or [])
    }

    rows = []
    for ic in city.insert_candidates:
        if not ic.place_id:
            continue
        d = details.get(ic.place_id, {})
        rating       = d.get("rating_count") and ic.rating  # use IC's rating (from Places seed)
        rating_count = d.get("rating_count")
        # Fall back to IC rating if batch details didn't return one
        _rating = float(ic.rating or 0.0) if hasattr(ic, "rating") else 0.0
        stage, signals = _stage_and_signals(_rating, rating_count)
        # Preserve trend-derived velocity_ratio if already computed (marked by trend_seeder)
        prev = existing_signals.get(ic.place_id, {})
        if prev.get("trend_seeded"):
            signals["velocity_ratio"] = prev.get("velocity_ratio", signals["velocity_ratio"])
            signals["trend_seeded"] = True
        rows.append({
            "place_id":   ic.place_id,
            "city_id":    city_id,
            "stage":      stage,
            "signals":    signals,
            "updated_at": datetime.utcnow().isoformat(),
        })

    if not rows:
        return {"seeded": 0}

    _supabase.table("place_dynamic_profiles").upsert(rows, on_conflict="place_id").execute()
    return {"seeded": len(rows)}


@app.post("/api/places/seed-trends")
def seed_place_trends(city_id: str = Query(...)):
    """Seed real trend velocity scores for all places in a city.

    Fetches signals from YouTube, Wikimedia, Foursquare, and Reddit (if credentials
    are set). Overwrites velocity_ratio in place_dynamic_profiles while preserving
    stage and crowd_ratio. Safe to call repeatedly — idempotent.
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    try:
        city = load_city(city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    places = [
        {"place_id": ic.place_id, "name": ic.name, "lat": ic.lat, "lon": ic.lon}
        for ic in city.insert_candidates
        if ic.place_id
    ]
    if not places:
        return {"updated": 0, "skipped": 0}

    if not any([YOUTUBE_API_KEY, FOURSQUARE_API_KEY, REDDIT_CLIENT_ID]):
        raise HTTPException(status_code=400, detail="no_trend_api_keys_configured")

    from city.trend_seeder import seed_trend_scores
    result = seed_trend_scores(
        city_id=city_id,
        places=places,
        city_name=city.name,
        country_code="",
        supabase=_supabase,
        youtube_key=YOUTUBE_API_KEY,
        foursquare_key=FOURSQUARE_API_KEY,
        reddit_client_id=REDDIT_CLIENT_ID,
        reddit_client_secret=REDDIT_CLIENT_SECRET,
    )
    return result


@app.api_route("/api/places/seed-trends/all", methods=["GET", "POST"])
async def seed_all_city_trends(background_tasks: BackgroundTasks):
    """Trigger trend velocity refresh for every city in place_dynamic_profiles.

    Runs in the background — returns immediately. Cities seeded within the
    last 7 days are skipped automatically (staleness guard).
    Accepts both GET (Railway/uptime cron) and POST.
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")

    background_tasks.add_task(
        _refresh_all_cities,
        supabase=_supabase,
        youtube_key=YOUTUBE_API_KEY,
        foursquare_key=FOURSQUARE_API_KEY,
        reddit_client_id=REDDIT_CLIENT_ID,
        reddit_client_secret=REDDIT_CLIENT_SECRET,
    )
    return {"status": "started", "message": "Trend refresh running in background for all cities"}


# ── Phase 11: Surprise Me ────────────────────────────────────────────────────

class SurpriseMeRequest(BaseModel):
    start_city_id: str
    end_city_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    persona: str = "explorer"


_PERSONA_DESCRIPTIONS = {
    "wanderer":      "an adventurous traveller who loves getting lost in side streets and local markets",
    "historian":     "a culture-lover who prioritises historical landmarks, museums and heritage sites",
    "epicurean":     "a foodie who plans their day around restaurants, cafes, street food and local markets",
    "pulse":         "a night-owl who loves nightlife, live music, bars and late-night street food",
    "slowtraveller": "a relaxed traveller who prefers slow mornings, parks, cafes and unhurried exploration",
    "voyager":       "an efficiency-focused traveller who wants to see the most important sights in limited time",
    "explorer":      "a curious traveller who balances iconic sights with hidden gems and local experiences",
}


@app.post("/api/surprise-me")
async def surprise_me(body: SurpriseMeRequest, user=Depends(require_auth_or_pack)):
    """Build a full itinerary from scratch using Claude Haiku + the 5-layer engine."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="anthropic_key_not_configured")

    try:
        city_data = load_city(body.start_city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    # Build date list
    travel_dates: list[str] = []
    if body.start_date and body.end_date:
        from datetime import date as _date, timedelta as _td
        d = _date.fromisoformat(body.start_date)
        end = _date.fromisoformat(body.end_date)
        while d <= end:
            travel_dates.append(d.isoformat())
            d += _td(days=1)
    if not travel_dates:
        travel_dates = [body.start_date or "2026-01-01"]

    total_days = len(travel_dates)
    persona_desc = _PERSONA_DESCRIPTIONS.get(body.persona.lower(), _PERSONA_DESCRIPTIONS["explorer"])

    # Collect city context for Claude
    city_context_lines: list[str] = []
    if city_data.insert_candidates:
        picks = city_data.insert_candidates[:15]
        city_context_lines.append("Available places (use these for suggestions):")
        for p in picks:
            city_context_lines.append(f"  - {p.name} ({p.type}) at ({p.lat:.4f},{p.lon:.4f})")
    city_context = "\n".join(city_context_lines)

    system_prompt = (
        "You are a travel itinerary generator. Return ONLY valid JSON, no markdown, no explanation.\n"
        f"Build a {total_days}-day itinerary for {city_data.name} for {persona_desc}.\n"
        "JSON format: {\"days\": [{\"city\": \"CityName\", \"date\": \"YYYY-MM-DD\", \"places\": "
        "[{\"name\": \"Place\", \"category\": \"restaurant|cafe|park|museum|historic|tourism|place\", "
        "\"duration_min\": 60, \"lat\": 0.0, \"lon\": 0.0}]}]}\n"
        "Rules: 4-6 places per day. Use real lat/lon coordinates. Dates must match the trip dates."
    )

    user_message = (
        f"City: {city_data.name}\n"
        f"Dates: {', '.join(travel_dates)}\n"
        f"Persona: {body.persona} — {persona_desc}\n"
        f"{city_context}"
    )

    # Step 1: Claude Haiku generates raw itinerary
    client_ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client_ai.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        claude_data = json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=502, detail=f"claude_error: {str(e)}")

    # Step 2: Convert Claude's place list to EngineStop objects
    engine_stops: list[EngineStop] = []
    for day_data in claude_data.get("days", []):
        for place in day_data.get("places", []):
            try:
                engine_stops.append(EngineStop(
                    place_id=f"surprise-{uuid.uuid4().hex[:8]}",
                    name=place.get("name", ""),
                    lat=float(place.get("lat", 0)),
                    lon=float(place.get("lon", 0)),
                    category=place.get("category", "place"),
                    duration_min=int(place.get("duration_min", 60)),
                    opening_hours=[],
                    price_level=None,
                    rating=None,
                    neighborhood=None,
                    is_user_added=False,
                ))
            except (TypeError, ValueError):
                continue

    if not engine_stops:
        raise HTTPException(status_code=502, detail="claude_returned_no_places")

    # Step 3: Run engine pipeline
    ctx = EngineContext(
        persona={"archetype": body.persona, "day_buffer_min": 30},
        city=city_data,
        travel_dates=travel_dates,
        weather=None,
    )
    result = await build_itinerary(engine_stops, ctx)

    return {
        "generation_id": result.generation_id,
        "days": [
            {
                "date": day.date,
                "is_travel_day": day.is_travel_day,
                "stops": [
                    {
                        "place_id": s.place_id,
                        "name": s.name,
                        "lat": s.lat,
                        "lon": s.lon,
                        "category": s.category,
                        "duration_min": s.duration_min,
                        "scheduled_time": s.scheduled_time,
                        "transition_to_next": s.transition_to_next,
                        "type": s.type,
                        "is_user_added": s.is_user_added,
                        "outdoor": s.outdoor,
                        "tags": s.tags or [],
                    }
                    for s in day.stops
                ],
            }
            for day in result.days
        ],
        "messages": [
            {
                "type": msg.type,
                "what": msg.what,
                "why": msg.why,
                "consequence": msg.consequence,
                "dismissable": msg.dismissable,
            }
            for msg in result.messages
        ],
        "recommendations": result.recommendations,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
