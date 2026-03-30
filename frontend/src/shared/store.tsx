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
}

function getInitialScreen(): Screen {
  try {
    const stored = localStorage.getItem('ur_persona');
    if (stored) return 'destination';
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

export const initialState: AppState = {
  currentScreen: getInitialScreen(),
  obAnswers: defaultObAnswers,
  persona: getStoredPersona(),
  city: '',
  cityGeo: null,
  places: [],
  selectedPlaces: [],
  activeFilter: 'all',
  tripContext: defaultTripCtx,
  itinerary: null,
  weather: null,
  route: null,
  savedItineraries: getStoredItineraries(),
};

// ── Actions ───────────────────────────────────────────────────

export type Action =
  | { type: 'GO_TO'; screen: Screen }
  | { type: 'SET_OB_ANSWER'; key: keyof OnboardingAnswers; value: OnboardingAnswers[keyof OnboardingAnswers] }
  | { type: 'SET_PERSONA'; persona: Persona }
  | { type: 'SET_CITY'; city: string }
  | { type: 'SET_CITY_GEO'; geo: GeoData }
  | { type: 'SET_PLACES'; places: Place[] }
  | { type: 'TOGGLE_PLACE'; place: Place }
  | { type: 'SET_SELECTED_PLACES'; places: Place[] }
  | { type: 'SET_FILTER'; filter: MapFilter | 'all' }
  | { type: 'SET_TRIP_CONTEXT'; ctx: Partial<TripContext> }
  | { type: 'SET_ITINERARY'; itinerary: Itinerary | null }
  | { type: 'SET_WEATHER'; weather: WeatherData }
  | { type: 'SET_ROUTE'; route: RouteData }
  | { type: 'SAVE_ITINERARY'; saved: SavedItinerary }
  | { type: 'RESET_MAP' };

// ── Reducer ───────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GO_TO':
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
      return { ...state, city: action.city, places: [], selectedPlaces: [], cityGeo: null };

    case 'SET_CITY_GEO':
      return { ...state, cityGeo: action.geo };

    case 'SET_PLACES':
      return { ...state, places: action.places };

    case 'TOGGLE_PLACE': {
      const exists = state.selectedPlaces.some(p => p.id === action.place.id);
      return {
        ...state,
        selectedPlaces: exists
          ? state.selectedPlaces.filter(p => p.id !== action.place.id)
          : [...state.selectedPlaces, action.place],
      };
    }

    case 'SET_SELECTED_PLACES':
      return { ...state, selectedPlaces: action.places };

    case 'SET_FILTER':
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

    case 'RESET_MAP':
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
