import { useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { Place, MapFilter } from '../../shared/types';

export function useMap() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [activePlace, setActivePlace] = useState<Place | null>(null);

  const { city, places, selectedPlaces, activeFilter, cityGeo } = state;

  useEffect(() => {
    if (city && places.length === 0) {
      loadPlaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  async function loadPlaces() {
    setLoading(true);
    try {
      const data = await api.mapData(city);
      dispatch({ type: 'SET_PLACES', places: Array.isArray(data) ? data : [] });
    } catch {
      // silent fail — empty map
    } finally {
      setLoading(false);
    }
  }

  const filteredPlaces =
    activeFilter === 'all' || (activeFilter as string) === 'recommended'
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
    loading,
    activePlace,
    setActivePlace,
    togglePlace,
    setFilter,
    goToRoute,
    goBack,
  };
}
