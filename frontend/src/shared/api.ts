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
  const res = await fetch(`${BASE}/map-data?${params}`);
  if (!res.ok) throw new Error('map-data failed');
  return res.json();
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
): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), name, category });
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
