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

export type OurPickBadge = 'trending' | 'hidden_gem' | 'getting_busy' | null;

export interface AnalysisInsight {
  text: string
  state: 'gold' | 'green' | 'red'
  linkLabel?: string
}

/**
 * Returns up to 3 travel-aware AnalysisInsight objects.
 * First insight is always open/close status when details are available.
 */
export function computeAnalysisInsights(
  place: { category: string },
  details: { weekday_text?: string[]; open_now?: boolean } | null | undefined,
  ourPickBadge: OurPickBadge,
  travelStart: string | null,
  travelEnd: string | null,
): AnalysisInsight[] {
  const insights: AnalysisInsight[] = []

  // 1. Open/close insight — always first
  if (details?.weekday_text?.length && travelStart && travelEnd) {
    const closedDay = (() => {
      const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const endDate1 = new Date(travelEnd + 'T12:00:00Z')
      for (
        let d = new Date(travelStart + 'T12:00:00Z');
        d <= endDate1;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const jsDay = d.getUTCDay()
        const googleIdx = jsDay === 0 ? 6 : jsDay - 1
        const line = details.weekday_text![googleIdx]
        if (line && /closed/i.test(line)) {
          const day = d.getUTCDate()
          const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
          return { dayName: DAY[jsDay], dateStr: `${month} ${day}` }
        }
      }
      return null
    })()

    if (closedDay === null) {
      const startFmt = new Date(travelStart + 'T12:00:00Z').toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      const endFmt = new Date(travelEnd + 'T12:00:00Z').toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      insights.push({ text: `Open every day ${startFmt}–${endFmt} · no schedule conflicts`, state: 'green' })
    } else {
      insights.push({
        text: `Closed ${closedDay.dayName} · ${closedDay.dateStr} falls in your trip → plan another day`,
        state: 'red',
        linkLabel: 'check hours',
      })
    }
  }

  // 2. Trend velocity
  if (ourPickBadge && travelStart) {
    const month = new Date(travelStart + 'T12:00:00Z').toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    if (ourPickBadge === 'trending') {
      insights.push({ text: `Trending in ${month} · popular during your dates → consider booking ahead`, state: 'gold', linkLabel: 'reserve' })
    } else if (ourPickBadge === 'hidden_gem') {
      insights.push({ text: `Hidden gem · fewer crowds during your trip → any time of day works`, state: 'gold' })
    } else if (ourPickBadge === 'getting_busy') {
      insights.push({ text: `Getting popular fast · crowds growing → visit early in your trip`, state: 'gold' })
    }
  }

  // 3. Best visiting time heuristic
  if (travelStart && travelEnd && insights.length < 3) {
    let includesWeekend = false
    let allWeekdays = true
    const endDate2 = new Date(travelEnd + 'T12:00:00Z')
    for (
      let d = new Date(travelStart + 'T12:00:00Z');
      d <= endDate2;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const day = d.getUTCDay()
      if (day === 0 || day === 6) { includesWeekend = true; allWeekdays = false }
    }

    const cat = place.category
    if ((cat === 'tourism' || cat === 'park' || cat === 'historic') && includesWeekend) {
      insights.push({ text: `Busiest on weekends · your trip includes Sat–Sun → arrive before 10am`, state: 'gold' })
    } else if (cat === 'restaurant') {
      insights.push({ text: `Peak lunch 12–2pm · your trip overlaps weekdays → book a table ahead`, state: 'gold', linkLabel: 'reserve' })
    } else if (cat === 'cafe' && allWeekdays) {
      insights.push({ text: `Quieter on weekday mornings · your trip aligns well → no need to rush`, state: 'gold' })
    }
  }

  return insights.slice(0, 3)
}
