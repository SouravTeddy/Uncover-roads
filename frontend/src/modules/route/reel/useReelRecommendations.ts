import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ReelRecoPlace } from '../../../shared/types';
import type { ReelRecoCard } from './types';

interface Result {
  places: ReelRecoPlace[];
  loading: boolean;
  error: boolean;
}

const FETCH_TIMEOUT_MS = 8000;

/**
 * Fetches persona-scored nearby recommendations when a reco card becomes active.
 * Results are cached per card ID — re-activation doesn't re-fetch.
 * No AI text in the response — all scoring is deterministic (persona_affinity.py).
 */
export function useReelRecommendations(
  card: ReelRecoCard,
  archetype: string,
  existingPlaceIds: string[],
  active: boolean,
): Result {
  const [places, setPlaces] = useState<ReelRecoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
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

    api.reelReco({
      lat: card.stopLat,
      lon: card.stopLon,
      trigger: card.trigger,
      archetype,
      existingPlaceIds,
    })
      .then(data => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPlaces(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        fetched.current = false;
        setLoading(false);
        setError(true);
      });

    return () => { cancelled = true; clearTimeout(timeoutId); fetched.current = false; };
  }, [active, card.id, card.stopLat, card.stopLon, card.trigger, archetype, existingPlaceIds]);

  return { places, loading, error };
}
