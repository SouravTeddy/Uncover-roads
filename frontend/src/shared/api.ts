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
} from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const API = BASE;

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
    travel_date: string;
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
  lat: number,
  lon: number,
  filters: string[] = [],
  bbox?: BBox,
): Promise<Place[]> {
  const params = new URLSearchParams({ city, lat: String(lat), lon: String(lon) });
  filters.forEach(f => params.append('filters', f));
  if (bbox) {
    const [south, north, west, east] = bbox;
    params.set('south', String(south));
    params.set('north', String(north));
    params.set('west', String(west));
    params.set('east', String(east));
  }
  const res = await fetch(`${API}/map-data?${params}`);
  if (!res.ok) throw new Error('map-data failed');
  return res.json();
}

export const api = {
  geocode: (city: string) =>
    get<GeoData>(`/geocode?city=${encodeURIComponent(city)}`),

  mapData: (city: string, lat?: number, lon?: number, filters?: string[], bbox?: BBox) => {
    if (lat !== undefined && lon !== undefined) {
      return mapData(city, lat, lon, filters, bbox);
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
};
