// Chip taxonomy and URL builder for contextual action chips on RecoCard.

export type ChipKind = 'expand' | 'direct';

export interface ChipDef {
  label: string;      // e.g. "Café nearby ›" or "Restrooms ↗"
  emoji: string;
  kind: ChipKind;
  nearbyType?: string; // Google Places type for expand chips (e.g. 'cafe')
}

// ── Type → chip groups ───────────────────────────────────────────

interface ChipGroup {
  types: string[];
  expand: Array<{ label: string; emoji: string; nearbyType: string }>;
  direct: Array<{ label: string; emoji: string }>;
}

const CHIP_GROUPS: ChipGroup[] = [
  {
    types: ['museum', 'art_gallery', 'exhibition_center'],
    expand: [
      { label: 'Museum café ›', emoji: '☕', nearbyType: 'cafe' },
      { label: 'Gift shop ›',   emoji: '🛍', nearbyType: 'store' },
    ],
    direct: [
      { label: 'Book tickets ↗', emoji: '🎟' },
      { label: 'Restrooms ↗',    emoji: '🚻' },
    ],
  },
  {
    types: ['hindu_temple', 'mosque', 'church', 'place_of_worship', 'synagogue'],
    expand: [
      { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
    ],
    direct: [
      { label: 'Prayer times ↗', emoji: '🙏' },
      { label: 'Dress code ↗',   emoji: '👗' },
      { label: 'Restrooms ↗',    emoji: '🚻' },
    ],
  },
  {
    types: ['park', 'national_park', 'botanical_garden', 'hiking_area', 'nature_reserve'],
    expand: [
      { label: 'Café nearby ›',  emoji: '☕', nearbyType: 'cafe' },
      { label: 'Photo spots ›',  emoji: '📸', nearbyType: 'tourist_attraction' },
    ],
    direct: [
      { label: 'Trail map ↗',  emoji: '🥾' },
      { label: 'Restrooms ↗', emoji: '🚻' },
    ],
  },
  {
    types: ['tourist_attraction', 'viewpoint', 'landmark'],
    expand: [
      { label: 'Best angles ›', emoji: '📸', nearbyType: 'tourist_attraction' },
      { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
    ],
    direct: [
      { label: 'Street view ↗', emoji: '🗺' },
      { label: 'Restrooms ↗',   emoji: '🚻' },
    ],
  },
  {
    types: ['restaurant', 'food', 'bar', 'night_club', 'cafe', 'bakery', 'coffee_shop'],
    expand: [
      { label: 'Dessert nearby ›', emoji: '🍦', nearbyType: 'bakery' },
    ],
    direct: [
      { label: 'Walk it off ↗',  emoji: '🚶' },
      { label: 'Leave review ↗', emoji: '⭐' },
      { label: 'Restrooms ↗',    emoji: '🚻' },
    ],
  },
  {
    types: ['historic', 'monument', 'ruins', 'castle', 'memorial'],
    expand: [
      { label: 'Photo spots ›', emoji: '📸', nearbyType: 'tourist_attraction' },
      { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
    ],
    direct: [
      { label: 'Book ahead ↗', emoji: '🎟' },
      { label: 'Restrooms ↗',  emoji: '🚻' },
    ],
  },
];

const FALLBACK_GROUP: ChipGroup = {
  types: [],
  expand: [
    { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
  ],
  direct: [
    { label: 'Explore nearby ↗', emoji: '🗺' },
    { label: 'Restrooms ↗',      emoji: '🚻' },
  ],
};

// ── Time-based chip definitions ──────────────────────────────────

const TIME_CHIPS: Array<{ minStart: number; minEnd: number; chip: ChipDef }> = [
  {
    minStart: 11 * 60,
    minEnd: 14 * 60,
    chip: { label: 'Lunch nearby ›', emoji: '🍽', kind: 'expand', nearbyType: 'restaurant' },
  },
  {
    minStart: 15 * 60,
    minEnd: 17 * 60,
    chip: { label: 'Afternoon coffee ›', emoji: '☕', kind: 'expand', nearbyType: 'cafe' },
  },
  {
    minStart: 18 * 60,
    minEnd: Infinity,
    chip: { label: 'Dinner nearby ›', emoji: '🌙', kind: 'expand', nearbyType: 'restaurant' },
  },
];

// ── Public API ───────────────────────────────────────────────────

/**
 * Returns up to 4 contextual chips for a stop.
 * @param googleTypes  Google Place types[] for the stop (from usePlaceDetails cache)
 * @param timeMins     Current stop start time in minutes from midnight
 */
export function getContextualChips(googleTypes: string[], timeMins: number): ChipDef[] {
  // Find first matching group
  const group =
    CHIP_GROUPS.find(g => g.types.some(t => googleTypes.includes(t))) ??
    FALLBACK_GROUP;

  // Build initial chip list from type group
  const typeChips: ChipDef[] = [
    ...group.expand.map(e => ({ label: e.label, emoji: e.emoji, kind: 'expand' as const, nearbyType: e.nearbyType })),
    ...group.direct.map(d => ({ label: d.label, emoji: d.emoji, kind: 'direct' as const })),
  ];

  // Check for a time-based chip
  const timeChip = TIME_CHIPS.find(
    tc => timeMins >= tc.minStart && timeMins < tc.minEnd,
  )?.chip ?? null;

  if (!timeChip) return typeChips.slice(0, 4);

  // Time chip prepended; if total would exceed 4, drop the first type chip
  const combined =
    typeChips.length < 4
      ? [timeChip, ...typeChips]
      : [timeChip, ...typeChips.slice(1)];

  return combined.slice(0, 4);
}

// ── Direct chip URL builder ──────────────────────────────────────

export interface DirectChipStop {
  place: string;
  lat: number;
  lon: number;
}

/**
 * Builds a Maps deep-link for a direct chip.
 * @param label   The chip label (including the ↗ suffix)
 * @param stop    Stop coordinates and name
 * @param isMac   true for Apple Maps base, false for Google Maps
 */
export function buildDirectUrl(
  label: string,
  stop: DirectChipStop,
  isMac: boolean,
): string {
  const appleBase = 'maps://maps.apple.com/';
  const googleBase = 'https://maps.google.com/maps';
  const googleSearch = 'https://maps.google.com/';
  const gSearch = 'https://www.google.com/search';
  const { lat, lon, place } = stop;

  if (label === 'Restrooms ↗') {
    return isMac
      ? `${appleBase}?q=restroom&near=${lat},${lon}`
      : `${googleSearch}?q=restroom&near=${lat},${lon}`;
  }
  if (label === 'Trail map ↗') {
    return isMac
      ? `${appleBase}?q=hiking+trail&near=${lat},${lon}`
      : `${googleSearch}?q=hiking+trail&near=${lat},${lon}`;
  }
  if (label === 'Walk it off ↗') {
    return isMac
      ? `${appleBase}?saddr=${lat},${lon}&dirflg=w`
      : `${googleBase}?saddr=${lat},${lon}&dirflg=w`;
  }
  if (label === 'Leave review ↗') {
    return `https://maps.google.com/?q=${encodeURIComponent(place)}`;
  }
  if (label === 'Street view ↗') {
    return `https://maps.google.com/?q=${lat},${lon}&layer=c`;
  }
  if (label === 'Book tickets ↗' || label === 'Book ahead ↗') {
    return `${gSearch}?q=tickets+${encodeURIComponent(place)}`;
  }
  if (label === 'Prayer times ↗') {
    return `${gSearch}?q=prayer+times+${encodeURIComponent(place)}`;
  }
  if (label === 'Dress code ↗') {
    return `${gSearch}?q=dress+code+${encodeURIComponent(place)}`;
  }
  // Explore nearby (fallback)
  return isMac
    ? `${appleBase}?q=things+to+do&near=${lat},${lon}`
    : `${googleSearch}?q=things+to+do&near=${lat},${lon}`;
}
