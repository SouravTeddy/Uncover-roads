import type { LineString } from 'geojson';

// ── Screen navigation ─────────────────────────────────────────
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5'
  | 'persona'
  | 'destination'
  | 'map'
  | 'route'
  | 'trips'
  | 'nav'
  | 'profile';

// ── Onboarding answers ────────────────────────────────────────
export type Ritual = 'coffee' | 'tea' | 'alcohol' | 'neither';
export type Sensory = 'visual' | 'taste' | 'history' | 'movement';
export type TravelStyle = 'planner' | 'spontaneous' | 'balanced' | 'local';
export type Attraction = 'historic' | 'culture' | 'markets' | 'nature';
export type Pace = 'walking' | 'transit' | 'self' | 'any';
export type Social = 'solo' | 'couple' | 'group' | 'family';

export interface OnboardingAnswers {
  ritual: Ritual | null;
  sensory: Sensory | null;
  style: TravelStyle | null;
  attractions: Attraction[];
  pace: Pace | null;
  social: Social | null;
}

// ── Persona ───────────────────────────────────────────────────
export interface PersonaTraits {
  artistic: number;
  artistic_exp: string;
  culinary: number;
  culinary_exp: string;
  efficiency: number;
  efficiency_exp: string;
  urban: number;
  urban_exp: string;
}

export interface PersonaArchetypeData {
  name: string;
  desc: string;
  venue_filters: string[];
  itinerary_bias: string[];
}

export interface TopMatch {
  arch: string;
  pct: number;
}

export interface Persona {
  archetype: string;
  archetype_name: string;
  archetype_desc: string;
  ritual: Ritual | null;
  sensory: Sensory | null;
  style: TravelStyle | null;
  attractions: Attraction[];
  pace: Pace | null;
  social: Social | null;
  insight?: string;
  traits?: PersonaTraits;
  top_matches?: TopMatch[];
  archetypeData: PersonaArchetypeData;
  venue_filters: string[];
  itinerary_bias: string[];
}

// ── Geo ───────────────────────────────────────────────────────
export interface GeoData {
  lat: number;
  lon: number;
  bbox: [number, number, number, number]; // south, north, west, east
}

// ── Places / Map ──────────────────────────────────────────────
export type Category = 'restaurant' | 'cafe' | 'park' | 'museum' | 'historic' | 'tourism' | 'place' | 'event';
export type MapFilter = Category | 'all' | 'recommended';

export interface Place {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  imageUrl?: string | null;
  reason?: string;
}

// ── Trip context ──────────────────────────────────────────────
export type StartType = 'hotel' | 'airport' | 'station' | 'airbnb' | 'pin';

export interface TripContext {
  startType: StartType;
  arrivalTime: string | null;      // "HH:MM"
  date: string;                    // ISO date string
  days: number;
  dayNumber: number;
  flightTime: string | null;       // "HH:MM"
  isLongHaul: boolean;
  locationLat: number | null;
  locationLon: number | null;
  locationName: string | null;
}

// ── Itinerary ─────────────────────────────────────────────────
export interface ItineraryStop {
  place: string;
  day?: number;
  time?: string;
  lat?: number;
  lon?: number;
  tip?: string;
  duration?: string;
  transit_to_next?: string;
  tags?: string[];
}

export interface ItinerarySummary {
  total_places?: number;
  best_transport?: string;
  pro_tip?: string;
  conflict_notes?: string;
  suggested_start_time?: string;
  day_narrative?: string;
}

export interface Itinerary {
  itinerary: ItineraryStop[];
  summary?: ItinerarySummary;
  city?: string;
}

// ── Weather ───────────────────────────────────────────────────
export interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
}

// ── Route ─────────────────────────────────────────────────────
export interface LatLon {
  lat: number;
  lon: number;
}

export interface RouteData {
  geojson?: LineString;
  distance?: number;
  duration?: number;
}

// ── Saved itineraries ─────────────────────────────────────────
export interface SavedItinerary {
  id: string;
  city: string;
  date: string;
  itinerary: Itinerary;
  persona: Persona;
}

// ── City search ───────────────────────────────────────────────
export interface CityResult {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

// ── Google Places ─────────────────────────────────────────────
export interface AutocompleteResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  rating?: number;
  rating_count?: number;
  phone?: string;
  website?: string;
  price_level?: number; // 0 = free, 1–4 = $ to $$$$
  open_now?: boolean;
  weekday_text?: string[];
  photo_ref?: string;
  types?: string[];
  error?: string;
}
