import type {
  GeoData,
  Place,
  CityResult,
  RouteData,
  LatLon,
  Itinerary,
  WeatherData,
  Persona,
  OnboardingAnswers,
  AutocompleteResult,
  PlaceDetails,
  NearbyResult,
} from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Returns the URL of a Google Place photo via the backend proxy. */
export function getPlacePhotoUrl(photoRef: string, maxWidth = 800): string {
  return `${BASE}/place-photo?photo_ref=${encodeURIComponent(photoRef)}&max_width=${maxWidth}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

export type BBox = [number, number, number, number]; // [south, north, west, east]

export interface ItineraryRequest {
  city: string;
  lat: number;
  lon: number;
  days: number;
  day_number: number;
  pace: string;
  persona: string;
  persona_archetype: string;
  persona_context: string;
  trip_context: {
    start_type: string;
    arrival_time: string | null;
    travel_date: string | null;
    total_days?: number;
    flight_time: string | null;
    is_long_haul: boolean;
    location_lat: number | null;
    location_lon: number | null;
    location_name: string | null;
  };
  selected_places?: Array<{ id: string; title: string; lat?: number; lon?: number }>;
  conflict_resolution?: string;
}

export interface PersonaResponse {
  persona: Persona;
  conflicts: { has_conflicts: boolean; conflicts: string[] };
  city_profile: Record<string, unknown>;
}

// ── Client-side Overpass fallback ────────────────────────────────────────────
// Used when backend /map-data returns empty (e.g. no Google API key on server)

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

function _overpassCategory(tags: Record<string, string>): string {
  const amenity = tags.amenity ?? '';
  const tourism = tags.tourism ?? '';
  const leisure = tags.leisure ?? '';
  const historic = tags.historic ?? '';
  if (amenity === 'restaurant' || amenity === 'bar' || amenity === 'food_court' || tags.cuisine) return 'restaurant';
  if (amenity === 'cafe') return 'cafe';
  if (amenity === 'museum' || tourism === 'museum') return 'museum';
  if (leisure === 'park' || leisure === 'garden' || leisure === 'nature_reserve') return 'park';
  if (historic) return 'historic';
  if (tourism === 'attraction' || tourism === 'artwork' || tourism === 'viewpoint' || tourism === 'gallery') return 'tourism';
  return 'place';
}

async function _fetchOverpassMapData(lat: number, lon: number, radiusM: number): Promise<Place[]> {
  const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|bar|food_court"]["name"](around:${radiusM},${lat},${lon});node["amenity"="museum"]["name"](around:${radiusM},${lat},${lon});way["amenity"="museum"]["name"](around:${radiusM},${lat},${lon});node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:${radiusM},${lat},${lon});node["leisure"~"park|garden|nature_reserve"]["name"](around:${radiusM},${lat},${lon});node["historic"]["name"](around:${radiusM},${lat},${lon}););out center 200;`;

  for (const endpoint of OVERPASS_MIRRORS) {
    try {
      console.log(`[Overpass] trying ${endpoint}`);
      // Use GET to avoid any CORS preflight issues
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(18_000) });
      console.log(`[Overpass] ${endpoint} → ${res.status}`);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.startsWith('{')) {
        console.warn(`[Overpass] ${endpoint} returned non-JSON`);
        continue;
      }
      const data = JSON.parse(text);
      const elements: unknown[] = Array.isArray(data.elements) ? data.elements : [];
      console.log(`[Overpass] ${endpoint} → ${elements.length} elements`);

      const seen = new Set<string>();
      const places: Place[] = [];
      for (const el of elements) {
        const e = el as Record<string, unknown>;
        const tags = (e.tags ?? {}) as Record<string, string>;
        const name = (
          tags['name:en'] || tags['int_name'] || tags['name:ja_rm'] || tags['name:ko_rm'] || tags['name'] || ''
        ).trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const elLat = (e.lat ?? (e.center as Record<string, number> | undefined)?.lat) as number | undefined;
        const elLon = (e.lon ?? (e.center as Record<string, number> | undefined)?.lon) as number | undefined;
        if (elLat == null || elLon == null) continue;

        places.push({
          id: `osm-${e.type ?? 'n'}-${e.id ?? name}`,
          title: name,
          lat: elLat,
          lon: elLon,
          category: _overpassCategory(tags) as Place['category'],
          tags: {
            opening_hours: tags.opening_hours ?? '',
            website: tags.website ?? '',
            cuisine: tags.cuisine ?? '',
            description: tags.description ?? '',
          },
        });
      }
      console.log(`[Overpass] parsed ${places.length} places`);
      if (places.length > 0) return places;
      // 0 results from this mirror — try next (could be a temporary issue)
    } catch (err) {
      console.error(`[Overpass] ${endpoint} failed:`, err);
    }
  }
  console.error('[Overpass] all mirrors failed or returned 0 results');
  return [];
}

