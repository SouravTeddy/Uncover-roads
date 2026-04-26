import { describe, it, expect } from 'vitest';
import { computeCentroid } from './FavoritesLayer';

describe('computeCentroid', () => {
  it('returns null for empty array', () => {
    expect(computeCentroid([])).toBeNull();
  });

  it('returns the single point for one pin', () => {
    const result = computeCentroid([{ lat: 35.71, lon: 139.79 }]);
    expect(result).toEqual({ lat: 35.71, lon: 139.79 });
  });

  it('returns average lat/lon for multiple pins', () => {
    const result = computeCentroid([
      { lat: 35.70, lon: 139.78 },
      { lat: 35.72, lon: 139.80 },
    ]);
    expect(result?.lat).toBeCloseTo(35.71);
    expect(result?.lon).toBeCloseTo(139.79);
  });
});
