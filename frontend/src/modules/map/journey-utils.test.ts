import { describe, it, expect } from 'vitest';
import type { Place } from '../../shared/types';
import {
  getJourneyCities,
  isJourneyMode,
  haversineKm,
  suggestTransportMode,
} from './journey-utils';

const makePlaces = (cities: string[]): Place[] =>
  cities.map((c, i) => ({
    id: `p${i}`, title: `Place ${i}`, category: 'tourism' as const,
    lat: 0, lon: 0, _city: c,
  }));

describe('getJourneyCities', () => {
  it('returns empty array for no places', () => {
    expect(getJourneyCities([])).toEqual([]);
  });

  it('returns single city for same-city places', () => {
    expect(getJourneyCities(makePlaces(['Tokyo', 'Tokyo', 'Tokyo']))).toEqual(['Tokyo']);
  });

  it('returns ordered unique cities matching place add order', () => {
    expect(getJourneyCities(makePlaces(['Tokyo', 'Kyoto', 'Tokyo', 'Osaka']))).toEqual(['Tokyo', 'Kyoto', 'Osaka']);
  });

  it('ignores places with no _city', () => {
    const places: Place[] = [
      { id: 'a', title: 'A', category: 'park', lat: 0, lon: 0, _city: 'Tokyo' },
      { id: 'b', title: 'B', category: 'park', lat: 0, lon: 0 }, // no _city
    ];
    expect(getJourneyCities(places)).toEqual(['Tokyo']);
  });
});

describe('isJourneyMode', () => {
  it('false for empty', () => expect(isJourneyMode([])).toBe(false));
  it('false for single city', () => expect(isJourneyMode(makePlaces(['Tokyo']))).toBe(false));
  it('true for two cities', () => expect(isJourneyMode(makePlaces(['Tokyo', 'Kyoto']))).toBe(true));
  it('true for three cities', () => expect(isJourneyMode(makePlaces(['Tokyo', 'Dubai', 'Sydney']))).toBe(true));
});

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(35.68, 139.69, 35.68, 139.69)).toBeCloseTo(0, 1);
  });

  it('Tokyo to Kyoto is ~370km', () => {
    // Tokyo: 35.68, 139.69 | Kyoto: 35.01, 135.77
    expect(haversineKm(35.68, 139.69, 35.01, 135.77)).toBeCloseTo(363, 0);
  });

  it('London to New York is ~5500km', () => {
    expect(haversineKm(51.5, -0.12, 40.71, -74.01)).toBeCloseTo(5570, -2);
  });
});

describe('suggestTransportMode', () => {
  it('train for <150km', () => expect(suggestTransportMode(80)).toBe('train'));
  it('bullet_train for 150-600km', () => expect(suggestTransportMode(370)).toBe('bullet_train'));
  it('flight for >600km', () => expect(suggestTransportMode(700)).toBe('flight'));
  it('flight for intercontinental', () => expect(suggestTransportMode(5500)).toBe('flight'));
});
