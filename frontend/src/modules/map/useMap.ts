import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api, getPlacePhotoUrl } from '../../shared/api';
import { preloadImages } from '../../shared/imagePreloader';
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

export function useMap(activeCategories: string[] = []) {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [recommendedPlaces, setRecommendedPlaces] = useState<Place[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  // Session-only: tracks which categories the user has tapped — passed to LLM as behavior signal
  const viewedCategoriesRef = useRef<Set<string>>(new Set());

  const { city, places, selectedPlaces, activeFilter, cityGeo, persona, favouritedPins } = state;

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
    dispatch({ type: 'SET_PLACES', places: [] });
    try {
      const data = await api.mapData(
        city,
        cityGeo?.lat ?? undefined,
        cityGeo?.lon ?? undefined,
      );
      const raw: Place[] = Array.isArray(data) ? data : [];
      const withIds = raw.map((p, i) => ({ ...p, id: p.id ?? `${p.title}-${i}` }));
      dispatch({ type: 'SET_PLACES', places: withIds });
      preloadImages(withIds.map(p => p.photo_ref ? getPlacePhotoUrl(p.photo_ref) : (p as any).imageUrl));
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
        venueFilters:     persona.venue_filters ?? [],
        itineraryBias:    persona.itinerary_bias ?? [],
        places,
      });
      const picks = Array.isArray(result.picks) ? result.picks : [];
      const withIds = picks.map((p, i) => ({
        ...p,
        id: p.id ?? `rec-${i}`,
        reason: (p as any).whyRec ?? p.reason,
        reasonSignal: (p as any).signal ?? p.reasonSignal,
      }));
      const resolved = withIds.length > 0 ? withIds : clientSideFallback();
      setRecommendedPlaces(resolved);
      preloadImages(resolved.map(p => p.photo_ref ? getPlacePhotoUrl(p.photo_ref) : (p as any).imageUrl));
    } catch {
      const fallback = clientSideFallback();
      setRecommendedPlaces(fallback);
      preloadImages(fallback.map(p => p.photo_ref ? getPlacePhotoUrl(p.photo_ref) : (p as any).imageUrl));
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

    const archetypeLabel: Record<string, string> = {
      explorer:          'Matched to your explorer style',
      wanderer:          'Curated for wanderers like you',
      foodie:            'Picked for your food interests',
      gastronaut:        'Picked for your food interests',
      culture:           'Aligned with your cultural taste',
      slowscholar:       'Aligned with your cultural taste',
      adventure:         'Suited for adventurers',
      nightcreature:     'Fits your evening-first style',
      aesthete:          'Chosen for its design and beauty',
      flaneur:           'Suited for open-ended wandering',
      neighbourhoodlocal:'Off the tourist trail, just for you',
      efficientexplorer: 'High-value stop for your route',
      ritualseeker:      'Slow and intentional — your pace',
    };
    const fallbackReason =
      archetypeLabel[persona.archetype?.toLowerCase().replace(/[\s_-]/g, '') ?? ''] ?? 'Picked for you';

    // If no mapping resolved, return all non-event places
    if (targetCategories.size === 0) {
      return nonEvents.map(p => ({
        ...p,
        reason: fallbackReason,
        reasonSignal: 'persona' as const,
      }));
    }

    const catLabel: Record<string, string> = {
      museum:     'Matches your interest in culture',
      gallery:    'Matches your interest in art',
      historic:   'Matches your interest in heritage',
      temple:     'Matches your interest in heritage',
      park:       'Matches your love of open spaces',
      restaurant: 'Matches your food interests',
      cafe:       'Matches your café culture interest',
      bar:        'Matches your nightlife preference',
      market:     'Matches your local market interest',
      place:      'Aligns with your neighbourhood curiosity',
      tourism:    'A spot worth adding to your day',
    };

    return nonEvents
      .filter(p => targetCategories.has(p.category))
      .map(p => ({
        ...p,
        reason: catLabel[p.category] ?? fallbackReason,
        reasonSignal: 'persona' as const,
      }));
  }

  const filteredPlaces: Place[] =
    activeFilter === 'saved'
      ? places.filter(p => favouritedPins.some(f => f.placeId === p.id))
      : activeFilter === 'all' && activeCategories.length > 0
      ? places.filter(p => activeCategories.includes(p.category))
      : places;

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
