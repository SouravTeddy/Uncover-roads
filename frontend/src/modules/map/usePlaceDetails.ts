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

  // Fetches details silently in the background — no loading state.
  // The card renders immediately with OSM data; Google data enriches it when ready.
  const fetchDetails = useCallback(async (place: Place) => {
    const cacheKey = `${place.lat.toFixed(5)}:${place.lon.toFixed(5)}`;

    // Check client-side cache first (synchronous — no flicker)
    if (detailsCache.has(cacheKey)) {
      setDetails(detailsCache.get(cacheKey)!);
      return;
    }

    // Reset to null so previous card's details don't leak into the new card
    setDetails(null);

    try {
      const result = await fetchPinDetails(place.lat, place.lon, place.title, place.category);
      if (result) {
        detailsCache.set(cacheKey, result);
        setDetails(result);
      }
    } catch {
      // Silently ignore — card will remain on OSM-only data
    }
  }, []);

  const clearDetails = useCallback(() => {
    setDetails(null);
  }, []);

  return { details, fetchDetails, clearDetails };
}
