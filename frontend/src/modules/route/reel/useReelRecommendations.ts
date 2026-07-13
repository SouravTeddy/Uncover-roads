import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ReelRecoPlace } from '../../../shared/types';
import type { ReelRecoCard } from './types';

interface Result {
  places: ReelRecoPlace[];
  loading: boolean;
  error: boolean;
  photoUrl: string | null;
}

// If the primary category returns no places, try these fallbacks in order.
const CATEGORY_FALLBACKS: Partial<Record<string, string[]>> = {
  dinner:             ['restaurant', 'cafe', 'bar'],
  lunch:              ['restaurant', 'cafe', 'market'],
  evening:            ['bar', 'nightlife', 'viewpoint'],
  culture:            ['museum', 'historic', 'gallery'],
  rest:               ['cafe', 'park'],
  social_gap:         ['bar', 'cafe', 'park'],
  hidden_gem:         ['point_of_interest', 'cafe', 'viewpoint'],
  category_diversity: ['attraction', 'museum', 'viewpoint'],
  weather:            ['museum', 'cafe'],
  local_food:         ['restaurant', 'market', 'cafe'],
  photo_detour:       ['scenic', 'viewpoint', 'park'],
  famous_spots:       ['tourism', 'historic', 'museum'],
  walking_gap:        ['park', 'viewpoint'],
};

const FETCH_TIMEOUT_MS = 8000;

export function useReelRecommendations(
  card: ReelRecoCard,
  archetype: string,
  existingPlaceIds: string[],
  active: boolean,
  category?: string,
): Result {
  const [places, setPlaces] = useState<ReelRecoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fetched = useRef(false);
  const prevCardId = useRef<string>(card.id);

  useEffect(() => {
    if (card.id !== prevCardId.current) {
      fetched.current = false;
      prevCardId.current = card.id;
      setPlaces([]);
      setError(false);
      setPhotoUrl(null);
    }

    if (!active || fetched.current) return;
    if (!card.stopLat || !card.stopLon) return;

    fetched.current = true;
    setLoading(true);
    setError(false);

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      cancelled = true;
      fetched.current = false;
      setLoading(false);
      setError(true);
    }, FETCH_TIMEOUT_MS);

    // Build the full category chain: primary first, then fallbacks
    const fallbackChain = CATEGORY_FALLBACKS[card.trigger] ?? [];
    const categoryChain = category
      ? [category, ...fallbackChain.filter(c => c !== category)]
      : fallbackChain;

    const tryFetch = async (catChain: string[]): Promise<ReelRecoPlace[]> => {
      for (const cat of catChain) {
        const data = await api.reelReco({
          lat: card.stopLat!,
          lon: card.stopLon!,
          trigger: card.trigger,
          archetype,
          existingPlaceIds,
          category: cat,
        });
        if (data.length > 0) return data;
      }
      // Last resort: no category filter
      return api.reelReco({
        lat: card.stopLat!,
        lon: card.stopLon!,
        trigger: card.trigger,
        archetype,
        existingPlaceIds,
      });
    };

    tryFetch(categoryChain)
      .then(async data => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPlaces(data);
        setLoading(false);

        // Fetch photo for top-scoring place using placeId for direct Google Places lookup
        try {
          for (const p of data.slice(0, 2)) {
            const url = await api.placeImage(p.name, card.nearbyCity, p.placeId);
            if (cancelled) return;
            if (url) { setPhotoUrl(url); return; }
          }
        } catch {
          // photo fetch failed — card renders without photo, not an error
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        fetched.current = false;
        setLoading(false);
        setError(true);
      });

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [active, card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { places, loading, error, photoUrl };
}
