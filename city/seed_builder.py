"""Real-data city seed builder.

Fetches from 6 sources in parallel and assembles a CityData object.
All fetch functions are thin wrappers — independently mockable.

Sources:
  - Wikidata SPARQL   → landmark_anchors (CC0, no key)
  - OSM Overpass      → neighborhoods (internal use, not redistributed)
  - Google Places API → insert_candidates
  - Foursquare API    → hidden_gems (optional, skipped if no key)
  - Open-Meteo        → climate (CC BY 4.0, no key)
  - country_profiles  → engine_modifiers (static)

Latency: ~3–4s fully parallelised on cold city.
"""
from __future__ import annotations
import math
import os
import re
from concurrent.futures import ThreadPoolExecutor

import requests

from city.country_profiles import get_country_modifiers
from city.data_model import CityData, InsertCandidate, Neighborhood, load_city_from_dict
from city.persona_affinity import get_persona_affinity

_WIKIDATA_URL = "https://query.wikidata.org/sparql"
_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
_FOURSQUARE_URL = "https://api.foursquare.com/v3/places/search"
_OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"

# Google Place types → insert candidate type
_TYPE_MAP: dict[str, str] = {
    "cafe": "coffee", "coffee_shop": "coffee",
    "restaurant": "lunch", "food": "lunch",
    "park": "scenic_walk", "natural_feature": "scenic_walk", "viewpoint": "scenic_walk",
    "spa": "rest", "lodging": "rest",
    "tourist_attraction": "micro", "point_of_interest": "micro",
    "museum": "micro", "art_gallery": "micro",
}
_DEFAULT_TIME_COST: dict[str, int] = {
    "coffee": 25, "lunch": 60, "scenic_walk": 45, "rest": 30, "micro": 45
}


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ── Fetch functions ───────────────────────────────────────────────────────────

def _fetch_wikidata_landmarks(city: dict) -> list[str]:
    """Return up to 8 landmark slug IDs near city center via Wikidata SPARQL."""
    query = f"""
SELECT DISTINCT ?item ?itemLabel WHERE {{
  SERVICE wikibase:around {{
    ?item wdt:P625 ?loc.
    bd:serviceParam wikibase:center "Point({city['lon']} {city['lat']})"^^geo:wktLiteral.
    bd:serviceParam wikibase:radius "15".
  }}
  ?item wdt:P31/wdt:P279* wd:Q570116.
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 8
"""
    try:
        r = requests.get(
            _WIKIDATA_URL,
            params={"query": query, "format": "json"},
            headers={"User-Agent": "UncoverRoads/1.0 (travel app)"},
            timeout=10,
        )
        r.raise_for_status()
        bindings = r.json()["results"]["bindings"]
        return [_slugify(b["itemLabel"]["value"]) for b in bindings if "itemLabel" in b][:8]
    except Exception:
        return []


