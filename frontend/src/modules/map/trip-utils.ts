import type { Place, PlaceDetails } from '../../shared/types';

export interface DateEntry {
  isoDate: string;   // "YYYY-MM-DD"
  dayAbbr: string;   // "Mon"
  dayNum: number;    // 14
}

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Generate a strip of `count` consecutive days starting from today. */
export function generateDateStrip(count = 7): DateEntry[] {
  const result: DateEntry[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    result.push({
      isoDate: iso,
      dayAbbr: DAY_ABBRS[d.getDay()],
      dayNum: d.getDate(),
    });
  }
  return result;
}

/**
 * Parse the opening time (minutes since midnight) from a weekday_text line.
 * Google's weekday_text format: "Monday: 9:00 AM – 11:00 PM"
 * Returns null if the line is "Closed" or unparseable.
 */
function parseOpeningMinutes(weekdayText: string[], jsDay: number): number | null {
  // Google weekday_text: Mon=0, Tue=1, ..., Sun=6
  const googleDay = jsDay === 0 ? 6 : jsDay - 1;
  const line = weekdayText[googleDay];
  if (!line) return null;
  const match = line.match(/:\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

/**
 * Compute the app-recommended start time from the selected places' opening hours.
 * - Finds the earliest opening hour across all places on the selected date.
 * - Defaults to 9:00 AM if no opening hour data is available.
 * - Floors at 8:00 AM (won't suggest earlier).
 * - Rounds to the nearest 30 minutes.
 * Returns "HH:MM" in 24-hour format.
 */
export function computeRecommendedStartTime(
  selectedPlaces: Place[],
  getDetails: (title: string, lat: number, lon: number) => PlaceDetails | undefined,
  isoDate: string,
): string {
  const jsDay = new Date(isoDate + 'T12:00:00').getDay();
  let earliestMin = Infinity;

  for (const place of selectedPlaces) {
    const d = getDetails(place.title, place.lat, place.lon);
    if (!d?.weekday_text) continue;
    const openMin = parseOpeningMinutes(d.weekday_text, jsDay);
    if (openMin !== null && openMin < earliestMin) {
      earliestMin = openMin;
    }
  }

  if (!isFinite(earliestMin)) earliestMin = 9 * 60; // default 9:00 AM
  if (earliestMin < 8 * 60) earliestMin = 8 * 60;   // floor at 8:00 AM
  earliestMin = Math.round(earliestMin / 30) * 30;   // round to 30 min

  const h = Math.floor(earliestMin / 60);
  const m = earliestMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert "HH:MM" (24h) to "9:30 AM" display format. */
export function formatTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}
