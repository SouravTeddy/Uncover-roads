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
  EngineItinerary,
} from './types';
import { supabase } from './supabase';

export const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Returns the URL of a Google Place photo via the backend proxy. */
export function getPlacePhotoUrl(photoRef: string, maxWidth = 800, maxHeight?: number): string {
  let url = `${BASE}/place-photo?photo_ref=${encodeURIComponent(photoRef)}&max_width=${maxWidth}`;
  if (maxHeight !== undefined) url += `&max_height=${maxHeight}`;
  return url;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw Object.assign(new Error(`GET ${path} → ${res.status}`), { status: res.status });
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown;
    try { detail = (await res.json()).detail; } catch { /* non-JSON body */ }
    const err = Object.assign(new Error(`POST ${path} → ${res.status}`), { status: res.status, detail });
    throw err;
  }
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
  is_rebuild?: boolean;
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
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({
    city,
    center_lat: String(centerLat),
    center_lon: String(centerLon),
    radius_m:   String(radiusM),
  });
  try {
    const res = await fetch(`${BASE}/map-data?${params}`, { signal, headers: await authHeaders() });
    if (res.ok) {
      const data: Place[] = await res.json();
      const limited = data.slice(0, 150);
      if (import.meta.env.DEV) console.log(`[mapData] ${limited.length} places for ${city}`);
      return limited;
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return [];
    console.error('[mapData] fetch failed:', err);
  }
  return [];
}

