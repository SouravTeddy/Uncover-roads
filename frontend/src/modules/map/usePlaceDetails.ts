import { useState, useCallback } from 'react';
import { fetchPlaceDetails, findPlaceId } from '../../shared/api';
import type { Place, PlaceDetails } from '../../shared/types';

// Module-level caches — persist across renders but reset on page reload
const detailsCache = new Map<string, PlaceDetails>();
const placeIdCache = new Map<string, string>(); // "name:lat:lon" → google place_id

export function usePlaceDetails() {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async (place: Place) => {
    setLoading(true);
    setDetails(null);

    try {
      // Step 1: Resolve Google place_id from OSM name + coordinates
      const cacheKey = `${place.title}:${place.lat}:${place.lon}`;
      let placeId = placeIdCache.get(cacheKey);

      if (!placeId) {
        const resolved = await findPlaceId(place.title, place.lat, place.lon);
        if (resolved) {
          placeId = resolved;
          placeIdCache.set(cacheKey, resolved);
        }
      }

      if (!placeId) {
        // No Google match — gracefully show nothing extra
        return;
      }

      // Step 2: Get details (backend checks Supabase cache)
      if (detailsCache.has(placeId)) {
        setDetails(detailsCache.get(placeId)!);
        return;
      }

      const result = await fetchPlaceDetails(placeId);
      if (result) {
        detailsCache.set(placeId, result);
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
