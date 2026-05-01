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
  | 'journey'
  | 'route'
  | 'trips'
  | 'nav'
  | 'profile'
  | 'subscription';

export interface TripPack {
  id: string;
  trips: number;
  usedTrips: number;
  expiresAt: string; // ISO date string
}

export interface NotifPrefs {
  tripReminders: boolean;
  destinationSuggestions: boolean;
  liveEventAlerts: boolean;
  appUpdates: boolean;
}

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
  // Pace override (optional — derived from OB answers)
  pace?:            OBPace;
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
  reasonSignal?: 'persona' | 'behaviour';
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
  date: string;              // ISO datetime the trip was saved
  travelDate: string | null; // ISO date of actual travel (YYYY-MM-DD)
  cityLat: number | null;
  cityLon: number | null;
  selectedPlaces: Place[];   // places user added — needed for hours re-check
  itinerary: Itinerary;
  persona: Persona;
  lastUpdateCheck: string | null; // ISO datetime of last update check
  pendingSwapCards: SwapCard[];   // unresolved day-of swap cards
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
  types?: string[];
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

// ── Journey / Multi-city ──────────────────────────────────────
export type OriginType = 'home' | 'hotel' | 'airport' | 'custom';
export type TransitMode = 'flight' | 'drive' | 'train' | 'bus';

export interface OriginPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  originType: OriginType;
  departureTime?: string;   // "HH:MM" — home: user-set, airport: landing time
  checkInTime?: string;     // "HH:MM" — hotel: from Google Places
  checkOutTime?: string;    // "HH:MM" — hotel: from Google Places
  isLongHaul?: boolean;     // airport only
}

export type JourneyLeg =
  | { type: 'origin'; place: OriginPlace }
  | {
      type: 'city';
      city: string;
      countryCode: string;
      places: Place[];
      arrivalDate?: string;   // ISO date, set after calculateArrivalDates()
      estimatedDays: number;
      advisorMessage?: string;
    }
  | {
      type: 'transit';
      mode: TransitMode;
      from: string;
      to: string;
      fromCoords: [number, number]; // [lat, lon]
      toCoords: [number, number];
      durationMinutes?: number;
      distanceKm?: number;
      advisorMessage?: string;
    };

export interface AdvisorMessage {
  id: string;
  message: string;
  trigger: string;
  timestamp: number;
}

// ── Itinerary screen redesign ─────────────────────────────────

/** A LLM-generated reference pin — shown as a ghost on the map. */
export interface ReferencePin {
  id: string;
  title: string;
  lat: number;
  lon: number;
  category: Category;
  whyRec: string;    // "Why this for you" — one persona-matched sentence
  localTip: string;  // one insider tip line
}

/** A city the user has explored, shown in the footprint chip bar. */
export interface CityFootprint {
  city: string;
  emoji: string;       // e.g. "🗼"
  pinCount: number;    // number of places explored (not added), shown in chip
  lat: number;
  lon: number;
}

/** A story card shown during city-hop loading transition. */
export interface StoryCard {
  imageUrl: string;
  headline: string;
  body: string;
  cityContext: string;  // e.g. "Tokyo → Kyoto"
}

/** A place the user has saved to favourites (heart icon), not yet added. */
export interface FavouritedPin {
  placeId: string;  // matches Place.id
  title: string;
  lat: number;
  lon: number;
  city: string;
}

/** Visual state of a pin on the explore map. */
export type PinState = 'added' | 'reference' | 'similar' | 'favourited';

// ── Pricing / subscription ────────────────────────────────────

export type UserTier = 'free' | 'pack' | 'pro';

// ── Trip intelligence ─────────────────────────────────────────

export type UpdateCardKind = 'event' | 'hours_change' | 'weather';

export interface TripUpdateCard {
  id: string;
  kind: UpdateCardKind;
  tripId: string;
  title: string;
  detail: string;
  affectedStop?: string;
  actionLabel?: string;
  severity: 'info' | 'warning';
}

export interface SwapCard {
  id: string;
  stopName: string;
  stopIdx: number;
  currentSummary: string;
  currentNote?: string;
  suggestedSummary: string;
  suggestedNote: string;
  resolved: boolean;
  choice: 'new' | 'original' | null;
}

// ── Engine architecture types (Phase 3) ──────────────────────

/**
 * 10-dimension weight vector produced by the OB resolver.
 * Used for cosine similarity archetype resolution and as engine
 * input for every sequencing/insert/swap decision.
 */
export interface EngineWeights {
  w_walk_affinity: number       // 0–1: enjoyment of walking
  w_scenic: number              // 0–1: scenic routes vs efficient
  w_efficiency: number          // 0–1: tight schedule preference
  w_food_density: number        // 0–1: frequency of food/cafe inserts
  w_culture_depth: number       // 0–1: depth at cultural sites
  w_nightlife: number           // 0–1: evening/night weighting
  w_budget_sensitivity: number  // 0–1: penalise expensive inserts
  w_crowd_aversion: number      // 0–1: avoid high-crowd times
  w_spontaneity: number         // 0–1: openness to detours
  w_rest_need: number           // 0–1: frequency of rest breaks
}

