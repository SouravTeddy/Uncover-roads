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
  persona: Persona | null;
  city: string;
  cityGeo: GeoData | null;
  places: Place[];
  selectedPlaces: Place[];
  activeFilter: MapFilter | 'all';
  tripContext: TripContext;
  itinerary: Itinerary | null;
  weather: WeatherData | null;
  route: RouteData | null;
  savedItineraries: SavedItinerary[];
  userRole: 'user' | 'admin';
  generationCount: number;
}

// ── Session persistence (survives tab switches, clears on tab close) ──────────

function ssGet<T>(key: string): T | null {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

function ssSave(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function getInitialScreen(): Screen {
  try {
    // Restore map session if user was mid-session
    const sessionScreen = ssGet<Screen>('ur_ss_screen');
    if (sessionScreen && ['map', 'route', 'destination'].includes(sessionScreen)) {
      return sessionScreen;
    }
    const stored = localStorage.getItem('ur_persona');
    if (stored) return 'welcome';
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
  persona: getStoredPersona(),
  city:           ssGet<string>('ur_ss_city')    ?? '',
  cityGeo:        ssGet<GeoData>('ur_ss_geo')    ?? null,
  places:         ssGet<Place[]>('ur_ss_places') ?? [],
  selectedPlaces: ssGet<Place[]>('ur_ss_sel')    ?? [],
  activeFilter:   ssGet<MapFilter | 'all'>('ur_ss_filter') ?? 'all',
  tripContext: defaultTripCtx,
  itinerary: null,
  weather: null,
  route: null,
  savedItineraries: getStoredItineraries(),
  userRole: getStoredUserRole(),
  generationCount: getStoredGenerationCount(),
};

// ── Actions ───────────────────────────────────────────────────

export type Action =
  | { type: 'GO_TO'; screen: Screen }
  | { type: 'SET_OB_ANSWER'; key: keyof OnboardingAnswers; value: OnboardingAnswers[keyof OnboardingAnswers] }
  | { type: 'SET_PERSONA'; persona: Persona }
  | { type: 'SET_CITY'; city: string }
  | { type: 'SET_CITY_GEO'; geo: GeoData }
  | { type: 'SET_PLACES'; places: Place[] }
  | { type: 'MERGE_PLACES'; places: Place[] }
  | { type: 'TOGGLE_PLACE'; place: Place }
  | { type: 'SET_SELECTED_PLACES'; places: Place[] }
  | { type: 'SET_FILTER'; filter: MapFilter | 'all' }
  | { type: 'SET_TRIP_CONTEXT'; ctx: Partial<TripContext> }
  | { type: 'SET_ITINERARY'; itinerary: Itinerary | null }
  | { type: 'SET_WEATHER'; weather: WeatherData }
  | { type: 'SET_ROUTE'; route: RouteData }
  | { type: 'SAVE_ITINERARY'; saved: SavedItinerary }
  | { type: 'SET_SAVED_ITINERARIES'; items: SavedItinerary[] }
  | { type: 'SET_USER_ROLE'; role: 'user' | 'admin' }
  | { type: 'SET_GENERATION_COUNT'; count: number }
  | { type: 'INCREMENT_GENERATION_COUNT' }
  | { type: 'RESET_MAP' };

// ── Reducer ───────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
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
      return { ...state, itinerary: action.itinerary };

    case 'SET_WEATHER':
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

    case 'RESET_MAP':
      ssSave('ur_ss_city', '');
      ssSave('ur_ss_geo', null);
      ssSave('ur_ss_places', []);
      ssSave('ur_ss_sel', []);
      return { ...state, city: '', cityGeo: null, places: [], selectedPlaces: [], itinerary: null, route: null, weather: null };

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
