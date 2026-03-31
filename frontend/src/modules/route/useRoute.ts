import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { ItineraryRequest } from '../../shared/api';
import type { SavedItinerary } from '../../shared/types';
import { supabase } from '../../shared/supabase';
import { syncSavedItinerary, incrementGenerationCount } from '../../shared/userSync';

export function useRoute() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'saved'>('active');

  const { city, selectedPlaces, persona, itinerary, weather, savedItineraries } = state;

  useEffect(() => {
    if (!itinerary && selectedPlaces.length >= 2 && persona) {
      buildItinerary();
    }
    if (city && !weather) {
      loadWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buildItinerary() {
    if (!persona || !state.cityGeo) return;
    setLoading(true);
    setError(null);
    try {
      const body: ItineraryRequest = {
        city: state.city,
        lat: state.cityGeo.lat,
        lon: state.cityGeo.lon,
        days: state.tripContext.days,
        day_number: state.tripContext.dayNumber,
        pace: state.persona!.pace ?? 'any',
        persona: state.persona!.archetype,
        persona_archetype: state.persona!.archetype_name,
        persona_context: state.persona!.insight ?? '',
        trip_context: {
          start_type: state.tripContext.startType,
          arrival_time: state.tripContext.arrivalTime,
          travel_date: state.tripContext.date,
          flight_time: state.tripContext.flightTime,
          is_long_haul: state.tripContext.isLongHaul,
          location_lat: state.tripContext.locationLat,
          location_lon: state.tripContext.locationLon,
          location_name: state.tripContext.locationName,
        },
        selected_places: state.selectedPlaces.map(p => ({
          id: p.id, title: p.title, lat: p.lat, lon: p.lon,
        })),
      };
      const result = await api.aiItinerary(body);
      dispatch({ type: 'SET_ITINERARY', itinerary: result });
      dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
      // Persist count to Supabase if signed in
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) incrementGenerationCount(user.id).catch(console.warn);
      });
    } catch (err) {
      setError('Could not generate your itinerary. Please try again.');
      console.warn('Itinerary error:', err);
    } finally {
      setLoading(false);
    }
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
      itinerary,
      persona,
    };
    dispatch({ type: 'SAVE_ITINERARY', saved });
    // Sync to Supabase if signed in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) syncSavedItinerary(user.id, saved).catch(console.warn);
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
    weather,
    city,
    selectedPlaces,
    savedItineraries,
    removeStop,
    saveItinerary,
    buildItinerary,
    goBack,
    goToNav,
  };
}
