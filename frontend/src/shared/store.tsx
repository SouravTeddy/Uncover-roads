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
  generationCount: number;
  profileLoaded: boolean;
  journey: JourneyLeg[] | null;
  journeyBudgetDays: number | null;
  advisorMessages: AdvisorMessage[];
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
  generationCount: getStoredGenerationCount(),
  profileLoaded: false,
  journey: null,
  journeyBudgetDays: null,
  advisorMessages: [],
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
  | { type: 'RESET_JOURNEY' };

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
