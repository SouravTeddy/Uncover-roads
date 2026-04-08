const NOISE_TYPES = new Set([
  'point_of_interest', 'establishment', 'food', 'store', 'premise',
  'subpremise', 'geocode', 'street_address', 'route', 'locality', 'political',
]);

/** Filter Google types[], remove noise, title-case, max 3. */
export function filterTypes(types: string[]): string[] {
  return types
    .filter(t => !NOISE_TYPES.has(t))
    .slice(0, 3)
    .map(t =>
      t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    );
}

/**
 * Return the weekday_text line for a given JS day-of-week (0 = Sunday).
 * Google's weekday_text array starts at Monday (index 0).
 */
export function getHoursLabel(weekdayText: string[], jsDay: number): string | null {
  const googleDay = jsDay === 0 ? 6 : jsDay - 1;
  return weekdayText[googleDay] ?? null;
}

/**
 * From a weekday_text line like "Monday: 9:00 AM – 11:00 PM",
 * extract a human label: "Open now · Closes 11:00 PM" or "Closed · Opens 9:00 AM".
 * Returns the original line if the pattern doesn't match.
 */
export function parseOpenClose(line: string, openNow: boolean): string {
  const match = line.match(/:\s*(\d+:\d+\s*(?:AM|PM))\s*[–\-]\s*(\d+:\d+\s*(?:AM|PM))/i);
  if (!match) return line;
  const [, open, close] = match;
  return openNow
    ? `Open now · Closes ${close}`
    : `Closed · Opens ${open}`;
}

/** Apple Maps on iOS/macOS, Google Maps otherwise. */
export function getDirectionsUrl(lat: number, lon: number, userAgent = navigator.userAgent): string {
  const isApple = /Mac|iPhone|iPad|iPod/.test(userAgent);
  return isApple
    ? `maps://maps.apple.com/?q=${lat},${lon}`
    : `https://maps.google.com/maps?q=${lat},${lon}`;
}
