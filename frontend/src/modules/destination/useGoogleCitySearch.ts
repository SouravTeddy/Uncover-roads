import { useState, useCallback, useRef } from 'react';
import { placesAutocomplete, geocodePlace } from '../../shared/api';
import type { AutocompleteResult } from '../../shared/types';

function newSessionId(): string {
  return Math.random().toString(36).slice(2);
}

interface GeoResult { lat: number; lon: number; name: string; address: string }

// Nominatim fallback — used when Google Places returns nothing
async function nominatimCitySearch(query: string): Promise<Array<AutocompleteResult & { _geo?: GeoResult }>> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '1',
    featuretype: 'city',
    'accept-language': 'en',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en' },
    });
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => {
      const addr = (r.address ?? {}) as Record<string, string>;
      const mainText = addr.city ?? addr.town ?? addr.village ?? addr.county ?? (r.display_name as string).split(',')[0];
      const secondary = (r.display_name as string).split(',').slice(1, 3).join(',').trim();
      return {
        place_id: `nominatim_${r.place_id}`,
        description: r.display_name as string,
        main_text: mainText,
        secondary_text: secondary,
        _geo: {
          lat: parseFloat(r.lat as string),
          lon: parseFloat(r.lon as string),
          name: mainText,
          address: r.display_name as string,
        },
      };
    });
  } catch {
    return [];
  }
}

export function useGoogleCitySearch() {
  const [results, setResults] = useState<Array<AutocompleteResult & { _geo?: GeoResult }>>([]);
  const [loading, setLoading] = useState(false);
  const sessionIdRef = useRef<string>(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const predictions = await placesAutocomplete(input, sessionIdRef.current);
        if (predictions.length > 0) {
          setResults(predictions);
        } else {
          // Google returned nothing — fall back to Nominatim
          const fallback = await nominatimCitySearch(input);
          setResults(fallback);
        }
      } catch {
        // On any error try Nominatim
        try {
          const fallback = await nominatimCitySearch(input);
          setResults(fallback);
        } catch {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const selectResult = useCallback(
    async (result: AutocompleteResult & { _geo?: GeoResult }): Promise<GeoResult | null> => {
      // Nominatim results already carry geo — no extra API call needed
      if (result.place_id.startsWith('nominatim_')) {
        sessionIdRef.current = newSessionId();
        setResults([]);
        return result._geo ?? null;
      }
      // Google result — geocode via backend (ends the billing session)
      const geo = await geocodePlace(result.place_id, sessionIdRef.current);
      sessionIdRef.current = newSessionId();
      setResults([]);
      return geo;
    },
    [],
  );

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
    sessionIdRef.current = newSessionId();
  }, []);

  return { results, loading, search, selectResult, clear };
}