/** The 7 traveller archetypes resolved via cosine similarity against EngineWeights. */
export type ArchetypeId =
  | 'wanderer'
  | 'historian'
  | 'epicurean'
  | 'pulse'
  | 'slowtraveller'
  | 'voyager'
  | 'explorer'

/**
 * Every engine decision emits one of these messages.
 * The LLM writes the three sentences from a structured payload — it does not
 * make decisions, only narrates them.
 */
export interface EngineMessage {
  id: string                   // UUID — React key + dismiss target
  type: 'swap' | 'insert' | 'resequence' | 'weather' | 'transit' | 'advisory' | 'event'
  what: string                 // "Moved Senso-ji to 8am"
  why: string                  // "It closes at 5pm — you'd arrive at 4:30"
  consequence: string          // "You now reach Ueno with 3 hours to spare"
  dismissable: boolean
  undo_action?: string         // action key to reverse this decision
}

// ── Map exploration types (Phase 3) ──────────────────────────

/**
 * discovery_mode is set per city.
 *   anchor → full famous layer shown (essentials)
 *   deep   → famous layer de-emphasised, hidden gem pins boosted
 */
export type DiscoveryMode = 'anchor' | 'deep'

/** Which of the three simultaneous pin layers a pin belongs to. */
export type PinLayer = 'famous' | 'reference' | 'user'

/**
 * Unified pin type for the rebuilt map screen.
 * Replaces the split between Place (famous) and ReferencePin (reference)
 * and selectedPlaces (user-added).
 */
export interface MapPin {
  id: string           // unique pin ID (may be place_id for famous, uuid for reference)
  placeId: string      // Google place_id
  title: string
  lat: number
  lon: number
  layer: PinLayer
  category: Category
  saved: boolean       // ❤️ bookmarked — NOT in itinerary
  inItinerary: boolean // blue ring — user explicitly added to trip
}

/**
 * Filter chips in the map filter bar.
 *   all       → show all pins
 *   famous    → ★ Famous layer only
 *   for_you   → ✦ Reference ghost layer only
 *   culture/food/parks/nightlife → filter by category
 */
export type MapFilterChip = 'all' | 'famous' | 'for_you' | 'culture' | 'food' | 'parks' | 'nightlife'

/**
 * Context for a single city in the current trip session.
 * One CityContext per city — multi-city trips have an array of these.
 * discovery_mode is set per city when the city first loads.
 */
export interface CityContext {
  city: string
  countryCode: string
  lat: number
  lon: number
  discoveryMode: DiscoveryMode
  startDate: string | null   // ISO date "YYYY-MM-DD"
  endDate: string | null     // ISO date "YYYY-MM-DD"
  days: number               // computed from date range or 1 if no dates set
}

// ── Engine itinerary types (Phase 3) ─────────────────────────

/**
 * A single stop in an engine-built itinerary.
 * All factual fields (rating, priceLevel, weekdayText) come from Google Places.
 * whyForYou and localTip are LLM-generated (marked ✦ in UI — no factual claims).
 */
export interface EngineItineraryStop {
  id: string               // unique stop ID (UUID)
  placeId: string          // Google place_id
  title: string
  area: string             // neighbourhood name (from city data model)
  day: number              // 1-indexed
  time: string             // "09:00" — engine-assigned start time
  durationMin: number      // engine-assigned visit duration
  category: Category
  lat: number
  lon: number
  priceLevel: number | null   // 0–4 from Google Places (0 = free)
  rating: number | null       // from Google Places
  weekdayText: string[]       // from Google Places opening hours
  whyForYou: string           // LLM ✦ — persona tone only, no hours/prices/facts
  localTip: string | null     // LLM ✦ — atmosphere only
  googleMapsUrl: string | null
  website: string | null
  photoRef: string | null     // Google Places photo reference
}

/**
 * One day in an engine itinerary.
 * Travel days (isTravel: true) have no stops — the engine does not schedule
 * sightseeing during transit days.
 */
export interface EngineItineraryDay {
  day: number
  date: string               // ISO date "YYYY-MM-DD"
  city: string
  isTravel: boolean          // ✈️ travel day — no stops
  stops: EngineItineraryStop[]
  messages: EngineMessage[]  // engine decision banners for this day
}

/**
 * A complete itinerary produced by the intelligence engine.
 * personaSnapshot and archetypeSnapshot capture the weights used at
 * generation time — needed to regenerate consistently.
 */
export interface EngineItinerary {
  id: string                   // UUID
  generatedAt: string          // ISO datetime
  cities: string[]             // ordered list of cities
  days: EngineItineraryDay[]
  personaSnapshot: EngineWeights   // weights at generation time
  archetypeSnapshot: ArchetypeId
}
