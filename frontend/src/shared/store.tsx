import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type {
  Screen,
  OnboardingAnswers,
  Persona,
  GeoData,
  Place,
  MapFilter,
  TripContext,
  Itinerary,
  WeatherData,
  RouteData,
  SavedItinerary,
  RawOBAnswers,
  PersonaProfile,
  ResolvedConflict,
  JourneyLeg,
  AdvisorMessage,
  OriginPlace,
  UserTier,
  TripPack,
  NotifPrefs,
  ReferencePin,
  FavouritedPin,
  CityFootprint,
  EngineMessage,
  DiscoveryMode,
  MapFilterChip,
  CityContext,
  EngineItinerary,
  SavedEvent,
  ActiveBuild,
} from './types';

// ── State ─────────────────────────────────────────────────────

const defaultTripCtx: TripContext = {
  startType: 'hotel',
  arrivalTime: null,
  date: new Date().toISOString().split('T')[0],
  days: 1,
  dayNumber: 1,
  flightTime: null,
  isLongHaul: false,
  locationLat: null,
  locationLon: null,
  locationName: null,
};

const defaultObAnswers: OnboardingAnswers = {
  ritual: null,
  sensory: null,
  style: null,
  attractions: [],
  pace: null,
  social: null,
};

export interface AppState {
  theme: 'dark' | 'light';
  currentScreen: Screen;
  screenStack: Screen[];
  obAnswers: OnboardingAnswers;
  rawOBAnswers: RawOBAnswers | null;
  personaProfile: PersonaProfile | null;
  obPreResolved: ResolvedConflict[];
  persona: Persona | null;
  city: string;
  cityGeo: GeoData | null;
  places: Place[];
  selectedPlaces: Place[];
  activeFilter: MapFilter | 'all';
  recoFocusPlaces: Place[] | null;
  tripContext: TripContext;
  itinerary: Itinerary | null;
  itineraryDays: (Itinerary | null)[];
  travelStartDate: string | null;
  travelEndDate: string | null;
  weather: WeatherData | null;
  route: RouteData | null;
  savedItineraries: SavedItinerary[];
  userRole: 'user' | 'admin';
  userTier: UserTier;
  packTripsRemaining: number;
  autoReplenish: boolean;
  generationCount: number;
  profileLoaded: boolean;
  tripPacks: TripPack[];
  packPurchaseCount: number;
  notifPrefs: NotifPrefs;
  units: 'km' | 'miles';
  journey: JourneyLeg[] | null;
  journeyBudgetDays: number | null;
  advisorMessages: AdvisorMessage[];
  pendingActivePlace: Place | null;
  referencePins: ReferencePin[];
  favouritedPins: FavouritedPin[];
  cityFootprints: CityFootprint[];
  similarPinsState: { sourcePlaceId: string; similarIds: string[] } | null;
  savedEvents: SavedEvent[];
  liveEvents: import('./types').LiveEvent[];
  cityCountries: Record<string, string> // city name → country name, built up as cities are selected
  // ── Phase 3: new architecture fields ─────────────────────────
  cityContexts: CityContext[]          // one per city in current multi-city trip
  activeCityIndex: number              // index into cityContexts — which city is active
  engineMessages: EngineMessage[]      // current session engine decision banners (transient)
  engineItinerary: EngineItinerary | null  // current engine-built itinerary
  hasBuiltThisSession: boolean         // true after first build; resets on page load (not persisted)
  itineraryHistory: EngineItinerary[]  // previous generations — max 10
  activePinId: string | null           // which pin card is currently shown
  mapFilter: MapFilterChip             // active filter chip in the map filter bar
  reelSavedId: string | null;
  tripsActiveTab: 'current' | 'saved' | 'places';
  activeBuild: ActiveBuild | null;
  pendingTripDetails: import('./types').TripDetails | null;
  dismissedPinIds: string[];
  recoInteractions: Array<{
    recoId: string; dimension: string; archetype: string;
    action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan';
    conflictPresent: boolean; significance: number;
    signalSnapshot: { archetype: string; pace: string; densityScore: number | null; dayNumber: number; weather: string | null };
    timestamp: string;
  }>;
}

// ── Trip-state persistence (localStorage — survives refreshes, PWA restarts) ──

// Bump this when the shape of any stored key changes incompatibly.
// On mismatch, session/nav state is cleared so stale data can't crash the app.
// Saved itineraries and user profile keys are intentionally NOT cleared.
const SCHEMA_VERSION = 1;
const _SESSION_KEYS = [
  'ur_ss_screen', 'ur_ss_city', 'ur_ss_places', 'ur_ss_sel',
  'ur_ss_geo', 'ur_ss_engine_itin', 'ur_ss_active_build',
  'ur_ss_footprints', 'ur_ss_ts',
];
(function migrateStorage() {
  try {
    if (localStorage.getItem('ur_schema_v') === String(SCHEMA_VERSION)) return;
    for (const key of _SESSION_KEYS) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    localStorage.setItem('ur_schema_v', String(SCHEMA_VERSION));
  } catch { /* ignore — private mode or storage unavailable */ }
})();

