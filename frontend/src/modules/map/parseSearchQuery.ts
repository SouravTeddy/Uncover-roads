import type { Category } from '../../shared/types';

export interface ParsedQuery {
  category: Category | null;
  locationString: string | null;
  dateString: string | null;
}

export interface DateValidation {
  isoDate: string | null;
  withinTrip: boolean | null;
  nudgeMessage: string | null;
}

const CATEGORY_KEYWORDS: Record<string, Category> = {
  museum: 'museum', gallery: 'museum', art: 'museum',
  restaurant: 'restaurant', food: 'restaurant', eat: 'restaurant',
  café: 'restaurant', cafe: 'restaurant',
  park: 'park', garden: 'park', nature: 'park',
  temple: 'historic', shrine: 'historic', historic: 'historic',
  event: 'event', events: 'event', live: 'event', show: 'event', concert: 'event',
  bar: 'restaurant', nightlife: 'restaurant',
};

const LOCATION_PREFIXES = ['near', 'in', 'around', 'by'];

const DATE_PATTERN =
  /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\b/i;

export function parseSearchQuery(input: string): ParsedQuery {
  const lower = input.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Category: first matching keyword wins
  let category: Category | null = null;
  for (const word of words) {
    if (CATEGORY_KEYWORDS[word]) { category = CATEGORY_KEYWORDS[word]; break; }
  }

  // Location: text after first location prefix
  let locationString: string | null = null;
  for (const prefix of LOCATION_PREFIXES) {
    const idx = words.indexOf(prefix);
    if (idx !== -1 && idx < words.length - 1) {
      locationString = words.slice(idx + 1).join(' ');
      break;
    }
  }

  // Date: regex match (preserve original ordinal suffix in dateString)
  const dateMatch = lower.match(DATE_PATTERN);
  const dateString = dateMatch ? dateMatch[0].trim() : null;

  return { category, locationString, dateString };
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function resolveDate(dateString: string): Date | null {
  const lower = dateString.toLowerCase().trim();
  // "april 23" or "23 april" or "23rd april" or "april 23rd"
  const m1 = lower.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  const m2 = lower.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/);
  let day = -1, month = -1;
  if (m1) { month = MONTH_MAP[m1[1]] ?? -1; day = parseInt(m1[2]); }
  else if (m2) { day = parseInt(m2[1]); month = MONTH_MAP[m2[2]] ?? -1; }
  if (day < 1 || month < 0) return null;
  return new Date(new Date().getFullYear(), month, day);
}

export function validateSearchDate(
  dateString: string,
  travelStartDate: string | null,
  travelEndDate: string | null,
): DateValidation {
  const resolved = resolveDate(dateString);
  if (!resolved) return { isoDate: null, withinTrip: null, nudgeMessage: null };

  const isoDate = resolved.getFullYear() + '-' +
    String(resolved.getMonth() + 1).padStart(2, '0') + '-' +
    String(resolved.getDate()).padStart(2, '0');

  if (!travelStartDate || !travelEndDate) {
    return { isoDate, withinTrip: null, nudgeMessage: null };
  }

  const withinTrip = isoDate >= travelStartDate && isoDate <= travelEndDate;
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const nudgeMessage = withinTrip
    ? null
    : `${fmt(isoDate)} is outside your trip (${fmt(travelStartDate)}–${fmt(travelEndDate)})`;

  return { isoDate, withinTrip, nudgeMessage };
}
