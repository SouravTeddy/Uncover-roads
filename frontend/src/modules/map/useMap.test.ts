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