def _assemble_polygon(relation: dict) -> list[tuple[float, float]]:
    """Stitch outer member ways of a relation into a single closed polygon ring.

    With `out geom`, each member way has an inline `geometry` list of {lat, lon}
    dicts. We collect the outer ring ways and chain them end-to-end.
    Returns up to 200 (lat, lon) points, or [] if no geometry is available.
    """
    outer_ways: list[list[tuple[float, float]]] = []
    for member in relation.get("members", []):
        if member.get("type") != "way" or member.get("role") not in ("outer", ""):
            continue
        pts = [(pt["lat"], pt["lon"]) for pt in member.get("geometry", [])
               if "lat" in pt and "lon" in pt]
        if pts:
            outer_ways.append(pts)

    if not outer_ways:
        return []
    if len(outer_ways) == 1:
        ring = outer_ways[0]
    else:
        # Stitch ways into a continuous ring by matching endpoints
        ring: list[tuple[float, float]] = list(outer_ways[0])
        remaining = outer_ways[1:]
        tol = 1e-5
        for _ in range(len(remaining) * 2):
            if not remaining:
                break
            tail = ring[-1]
            matched = False
            for j, way in enumerate(remaining):
                if abs(tail[0] - way[0][0]) < tol and abs(tail[1] - way[0][1]) < tol:
                    ring.extend(way[1:])
                    remaining.pop(j)
                    matched = True
                    break
                if abs(tail[0] - way[-1][0]) < tol and abs(tail[1] - way[-1][1]) < tol:
                    ring.extend(reversed(way[:-1]))
                    remaining.pop(j)
                    matched = True
                    break
            if not matched and remaining:
                ring.extend(remaining.pop(0))

    # Thin to ≤200 points to keep JSONB size reasonable
    if len(ring) > 200:
        step = max(1, len(ring) // 200)
        ring = ring[::step]

    return ring


def _polygon_centroid(polygon: list[tuple[float, float]]) -> tuple[float, float]:
    """Return the arithmetic centroid of a polygon ring."""
    lat = sum(p[0] for p in polygon) / len(polygon)
    lon = sum(p[1] for p in polygon) / len(polygon)
    return lat, lon


def _fetch_osm_neighborhoods(city: dict) -> list[Neighborhood]:
    """Return 5–8 administrative neighborhoods near city center via OSM Overpass.

    Tries admin_level 7|8 first (works for most Asian/South Asian cities),
    then falls back to 8|9|10 (European cities), then 5|6 (district-level).
    Uses `out center` (much faster than `out geom`).
    Falls back to synthetic hex-grid if all queries fail or return nothing.
    """
    lat, lon = city['lat'], city['lon']
    level_bands = ["7|8", "8|9|10", "5|6"]
    elements: list = []
    for band in level_bands:
        query = (
            f'[out:json][timeout:25];'
            f'(relation["admin_level"~"{band}"]["name"]["boundary"="administrative"]'
            f'(around:15000,{lat},{lon}););out center;'
        )
        try:
            r = requests.post(_OVERPASS_URL, data={"data": query}, timeout=30)
            r.raise_for_status()
            elements = r.json().get("elements", [])
            if elements:
                break
        except Exception:
            continue

    neighborhoods: list[Neighborhood] = []
    seen: set[str] = set()
    for el in elements:
        name = el.get("tags", {}).get("name", "").strip()
        if not name or name in seen:
            continue
        center = el.get("center", {})
        nlat = center.get("lat", lat)
        nlon = center.get("lon", lon)
        nid = _slugify(name)
        neighborhoods.append(Neighborhood(
            id=nid, name=name, center=(nlat, nlon), polygon=[],
            best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
            crowd_index={"weekday": 0.5, "weekend": 0.7},
        ))
        seen.add(name)
        if len(neighborhoods) == 8:
            break

    if not neighborhoods:
        neighborhoods.append(_fallback_neighborhood(city))

    return neighborhoods


def _fallback_neighborhood(city: dict) -> Neighborhood:
    return Neighborhood(
        id=_slugify(city["name"]) + "_center",
        name=f"{city['name']} Center",
        center=(city["lat"], city["lon"]), polygon=[],
        best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
        crowd_index={"weekday": 0.5, "weekend": 0.7},
    )


def _fetch_google_pois(city: dict, neighborhoods: list[Neighborhood]) -> list[dict]:
    """Return POIs from Google Places for each neighborhood (coffee, lunch, scenic)."""
    key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not key:
        return []
    categories = ["cafe", "restaurant", "park"]
    results: list[dict] = []
    seen_ids: set[str] = set()
    for nh in neighborhoods[:3]:
        for category in categories:
            try:
                r = requests.get(_PLACES_URL, params={
                    "location": f"{nh.center[0]},{nh.center[1]}",
                    "radius": 800,
                    "type": category,
                    "key": key,
                }, timeout=10)
                r.raise_for_status()
                for place in r.json().get("results", [])[:2]:
                    pid = place.get("place_id", "")
                    if pid in seen_ids:
                        continue
                    seen_ids.add(pid)
                    # Use the search category as the authoritative type — Google's
                    # returned types list often has "lodging" or "tourist_attraction"
                    # before "restaurant"/"cafe", which would misclassify the place.
                    all_types = place.get("types") or [category]
                    primary_type = all_types[0]
                    insert_type = _TYPE_MAP.get(category, "micro")
                    results.append({
                        "place_id": pid,
                        "name": place["name"],
                        "lat": place["geometry"]["location"]["lat"],
                        "lon": place["geometry"]["location"]["lng"],
                        "type": insert_type,
                        "google_type": primary_type,
                        "time_cost_min": _DEFAULT_TIME_COST.get(insert_type, 45),
                        "neighborhood": nh.id,
                    })
            except Exception:
                continue
    return results


def _fetch_foursquare_hidden_gems(city: dict) -> list[str]:
    """Return up to 5 hidden gem slug IDs from Foursquare near city center."""
    key = os.environ.get("FOURSQUARE_API_KEY", "")
    if not key:
        return []
    try:
        r = requests.get(
            _FOURSQUARE_URL,
            params={
                "ll": f"{city['lat']},{city['lon']}",
                "radius": 10000,
                "limit": 10,
                "sort": "POPULARITY",
            },
            headers={"Authorization": key, "Accept": "application/json"},
            timeout=10,
        )
        r.raise_for_status()
        venues = r.json().get("results", [])
        # Prefer lower-popularity venues (indices 5–9 = more local)
        return [_slugify(v["name"]) for v in venues[5:10] if v.get("name")][:5]
    except Exception:
        return []


def _fetch_climate(city: dict) -> dict:
    """Return heat_threshold_c and rain_months from Open-Meteo 5-year historical avg."""
    from datetime import date
    end_year = date.today().year - 1
    start_year = end_year - 4
    try:
        r = requests.get(_OPEN_METEO_URL, params={
            "latitude": city["lat"],
            "longitude": city["lon"],
            "start_date": f"{start_year}-01-01",
            "end_date": f"{end_year}-12-31",
            "monthly": "temperature_2m_mean,precipitation_sum",
            "timezone": city.get("timezone", "UTC"),
        }, timeout=15)
        r.raise_for_status()
        data = r.json().get("monthly", {})
        temps = data.get("temperature_2m_mean", [])
        precip = data.get("precipitation_sum", [])
        monthly_temp = [0.0] * 12
        monthly_precip = [0.0] * 12
        counts = [0] * 12
        for i, (t, p) in enumerate(zip(temps, precip)):
            m = i % 12
            if t is not None:
                monthly_temp[m] += t
            if p is not None:
                monthly_precip[m] += p
            counts[m] += 1
        monthly_temp = [monthly_temp[m] / max(counts[m], 1) for m in range(12)]
        monthly_precip = [monthly_precip[m] / max(counts[m], 1) for m in range(12)]
        heat_threshold_c = max(int(max(monthly_temp)), 25)
        rain_months = [i + 1 for i, p in enumerate(monthly_precip) if p > 80]
        return {"heat_threshold_c": heat_threshold_c, "rain_months": rain_months}
    except Exception:
        return {"heat_threshold_c": 30, "rain_months": []}


# ── Assembly ──────────────────────────────────────────────────────────────────

def _build_insert_candidates(pois: list[dict]) -> list[InsertCandidate]:
    candidates = []
    for poi in pois:
        affinity = get_persona_affinity(poi.get("google_type", poi["type"]))
        time_of_day = {
            "coffee": ["morning", "afternoon"],
            "lunch": ["afternoon"],
            "scenic_walk": ["morning", "afternoon", "evening"],
            "rest": ["afternoon", "evening"],
            "micro": ["morning", "afternoon", "evening"],
        }.get(poi["type"], ["morning", "afternoon", "evening"])
        candidates.append(InsertCandidate(
            place_id=poi["place_id"] or f"{poi['type']}_{poi.get('neighborhood', 'center')}_0",
            name=poi["name"],
            lat=poi["lat"],
            lon=poi["lon"],
            type=poi["type"],
            time_cost_min=poi["time_cost_min"],
            persona_affinity=affinity,
            trigger=None,
            time_of_day_match=time_of_day,
        ))
    return candidates


def _derive_scenic_routes(neighborhoods: list[Neighborhood]) -> list[dict]:
    """Connect adjacent neighborhoods (within 2km) as scenic walk routes."""
    routes = []
    for i, a in enumerate(neighborhoods):
        for b in neighborhoods[i + 1:]:
            dist_km = _haversine_km(a.center[0], a.center[1], b.center[0], b.center[1])
            if dist_km <= 2.0:
                walk_min = int(dist_km * 15)
                routes.append({
                    "id": f"{a.id}_to_{b.id}",
                    "from_neighborhood": a.id,
                    "to_neighborhood": b.id,
                    "walk_min": max(walk_min, 5),
                    "score": round(max(0.5, 1.0 - dist_km / 2.0), 2),
                })
    return routes[:3]


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in metres between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fetch_footway_density(lat: float, lon: float, radius_m: int = 5000) -> float:
    """Return pedestrian infrastructure density (km of footway per km²) for a city area.

    Queries OSM Overpass for ways tagged as pedestrian-accessible within radius_m of the
    city centre.  Sums their lengths from node geometry and normalises by the query area.

    Returns 0.0 on any failure — callers must handle gracefully.
    """
    query = (
        f"[out:json][timeout:30];"
        f"(way[\"highway\"~\"^(footway|pedestrian|path|steps|living_street)$\"]"
        f"(around:{radius_m},{lat},{lon}););"
        f"out geom;"
    )
    try:
        r = requests.post(_OVERPASS_URL, data={"data": query}, timeout=35)
        r.raise_for_status()
        elements = r.json().get("elements", [])
    except Exception as e:
        print(f"FOOTWAY DENSITY: Overpass failed — {e}")
        return 0.0

    total_m = 0.0
    for way in elements:
        geom = way.get("geometry", [])
        for j in range(len(geom) - 1):
            total_m += _haversine_m(
                geom[j]["lat"], geom[j]["lon"],
                geom[j + 1]["lat"], geom[j + 1]["lon"],
            )

    area_km2 = math.pi * (radius_m / 1000) ** 2
    return (total_m / 1000) / area_km2  # km of footway per km²


def _walk_base_km_from_density(density: float) -> float:
    """Convert footway density (km/km²) to a walk-threshold baseline (km).

    Uses a logarithmic scale so differences at low density matter more than at high density.
    Clamps to [1.0, 6.0] km.

    Calibration reference points:
      density ~0.5  → 1.0 km  (car-centric: Dubai, Phoenix)
      density ~2    → 2.2 km  (mixed: Bangkok, Mumbai)
      density ~5    → 3.6 km  (walkable: Paris, NYC)
      density ~8    → 4.4 km  (very walkable: Amsterdam, Tokyo)
      density ~15+  → 5.5 km  (pedestrian-first: Venice, Prague old town)
    """
    return min(6.0, max(1.0, math.log(1 + density) * 2.0))


def fetch_overpass(query: str) -> dict:
    """Minimal Overpass API wrapper — independently patchable for tests."""
    resp = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _seed_city_osm_features(
    city_id: str,
    center_lat: float,
    center_lon: float,
    radius_km: float = 15.0,
    supabase=None,
) -> None:
    """Fetch OSM features for the full city area and cache to city_osm_features.

    Radius is 15 km — covers most city centres. Cache TTL is 7 days (checked
    by _fetch_route_character before trusting the cache).
    """
    from datetime import datetime, timezone

    # 1 degree ≈ 111 km
    delta = radius_km / 111.0
    s = center_lat - delta
    n = center_lat + delta
    w = center_lon - delta
    e = center_lon + delta

    query = f"""[out:json][timeout:30][bbox:{s},{w},{n},{e}];
(
  node["natural"~"wood|water|wetland|tree|grassland|scrub|beach"];
  node["tourism"="viewpoint"];
  node["historic"~"monument|memorial|castle|ruins|building"];
  node["amenity"~"bar|nightclub|restaurant|cafe|marketplace"];
  node["tourism"~"artwork|gallery|museum|attraction"];
  node["waterway"~"river|stream|canal"];
  node["amenity"~"community_centre|social_facility|library"];
);
out tags center;"""

    try:
        resp = fetch_overpass(query)
        elements = resp.get("elements", [])
    except Exception as exc:
        print(f"[city_osm] seed failed for {city_id}: {exc}")
        return

    if not supabase:
        return

    try:
        supabase.table("city_osm_features").upsert({
            "city_id": city_id,
            "elements": elements,
            "bbox_s": s, "bbox_w": w, "bbox_n": n, "bbox_e": e,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="city_id").execute()
        print(f"[city_osm] seeded {len(elements)} elements for {city_id}")
    except Exception as exc:
        print(f"[city_osm] upsert failed for {city_id}: {exc}")


def build_city_seed(city_entry: dict, supabase=None) -> CityData:
    """Build a CityData from real external sources. ~3–4s on cold city.

    Args:
        city_entry: dict with keys: city_id, name, lat, lon, country_code, timezone, tier
    """
    lat, lon = city_entry["lat"], city_entry["lon"]
    with ThreadPoolExecutor(max_workers=6) as pool:
        f_landmarks     = pool.submit(_fetch_wikidata_landmarks, city_entry)
        f_neighborhoods = pool.submit(_fetch_osm_neighborhoods, city_entry)
        f_climate       = pool.submit(_fetch_climate, city_entry)
        f_hidden        = pool.submit(_fetch_foursquare_hidden_gems, city_entry)
        f_density       = pool.submit(_fetch_footway_density, lat, lon)
        neighborhoods   = f_neighborhoods.result()
        f_pois          = pool.submit(_fetch_google_pois, city_entry, neighborhoods)
        landmarks       = f_landmarks.result()
        climate         = f_climate.result()
        hidden_gems     = f_hidden.result()
        density         = f_density.result()
        pois            = f_pois.result()

    country_mods = get_country_modifiers(city_entry["country_code"])
    insert_candidates = _build_insert_candidates(pois)
    scenic_routes = _derive_scenic_routes(neighborhoods)
    walk_base_km = _walk_base_km_from_density(density)

    city_data = load_city_from_dict({
        "id": city_entry["city_id"],
        "name": city_entry["name"],
        "tier": city_entry["tier"],
        "center": [city_entry["lat"], city_entry["lon"]],
        "timezone": city_entry.get("timezone", "UTC"),
        "climate": climate,
        "movement": {"walk_base_km": walk_base_km},
        "culture": {
            "meal_times": country_mods["meal_times"],
            "siesta": country_mods["siesta_window"] is not None,
        },
        "neighborhoods": [
            {
                "id": n.id, "name": n.name,
                "center": list(n.center),
                "polygon": [list(p) for p in n.polygon],
                "best_times": n.best_times, "crowd_index": n.crowd_index,
            }
            for n in neighborhoods
        ],
        "insert_candidates": [
            {
                "place_id": ic.place_id, "name": ic.name,
                "lat": ic.lat, "lon": ic.lon,
                "type": ic.type, "time_cost_min": ic.time_cost_min,
                "persona_affinity": ic.persona_affinity,
                "trigger": ic.trigger, "time_of_day_match": ic.time_of_day_match,
            }
            for ic in insert_candidates
        ],
        "scenic_routes": scenic_routes,
        "transit_edges": [],
        "engine_modifiers": {
            "siesta_window": country_mods["siesta_window"],
            "lunch_window_strict": country_mods["lunch_window_strict"],
            "evening_end_time": country_mods["evening_end_time"],
            "day_buffer_min": 20,  # default — refined from behavior data post-launch
        },
        "landmark_anchors": landmarks[:6],
        "hidden_gems": hidden_gems[:5],
    })

    # Warm city-level OSM cache for fast corridor scoring
    # (non-fatal: never blocks the city seed return)
    if supabase and city_entry.get("lat") and city_entry.get("lon"):
        try:
            _seed_city_osm_features(
                city_id=city_entry["city_id"],
                center_lat=city_entry["lat"],
                center_lon=city_entry["lon"],
                supabase=supabase,
            )
        except Exception as _osm_err:
            print(f"[city_osm] non-fatal seed error: {_osm_err}")

    return city_data
