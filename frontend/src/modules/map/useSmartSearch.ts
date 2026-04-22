// frontend/src/modules/map/useSmartSearch.ts
import type { Category } from '../../shared/types';

// ── Types ────────────────────────────────────────────────────────

export interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
}

export interface SuggestedChip {
  emoji: string;
  label: string;
  type: Category;
}

export interface SearchIntent {
  /** Place categories extracted from the query. Empty = no match found. */
  types: Category[];
  /** Named location extracted (e.g. "Eiffel Tower"). Null = use map bbox. */
  locationQuery: string | null;
  /** Chips to show when types is empty. */
  chips: SuggestedChip[];
}

// ── Dictionaries ─────────────────────────────────────────────────

const DIRECT_MAP: [RegExp, Category][] = [
  [/\b(museums?|galleries|gallerys?|exhibits?)\b/i,           'museum'],
  [/\b(parks?|gardens?|nature|outdoor)\b/i,                 'park'],
  [/\b(restaurants?|dining|food|eats?|lunch|dinner)\b/i,    'restaurant'],
  [/\b(cafes?|coffee|brunch)\b/i,                         'cafe'],
  [/\b(bars?|pubs?|nightlife)\b/i,                          'restaurant'],
  [/\b(churches?|mosques?|temples?|cathedrals?|synagogues?)\b/i,   'historic'],
  [/\b(landmarks?|monuments?|heritage|historic)\b/i,        'historic'],
  [/\b(hotels?|hostels?|accommodations?|stays?|sleep)\b/i,      'tourism'],
];

const INTENT_MAP: [RegExp, SuggestedChip[]][] = [
  [/morning|breakfast|cozy/i,   [{ emoji: '☕', label: 'cafe', type: 'cafe' }, { emoji: '🥐', label: 'bakery', type: 'restaurant' }]],
  [/night|evening|drinks/i,     [{ emoji: '🍸', label: 'bar', type: 'restaurant' }, { emoji: '🍽️', label: 'restaurant', type: 'restaurant' }]],
  [/kids|family|children/i,     [{ emoji: '🌿', label: 'park', type: 'park' }, { emoji: '🏛️', label: 'museum', type: 'museum' }]],
  [/culture|art|history/i,      [{ emoji: '🏛️', label: 'museum', type: 'museum' }, { emoji: '🏰', label: 'historic', type: 'historic' }]],
  [/nature|walk|green/i,        [{ emoji: '🌿', label: 'park', type: 'park' }]],
  [/shop|buy|market/i,          [{ emoji: '🛍️', label: 'market', type: 'place' }]],
];

const DEFAULT_CHIPS: SuggestedChip[] = [
  { emoji: '☕', label: 'cafe',    type: 'cafe' },
  { emoji: '🏛️', label: 'museum', type: 'museum' },
  { emoji: '🌿', label: 'park',   type: 'park' },
];

// ── Extraction ───────────────────────────────────────────────────

/** Extract place types and a named location from a free-text query. */
export function extractSearchIntent(query: string): SearchIntent {
  const types: Category[] = [];

  for (const [pattern, category] of DIRECT_MAP) {
    if (pattern.test(query) && !types.includes(category)) {
      types.push(category);
    }
  }

  // Named location: text after "near", "in", "at", "on", "around"
  const locMatch = query.match(/(?:near|in|at|on|around)\s+(.+?)(?:\s+and\b|\s+or\b|$)/i);
  const locationQuery = locMatch ? locMatch[1].trim() : null;

  // Chips for when types is empty
  let chips: SuggestedChip[] = [];
  if (types.length === 0) {
    for (const [pattern, suggestions] of INTENT_MAP) {
      if (pattern.test(query)) {
        chips = [...chips, ...suggestions];
        break; // first match wins
      }
    }
    if (chips.length === 0) chips = DEFAULT_CHIPS;
  }

  return { types, locationQuery, chips };
}

// ── Nominatim ────────────────────────────────────────────────────

export function nominatimToCategory(cls: string, type: string): Category {
  if (cls === 'amenity') {
    if (['restaurant', 'bar', 'fast_food', 'food_court', 'biergarten'].includes(type)) return 'restaurant';
    if (type === 'cafe') return 'cafe';
    if (type === 'museum') return 'museum';
  }
  if (cls === 'tourism') {
    if (['museum', 'gallery', 'artwork'].includes(type)) return 'museum';
    if (['hotel', 'hostel'].includes(type)) return 'tourism';
    if (['attraction', 'viewpoint', 'theme_park'].includes(type)) return 'tourism';
  }
  if (cls === 'historic') return 'historic';
  if (cls === 'leisure' || ['park', 'garden', 'nature_reserve'].includes(type)) return 'park';
  return 'place';
}

export async function nominatimSearch(
  query: string,
  bbox: [number, number, number, number] | null,
  signal: AbortSignal,
): Promise<NominatimResult[]> {
  const [south, north, west, east] = bbox ?? [0, 0, 0, 0];
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
    'accept-language': 'en',
  });
  if (bbox) {
    params.set('viewbox', `${west},${north},${east},${south}`);
    params.set('bounded', '1');
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'uncover-roads/1.0' },
    signal,
  });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && data.length === 0 && bbox) {
    params.delete('bounded');
    params.delete('viewbox');
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'uncover-roads/1.0' },
      signal,
    });
    if (!res2.ok) throw new Error(`Nominatim error ${res2.status}`);
    return res2.json();
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Run one Nominatim call per type in parallel, merge + deduplicate by place_id.
 * Falls back to a plain text search when types array is empty.
 */
export async function multiTypeNominatimSearch(
  types: Category[],
  plainQuery: string,
  bbox: [number, number, number, number] | null,
  signal: AbortSignal,
): Promise<NominatimResult[]> {
  if (types.length === 0) {
    return nominatimSearch(plainQuery, bbox, signal);
  }

  const results = await Promise.all(
    types.map(type => nominatimSearch(type, bbox, signal)),
  );

  const seen = new Set<number>();
  const merged: NominatimResult[] = [];
  for (const batch of results) {
    for (const r of batch) {
      if (!seen.has(r.place_id)) {
        seen.add(r.place_id);
        merged.push(r);
      }
    }
  }
  return merged.slice(0, 10);
}

// ── Bbox helpers ─────────────────────────────────────────────────

/** Diagonal distance in km of a [south, north, west, east] bbox. */
export function bboxDiagonalKm(bbox: [number, number, number, number]): number {
  const [south, north, west, east] = bbox;
  const R = 6371;
  const dLat = ((north - south) * Math.PI) / 180;
  const dLon = ((east - west) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((south * Math.PI) / 180) *
      Math.cos((north * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
