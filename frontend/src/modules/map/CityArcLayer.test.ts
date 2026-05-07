import { describe, it, expect } from 'vitest';
import { buildArcGeoJSON } from './CityArcLayer';
import type { CityFootprint } from '../../shared/types';

const TOKYO: CityFootprint = { city: 'Tokyo', emoji: '🗼', pinCount: 2, lat: 35.68, lon: 139.69 };
const SYDNEY: CityFootprint = { city: 'Sydney', emoji: '🦘', pinCount: 1, lat: -33.87, lon: 151.21 };

describe('buildArcGeoJSON', () => {
  it('returns null for fewer than 2 cities', () => {
    expect(buildArcGeoJSON([TOKYO])).toBeNull();
    expect(buildArcGeoJSON([])).toBeNull();
  });

  it('returns a FeatureCollection with a line for 2 cities', () => {
    const result = buildArcGeoJSON([TOKYO, SYDNEY]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('FeatureCollection');
    expect(result!.features.length).toBeGreaterThanOrEqual(1);
    const line = result!.features[0];
    expect(line.geometry.type).toBe('LineString');
    expect((line.geometry as GeoJSON.LineString).coordinates.length).toBeGreaterThan(2);
  });

  it('includes midpoint marker for transit icon', () => {
    const result = buildArcGeoJSON([TOKYO, SYDNEY]);
    const midpoint = result!.features.find(f => f.geometry.type === 'Point');
    expect(midpoint).toBeTruthy();
    expect(midpoint!.properties?.fromCity).toBe('Tokyo');
    expect(midpoint!.properties?.toCity).toBe('Sydney');
    expect(midpoint!.properties?.transitMode).toBeNull();
    expect(midpoint!.properties?.transitIcon).toBe('');
  });
});
