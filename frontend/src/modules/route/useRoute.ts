import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { SavedItinerary } from '../../shared/types';

export function useRoute() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'saved'>('active');

  const { city, selectedPlaces, persona, tripContext, itinerary, weather, savedItineraries } = state;

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
    if (!persona) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.aiItinerary({
        places: selectedPlaces,
        persona,
        tripCtx: tripContext,
        city,
      });
      dispatch({ type: 'SET_ITINERARY', itinerary: result });
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

  function saveItinerary() {
    if (!itinerary || !persona) return;
    const saved: SavedItinerary = {
      id: Date.now().toString(),
      city,
      date: new Date().toISOString(),
      itinerary,
      persona,
    };
    dispatch({ type: 'SAVE_ITINERARY', saved });
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
