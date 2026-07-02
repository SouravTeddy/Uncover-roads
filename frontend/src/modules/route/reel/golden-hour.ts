const cache = new Map<string, string | null>();

/**
 * Returns the golden hour start time as "HH:MM" in approximate local time.
 * Uses the free sunrise-sunset.org API (no key required).
 * The API returns UTC — we apply a longitude-based UTC offset estimate
 * (±30 min accuracy, good enough for a 90-min detection window).
 * Results are cached per lat/lon/date for the session lifetime.
 */
export async function computeGoldenHour(
  lat: number,
  lon: number,
  dateStr: string,
): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${dateStr}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${dateStr}&formatted=0`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) { cache.set(key, null); return null; }
    const json = await res.json() as { results?: { sunset?: string } };
    const sunsetIso = json.results?.sunset;
    if (!sunsetIso) { cache.set(key, null); return null; }

    // Convert UTC sunset to approximate local time via longitude offset
    const utcOffsetMs = Math.round(lon / 15) * 60 * 60 * 1000;
    const sunsetMs = new Date(sunsetIso).getTime();
    // Golden hour start = 45 min before sunset, in local time
    const goldenLocalMs = sunsetMs - 45 * 60 * 1000 + utcOffsetMs;
    const goldenLocal = new Date(goldenLocalMs);
    const hh = String(goldenLocal.getUTCHours()).padStart(2, '0');
    const mm = String(goldenLocal.getUTCMinutes()).padStart(2, '0');
    const result = `${hh}:${mm}`;
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
