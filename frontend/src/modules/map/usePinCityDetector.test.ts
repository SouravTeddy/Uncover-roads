import { describe, it, expect } from 'vitest';
import { findNearestCity } from './usePinCityDetector';

const TOKYO = { city: 'Tokyo', lat: 35.68, lon: 139.69 };
const SYDNEY = { city: 'Sydney', lat: -33.87, lon: 151.21 };
const OSAKA = { city: 'Osaka', lat: 34.69, lon: 135.50 };

describe('findNearestCity', () => {
  it('returns null when no cities known', () => {
    expect(findNearestCity(35.68, 139.69, [])).toBeNull();
  });

  it('assigns city when pin is within 30km of centroid', () => {
    // Shibuya: ~4km from Tokyo centroid
    expect(findNearestCity(35.66, 139.70, [TOKYO])).toBe('Tokyo');
  });

  it('returns null when pin is > 30km from all centroids', () => {
    expect(findNearestCity(-33.87, 151.21, [TOKYO])).toBeNull();
  });

  it('assigns nearest city when multiple cities exist', () => {
    // Pin near Osaka station (34.70, 135.50) — ~1km from Osaka centroid
    expect(findNearestCity(34.70, 135.50, [TOKYO, OSAKA])).toBe('Osaka');
  });

  it('returns null when pin is far from all known cities', () => {
    expect(findNearestCity(48.86, 2.35, [TOKYO, SYDNEY])).toBeNull();
  });
});
