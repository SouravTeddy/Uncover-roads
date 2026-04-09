import { useState, useCallback } from 'react';
import { fetchPinDetails } from '../../shared/api';
import type { Place, PlaceDetails } from '../../shared/types';

// Module-level cache — persists across renders, resets on page reload
// keyed by "lat:lon" (5dp) since that's what the backend uses
const detailsCache = new Map<string, PlaceDetails>();

/** Returns the live details cache reference (read-only intent). */
export function getAllCachedDetails(): ReadonlyMap<string, PlaceDetails> {
  return detailsCache;
}

/** Returns cached details for a place, if resolved. */
export function getCachedPlaceIdKey(_name: string, lat: number, lon: number): string | undefined {
  const key = `${lat.toFixed(5)}:${lon.toFixed(5)}`;
  return detailsCache.has(key) ? key : undefined;
}

export function usePlaceDetails() {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async (place: Place) => {
    setLoading(true);
    setDetails(null);

    const cacheKey = `${place.lat.toFixed(5)}:${place.lon.toFixed(5)}`;

    try {
      // Check client-side cache first
      if (detailsCache.has(cacheKey)) {
        setDetails(detailsCache.get(cacheKey)!);
        return;
      }

      // Single round-trip: backend resolves place_id + fetches details
      const result = await fetchPinDetails(place.lat, place.lon, place.title);
      if (result) {
        detailsCache.set(cacheKey, result);
        setDetails(result);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearDetails = useCallback(() => {
    setDetails(null);
  }, []);

  return { details, loading, fetchDetails, clearDetails };
}
