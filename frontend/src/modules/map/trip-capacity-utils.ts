export type CapacityStatus = 'unset' | 'ok' | 'overflow' | 'shortage';

/**
 * Returns a capacity status based on how many places fit into the trip duration.
 * Threshold: 5 places/day (fast pace cap). Will be parameterised when pace setting exists.
 */
export function getTripCapacityStatus(
  placeCount: number,
  totalDays: number,
): CapacityStatus {
  if (totalDays === 0 || placeCount === 0) return 'unset';
  if (placeCount < totalDays) return 'shortage';        // < 1 place/day
  if (placeCount > totalDays * 5) return 'overflow';    // > 5 places/day
  return 'ok';
}

/**
 * Computes the number of trip days (inclusive) from two ISO date strings.
 * Returns 0 if either date is null.
 */
export function computeTotalDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

/**
 * Returns a new ISO date string offset by `days` days from `isoDate`.
 * Uses T12:00:00 to avoid DST boundary issues.
 */
export function addDaysToIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
