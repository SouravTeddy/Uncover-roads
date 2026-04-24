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
 * Locked for free tier after the 2nd generation (generationCount >= 2),
 * unless they have active pack trips (packs unlock full experience).
 * 1st and 2nd generations are fully free; restriction kicks in on 3rd.
 */
export function isCurationLocked(state: AppState): boolean {
  if (state.userTier === 'pro' || state.userTier === 'unlimited') return false;
  if (getPackRemainingTrips(state.tripPacks) > 0) return false;
  return state.generationCount >= 2;
}

/**
 * Returns true when a paywall should be shown before generating.
 * Free tier: blocked after 3 generations unless pack trips remain.
 * Pro: never blocked in this client (server enforces monthly limit).
 * Unlimited: never blocked.
 */
export function shouldShowPaywall(state: AppState): boolean {
  if (state.userTier === 'pro' || state.userTier === 'unlimited') return false;
  if (getPackRemainingTrips(state.tripPacks) > 0) return false;
  return state.generationCount >= 3;
}

/** Returns true when the "switch to Pro" nudge should appear on the subscription screen. */
export function shouldShowConversionNudge(packPurchaseCount: number): boolean {
  return packPurchaseCount >= 2;
}
