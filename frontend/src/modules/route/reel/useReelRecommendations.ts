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

    api.reelReco({
      lat: card.stopLat,
      lon: card.stopLon,
      trigger: card.trigger,
      archetype,
      existingPlaceIds,
      category: category ?? undefined,
    })
      .then(async data => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPlaces(data);
        setLoading(false);

        // Fetch photo for top-scoring place, with one fallback attempt
        for (const p of data.slice(0, 2)) {
          const url = await api.placeImage(p.name, card.nearbyCity);
          if (cancelled) return;
          if (url) { setPhotoUrl(url); return; }
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
