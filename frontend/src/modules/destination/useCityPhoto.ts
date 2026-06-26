import { useEffect, useState } from 'react';
import { preloadImages } from '../../shared/imagePreloader';

const BASE = import.meta.env.VITE_API_URL ?? '';

// DB stores either a Google proxy path ("/place-photo?...") or null.
// Old Unsplash short IDs are treated as missing.
function resolveDbUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('/place-photo')) return `${BASE}${raw}`;
  if (raw.startsWith('http')) return raw; // future-proof for absolute Google URLs
  return null;
}

/** In-memory cache: city name (lowercased) → resolved URL or null */
const _cache = new Map<string, string | null>();

/** Fetches Google-backed image URL for a city. Returns null until resolved. */
export function useCityPhoto(cityName: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    cityName ? (_cache.get(cityName.toLowerCase()) ?? null) : null
  );

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
        const resolved = resolveDbUrl(Object.values(data)[0]);
        _cache.set(key, resolved);
        preloadImages([resolved]);
        setUrl(resolved);
      })
      .catch(() => {});
  }, [cityName]);

  return url;
}

/** Batch-fetches Google-backed image URLs for multiple cities. */
export function useCityPhotoBatch(cities: string[]): Map<string, string | null> {
  const [photoMap, setPhotoMap] = useState<Map<string, string | null>>(() => {
    const m = new Map<string, string | null>();
    for (const c of cities) {
      m.set(c.toLowerCase(), _cache.get(c.toLowerCase()) ?? null);
    }
    return m;
  });

  useEffect(() => {
    if (cities.length === 0) return;
    const missing = cities.filter(c => !_cache.has(c.toLowerCase()));
    if (missing.length === 0) return;

    const params = new URLSearchParams({ names: missing.join(',') });
    fetch(`${BASE}/api/cities/photos?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, string | null> | null) => {
        const updated = new Map(photoMap);
        const entries = data ? Object.entries(data) : missing.map(c => [c, null] as [string, null]);
        for (const [name, imgUrl] of entries) {
          const resolved = resolveDbUrl(imgUrl);
          _cache.set(name.toLowerCase(), resolved);
          updated.set(name.toLowerCase(), resolved);
          preloadImages([resolved]);
        }
        setPhotoMap(updated);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.join(',')]);

  return photoMap;
}