export async function mapData(
  city: string,
  centerLat: number,
  centerLon: number,
  radiusM = 3000,
): Promise<Place[]> {
  const params = new URLSearchParams({
    city,
    center_lat: String(centerLat),
    center_lon: String(centerLon),
    radius_m:   String(radiusM),
  });
  try {
    const res = await fetch(`${BASE}/map-data?${params}`);
    console.log(`[mapData] backend → ${res.status}`);
    if (res.ok) {
      const data: Place[] = await res.json();
      console.log(`[mapData] backend returned ${data.length} places`);
      if (data.length > 0) return data;
    }
  } catch (err) {
    console.error('[mapData] backend fetch failed:', err);
  }
  // Backend returned empty or failed — call Overpass directly from browser
  console.log('[mapData] falling back to client-side Overpass');
  return _fetchOverpassMapData(centerLat, centerLon, radiusM);
}

export const api = {
  geocode: (city: string) =>
    get<GeoData>(`/geocode?city=${encodeURIComponent(city)}`),

  mapData: (city: string, lat?: number, lon?: number, radiusM = 3000) => {
    if (lat !== undefined && lon !== undefined) {
      return mapData(city, lat, lon, radiusM);
    }
    return get<Place[]>(`/map-data?city=${encodeURIComponent(city)}`);
  },

  recommended: (city: string, persona: Persona) =>
    get<Place[]>(
      `/recommended-places?city=${encodeURIComponent(city)}&persona=${encodeURIComponent(JSON.stringify(persona))}`
    ),

  citySearch: (q: string) =>
    get<CityResult[]>(`/city-search?q=${encodeURIComponent(q)}`),

  route: (points: LatLon[]) =>
    post<RouteData>('/route', { points }),

  aiItinerary: (body: ItineraryRequest) =>
    post<Itinerary>('/ai-itinerary', body),

  weather: (city: string) =>
    get<WeatherData>(`/weather?city=${encodeURIComponent(city)}`),

  placeImage: async (name: string, city: string): Promise<string | null> => {
    try {
      const data = await get<{ image: string | null }>(
        `/place-image?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`
      );
      return data.image ?? null;
    } catch {
      return null;
    }
  },

  persona: (answers: OnboardingAnswers, city: string) =>
    post<PersonaResponse>('/persona', { ob_answers: answers, city }),

  cityProfile: (city: string) =>
    get<{ profile: Record<string, unknown> }>(
      `/city-profile?city=${encodeURIComponent(city)}`
    ),

  events: (city: string, startDate: string, endDate: string, lat?: number, lon?: number) => {
    const params = new URLSearchParams({
      city,
      start_date: startDate,
      end_date:   endDate,
    });
    if (lat !== undefined) params.set('lat', String(lat));
    if (lon !== undefined) params.set('lon', String(lon));
    return get<Place[]>(`/events?${params}`);
  },
};

// Note: backend param is 'query' (not 'input') — renamed to avoid Python builtin shadow
export async function placesAutocomplete(
  query: string,
  sessionId: string,
  types = '',
): Promise<AutocompleteResult[]> {
  const params = new URLSearchParams({ query, session_id: sessionId, types });
  const res = await fetch(`${BASE}/places-autocomplete?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const predictions = data.predictions;
  return Array.isArray(predictions) ? predictions : [];
}

export async function geocodePlace(
  placeId: string,
  sessionId: string
): Promise<{ lat: number; lon: number; name: string; address: string } | null> {
  const params = new URLSearchParams({ place_id: placeId, session_id: sessionId });
  const res = await fetch(`${BASE}/geocode-place?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.lat || !data.lon) return null;
  return data;
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({ place_id: placeId });
  const res = await fetch(`${BASE}/place-details?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.place_id) return null;
  return data as PlaceDetails;
}

export async function findPlaceId(
  name: string,
  lat: number,
  lon: number
): Promise<string | null> {
  const params = new URLSearchParams({ name, lat: String(lat), lon: String(lon) });
  const res = await fetch(`${BASE}/find-place-id?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.place_id ?? null;
}

/** Single round-trip: resolves place_id from coords then fetches full details. */
export async function fetchPinDetails(
  lat: number,
  lon: number,
  name: string,
  category = '',
  placeId = '',
): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), name, category });
  if (placeId) params.set('place_id', placeId);
  const res = await fetch(`${BASE}/pin-details?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.place_id) return null;
  return data as PlaceDetails;
}

export async function fetchNearby(
  lat: number,
  lon: number,
  type: string,
): Promise<NearbyResult[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    type,
    radius: '500',
    limit: '3',
  });
  const res = await fetch(`${BASE}/nearby?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
