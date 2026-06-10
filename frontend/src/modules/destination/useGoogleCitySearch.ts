import { useState, useCallback, useRef } from 'react';
import { placesAutocomplete, geocodePlace } from '../../shared/api';
import type { AutocompleteResult } from '../../shared/types';

function newSessionId(): string {
  return Math.random().toString(36).slice(2);
}

interface GeoResult { lat: number; lon: number; name: string; address: string; country?: string; countryCode?: string }

const BLOCKED_COUNTRY_CODES = new Set([
  'kp',  // North Korea
  'sy',  // Syria
  'ir',  // Iran
  'cu',  // Cuba
  'mm',  // Myanmar
  'af',  // Afghanistan
  'ly',  // Libya (active conflict)
  'ye',  // Yemen
  'sd',  // Sudan
])

const BLOCKED_KEYWORDS = [
  'north korea', 'dprk', 'pyongyang',
  'syria', 'damascus', 'aleppo',
  'iran', 'tehran',
  'cuba', 'havana',
  'myanmar', 'rangoon', 'yangon', 'naypyidaw',
  'afghanistan', 'kabul',
  'libya', 'tripoli',
  'yemen', 'sanaa', "sana'a",
  'sudan', 'khartoum',
]

function isBlockedResult(r: AutocompleteResult & { _geo?: GeoResult }): boolean {
  // Check country code for Nominatim results
  if (r._geo?.countryCode && BLOCKED_COUNTRY_CODES.has(r._geo.countryCode)) return true
  // Check text for Google results (no country code available pre-geocode)
  const text = `${r.main_text} ${r.secondary_text ?? ''} ${r._geo?.country ?? ''}`.toLowerCase()
  return BLOCKED_KEYWORDS.some(kw => text.includes(kw))
}

// Nominatim fallback — used when Google Places returns nothing
async function nominatimCitySearch(query: string): Promise<Array<AutocompleteResult & { _geo?: GeoResult }>> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '1',
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
          country: addr.country ?? undefined,
          countryCode: (addr.country_code ?? '').toLowerCase(),
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
        // Pass 1: regions catches cities, districts, and states (e.g. "Goa")
        let predictions = await placesAutocomplete(input, sessionIdRef.current, '(regions)');
        // Pass 2: if nothing, try establishments — catches POIs (e.g. "Kedarnath")
        if (predictions.length === 0) {
          predictions = await placesAutocomplete(input, sessionIdRef.current, 'establishment');
        }
        const filteredPredictions = predictions.filter(r => !isBlockedResult(r));
        if (filteredPredictions.length > 0) {
          setResults(filteredPredictions);
        } else if (predictions.length === 0) {
          // Google returned nothing — fall back to Nominatim
          const fallback = await nominatimCitySearch(input);
          setResults(fallback.filter(r => !isBlockedResult(r)));
        } else {
          setResults([]);
        }
      } catch {
        // On any error try Nominatim
        try {
          const fallback = await nominatimCitySearch(input);
          setResults(fallback.filter(r => !isBlockedResult(r)));
        } catch {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const selectResult = useCallback(
    async (result: AutocompleteResult & { _geo?: GeoResult }): Promise<GeoResult | null | 'blocked'> => {
      // Belt-and-suspenders: block even if somehow a blocked result reaches selection
      if (isBlockedResult(result)) return 'blocked';
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
      if (!geo) return null;
      // Extract country from secondary_text: "Tokyo, Japan" → "Japan"
      const country = result.secondary_text
        ? result.secondary_text.split(',').at(-1)?.trim() || undefined
        : undefined;
      const resolvedGeo: GeoResult = { ...geo, country };
      // Final check: verify resolved geo doesn't belong to a blocked country
      if (isBlockedResult({ ...result, _geo: resolvedGeo })) return 'blocked';
      return resolvedGeo;
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
