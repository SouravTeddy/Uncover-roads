import { useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { Place, MapFilter } from '../../shared/types';

export function useMap() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [recommendedPlaces, setRecommendedPlaces] = useState<Place[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const { city, places, selectedPlaces, activeFilter, cityGeo, persona } = state;

  useEffect(() => {
    if (city && places.length === 0) {
      loadPlaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  useEffect(() => {
    if (activeFilter === 'recommended' && recommendedPlaces.length === 0 && city && persona) {
      loadRecommended();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  async function loadPlaces() {
    setLoading(true);
    setError(false);
    try {
      const data = await api.mapData(
        city,
        cityGeo?.lat ?? undefined,
        cityGeo?.lon ?? undefined,
      );
      const raw: Place[] = Array.isArray(data) ? data : [];
      const withIds = raw.map((p, i) => ({ ...p, id: p.id ?? `${p.title}-${i}` }));
      dispatch({ type: 'SET_PLACES', places: withIds });
      if (withIds.length === 0) setError(true);
    } catch (e) {
      console.error('[useMap] loadPlaces failed:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecommended() {
    if (!persona) return;
    setRecLoading(true);
    try {
      const data = await api.recommended(city, persona);
      const withIds = (Array.isArray(data) ? data : []).map((p, i) => ({
        ...p,
        id: p.id ?? `${p.title}-${i}`,
      }));
      setRecommendedPlaces(withIds.length > 0 ? withIds : clientSideFallback());
    } catch {
      setRecommendedPlaces(clientSideFallback());
    } finally {
      setRecLoading(false);
    }
  }

  // Fallback: filter loaded places by persona.venue_filters categories + add a generic reason
  function clientSideFallback(): Place[] {
    if (!persona) return [];
    const filters = new Set(persona.venue_filters ?? []);
    return places
      .filter(p => filters.has(p.category))
      .map(p => ({
        ...p,
        reason: `Matches your interest in ${p.category}`,
      }));
  }

  const filteredPlaces: Place[] =
    activeFilter === 'recommended'
      ? recommendedPlaces
      : activeFilter === 'all'
      ? places
      : places.filter(p => p.category === (activeFilter as string));

  function togglePlace(place: Place) {
    dispatch({ type: 'TOGGLE_PLACE', place });
  }

  function setFilter(f: MapFilter) {
    dispatch({ type: 'SET_FILTER', filter: f });
  }

  function goToRoute() {
    dispatch({ type: 'GO_TO', screen: 'route' });
  }

  function goBack() {
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  return {
    city,
    cityGeo,
    places,
    filteredPlaces,
    selectedPlaces,
    activeFilter,
    loading: loading || recLoading,
    error,
    loadPlaces,
    activePlace,
    setActivePlace,
    togglePlace,
    setFilter,
    goToRoute,
    goBack,
  };
}
