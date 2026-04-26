import { describe, it, expect } from 'vitest';
import type { AppState } from './store';
import type { TripPack } from './types';
import {
  isCurationLocked,
  shouldShowPaywall,
  getPackRemainingTrips,
  shouldShowConversionNudge,
} from './tier';
import { initialState } from './store';

function state(overrides: Partial<AppState>): AppState {
  return { ...initialState, ...overrides };
}

describe('isCurationLocked', () => {
  it('is false for free tier on 1st generation', () => {
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 0 }))).toBe(false);
  });

  it('is false for free tier on 2nd generation', () => {
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 1 }))).toBe(false);
  });

  it('is true for free tier on 3rd generation', () => {
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 2 }))).toBe(true);
  });

  it('is false for pro tier', () => {
    expect(isCurationLocked(state({ userTier: 'pro', generationCount: 10 }))).toBe(false);
  });

  it('is false for pro tier with high generation count', () => {
    expect(isCurationLocked(state({ userTier: 'pro', generationCount: 100 }))).toBe(false);
  });

  it('is false for free tier using an active pack trip', () => {
    const pack: TripPack = { id: 'p1', trips: 5, usedTrips: 1, expiresAt: '2027-01-01' };
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 5, tripPacks: [pack] }))).toBe(false);
  });
});

describe('shouldShowPaywall', () => {
  it('is false for free tier under 3 generations', () => {
    expect(shouldShowPaywall(state({ userTier: 'free', generationCount: 2 }))).toBe(false);
  });

  it('is true for free tier at 3 or more generations with no packs', () => {
    expect(shouldShowPaywall(state({ userTier: 'free', generationCount: 3 }))).toBe(true);
  });

  it('is false for free tier at 3+ generations with available pack trips', () => {
    const pack: TripPack = { id: 'p1', trips: 5, usedTrips: 1, expiresAt: '2027-01-01' };
    expect(shouldShowPaywall(state({ userTier: 'free', generationCount: 3, tripPacks: [pack] }))).toBe(false);
  });

  it('is false for pro tier under 5 generations this month', () => {
    expect(shouldShowPaywall(state({ userTier: 'pro', generationCount: 4 }))).toBe(false);
  });

  it('is false for pro with high generation count', () => {
    expect(shouldShowPaywall(state({ userTier: 'pro', generationCount: 100 }))).toBe(false);
  });
});

describe('getPackRemainingTrips', () => {
  it('returns 0 with no packs', () => {
    expect(getPackRemainingTrips([])).toBe(0);
  });

  it('sums remaining trips across non-expired packs', () => {
    const future = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const packs: TripPack[] = [
      { id: 'p1', trips: 5, usedTrips: 2, expiresAt: future },
      { id: 'p2', trips: 10, usedTrips: 10, expiresAt: future },
    ];
    expect(getPackRemainingTrips(packs)).toBe(3);
  });

  it('excludes expired packs', () => {
    const past = '2020-01-01';
    const packs: TripPack[] = [
      { id: 'p1', trips: 5, usedTrips: 0, expiresAt: past },
    ];
    expect(getPackRemainingTrips(packs)).toBe(0);
  });
});

describe('shouldShowConversionNudge', () => {
  it('is true after 2nd pack purchase', () => {
    expect(shouldShowConversionNudge(2)).toBe(true);
  });

  it('is false after 1st pack purchase', () => {
    expect(shouldShowConversionNudge(1)).toBe(false);
  });
});
