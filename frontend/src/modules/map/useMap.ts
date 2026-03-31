import { useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { Place, MapFilter } from '../../shared/types';

// Maps persona venue_filter/itinerary_bias values → OSM category values that actually exist in map data
const VENUE_TO_CATEGORY: Record<string, string> = {
  restaurant: 'restaurant', cafe: 'cafe',    park: 'park',
  museum:     'museum',     historic: 'historic', tourism: 'tourism',
  // Aliases
  gallery:    'museum',     monument: 'historic', heritage: 'historic',
  culture:    'museum',     art:      'museum',
  market:     'place',      markets:  'place',    storefront: 'place',
  bar:        'restaurant', rooftop:  'restaurant', wine: 'restaurant',
  food:       'restaurant', gastronomy: 'restaurant', dining: 'restaurant',
  local:      'cafe',       neighbourhood: 'place', varied: 'place',
  outdoor:    'park',       nature: 'park',       adventure: 'park',
  nightlife:  'place',      club: 'place',        events: 'place',
};

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
    if (city && persona && recommendedPlaces.length === 0) {
      loadRecommended();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Re-run recommended when places load (clientSideFallback needs places populated)
  useEffect(() => {
    if (places.length > 0 && recommendedPlaces.length === 0 && persona) {
      loadRecommended();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.length]);

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

  /**
   * Client-side fallback: maps persona venue_filters + itinerary_bias
   * to actual OSM categories and marks matching places as recommended.
   */
  function clientSideFallback(): Place[] {
    if (!persona || places.length === 0) return [];

    const signals = [
      ...(persona.venue_filters ?? []),
      ...(persona.itinerary_bias ?? []),
    ];

    const targetCategories = new Set<string>();
    signals.forEach(v => {
      const cat = VENUE_TO_CATEGORY[v.toLowerCase()];
      if (cat) targetCategories.add(cat);
    });

    // If no mapping resolved, mark all places (better than showing nothing)
    if (targetCategories.size === 0) {
      return places.map(p => ({ ...p, reason: 'Curated for your travel style' }));
    }

    return places
      .filter(p => targetCategories.has(p.category))
      .map(p => ({ ...p, reason: `Recommended for your travel style` }));
  }

  // "Our Picks" tab shows ALL places (not just recommended subset) so map stays rich.
  // Recommended pins are visually distinct via blue icon — filter just communicates intent.
  const filteredPlaces: Place[] =
    activeFilter === 'all' || activeFilter === 'recommended'
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
    recommendedPlaces,
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
