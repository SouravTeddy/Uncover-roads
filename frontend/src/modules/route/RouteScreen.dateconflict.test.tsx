import { describe, it, expect } from 'vitest';
import { computeExtraDays } from './RouteScreen';

describe('computeExtraDays', () => {
  it('returns 0 when itinerary fits within budget', () => {
    expect(computeExtraDays(5, '2026-05-14', '2026-05-18')).toBe(0);
  });

  it('returns 0 when no dates set', () => {
    expect(computeExtraDays(5, null, null)).toBe(0);
  });

  it('returns extra days when itinerary exceeds budget', () => {
    expect(computeExtraDays(7, '2026-05-14', '2026-05-18')).toBe(2);
  });

  it('returns 0 when exactly equal', () => {
    expect(computeExtraDays(5, '2026-05-14', '2026-05-18')).toBe(0);
  });
});
