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
  UserTier,
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
  currentScreen: Screen;
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
  userTier: UserTier;
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
}

// ── Trip-state persistence (localStorage — survives refreshes, PWA restarts) ──

function ssGet<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

function ssSave(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
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
    const stored = localStorage.getItem('ur_persona');
    if (stored) {
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
    return stored ? (JSON.parse(stored) as Persona) : null;
  } catch {
    return null;
  }
}

function getStoredItineraries(): SavedItinerary[] {
  try {
    const stored = localStorage.getItem('ur_saved_itineraries');
    return stored ? (JSON.parse(stored) as SavedItinerary[]) : [];
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

export const initialState: AppState = {
  currentScreen: getInitialScreen(),
  obAnswers: defaultObAnswers,
  rawOBAnswers: null,
  personaProfile: null,
  obPreResolved: [],
  persona: getStoredPersona(),
  city:           ssGet<string>('ur_ss_city')    ?? '',
  cityGeo:        ssGet<GeoData>('ur_ss_geo')    ?? null,
  places:         ssGet<Place[]>('ur_ss_places') ?? [],
  selectedPlaces: ssGet<Place[]>('ur_ss_sel')    ?? [],
  activeFilter:   ssGet<MapFilter | 'all'>('ur_ss_filter') ?? 'all',
  tripContext: defaultTripCtx,
  itinerary:       ssGet<Itinerary>('ur_ss_itinerary')         ?? null,
  itineraryDays:   ssGet<(Itinerary | null)[]>('ur_ss_itin_days') ?? [],
  travelStartDate: ssGet<string>('ur_ss_start_date')           ?? null,
  travelEndDate:   ssGet<string>('ur_ss_end_date')             ?? null,
  weather: ssGet<WeatherData>('ur_ss_weather') ?? null,
  route: null,
  savedItineraries: getStoredItineraries(),
  userRole: getStoredUserRole(),
  userTier: (ssGet<UserTier>('ur_ss_tier') ?? 'free'),
  packTripsRemaining: (ssGet<number>('ur_ss_pack_trips') ?? 0),
  autoReplenish: (ssGet<boolean>('ur_ss_auto_replenish') ?? false),
  generationCount: getStoredGenerationCount(),
  profileLoaded: false,
  userTier: getStoredTier(),
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
};

// ── Actions ───────────────────────────────────────────────────

export type Action =
  | { type: 'GO_TO'; screen: Screen }
  | { type: 'SET_OB_ANSWER'; key: keyof OnboardingAnswers; value: OnboardingAnswers[keyof OnboardingAnswers] }
  | { type: 'SET_PERSONA'; persona: Persona }
  | { type: 'SET_CITY'; city: string }
  | { type: 'UPDATE_CITY_LABEL'; city: string }
  | { type: 'SET_CITY_GEO'; geo: GeoData }
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
  | { type: 'ADD_CITY_FOOTPRINT'; footprint: CityFootprint }
  | { type: 'SET_SIMILAR_PINS'; state: { sourcePlaceId: string; similarIds: string[] } | null };

// ── Reducer ───────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GO_TO':
      ssSave('ur_ss_screen', action.screen);
      return { ...state, currentScreen: action.screen };

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
      return { ...state, city: action.city, places: [], selectedPlaces: [], cityGeo: null };

    case 'UPDATE_CITY_LABEL':
      ssSave('ur_ss_city', action.city);
      return { ...state, city: action.city };

    case 'SET_CITY_GEO':
      ssSave('ur_ss_geo', action.geo);
      return { ...state, cityGeo: action.geo };

    case 'SET_PLACES':
      ssSave('ur_ss_places', action.places);
      return { ...state, places: action.places };

    case 'MERGE_PLACES': {
      const existingIds = new Set(state.places.map(p => p.id));
      const newPlaces = action.places.filter(p => !existingIds.has(p.id));
      const merged = [...state.places, ...newPlaces];
      ssSave('ur_ss_places', merged);
      return { ...state, places: merged };
    }

    case 'TOGGLE_PLACE': {
      const exists = state.selectedPlaces.some(p => p.id === action.place.id);
      const updated = exists
        ? state.selectedPlaces.filter(p => p.id !== action.place.id)
        : [...state.selectedPlaces, action.place];
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
      const updated = [...state.savedItineraries, action.saved];
      try {
        localStorage.setItem('ur_saved_itineraries', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return { ...state, savedItineraries: updated };
    }

    case 'SET_SAVED_ITINERARIES':
      return { ...state, savedItineraries: action.items };

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

    case 'SET_RAW_OB_ANSWER':
      return {
        ...state,
        rawOBAnswers: {
          ...(state.rawOBAnswers ?? {
            group: null, mood: [], pace: [], day_open: null,
            dietary: [], budget: null, evening: null,
          }),
          [action.key]: action.value,
        } as RawOBAnswers,
      };

    case 'SET_OB_PRE_RESOLVED':
      return { ...state, obPreResolved: action.value };

    case 'SET_PERSONA_PROFILE':
      // Persist immediately so the app knows OB is done even if the user
      // closes before hitting "Start Planning" on the PersonaScreen.
      try {
        localStorage.setItem('ur_persona', JSON.stringify({ archetype: action.profile.archetype }));
      } catch { /* ignore */ }
      return { ...state, personaProfile: action.profile };

    case 'SET_JOURNEY_ORIGIN': {
      const originLeg: JourneyLeg = { type: 'origin', place: action.place };
      const existingNonOrigin = (state.journey ?? []).filter(l => l.type !== 'origin');
      return { ...state, journey: [originLeg, ...existingNonOrigin] };
    }

    case 'UPDATE_JOURNEY_LEGS':
      return { ...state, journey: action.legs };

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

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}

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
  // Free tier
  if (genCount < 2) return { allowed: true, degraded: false };
  if (genCount === 2) return { allowed: true, degraded: true };
  return { allowed: false, degraded: false };
}
