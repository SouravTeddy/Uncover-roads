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
  TripContext,
} from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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

export interface ItineraryRequest {
  places: Place[];
  persona: Persona;
  tripCtx: TripContext;
  city: string;
}

export interface PersonaResponse {
  persona: Persona;
  conflicts: { has_conflicts: boolean; conflicts: string[] };
  city_profile: Record<string, unknown>;
}

export const api = {
  geocode: (city: string) =>
    get<GeoData>(`/geocode?city=${encodeURIComponent(city)}`),

  mapData: (city: string) =>
    get<Place[]>(`/map-data?city=${encodeURIComponent(city)}`),

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
      const data = await get<{ url: string | null }>(
        `/place-image?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`
      );
      return data.url ?? null;
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