function ssGet<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

const SESSION_IDLE_MS = 60 * 60 * 1000; // 1 hour — reopen after this → explore tab

function ssSave(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Track when the session was last active so idle reopens land on Explore
    if (key === 'ur_ss_screen') localStorage.setItem('ur_ss_ts', String(Date.now()));
  } catch { /* ignore */ }
}

function getInitialScreen(): Screen {
  try {
    // Primary signal: a flag set by signInWithGoogle() before the OAuth
    // redirect. Session storage survives same-tab redirects, so this is
    // 100% reliable regardless of URL param stripping or auth-event timing.
    if (sessionStorage.getItem('ur_auth_pending') === '1') {
      sessionStorage.removeItem('ur_auth_pending');
      return 'login';
    }
    // Fallback: detect OAuth redirect via ?code= / #access_token= in URL.
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || window.location.hash.includes('access_token=')) {
      return 'login';
    }
    const hasCompletedOB = localStorage.getItem('ur_persona') || localStorage.getItem('ur_ob_done');
    if (hasCompletedOB) {
      try {
        // After an idle session, always land on Explore rather than restoring
        // whatever screen the user last had open
        const lastTs = Number(localStorage.getItem('ur_ss_ts') ?? 0);
        if (lastTs && Date.now() - lastTs > SESSION_IDLE_MS) {
          return 'destination';
        }

        const lastScreen = localStorage.getItem('ur_ss_screen');
        if (lastScreen) {
          const parsed = JSON.parse(lastScreen) as Screen;
          if (parsed === 'itinerary-reel' && localStorage.getItem('ur_ss_engine_itin')) {
            return 'trips'; // reel is now inside the trips screen (Current tab)
          }
          if (parsed !== 'itinerary-reel' && parsed !== 'login' && parsed !== 'trips') {
            return parsed;
          }
        }
      } catch { /* ignore — fall through to destination */ }
      return 'destination';
    }
  } catch {
    // ignore
  }
  return 'login';
}

function getStoredPersona(): Persona | null {
  try {
    const stored = localStorage.getItem('ur_persona');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<Persona>;
    // Reject stubs written by SET_PERSONA_PROFILE (they lack venue_filters)
    if (!parsed.venue_filters || parsed.venue_filters.length === 0 && !parsed.archetypeData) return null;
    return parsed as Persona;
  } catch {
    return null;
  }
}

function getStoredRawOBAnswers(): RawOBAnswers | null {
  try {
    const stored = localStorage.getItem('ur_raw_ob_answers');
    return stored ? (JSON.parse(stored) as RawOBAnswers) : null;
  } catch {
    return null;
  }
}

