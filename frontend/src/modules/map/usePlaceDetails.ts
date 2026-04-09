import { useState, useCallback } from 'react';
import { fetchPinDetails } from '../../shared/api';
import type { Place, PlaceDetails } from '../../shared/types';

// Module-level cache — persists across renders, resets on page reload
const detailsCache = new Map<string, PlaceDetails>();

/** Returns the live details cache reference (read-only intent). */
export function getAllCachedDetails(): ReadonlyMap<string, PlaceDetails> {
  return detailsCache;
}

/** Returns cached details key for a place, if resolved. */
export function getCachedPlaceIdKey(_name: string, lat: number, lon: number): string | undefined {
  const key = `${lat.toFixed(5)}:${lon.toFixed(5)}`;
  return detailsCache.has(key) ? key : undefined;
}

/** Fetch a short description from Wikipedia for a place that has an OSM wikipedia tag. */
async function fetchWikipediaSummary(wikipediaTag: string): Promise<string | null> {
  try {
    // OSM wikipedia tag format: "en:Article_Title" or just "Article_Title"
    const article = wikipediaTag.includes(':')
      ? wikipediaTag.slice(wikipediaTag.indexOf(':') + 1)
      : wikipediaTag;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    // data.extract is the opening paragraph; truncate to ~200 chars
    const extract: string = data.extract ?? '';
    if (!extract) return null;
    return extract.length > 220 ? extract.slice(0, 217) + '…' : extract;
  } catch {
    return null;
  }
}

export function usePlaceDetails() {
  const [details, setDetails] = useState<PlaceDetails | null>(null);

  // Fetches details silently — card renders immediately with OSM data,
  // Google + Wikipedia data enrich it when ready.
  const fetchDetails = useCallback(async (place: Place) => {
    const cacheKey = `${place.lat.toFixed(5)}:${place.lon.toFixed(5)}`;

    // Cache hit — immediate render, no fetch needed
    if (detailsCache.has(cacheKey)) {
      setDetails(detailsCache.get(cacheKey)!);
      return;
    }

    setDetails(null);

    // Fire Google and Wikipedia requests in parallel
    const [googleResult, wikiSummary] = await Promise.allSettled([
      fetchPinDetails(place.lat, place.lon, place.title, place.category, place.place_id ?? ''),
      place.tags?.wikipedia ? fetchWikipediaSummary(place.tags.wikipedia) : Promise.resolve(null),
    ]);

    const google = googleResult.status === 'fulfilled' ? googleResult.value : null;
    const wiki = wikiSummary.status === 'fulfilled' ? wikiSummary.value : null;

    // Merge: Google data + Wikipedia description as fallback
    const merged: PlaceDetails | null = google
      ? {
          ...google,
          // Use Google's editorial_summary if present, otherwise Wikipedia
          editorial_summary: google.editorial_summary || wiki || undefined,
        }
      : wiki
        ? {
            // Minimal PlaceDetails shell to carry the Wikipedia description
            place_id: '',
            name: place.title,
            address: '',
            lat: place.lat,
            lon: place.lon,
            editorial_summary: wiki,
          }
        : null;

    if (merged) {
      detailsCache.set(cacheKey, merged);
      setDetails(merged);
    }
  }, []);

  const clearDetails = useCallback(() => {
    setDetails(null);
  }, []);

  return { details, fetchDetails, clearDetails };
}
