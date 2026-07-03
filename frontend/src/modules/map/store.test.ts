import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reducer, initialState } from '../../shared/store';

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { store = {}; },
};

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UPDATE_CITY_LABEL', () => {
  it('updates city string without clearing places or cityGeo', () => {
    const withData = {
      ...initialState,
      city: 'Tokyo',
      places: [{ id: '1', title: 'Park', category: 'park' as const, lat: 35, lon: 139 }],
      cityGeo: { lat: 35.6762, lon: 139.6503, bbox: [35, 36, 139, 140] as [number,number,number,number] },
    };
    const next = reducer(withData, { type: 'UPDATE_CITY_LABEL', city: 'Shinjuku' });
    expect(next.city).toBe('Shinjuku');
    expect(next.places).toHaveLength(1);
    expect(next.cityGeo).not.toBeNull();
  });

  it('persists city to localStorage', () => {
    const next = reducer(initialState, { type: 'UPDATE_CITY_LABEL', city: 'Osaka' });
    expect(next.city).toBe('Osaka');
    expect(localStorage.getItem('ur_ss_city')).toBe('"Osaka"');
  });
});