function getStoredPersonaProfile(): PersonaProfile | null {
  try {
    const stored = localStorage.getItem('ur_persona_profile');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getStoredItineraries(): SavedItinerary[] {
  try {
    const stored = localStorage.getItem('ur_saved_itineraries');
    const items = stored ? (JSON.parse(stored) as SavedItinerary[]) : [];
    // Backfill new fields for itineraries saved before this version
    return items.map(rawItem => {
      const item = rawItem as unknown as Record<string, unknown>;
      return {
        travelDate: null,
        cityLat: null,
        cityLon: null,
        selectedPlaces: [],
        lastUpdateCheck: null,
        pendingSwapCards: [],
        ...item,
      } as unknown as SavedItinerary;
    });
  } catch {
    return [];
  }
}

function getStoredGenerationCount(): number {
  try {
    const stored = localStorage.getItem('ur_gen_count');
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

function getStoredUserRole(): 'user' | 'admin' {
  try {
    return localStorage.getItem('ur_user_role') === 'admin' ? 'admin' : 'user';
  } catch {
    return 'user';
  }
}

function getStoredTier(): UserTier {
  try {
    const v = localStorage.getItem('ur_user_tier');
    if (v === 'pack' || v === 'pro') return v;
    return 'free';
  } catch { return 'free'; }
}

function getStoredTripPacks(): TripPack[] {
  try {
    const v = localStorage.getItem('ur_trip_packs');
    return v ? (JSON.parse(v) as TripPack[]) : [];
  } catch { return []; }
}

function getStoredPackPurchaseCount(): number {
  try {
    const v = localStorage.getItem('ur_pack_count');
    if (!v) return 0;
    const parsed = parseInt(v, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch { return 0; }
}

function getStoredNotifPrefs(): NotifPrefs {
  try {
    const v = localStorage.getItem('ur_notif_prefs');
    return v ? (JSON.parse(v) as NotifPrefs) : {
      tripReminders: true,
      destinationSuggestions: true,
      liveEventAlerts: false,
      appUpdates: true,
    };
  } catch {
    return { tripReminders: true, destinationSuggestions: true, liveEventAlerts: false, appUpdates: true };
  }
}

function getStoredUnits(): 'km' | 'miles' {
  try {
    return localStorage.getItem('ur_units') === 'miles' ? 'miles' : 'km';
  } catch { return 'km'; }
}

const _initialScreen = getInitialScreen();
export const initialState: AppState = {
  theme: 'dark',
  currentScreen: _initialScreen,
  screenStack: [_initialScreen],
  obAnswers: defaultObAnswers,
  rawOBAnswers: getStoredRawOBAnswers(),
  personaProfile: getStoredPersonaProfile(),
  obPreResolved: [],
  persona: getStoredPersona(),
  city:           ssGet<string>('ur_ss_city')    ?? '',
  cityGeo:        (() => { const g = ssGet<GeoData>('ur_ss_geo'); return (g && typeof g.lat === 'number' && isFinite(g.lat) && typeof g.lon === 'number' && isFinite(g.lon)) ? g : null; })(),
  places:         ssGet<Place[]>('ur_ss_places') ?? [],
  selectedPlaces: ssGet<Place[]>('ur_ss_sel')    ?? [],
  activeFilter:   'all',
  recoFocusPlaces: null,
  tripContext: defaultTripCtx,
  itinerary:       ssGet<Itinerary>('ur_ss_itinerary')         ?? null,
  itineraryDays:   ssGet<(Itinerary | null)[]>('ur_ss_itin_days') ?? [],
  travelStartDate: ssGet<string>('ur_ss_start_date')           ?? null,
  travelEndDate:   ssGet<string>('ur_ss_end_date')             ?? null,
  weather: ssGet<WeatherData>('ur_ss_weather') ?? null,
  route: null,
  savedItineraries: getStoredItineraries(),
  userRole: getStoredUserRole(),
  userTier: getStoredTier(),
  packTripsRemaining: (ssGet<number>('ur_ss_pack_trips') ?? 0),
  autoReplenish: (ssGet<boolean>('ur_ss_auto_replenish') ?? false),
  generationCount: getStoredGenerationCount(),
  profileLoaded: false,
  tripPacks: getStoredTripPacks(),
  packPurchaseCount: getStoredPackPurchaseCount(),
  notifPrefs: getStoredNotifPrefs(),
  units: getStoredUnits(),
  journey: null,
  journeyBudgetDays: null,
  advisorMessages: [],
  pendingActivePlace: null,
  referencePins: [],
  favouritedPins: ssGet<FavouritedPin[]>('ur_ss_favs') ?? [],
  cityFootprints: ssGet<CityFootprint[]>('ur_ss_footprints') ?? [],
  similarPinsState: null,
  savedEvents: ssGet<SavedEvent[]>('ur_ss_saved_events') ?? [],
  liveEvents: [],
  cityCountries: {},
  // ── Phase 3: new architecture fields ─────────────────────────
  cityContexts: [],
  activeCityIndex: 0,
  engineMessages: [],
  engineItinerary: ssGet<EngineItinerary>('ur_ss_engine_itin') ?? null,
  hasBuiltThisSession: false,
  itineraryHistory: ssGet<EngineItinerary[]>('ur_ss_itin_history') ?? [],
  activePinId: null,
  mapFilter: 'all' as MapFilterChip,
  reelSavedId: null,
  tripsActiveTab: 'saved',
  activeBuild: (() => {
    const b = ssGet<ActiveBuild>('ur_ss_active_build');
    // Discard builds older than 15 min — they either completed while the app
    // was closed (result already in engineItinerary) or the Railway dyno died.
    if (b && (b.status === 'pending' || b.status === 'running')) {
      if (b.startedAt && Date.now() - b.startedAt > 15 * 60 * 1000) return null;
    }
    return b ?? null;
  })(),
  pendingTripDetails: null,
  dismissedPinIds: [],
  recoInteractions: [],
};

// ── Actions ───────────────────────────────────────────────────

export type Action =
  | { type: 'GO_TO'; screen: Screen }
  | { type: 'GO_BACK' }
  | { type: 'NAV_TAB'; screen: Screen }
  | { type: 'SET_OB_ANSWER'; key: keyof OnboardingAnswers; value: OnboardingAnswers[keyof OnboardingAnswers] }
  | { type: 'SET_PERSONA'; persona: Persona }
  | { type: 'SET_CITY'; city: string }
  | { type: 'SET_CITY_COUNTRY'; city: string; country: string }
  | { type: 'UPDATE_CITY_LABEL'; city: string }
  | { type: 'SET_CITY_GEO'; geo: GeoData }
  | { type: 'SET_VIEWPORT_CITY'; city: string; geo: GeoData }
  | { type: 'SET_PLACES'; places: Place[] }
  | { type: 'MERGE_PLACES'; places: Place[] }
  | { type: 'TOGGLE_PLACE'; place: Place }
  | { type: 'SET_SELECTED_PLACES'; places: Place[] }
  | { type: 'SET_FILTER'; filter: MapFilter | 'all' }
  | { type: 'SET_TRIP_CONTEXT'; ctx: Partial<TripContext> }
  | { type: 'SET_ITINERARY'; itinerary: Itinerary | null }
  | { type: 'SET_ITINERARY_DAYS'; days: (Itinerary | null)[] }
  | { type: 'APPEND_ITINERARY_DAY'; day: Itinerary | null }
  | { type: 'SET_TRAVEL_DATES'; startDate: string; endDate: string }
  | { type: 'SET_WEATHER'; weather: WeatherData }
  | { type: 'SET_ROUTE'; route: RouteData }
  | { type: 'SAVE_ITINERARY'; saved: SavedItinerary }
  | { type: 'SET_SAVED_ITINERARIES'; items: SavedItinerary[] }
  | { type: 'UPDATE_SAVED_ITINERARY'; id: string; patch: Partial<SavedItinerary> }
  | { type: 'SET_USER_ROLE'; role: 'user' | 'admin' }
  | { type: 'SET_TIER'; tier: UserTier }
  | { type: 'SET_PACK_TRIPS'; count: number }
  | { type: 'CONSUME_PACK_TRIP' }
  | { type: 'SET_AUTO_REPLENISH'; enabled: boolean }
  | { type: 'SET_GENERATION_COUNT'; count: number }
  | { type: 'INCREMENT_GENERATION_COUNT' }
  | { type: 'PROFILE_LOADED' }
  | { type: 'RESET_MAP' }
  | { type: 'SET_RAW_OB_ANSWER'; key: keyof RawOBAnswers; value: unknown }
  | { type: 'SET_OB_PRE_RESOLVED'; value: ResolvedConflict[] }
  | { type: 'SET_PERSONA_PROFILE'; profile: PersonaProfile }
  | { type: 'SET_JOURNEY_ORIGIN'; place: OriginPlace }
  | { type: 'UPDATE_JOURNEY_LEGS'; legs: JourneyLeg[] }
  | { type: 'SET_TRANSIT_DETAILS'; from: string; to: string; departureTime: string; arrivalTime: string; durationMinutes: number; transitRef?: string }
  | { type: 'SET_JOURNEY_BUDGET'; days: number }
  | { type: 'ADD_ADVISOR_MESSAGE'; message: AdvisorMessage }
  | { type: 'CLEAR_ADVISOR_MESSAGES' }
  | { type: 'RESET_JOURNEY' }
  | { type: 'SET_PENDING_PLACE'; place: Place }
  | { type: 'CLEAR_PENDING_PLACE' }
  | { type: 'SET_USER_TIER'; tier: UserTier }
  | { type: 'ADD_TRIP_PACK'; pack: TripPack }
  | { type: 'USE_PACK_TRIP'; packId: string }
  | { type: 'SET_NOTIF_PREFS'; prefs: Partial<NotifPrefs> }
  | { type: 'SET_UNITS'; units: 'km' | 'miles' }
  | { type: 'SET_REFERENCE_PINS'; pins: ReferencePin[] }
  | { type: 'TOGGLE_FAVOURITE'; pin: FavouritedPin }
  | { type: 'SET_FAVOURITED_PINS'; pins: FavouritedPin[] }
  | { type: 'ADD_CITY_FOOTPRINT'; footprint: CityFootprint }
  | { type: 'SET_SIMILAR_PINS'; state: { sourcePlaceId: string; similarIds: string[] } | null }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }
  | { type: 'SAVE_EVENT'; event: SavedEvent }
  | { type: 'REMOVE_EVENT'; id: string }
  | { type: 'SET_SAVED_EVENTS'; events: SavedEvent[] }
  | { type: 'SET_LIVE_EVENTS'; events: import('./types').LiveEvent[] }
  // ── Phase 3: city context actions ────────────────────────────
  | { type: 'SET_CITY_CONTEXTS'; contexts: CityContext[] }
  | { type: 'ADD_CITY_CONTEXT'; context: CityContext }
  | { type: 'SET_ACTIVE_CITY_INDEX'; index: number }
  | { type: 'SET_DISCOVERY_MODE'; cityIndex: number; mode: DiscoveryMode }
  // ── Phase 3: engine message actions ──────────────────────────
  | { type: 'ADD_ENGINE_MESSAGE'; message: EngineMessage }
  | { type: 'DISMISS_ENGINE_MESSAGE'; id: string }
  | { type: 'CLEAR_ENGINE_MESSAGES' }
  // ── Phase 3: engine itinerary actions ────────────────────────
  | { type: 'SET_ENGINE_ITINERARY'; itinerary: EngineItinerary | null }
  | { type: 'PUSH_ITINERARY_HISTORY'; itinerary: EngineItinerary }
  // ── Phase 3: map UI actions ───────────────────────────────────
  | { type: 'SET_ACTIVE_PIN_ID'; id: string | null }
  | { type: 'SET_MAP_FILTER'; filter: MapFilterChip }
  | { type: 'SET_REEL_SAVED_ID'; id: string | null }
  | { type: 'REMOVE_ITINERARY'; id: string }
  | { type: 'SET_PENDING_TRIP_DETAILS'; details: import('./types').TripDetails | null }
  | { type: 'DISMISS_PIN'; pinId: string }
  | { type: 'SET_RECO_FOCUS_PLACES'; places: Place[] | null }
  | { type: 'UPDATE_PLACE_CITY'; id: string; city: string }
  | { type: 'SET_ACTIVE_BUILD'; build: ActiveBuild }
  | { type: 'CLEAR_ACTIVE_BUILD' }
  | { type: 'SET_TRIPS_TAB'; tab: 'current' | 'saved' | 'places' };

// ── Reducer ───────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GO_TO': {
      ssSave('ur_ss_screen', action.screen);
      const stack = [...state.screenStack, action.screen];
      return { ...state, currentScreen: action.screen, screenStack: stack };
    }

    case 'GO_BACK': {
      if (state.screenStack.length <= 1) return state;
      const stack = state.screenStack.slice(0, -1);
      const screen = stack[stack.length - 1];
      ssSave('ur_ss_screen', screen);
      return { ...state, currentScreen: screen, screenStack: stack };
    }

    case 'NAV_TAB': {
      ssSave('ur_ss_screen', action.screen);
      return { ...state, currentScreen: action.screen, screenStack: [action.screen] };
    }

    case 'SET_OB_ANSWER':
      return {
        ...state,
        obAnswers: { ...state.obAnswers, [action.key]: action.value },
      };

    case 'SET_PERSONA': {
      try {
        localStorage.setItem('ur_persona', JSON.stringify(action.persona));
      } catch {
        // ignore
      }
      return { ...state, persona: action.persona };
    }

    case 'SET_CITY':
      ssSave('ur_ss_city', action.city);
      ssSave('ur_ss_places', []);
      ssSave('ur_ss_sel', []);
      ssSave('ur_ss_geo', null);
      ssSave('ur_ss_footprints', []);
      ssSave('ur_ss_engine_itin', null);
      ssSave('ur_ss_active_build', null);
      return {
        ...state,
        city: action.city,
        places: [],
        selectedPlaces: [],
        cityGeo: null,
        cityFootprints: [],
        cityContexts: [],
        activeCityIndex: 0,
        engineItinerary: null,
        activeBuild: null,
      };

    case 'UPDATE_CITY_LABEL':
      ssSave('ur_ss_city', action.city);
      return { ...state, city: action.city };

    case 'SET_VIEWPORT_CITY':
      // Switch the map viewport to a new city without wiping the itinerary.
      // Only clears discovery places; selectedPlaces/footprints/dates are preserved.
      ssSave('ur_ss_city', action.city);
      ssSave('ur_ss_geo', action.geo);
      ssSave('ur_ss_places', []);
      return {
        ...state,
        city: action.city,
        cityGeo: action.geo,
        places: [],
      };

    case 'SET_CITY_GEO':
      ssSave('ur_ss_geo', action.geo);
      return { ...state, cityGeo: action.geo };

    case 'SET_CITY_COUNTRY':
      return { ...state, cityCountries: { ...state.cityCountries, [action.city]: action.country } };

    case 'SET_PLACES':
      ssSave('ur_ss_places', action.places);
      return { ...state, places: action.places };

    case 'MERGE_PLACES': {
      const existingIds = new Set(state.places.map(p => p.id));
      const newPlaces = action.places.filter(p => !existingIds.has(p.id));
      const merged = [...state.places, ...newPlaces];
      // Cap at 2000 to keep rendering performant; trim oldest explored areas first
      const capped = merged.length > 2000 ? merged.slice(merged.length - 2000) : merged;
      ssSave('ur_ss_places', capped);
      return { ...state, places: capped };
    }

    case 'TOGGLE_PLACE': {
      const exists = state.selectedPlaces.some(p => p.id === action.place.id);
      const updated = exists
        ? state.selectedPlaces.filter(p => p.id !== action.place.id)
        : [...state.selectedPlaces, action.place];
      ssSave('ur_ss_sel', updated);
      return { ...state, selectedPlaces: updated };
    }

    case 'UPDATE_PLACE_CITY': {
      const updated = state.selectedPlaces.map(p =>
        p.id === action.id ? { ...p, _city: action.city } : p
      );
      ssSave('ur_ss_sel', updated);
      return { ...state, selectedPlaces: updated };
    }

    case 'SET_SELECTED_PLACES':
      ssSave('ur_ss_sel', action.places);
      return { ...state, selectedPlaces: action.places };

    case 'SET_FILTER':
      ssSave('ur_ss_filter', action.filter);
      return { ...state, activeFilter: action.filter };

    case 'SET_TRIP_CONTEXT':
      return { ...state, tripContext: { ...state.tripContext, ...action.ctx } };

    case 'SET_ITINERARY':
      ssSave('ur_ss_itinerary', action.itinerary);
      return { ...state, itinerary: action.itinerary };

    case 'SET_ITINERARY_DAYS':
      ssSave('ur_ss_itin_days', action.days);
      return { ...state, itineraryDays: action.days };

    case 'APPEND_ITINERARY_DAY': {
      const updated = [...state.itineraryDays, action.day];
      ssSave('ur_ss_itin_days', updated);
      return { ...state, itineraryDays: updated };
    }

    case 'SET_TRAVEL_DATES':
      ssSave('ur_ss_start_date', action.startDate);
      ssSave('ur_ss_end_date', action.endDate);
      return { ...state, travelStartDate: action.startDate, travelEndDate: action.endDate };

    case 'SET_WEATHER':
      ssSave('ur_ss_weather', action.weather);
      return { ...state, weather: action.weather };

    case 'SET_ROUTE':
      return { ...state, route: action.route };

    case 'SAVE_ITINERARY': {
      if (state.savedItineraries.some(s => s.id === action.saved.id)) return state;
      const saved = state.pendingTripDetails
        ? { ...action.saved, tripDetails: state.pendingTripDetails }
        : action.saved;
      const updated = [...state.savedItineraries, saved];
      try {
        localStorage.setItem('ur_saved_itineraries', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return { ...state, savedItineraries: updated, pendingTripDetails: null };
    }

    case 'UPDATE_SAVED_ITINERARY': {
      const updated = state.savedItineraries.map(s =>
        s.id === action.id ? { ...s, ...action.patch } : s
      );
      try {
        localStorage.setItem('ur_saved_itineraries', JSON.stringify(updated));
      } catch { /* ignore */ }
      return { ...state, savedItineraries: updated };
    }

    case 'REMOVE_ITINERARY': {
      const updated = state.savedItineraries.filter(s => s.id !== action.id);
      try {
        localStorage.setItem('ur_saved_itineraries', JSON.stringify(updated));
      } catch { /* ignore */ }
      return { ...state, savedItineraries: updated };
    }

    case 'SET_SAVED_ITINERARIES': {
      // Merge: combine local items not in Supabase with Supabase items.
      // Keeps locally-saved-but-not-yet-synced trips from being overwritten.
      const remoteIds = new Set(action.items.map(i => i.id));
      const localOnly = state.savedItineraries.filter(i => !remoteIds.has(i.id));
      const merged = [...action.items, ...localOnly].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      return { ...state, savedItineraries: merged };
    }

    case 'SET_USER_ROLE':
      try { localStorage.setItem('ur_user_role', action.role); } catch { /* ignore */ }
      return { ...state, userRole: action.role };

    case 'SET_TIER':
      ssSave('ur_ss_tier', action.tier);
      return { ...state, userTier: action.tier };

    case 'SET_PACK_TRIPS':
      ssSave('ur_ss_pack_trips', action.count);
      return { ...state, packTripsRemaining: action.count };

    case 'CONSUME_PACK_TRIP': {
      const updated = Math.max(0, state.packTripsRemaining - 1);
      ssSave('ur_ss_pack_trips', updated);
      return { ...state, packTripsRemaining: updated };
    }

    case 'SET_AUTO_REPLENISH':
      ssSave('ur_ss_auto_replenish', action.enabled);
      return { ...state, autoReplenish: action.enabled };

    case 'SET_GENERATION_COUNT':
      try { localStorage.setItem('ur_gen_count', String(action.count)); } catch { /* ignore */ }
      return { ...state, generationCount: action.count };

    case 'INCREMENT_GENERATION_COUNT': {
      const next = state.generationCount + 1;
      try { localStorage.setItem('ur_gen_count', String(next)); } catch { /* ignore */ }
      return { ...state, generationCount: next };
    }

    case 'PROFILE_LOADED':
      return { ...state, profileLoaded: true };

    case 'RESET_MAP':
      ssSave('ur_ss_city', '');
      ssSave('ur_ss_geo', null);
      ssSave('ur_ss_places', []);
      ssSave('ur_ss_sel', []);
      ssSave('ur_ss_itinerary', null);
      ssSave('ur_ss_itin_days', []);
      ssSave('ur_ss_start_date', null);
      ssSave('ur_ss_end_date', null);
      ssSave('ur_ss_weather', null);
      return {
        ...state,
        city: '', cityGeo: null, places: [], selectedPlaces: [],
        itinerary: null, itineraryDays: [], travelStartDate: null,
        travelEndDate: null, route: null, weather: null,
      };

    case 'SET_RAW_OB_ANSWER': {
      const updatedRawOB: RawOBAnswers = {
        ...(state.rawOBAnswers ?? {
          group: null, mood: [], pace: [], day_open: null,
          dietary: [], budget: null, evening: null,
        }),
        [action.key]: action.value,
      } as RawOBAnswers;
      try { localStorage.setItem('ur_raw_ob_answers', JSON.stringify(updatedRawOB)); } catch { /* ignore */ }
      return { ...state, rawOBAnswers: updatedRawOB };
    }

    case 'SET_OB_PRE_RESOLVED':
      return { ...state, obPreResolved: action.value };

    case 'SET_PERSONA_PROFILE':
      // Persist immediately so the app knows OB is done even if the user
      // closes before hitting "Start Planning" on the PersonaScreen.
      // Use a dedicated sentinel key so we never clobber a full Persona in ur_persona.
      try {
        localStorage.setItem('ur_ob_done', '1');
        localStorage.setItem('ur_persona_profile', JSON.stringify(action.profile));
      } catch { /* ignore */ }
      return { ...state, personaProfile: action.profile };

    case 'SET_JOURNEY_ORIGIN': {
      const originLeg: JourneyLeg = { type: 'origin', place: action.place };
      const existingNonOrigin = (state.journey ?? []).filter(l => l.type !== 'origin');
      return { ...state, journey: [originLeg, ...existingNonOrigin] };
    }

    case 'UPDATE_JOURNEY_LEGS':
      return { ...state, journey: action.legs };

    case 'SET_TRANSIT_DETAILS': {
      const updated = (state.journey ?? []).map(leg => {
        if (
          leg.type === 'transit' &&
          leg.from === action.from &&
          leg.to === action.to
        ) {
          return {
            ...leg,
            departureTime: action.departureTime,
            arrivalTime: action.arrivalTime,
            durationMinutes: action.durationMinutes,
            transitRef: action.transitRef,
          };
        }
        return leg;
      });
      return { ...state, journey: updated };
    }

    case 'SET_JOURNEY_BUDGET':
      return { ...state, journeyBudgetDays: action.days };

    case 'ADD_ADVISOR_MESSAGE':
      return { ...state, advisorMessages: [...state.advisorMessages, action.message] };

    case 'CLEAR_ADVISOR_MESSAGES':
      return { ...state, advisorMessages: [] };

    case 'RESET_JOURNEY':
      return { ...state, journey: null, journeyBudgetDays: null, advisorMessages: [] };

    case 'SET_PENDING_PLACE':
      return { ...state, pendingActivePlace: action.place };

    case 'CLEAR_PENDING_PLACE':
      return { ...state, pendingActivePlace: null };

    case 'SET_USER_TIER':
      try { localStorage.setItem('ur_user_tier', action.tier); } catch { /* ignore */ }
      return { ...state, userTier: action.tier };

    case 'ADD_TRIP_PACK': {
      const packs = [...state.tripPacks, action.pack];
      const count = state.packPurchaseCount + 1;
      try {
        localStorage.setItem('ur_trip_packs', JSON.stringify(packs));
        localStorage.setItem('ur_pack_count', String(count));
      } catch { /* ignore */ }
      return { ...state, tripPacks: packs, packPurchaseCount: count };
    }

    case 'USE_PACK_TRIP': {
      const packs = state.tripPacks.map(p =>
        p.id === action.packId ? { ...p, usedTrips: p.usedTrips + 1 } : p
      );
      try { localStorage.setItem('ur_trip_packs', JSON.stringify(packs)); } catch { /* ignore */ }
      return { ...state, tripPacks: packs };
    }

    case 'SET_NOTIF_PREFS': {
      const prefs = { ...state.notifPrefs, ...action.prefs };
      try { localStorage.setItem('ur_notif_prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
      return { ...state, notifPrefs: prefs };
    }

    case 'SET_UNITS':
      try { localStorage.setItem('ur_units', action.units); } catch { /* ignore */ }
      return { ...state, units: action.units };

    case 'SET_REFERENCE_PINS':
      return { ...state, referencePins: action.pins };

    case 'TOGGLE_FAVOURITE': {
      const exists = state.favouritedPins.some(f => f.placeId === action.pin.placeId);
      const updated = exists
        ? state.favouritedPins.filter(f => f.placeId !== action.pin.placeId)
        : [...state.favouritedPins, action.pin];
      ssSave('ur_ss_favs', updated);
      return { ...state, favouritedPins: updated };
    }

    case 'SET_FAVOURITED_PINS': {
      ssSave('ur_ss_favs', action.pins);
      return { ...state, favouritedPins: action.pins };
    }

    case 'ADD_CITY_FOOTPRINT': {
      const exists = state.cityFootprints.some(f => f.city === action.footprint.city);
      const updated = exists
        ? state.cityFootprints.map(f =>
            f.city === action.footprint.city ? action.footprint : f
          )
        : [...state.cityFootprints, action.footprint];
      ssSave('ur_ss_footprints', updated);
      return { ...state, cityFootprints: updated };
    }

    case 'SET_SIMILAR_PINS':
      return { ...state, similarPinsState: action.state };

    case 'SET_THEME': {
      localStorage.setItem('ur_theme', action.theme);
      document.documentElement.dataset.theme = action.theme;
      return { ...state, theme: action.theme };
    }

    // ── Phase 3: city context cases ────────────────────────────

    case 'SET_CITY_CONTEXTS':
      return { ...state, cityContexts: action.contexts }

    case 'ADD_CITY_CONTEXT': {
      const exists = state.cityContexts.some(c => c.city === action.context.city)
      if (exists) return state
      return { ...state, cityContexts: [...state.cityContexts, action.context] }
    }

    case 'SET_ACTIVE_CITY_INDEX':
      return { ...state, activeCityIndex: action.index }

    case 'SET_DISCOVERY_MODE': {
      if (action.cityIndex < 0 || action.cityIndex >= state.cityContexts.length) return state
      const contexts = state.cityContexts.map((c, i) =>
        i === action.cityIndex ? { ...c, discoveryMode: action.mode } : c
      )
      return { ...state, cityContexts: contexts }
    }

    // ── Phase 3: engine message cases ──────────────────────────

    case 'ADD_ENGINE_MESSAGE':
      return { ...state, engineMessages: [...state.engineMessages, action.message] }

    case 'DISMISS_ENGINE_MESSAGE':
      return {
        ...state,
        engineMessages: state.engineMessages.filter(m => m.id !== action.id),
      }

    case 'CLEAR_ENGINE_MESSAGES':
      return { ...state, engineMessages: [] }

    // ── Phase 3: engine itinerary cases ────────────────────────

    case 'SET_ACTIVE_BUILD':
      ssSave('ur_ss_active_build', action.build);
      return { ...state, activeBuild: action.build };
    case 'CLEAR_ACTIVE_BUILD':
      ssSave('ur_ss_active_build', null);
      return { ...state, activeBuild: null };

    case 'SET_TRIPS_TAB':
      return { ...state, tripsActiveTab: action.tab };

    case 'SET_ENGINE_ITINERARY':
      ssSave('ur_ss_engine_itin', action.itinerary)
      return { ...state, engineItinerary: action.itinerary, hasBuiltThisSession: action.itinerary != null ? true : state.hasBuiltThisSession }

    case 'PUSH_ITINERARY_HISTORY': {
      const history = [action.itinerary, ...state.itineraryHistory].slice(0, 10)
      ssSave('ur_ss_engine_itin', action.itinerary)
      ssSave('ur_ss_itin_history', history)
      return { ...state, engineItinerary: action.itinerary, itineraryHistory: history, hasBuiltThisSession: true }
    }

    // ── Phase 3: map UI cases ───────────────────────────────────

    case 'SET_ACTIVE_PIN_ID':
      return { ...state, activePinId: action.id }

    case 'SET_MAP_FILTER':
      return { ...state, mapFilter: action.filter }

    case 'SAVE_EVENT': {
      const exists = state.savedEvents.some(e => e.id === action.event.id);
      if (exists) return state;
      const updated = [...state.savedEvents, action.event];
      ssSave('ur_ss_saved_events', updated);
      return { ...state, savedEvents: updated };
    }

    case 'REMOVE_EVENT': {
      const updated = state.savedEvents.filter(e => e.id !== action.id);
      ssSave('ur_ss_saved_events', updated);
      return { ...state, savedEvents: updated };
    }

    case 'SET_SAVED_EVENTS': {
      ssSave('ur_ss_saved_events', action.events);
      return { ...state, savedEvents: action.events };
    }

    case 'SET_LIVE_EVENTS':
      return { ...state, liveEvents: action.events };

    case 'SET_REEL_SAVED_ID':
      return { ...state, reelSavedId: action.id };

    case 'SET_PENDING_TRIP_DETAILS':
      return { ...state, pendingTripDetails: action.details };

    case 'DISMISS_PIN':
      return { ...state, dismissedPinIds: [...state.dismissedPinIds, action.pinId] };

    case 'SET_RECO_FOCUS_PLACES':
      return { ...state, recoFocusPlaces: action.places };

    default:
      return state;
  }
}

// ── Module-level store reference (for getState() outside React) ──────────────

interface StoreSnapshot {
  theme: AppState['theme'];
  dispatch: React.Dispatch<Action>;
}

let _currentState: AppState = initialState;
let _dispatch: React.Dispatch<Action> = (action: Action) => {
  _currentState = reducer(_currentState, action);
};

// ── Context ───────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Keep module-level references in sync with React state
  _currentState = state;
  _dispatch = dispatch;

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}

useAppStore.getState = (): StoreSnapshot & Pick<AppState, 'theme'> => ({
  theme: _currentState.theme,
  dispatch: _dispatch,
});

/**
 * Pure function — determines whether a generation attempt is allowed
 * and whether it should be degraded (no Our Picks / Live Events).
 *
 * @param tier       Current user tier
 * @param genCount   Number of itineraries generated so far (free tier)
 * @param packTrips  Current pack trip balance (pack tier)
 */
export function getGenerationAccess(
  tier: UserTier,
  genCount: number,
  packTrips: number,
): { allowed: boolean; degraded: boolean } {
  if (tier === 'pro') return { allowed: true, degraded: false };
  if (tier === 'pack') return { allowed: packTrips > 0, degraded: false };
  // Free tier: degrade Our Picks/Live Events on the last free trip (count=2),
  // block entirely once the limit is reached (count>=3).
  if (genCount < 2) return { allowed: true, degraded: false };
  if (genCount < 3) return { allowed: true, degraded: true };
  return { allowed: false, degraded: false };
}
