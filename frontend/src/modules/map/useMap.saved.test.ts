import { describe, it, expect } from 'vitest';
import type { Place, FavouritedPin } from '../../shared/types';

// Test the filter logic directly — inline pure function
function filterPlacesForSaved(
  places: Place[],
  favouritedPins: FavouritedPin[],
  activeFilter: string,
): Place[] {
  if (activeFilter !== 'saved') return places;
  const ids = new Set(favouritedPins.map(f => f.placeId));
  return places.filter(p => ids.has(p.id));
}

const places: Place[] = [
  { id: 'a', title: 'A', category: 'park', lat: 0, lon: 0 },
  { id: 'b', title: 'B', category: 'museum', lat: 0, lon: 0 },
  { id: 'c', title: 'C', category: 'restaurant', lat: 0, lon: 0 },
];

const favs: FavouritedPin[] = [
  { placeId: 'a', title: 'A', lat: 0, lon: 0, city: 'Tokyo' },
];

describe('saved filter logic', () => {
  it('returns all places when filter is not saved', () => {
    expect(filterPlacesForSaved(places, favs, 'all')).toHaveLength(3);
  });

  it('returns only favourited places when filter is saved', () => {
    const result = filterPlacesForSaved(places, favs, 'saved');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty when no places are favourited', () => {
    expect(filterPlacesForSaved(places, [], 'saved')).toHaveLength(0);
  });
});
