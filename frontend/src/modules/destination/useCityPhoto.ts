import { useEffect, useState } from 'react';
import { getCityPhotoUrl } from '../../shared/cityPhoto';

const BASE = import.meta.env.VITE_API_URL ?? '';

/** In-memory cache: city name (lowercased) → resolved URL */
const _cache = new Map<string, string>();

/** Fetches image URL for a single city from DB; falls back to Unsplash map. */
export function useCityPhoto(cityName: string | null): string {
  const fallback = cityName ? getCityPhotoUrl(cityName) : getCityPhotoUrl('');

  const [url, setUrl] = useState<string>(() => {
    if (!cityName) return fallback;
    return _cache.get(cityName.toLowerCase()) ?? fallback;
  });

  useEffect(() => {
    if (!cityName) return;
    const key = cityName.toLowerCase();
    if (_cache.has(key)) {
      setUrl(_cache.get(key)!);
      return;
    }
    const params = new URLSearchParams({ names: cityName });
    fetch(`${BASE}/api/cities/photos?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, string | null> | null) => {
        if (!data) return;
        const found = Object.values(data)[0];
        if (found) {
          _cache.set(key, found);
          setUrl(found);
        }
      })
      .catch(() => {/* keep fallback */});
  }, [cityName]);

  return url;
}

/** Batch-fetches image URLs for multiple cities. Returns a stable map. */
export function useCityPhotoBatch(cities: string[]): Map<string, string> {
  const [photoMap, setPhotoMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const c of cities) {
      const key = c.toLowerCase();
      // Pre-populate with Unsplash fallback so map is never empty on first render.
      m.set(key, _cache.get(key) ?? getCityPhotoUrl(c));
    }
    return m;
  });

  useEffect(() => {
    if (cities.length === 0) return;
    const missing = cities.filter(c => !_cache.has(c.toLowerCase()));
    if (missing.length === 0) return;

    const applyFallbacks = () => {
      setPhotoMap(prev => {
        const updated = new Map(prev);
        let changed = false;
        for (const c of missing) {
          const key = c.toLowerCase();
          if (!updated.has(key)) {
            const url = getCityPhotoUrl(c);
            _cache.set(key, url);
            updated.set(key, url);
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    };

    const params = new URLSearchParams({ names: missing.join(',') });
    fetch(`${BASE}/api/cities/photos?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, string | null> | null) => {
        if (!data) { applyFallbacks(); return; }
        const updated = new Map(photoMap);
        for (const [name, imgUrl] of Object.entries(data)) {
          const resolved = imgUrl ?? getCityPhotoUrl(name);
          _cache.set(name.toLowerCase(), resolved);
          updated.set(name.toLowerCase(), resolved);
        }
        setPhotoMap(updated);
      })
      .catch(applyFallbacks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.join(',')]);

  return photoMap;
}
