import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ReelRecoPlace } from '../../../shared/types';
import type { ReelRecoCard } from './types';

interface Result {
  places: ReelRecoPlace[];
  loading: boolean;
}

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
  const fetched = useRef(false);

  useEffect(() => {
    if (!active || fetched.current) return;
    if (!card.stopLat || !card.stopLon) return;

    fetched.current = true;
    setLoading(true);

    api.reelReco({
      lat: card.stopLat,
      lon: card.stopLon,
      trigger: card.trigger,
      archetype,
      existingPlaceIds,
    })
      .then(setPlaces)
      .finally(() => setLoading(false));
  }, [active, card.id, card.stopLat, card.stopLon, card.trigger, archetype, existingPlaceIds]);

  return { places, loading };
}
