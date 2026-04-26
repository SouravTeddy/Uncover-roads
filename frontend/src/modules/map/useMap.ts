import { useEffect, useRef, useState } from 'react';
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

  // Session-only: tracks which categories the user has tapped — passed to LLM as behavior signal
  const viewedCategoriesRef = useRef<Set<string>>(new Set());

  const { city, places, selectedPlaces, activeFilter, cityGeo, persona } = state;

  // Recommended places load once we have places to filter against
  useEffect(() => {
    if (city && persona && places.length > 0 && recommendedPlaces.length === 0) {
      loadRecommended();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, places.length]);

  /** Call this whenever the user opens a place card — tracks browsing behavior for Our Picks */
  function trackViewedCategory(category: string) {
    viewedCategoriesRef.current.add(category);
  }

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
      const result = await api.recommendedPlaces({
        city,
        personaArchetype: persona.archetype,
        personaDesc: persona.archetype_desc ?? '',
        venueFilters: persona.venue_filters ?? [],
        itineraryBias: persona.itinerary_bias ?? [],
        viewedCategories: [...viewedCategoriesRef.current],
      });
      const picks = Array.isArray(result.picks) ? result.picks : [];
      const withIds = picks.map((p, i) => ({
        ...p,
        id: p.id ?? `rec-${i}`,
        reason: (p as any).whyRec ?? p.reason,
        reasonSignal: (p as any).signal ?? p.reasonSignal,
      }));
      setRecommendedPlaces(withIds.length > 0 ? withIds : clientSideFallback());
    } catch {
      setRecommendedPlaces(clientSideFallback());
    } finally {
      setRecLoading(false);
    }
  }

  /**
   * Client-side fallback when the LLM call fails.
   * Filters events out, maps persona signals to OSM categories,
   * marks all results with reasonSignal: 'persona'.
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

    const nonEvents = places.filter(p => p.category !== 'event');

    // If no mapping resolved, return all non-event places
    if (targetCategories.size === 0) {
      return nonEvents.map(p => ({
        ...p,
        reason: 'Curated for your travel style',
        reasonSignal: 'persona' as const,
      }));
    }

    return nonEvents
      .filter(p => targetCategories.has(p.category))
      .map(p => ({
        ...p,
        reason: 'Recommended for your travel style',
        reasonSignal: 'persona' as const,
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
    trackViewedCategory,
    goToRoute,
    goBack,
  };
}
