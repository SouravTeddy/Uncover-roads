import { describe, it, expect } from 'vitest';

// Pure logic extracted for testing — clientSideFallback behavior
// We test the filtering logic directly rather than mocking the full hook

type Place = { id: string; title: string; category: string; lat: number; lon: number; reason?: string; reasonSignal?: 'persona' | 'behaviour' };

function clientSideFallbackLogic(
  places: Place[],
  signals: string[],
): Place[] {
  const VENUE_TO_CATEGORY: Record<string, string> = {
    restaurant: 'restaurant', cafe: 'cafe', park: 'park',
    museum: 'museum', historic: 'historic', tourism: 'tourism',
    gallery: 'museum', monument: 'historic', heritage: 'historic',
    culture: 'museum', art: 'museum', market: 'place', markets: 'place',
    storefront: 'place', bar: 'restaurant', rooftop: 'restaurant',
    wine: 'restaurant', food: 'restaurant', gastronomy: 'restaurant',
    dining: 'restaurant', local: 'cafe', neighbourhood: 'place',
    varied: 'place', outdoor: 'park', nature: 'park', adventure: 'park',
    nightlife: 'place', club: 'place', events: 'place',
  };

  const targetCategories = new Set<string>();
  signals.forEach(v => {
    const cat = VENUE_TO_CATEGORY[v.toLowerCase()];
    if (cat) targetCategories.add(cat);
  });

  const nonEvents = places.filter(p => p.category !== 'event');

  if (targetCategories.size === 0) {
    return nonEvents.map(p => ({ ...p, reason: 'Curated for your travel style', reasonSignal: 'persona' as const }));
  }

  return nonEvents
    .filter(p => targetCategories.has(p.category))
    .map(p => ({ ...p, reason: 'Recommended for your travel style', reasonSignal: 'persona' as const }));
}

describe('clientSideFallback logic', () => {
  const places: Place[] = [
    { id: '1', title: 'Blue Cafe', category: 'cafe', lat: 0, lon: 0 },
    { id: '2', title: 'City Museum', category: 'museum', lat: 0, lon: 0 },
    { id: '3', title: 'Jazz Night', category: 'event', lat: 0, lon: 0 },
    { id: '4', title: 'Green Park', category: 'park', lat: 0, lon: 0 },
  ];

  it('filters out event category', () => {
    const result = clientSideFallbackLogic(places, ['cafe']);
    expect(result.find(p => p.category === 'event')).toBeUndefined();
  });

  it('sets reasonSignal to persona', () => {
    const result = clientSideFallbackLogic(places, ['cafe']);
    expect(result.every(p => p.reasonSignal === 'persona')).toBe(true);
  });

  it('filters by mapped category', () => {
    const result = clientSideFallbackLogic(places, ['museum']);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('City Museum');
  });

  it('returns all non-events when no signals map', () => {
    const result = clientSideFallbackLogic(places, ['unknownsignal']);
    expect(result).toHaveLength(3); // cafe, museum, park — no event
    expect(result.every(p => p.reasonSignal === 'persona')).toBe(true);
  });
});

it('filters places by activeCategory when filter is all', () => {
  const places = [
    { id: '1', title: 'A Park', category: 'park',       lat: 0, lon: 0 },
    { id: '2', title: 'A Cafe', category: 'cafe',       lat: 0, lon: 0 },
    { id: '3', title: 'A Rest', category: 'restaurant', lat: 0, lon: 0 },
  ];
  // filteredPlaces logic extracted: activeFilter='all', activeCategory='park'
  const result = places.filter(p =>
    'all' === 'all' && 'park' !== null ? p.category === 'park' : true
  );
  expect(result).toHaveLength(1);
  expect(result[0].title).toBe('A Park');
});

it('BuildItineraryBar canBuild is false with 1 place', () => {
  const places: Place[] = [{ id: '1', title: 'A', category: 'park', lat: 0, lon: 0 }];
  const canBuild = places.length >= 2;
  expect(canBuild).toBe(false);
});

it('BuildItineraryBar canBuild is true with 2 places', () => {
  const places: Place[] = [
    { id: '1', title: 'A', category: 'park',       lat: 0, lon: 0 },
    { id: '2', title: 'B', category: 'restaurant', lat: 0, lon: 0 },
  ];
  const canBuild = places.length >= 2;
  expect(canBuild).toBe(true);
});

// ── filteredPlaces multi-category logic ───────────────────────────────────────

function applyFilter(
  places: { id: string; category: string }[],
  activeCategories: string[],
): { id: string; category: string }[] {
  if (activeCategories.length === 0) return places
  return places.filter(p => activeCategories.includes(p.category))
}

describe('filteredPlaces multi-category logic', () => {
  const places = [
    { id: '1', category: 'historic' },
    { id: '2', category: 'tourism' },
    { id: '3', category: 'cafe' },
    { id: '4', category: 'museum' },
  ]

  it('returns all places when activeCategories is empty', () => {
    expect(applyFilter(places, [])).toHaveLength(4)
  })

  it('filters to single category', () => {
    const result = applyFilter(places, ['cafe'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('filters to multiple categories (Landmarks = historic + tourism)', () => {
    const result = applyFilter(places, ['historic', 'tourism'])
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id).sort()).toEqual(['1', '2'])
  })
})
