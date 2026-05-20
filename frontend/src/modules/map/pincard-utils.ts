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

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Given Google's weekday_text array and an ISO travel date ("YYYY-MM-DD"),
 * returns a badge object for the travel date's day of week.
 *
 * Returns null if weekdayText is empty or travelDate is not parseable.
 */
export function getTravelDateBadge(
  weekdayText: string[],
  travelDate: string,
): { text: string; status: 'open' | 'closed' } | null {
  if (!weekdayText.length) return null;

  // Parse the travel date as UTC noon to avoid timezone shifts
  const d = new Date(travelDate + 'T12:00:00Z');
  if (isNaN(d.getTime())) return null;

  const jsDay = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const googleIdx = jsDay === 0 ? 6 : jsDay - 1; // Google's array: Mon=0 … Sun=6
  const line = weekdayText[googleIdx];
  if (!line) return null;

  const shortDay = SHORT_DAY[jsDay];
  const dayNum = d.getUTCDate();
  const monthName = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  const isClosed = /closed/i.test(line);
  if (isClosed) {
    return {
      text: `⚠️ Closed ${shortDay} · Your travel day is ${shortDay} ${dayNum} ${monthName}`,
      status: 'closed',
    };
  }

  // Extract closing time from "DayName: HH:MM AM – HH:MM AM"
  const closeMatch = line.match(/[–\-]\s*(\d+:\d+\s*(?:AM|PM))/i);
  const closeTime = closeMatch ? closeMatch[1] : null;

  return {
    text: closeTime
      ? `📅 Open · ${shortDay} ${dayNum} ${monthName} · Closes ${closeTime}`
      : `📅 Open · ${shortDay} ${dayNum} ${monthName}`,
    status: 'open',
  };
}

type OurPickBadge = 'trending' | 'hidden_gem' | 'getting_busy' | null;

/**
 * Returns up to 3 travel-aware insight strings for the Our Analysis aura strip.
 * Priority: trend velocity → hours/open status → best-time heuristic.
 */
export function computeAnalysisInsights(
  place: { category: string },
  details: { weekday_text?: string[]; open_now?: boolean | null } | null | undefined,
  ourPickBadge: OurPickBadge,
  travelStart: string | null,
  travelEnd: string | null,
): string[] {
  const insights: string[] = [];

  // 1. Trend velocity
  if (ourPickBadge && travelStart) {
    const month = new Date(travelStart + 'T12:00:00Z').toLocaleString('en-US', {
      month: 'long', timeZone: 'UTC',
    });
    if (ourPickBadge === 'trending') {
      insights.push(`Popular in ${month} — can get busy around your trip`);
    } else if (ourPickBadge === 'hidden_gem') {
      insights.push(`Hidden gem — fewer crowds during your trip`);
    } else if (ourPickBadge === 'getting_busy') {
      insights.push(`Getting popular — worth visiting early in your trip`);
    }
  }

  // 2. Hours / open status across travel days
  if (details?.weekday_text?.length && travelStart && travelEnd) {
    const closedDays: string[] = [];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (
      let d = new Date(travelStart + 'T12:00:00Z');
      d <= new Date(travelEnd + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const jsDay = d.getUTCDay();
      const googleIdx = jsDay === 0 ? 6 : jsDay - 1;
      const line = details.weekday_text[googleIdx];
      if (line && /closed/i.test(line)) {
        closedDays.push(DAY_NAMES[jsDay]);
      }
    }

    if (closedDays.length === 0) {
      insights.push(`Open on all your travel days`);
    } else {
      insights.push(`Closed on ${closedDays[0]} — check your itinerary`);
    }
  }

  // 3. Best visiting time heuristic
  if (travelStart && travelEnd) {
    let includesWeekend = false;
    for (
      let d = new Date(travelStart + 'T12:00:00Z');
      d <= new Date(travelEnd + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const day = d.getUTCDay();
      if (day === 0 || day === 6) { includesWeekend = true; break; }
    }

    const cat = place.category;
    if ((cat === 'tourism' || cat === 'park' || cat === 'historic') && includesWeekend) {
      insights.push(`Gets busy on weekends — go early morning`);
    } else if (cat === 'restaurant') {
      insights.push(`Peak lunch 12–2pm — consider booking ahead`);
    } else if (cat === 'cafe') {
      let allWeekdays = true;
      for (
        let d = new Date(travelStart + 'T12:00:00Z');
        d <= new Date(travelEnd + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const day = d.getUTCDay();
        if (day === 0 || day === 6) { allWeekdays = false; break; }
      }
      if (allWeekdays) {
        insights.push(`Quieter on weekdays — your trip includes weekday mornings`);
      }
    }
  }

  return insights.slice(0, 3);
}
