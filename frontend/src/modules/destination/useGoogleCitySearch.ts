import { useState, useCallback, useRef } from 'react';
import { placesAutocomplete, geocodePlace } from '../../shared/api';
import type { AutocompleteResult } from '../../shared/types';

function newSessionId(): string {
  return Math.random().toString(36).slice(2);
}

export function useGoogleCitySearch() {
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionIdRef = useRef<string>(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < 2) {
      setResults([]);
      return;
    }
    // 300ms debounce — keystrokes are free (session tokens), this just reduces noise
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const predictions = await placesAutocomplete(input, sessionIdRef.current);
        setResults(predictions);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const selectResult = useCallback(
    async (result: AutocompleteResult) => {
      // This ends the billing session ($0.017)
      const geo = await geocodePlace(result.place_id, sessionIdRef.current);
      // Reset session for next search
      sessionIdRef.current = newSessionId();
      setResults([]);
      return geo; // { lat, lon, name, address } | null
    },
    []
  );

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
    sessionIdRef.current = newSessionId();
  }, []);

  return { results, loading, search, selectResult, clear };
}
