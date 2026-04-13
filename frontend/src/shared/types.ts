import type { LineString } from 'geojson';

// ── Screen navigation ─────────────────────────────────────────
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
  | 'ob8' | 'ob9'
  | 'persona'
  | 'destination'
  | 'map'
  | 'route'
  | 'trips'
  | 'nav'
  | 'profile';

// ── New OB answer types ───────────────────────────────────────
export type OBGroup    = 'solo' | 'couple' | 'family' | 'friends';
export type OBMood     = 'explore' | 'relax' | 'eat_drink' | 'culture';
export type OBPace     = 'slow' | 'balanced' | 'pack' | 'spontaneous';
export type OBDayOpen  = 'coffee' | 'breakfast' | 'straight' | 'grab_go';
export type OBDietary  = 'none' | 'plant_based' | 'halal' | 'kosher' | 'allergy';
export type OBBudget   = 'budget' | 'mid_range' | 'comfortable' | 'luxury';
export type OBEvening  = 'bars' | 'dinner_wind' | 'markets' | 'early';
export type OBKidFocus = 'outdoor' | 'edu' | 'food' | 'slow';
export type OBBudgetProtect = 'free_only' | 'one_splurge' | 'street_food' | 'local_transport';
export type OBFoodScene = 'street' | 'restaurant' | 'cafe' | 'bars';
export type SocialFlag  = 'solo' | 'couple' | 'family' | 'group' | 'kids';
export type DietaryFlag = 'vegan_boost' | 'meat_flag' | 'halal_certified_only'
                        | 'kosher_certified_only' | 'allergy_warning';

export interface RawOBAnswers {
  group:          OBGroup | null;
  mood:           OBMood[];           // multi-choice, up to 3
  pace:           OBPace[];           // multi-choice, up to 2
  day_open:       OBDayOpen | null;
  dietary:        OBDietary[];        // multi-choice, all selectable
  budget:         OBBudget | null;
  evening:        OBEvening | null;
  // conditional
  kid_focus?:     OBKidFocus | null;
  budget_protect?: OBBudgetProtect | null;
  food_scene?:    OBFoodScene | null;
}

export interface ResolvedConflict {
  conflict_id: 'C1' | 'C2' | 'C3' | 'C4';
  method:      'user_pick' | 'suggestion' | 'auto_blend';
  winner?:     string;
  score?:      number;
}

export type VenueType =
  | 'neighbourhood' | 'landmark' | 'viewpoint'
  | 'park' | 'spa' | 'cafe' | 'restaurant'
  | 'market' | 'street_food' | 'museum'
  | 'heritage' | 'gallery' | 'romantic'
  | 'table_for_2' | 'family' | 'communal'
  | 'social' | 'group_booking';

export interface PersonaProfile {
  // Resolved itinerary params
  stops_per_day:    number;
  time_per_stop:    number;
  venue_weights:    Partial<Record<VenueType, number>>;
  price_min:        1 | 2 | 3 | 4;
  price_max:        1 | 2 | 3 | 4;
  flexibility:      number;
  day_open:         OBDayOpen;
  day_buffer_min:   number;
  evening_type:     OBEvening;
  evening_end_time: string;
  social_flags:     SocialFlag[];
  dietary:          DietaryFlag[];
  // Conditional
  kid_focus?:       OBKidFocus;
  budget_protect?:  OBBudgetProtect;
  food_scene?:      OBFoodScene;
  // Archetype
  archetype:        string;
  // Resolution metadata
  resolved_conflicts: ResolvedConflict[];
  auto_blend:       boolean;
}

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
  country?: string;   // ISO country name from Nominatim
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
  // Google fields — present when place came from Google Nearby Search
  place_id?: string;
  rating?: number;
  open_now?: boolean;
  photo_ref?: string;
  price_level?: number;
  // Journey mode — city context stamped on fetch
  _city?: string;
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
  category?: string;
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
  editorial_summary?: string;
  top_review?: string;
}

export interface NearbyResult {
  name: string;
  address: string;
  rating?: number;
  distance_m: number;
  lat: number;
  lon: number;
  place_id: string;
}
