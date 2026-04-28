import { useState, useEffect } from 'react';
import { useAppStore, getGenerationAccess } from '../../shared/store';
import { api, aiItineraryStream } from '../../shared/api';
import { shouldShowPaywall } from '../../shared/tier';
import type { ItineraryRequest } from '../../shared/api';
import type { Itinerary, SavedItinerary } from '../../shared/types';
import { supabase } from '../../shared/supabase';
import { syncSavedItinerary, incrementGenerationCount } from '../../shared/userSync';
import { computeTotalDays, addDaysToIso } from '../map/trip-capacity-utils';

export function useRoute() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'saved'>('active');

  const { city, selectedPlaces, persona, itinerary, weather, savedItineraries } = state;

  const totalDays = computeTotalDays(state.travelStartDate, state.travelEndDate) ||
    (state.tripContext.days ?? 1);
  const streamingDays = state.itineraryDays.length < totalDays && !error;

  useEffect(() => {
    if (!itinerary && selectedPlaces.length >= 2 && persona) {
      buildItinerary();
    }
    if (city && !weather) {
      loadWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buildItinerary(overridePlaces?: typeof state.selectedPlaces) {
    if (shouldShowPaywall(state)) {
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return;
    }

    if (!persona || !state.cityGeo) return;

    const access = getGenerationAccess(state.userTier, state.generationCount, state.packTripsRemaining);
    if (!access.allowed) {
      // Navigate to subscription screen for free users who've hit limit
      // or pack users with zero balance
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return;
    }

    const days = totalDays > 0 ? totalDays : (state.tripContext.days ?? 1);
    const startDate = state.travelStartDate ?? state.tripContext.date;
    const placesToUse = overridePlaces ?? state.selectedPlaces;

    dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    setError(null);
    setLoading(true);

    const streamRequest: ItineraryRequest = {
      city:              state.city,
      lat:               state.cityGeo.lat,
      lon:               state.cityGeo.lon,
      days,
      day_number:        1,
      pace:              persona.pace ?? 'any',
      persona:           persona.archetype,
      persona_archetype: persona.archetype_name,
      persona_context:   persona.insight ?? '',
      trip_context: {
        start_type:    state.tripContext.startType,
        arrival_time:  state.tripContext.arrivalTime,
        travel_date:   startDate,
        total_days:    days,
        flight_time:   state.tripContext.flightTime,
        is_long_haul:  state.tripContext.isLongHaul,
        location_lat:  state.tripContext.locationLat,
        location_lon:  state.tripContext.locationLon,
        location_name: state.tripContext.locationName,
      },
      selected_places: placesToUse.map(p => ({ id: p.id, title: p.title, lat: p.lat, lon: p.lon })),
    };

    let dispatched = 0;
    let streamAttempt = 0;

    while (streamAttempt <= 2) {
      try {
        for await (const day of aiItineraryStream(streamRequest)) {
          dispatch({ type: 'APPEND_ITINERARY_DAY', day });
          if (dispatched === 0) {
            dispatch({ type: 'SET_ITINERARY', itinerary: day }); // backward compat
            setLoading(false);
          }
          dispatched++;
        }
        break; // stream completed cleanly
      } catch {
        if (dispatched === 0 && streamAttempt < 2) {
          streamAttempt++;
          await new Promise(r => setTimeout(r, 500 * streamAttempt));
          continue;
        }
        break;
      }
    }

    if (dispatched === 0) {
      setLoading(false);
      setError('Could not generate your itinerary. Please try again.');
      return;
    }

    // Auto-retry any missing days via single-day endpoint
    if (dispatched < days) {
      for (let d = dispatched + 1; d <= days; d++) {
        const result = await retryDay(d, days, startDate, streamRequest);
        dispatch({ type: 'APPEND_ITINERARY_DAY', day: result });
      }
    }

    dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) incrementGenerationCount(user.id).catch(console.warn);
    });
  }

  async function loadWeather() {
    if (!city) return;
    try {
      const wx = await api.weather(city);
      dispatch({ type: 'SET_WEATHER', weather: wx });
    } catch {
      // non-critical
    }
  }

  function removeStop(idx: number) {
    const stops = itinerary?.itinerary ?? [];
    const removed = stops[idx];
    if (!removed) return;
    const nameLower = (removed.place ?? '').toLowerCase();
    const updatedPlaces = selectedPlaces.filter(p => {
      const t = p.title.toLowerCase();
      return !(t === nameLower || nameLower.includes(t.slice(0, 8)) || t.includes(nameLower.slice(0, 8)));
    });
    dispatch({ type: 'SET_SELECTED_PLACES', places: updatedPlaces });
    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    if (updatedPlaces.length < 1) {
      dispatch({ type: 'GO_TO', screen: 'map' });
      return;
    }
    buildItinerary();
  }

  async function saveItinerary() {
    if (!itinerary || !persona) return;
    const saved: SavedItinerary = {
      id: Date.now().toString(),
      city,
      date: new Date().toISOString(),
      travelDate: state.tripContext.date ?? null,
      cityLat: state.cityGeo?.lat ?? null,
      cityLon: state.cityGeo?.lon ?? null,
      selectedPlaces: state.selectedPlaces,
      itinerary,
      persona,
      lastUpdateCheck: null,
      pendingSwapCards: [],
    };
    dispatch({ type: 'SAVE_ITINERARY', saved });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) syncSavedItinerary(user.id, saved).catch(console.warn);
  }

  function addSuggestion(place: import('../../shared/types').Place) {
    if (state.selectedPlaces.some(p => p.id === place.id)) return;
    if (!state.places.some(p => p.id === place.id)) {
      dispatch({ type: 'MERGE_PLACES', places: [place] });
    }
    const newSelected = [...state.selectedPlaces, place];
    dispatch({ type: 'SET_SELECTED_PLACES', places: newSelected });
    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    buildItinerary(newSelected);
  }

  function goBack() {
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function goToNav() {
    dispatch({ type: 'GO_TO', screen: 'nav' });
  }

  return {
    loading,
    error,
    tab,
    setTab,
    itinerary,
    itineraryDays: state.itineraryDays,
    totalDays,
    streamingDays,
    weather,
    city,
    selectedPlaces,
    savedItineraries,
    removeStop,
    saveItinerary,
    buildItinerary,
    addSuggestion,
    goBack,
    goToNav,
  };
}

export async function retryDay(
  dayNumber: number,
  totalDays: number,
  startDate: string,
  base: ItineraryRequest,
  delayMs = 500,
): Promise<Itinerary | null> {
  const travelDate = addDaysToIso(startDate, dayNumber - 1);
  const body: ItineraryRequest = {
    ...base,
    day_number: dayNumber,
    trip_context: { ...base.trip_context, travel_date: travelDate, total_days: totalDays },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
    try {
      const result = await api.aiItinerary(body);
      if (result && !(result as unknown as { error?: string }).error) return result;
    } catch { /* continue */ }
  }
  return null;
}
