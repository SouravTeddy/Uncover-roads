import type { AppState } from './store';
import type { TripPack } from './types';

/** Returns total remaining trips across non-expired packs. */
export function getPackRemainingTrips(packs: TripPack[]): number {
  const today = new Date().toISOString().split('T')[0];
  return packs.reduce((sum, p) => {
    if (p.expiresAt < today) return sum;
    return sum + Math.max(0, p.trips - p.usedTrips);
  }, 0);
}

/**
 * Returns true when Our Picks and Live Events should be hidden/locked.
 * All 3 free generations are full — curation is only locked after the free
 * limit is exhausted and no pack trips remain.
 */
export function isCurationLocked(state: AppState): boolean {
  if (state.userTier === 'pro') return false;
  if (getPackRemainingTrips(state.tripPacks) > 0) return false;
  return state.generationCount >= 3;
}

/**
 * Returns true when a paywall should be shown before generating.
 * Free tier: blocked after 3 generations unless pack trips remain.
 * Pro: never blocked in this client (server enforces monthly limit).
 * Unlimited: never blocked.
 */
export function shouldShowPaywall(state: AppState): boolean {
  if (state.userTier === 'pro') return false;
  if (getPackRemainingTrips(state.tripPacks) > 0) return false;
  return state.generationCount >= 3;
}

/** Returns true when the "switch to Pro" nudge should appear on the subscription screen. */
export function shouldShowConversionNudge(packPurchaseCount: number): boolean {
  return packPurchaseCount >= 2;
}

const PACK_PRICES: Record<number, number> = { 10: 299 };

/** Returns total amount spent across all trip packs. */
export function computePackSpend(packs: TripPack[]): number {
  return packs.reduce((sum, p) => sum + (PACK_PRICES[p.trips] ?? 0), 0);
}

/**
 * Returns how much more the user would spend continuing with packs vs switching
 * to a monthly subscription. Clamped to 0 — never negative.
 */
export function clampedNudgeSavings(packSpend: number, monthlyPrice: number): number {
  return Math.max(0, packSpend - monthlyPrice);
}