export const api = {
  picks: (cityId: string, lat?: number, lon?: number) => {
    const params = new URLSearchParams({ city_id: cityId })
    if (lat !== undefined) params.set('lat', String(lat))
    if (lon !== undefined) params.set('lon', String(lon))
    return get<unknown[]>(`/api/cities/picks?${params}`)
  },

  geocode: (city: string) =>
    get<GeoData>(`/geocode?city=${encodeURIComponent(city)}`),

  mapData: (city: string, lat?: number, lon?: number, radiusM = 3000) => {
    if (lat !== undefined && lon !== undefined) {
      return mapData(city, lat, lon, radiusM);
    }
    return get<Place[]>(`/map-data?city=${encodeURIComponent(city)}`);
  },

  recommendedPlaces: (params: {
    city: string;
    personaArchetype: string;
    venueFilters: string[];
    itineraryBias: string[];
    places: Place[];
  }) =>
    post<{ picks: Place[] }>('/recommended-places', {
      city:              params.city,
      persona_archetype: params.personaArchetype,
      venue_filters:     params.venueFilters,
      itinerary_bias:    params.itineraryBias,
      places:            params.places,
    }),

  personaInsight: (params: {
    placeTitle: string;
    placeCategory: string;
    city: string;
    personaArchetype: string;
    personaDesc: string;
    mode: 'map' | 'itinerary';
    tags?: Record<string, string>;
    priceLevel?: number;
  }) =>
    post<{ insight: string | null }>('/persona-insight', {
      place_title:       params.placeTitle,
      place_category:    params.placeCategory,
      city:              params.city,
      persona_archetype: params.personaArchetype,
      persona_desc:      params.personaDesc,
      mode:              params.mode,
      tags:              params.tags ?? {},
      price_level:       params.priceLevel ?? null,
    }),

  citySearch: (q: string) =>
    get<CityResult[]>(`/city-search?q=${encodeURIComponent(q)}`),

  route: (points: LatLon[]) =>
    post<RouteData>('/route', { points }),

  aiItinerary: (body: ItineraryRequest) =>
    post<Itinerary>('/ai-itinerary', body),

  engineItinerary: {
    // Legacy synchronous build — kept for fallback, not called from frontend anymore
    build: (body: { city: string; lat: number; lon: number; days: number; startDate: string; selectedPlaces: unknown[]; personaArchetype: string; engineWeights: null; cities?: string[]; arrivalTime: string | null; departureTime: string | null; startType: string }) =>
      post<EngineItinerary>('/engine-itinerary', body),
    // Background build — returns immediately with buildId
    start: (body: { city: string; lat: number; lon: number; days: number; startDate: string; selectedPlaces: unknown[]; personaArchetype: string; engineWeights: Record<string, number> | null; cities?: string[]; arrivalTime: string | null; departureTime: string | null; startType: string; rawOBAnswers: import('./types').RawOBAnswers | null }) =>
      post<{ buildId: string; status: string }>('/engine-itinerary/start', body),
    // Poll build status
    status: (buildId: string) =>
      get<{ buildId: string; status: string; result: EngineItinerary | null; error: string | null; updatedAt: string }>(`/engine-itinerary/status/${buildId}`),
  },

  surpriseMe: (body: {
    start_city_id: string
    end_city_id: string
    start_date?: string
    end_date?: string
    persona: string
  }) =>
    post<EngineItinerary>('/api/surprise-me', body),

  weather: (city: string) =>
    get<WeatherData>(`/weather?city=${encodeURIComponent(city)}`),

  cityPhotos: async (cities: string[]): Promise<Record<string, string | null>> => {
    if (cities.length === 0) return {};
    try {
      const params = new URLSearchParams({ names: cities.join(',') });
      const res = await fetch(`${BASE}/api/cities/photos?${params}`, { headers: await authHeaders() });
      return res.ok ? res.json() : {};
    } catch { return {}; }
  },

  placeImage: async (name: string, city: string, pid?: string): Promise<string | null> => {
    try {
      const pidParam = pid ? `&pid=${encodeURIComponent(pid)}` : '';
      const data = await get<{ image: string | null }>(
        `/place-image?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}${pidParam}`
      );
      if (!data.image) return null;
      // /place-image may return a relative path like "/place-photo?..." — make it absolute
      return data.image.startsWith('/') ? `${BASE}${data.image}` : data.image;
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
    return get<{ places: Place[] }>(`/events?${params}`).then(d => d.places ?? []);
  },

  referencePins: async (params: {
    city: string;
    personaArchetype: string;
    days: number;
    prevCity?: string;
    prevPicks?: string[];
  }): Promise<{ pins: import('./types').ReferencePin[]; storyCards: import('./types').StoryCard[] }> => {
    return post('/reference-pins', {
      city: params.city,
      persona_archetype: params.personaArchetype,
      days: params.days,
      prev_city: params.prevCity ?? '',
      prev_picks: params.prevPicks ?? [],
    });
  },

  nearbyPlaces: async (opts: { lat: number; lon: number; category: string; limit: number }): Promise<Place[]> => {
    try {
      const params = new URLSearchParams({
        lat:      String(opts.lat),
        lon:      String(opts.lon),
        type:     opts.category,
        radius:   '1000',
        limit:    String(opts.limit),
      });
      const res = await fetch(`${BASE}/nearby?${params}`, { headers: await authHeaders() });
      if (!res.ok) return [];
      const data: NearbyResult[] = await res.json();
      return (Array.isArray(data) ? data : []).map(r => ({
        id:       r.place_id ?? `nr-${r.name}`,
        title:    r.name,
        lat:      r.lat,
        lon:      r.lon,
        category: opts.category as Place['category'],
        tags:     {},
      }));
    } catch { return []; }
  },

  recalibrate: async (params: {
    stops: import('./types').ItineraryStop[];
    currentTime: string;
    persona: string;
    pace: string;
    city: string;
    lat: number;
    lon: number;
    travelDate: string;
  }): Promise<{ swap_cards: import('./types').SwapCard[] }> => {
    const raw = await post<{ swap_cards: Array<{
      id: string;
      stop_name: string;
      stop_idx: number;
      current_summary: string;
      current_note?: string;
      suggested_summary: string;
      suggested_note: string;
      resolved: boolean;
      choice: 'new' | 'original' | null;
    }> }>('/recalibrate', {
      stops:        params.stops,
      current_time: params.currentTime,
      persona:      params.persona,
      pace:         params.pace,
      city:         params.city,
      lat:          params.lat,
      lon:          params.lon,
      travel_date:  params.travelDate,
    });
    return {
      swap_cards: (raw.swap_cards ?? []).map(c => ({
        id:               c.id,
        stopName:         c.stop_name,
        stopIdx:          c.stop_idx,
        currentSummary:   c.current_summary,
        currentNote:      c.current_note,
        suggestedSummary: c.suggested_summary,
        suggestedNote:    c.suggested_note,
        resolved:         c.resolved,
        choice:           c.choice,
      })),
    };
  },
};

// Note: backend param is 'query' (not 'input') — renamed to avoid Python builtin shadow
export async function placesAutocomplete(
  query: string,
  sessionId: string,
  types = '',
  lat?: number,
  lon?: number,
): Promise<AutocompleteResult[]> {
  const params = new URLSearchParams({ query, session_id: sessionId, types });
  if (lat != null && lon != null) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }
  const res = await fetch(`${BASE}/places-autocomplete?${params}`, { headers: await authHeaders() });
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
  const res = await fetch(`${BASE}/geocode-place?${params}`, { headers: await authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.lat || !data.lon) return null;
  return data;
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({ place_id: placeId });
  const res = await fetch(`${BASE}/place-details?${params}`, { headers: await authHeaders() });
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
  const res = await fetch(`${BASE}/find-place-id?${params}`, { headers: await authHeaders() });
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
  const res = await fetch(`${BASE}/pin-details?${params}`, { headers: await authHeaders() });
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
  const res = await fetch(`${BASE}/nearby?${params}`, { headers: await authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function searchNearby(
  lat: number,
  lon: number,
  type: string,
  radius: number,
  limit: number,
): Promise<NearbyResult[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    type,
    radius: String(radius),
    limit: String(limit),
  });
  const res = await fetch(`${BASE}/nearby?${params}`, { headers: await authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export interface InterCityRouteResult {
  duration_min: number;
  distance_km: number;
}

/**
 * Resolves the city/state/country for a lat/lon via the backend.
 * Backend uses Google Geocoding API (authoritative, structured) with
 * Nominatim as fallback, and caches results server-side.
 * Returns null if both providers fail.
 */
export async function reverseGeocodeCity(
  lat: number,
  lon: number,
): Promise<{ city: string | null; state: string | null; country: string | null } | null> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    const res = await fetch(`${BASE}/api/geocode/reverse?${params}`, { headers: await authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Calls the backend /route endpoint (OSRM) between two lat/lon points.
 * Returns null if OSRM has no road route (e.g. ocean crossing).
 */
export async function routeInterCity(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): Promise<InterCityRouteResult | null> {
  try {
    const result = await post<{ summary?: { duration_min: number; distance_km: number }; error?: string }>(
      '/route',
      { points: [{ lat: fromLat, lon: fromLon }, { lat: toLat, lon: toLon }] },
    );
    if (result.error || !result.summary) return null;
    return { duration_min: result.summary.duration_min, distance_km: result.summary.distance_km };
  } catch {
    return null;
  }
}

export async function fetchRouteProfile(
  originLat: number, originLon: number,
  destLat: number, destLon: number,
): Promise<import('../modules/route/reel/types').RouteProfile | null> {
  try {
    const params = new URLSearchParams({
      origin_lat: String(originLat), origin_lon: String(originLon),
      dest_lat: String(destLat), dest_lon: String(destLon),
    });
    const res = await fetch(`${BASE}/route-profile?${params}`, { headers: await authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function* aiItineraryStream(
  body: ItineraryRequest,
): AsyncGenerator<Itinerary> {
  const res = await fetch(`${BASE}/ai-itinerary-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Stream ${res.status}`);
  if (!res.body) throw new Error('Stream response has no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) yield JSON.parse(trimmed) as Itinerary;
    }
  }
  // flush remaining buffer (last line without trailing newline)
  if (buffer.trim()) yield JSON.parse(buffer.trim()) as Itinerary;
}
