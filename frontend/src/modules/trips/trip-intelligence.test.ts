import { describe, it, expect } from 'vitest';
import { getDaysUntilTravel, getCountdownColour } from './TripCountdown';

describe('getDaysUntilTravel', () => {
  it('returns null when travelDate is null', () => {
    expect(getDaysUntilTravel(null)).toBeNull();
  });

  it('returns 0 on the travel date itself', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getDaysUntilTravel(today)).toBe(0);
  });

  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    expect(getDaysUntilTravel(future)).toBe(10);
  });

  it('returns negative for a past date', () => {
    const past = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
    expect(getDaysUntilTravel(past)! < 0).toBe(true);
  });
});

describe('getCountdownColour', () => {
  it('returns green for 0 days (today)', () => {
    expect(getCountdownColour(0)).toBe('#22c55e');
  });

  it('returns amber for 1–7 days', () => {
    expect(getCountdownColour(5)).toBe('#f59e0b');
  });

  it('returns indigo for more than 7 days', () => {
    expect(getCountdownColour(14)).toBe('#6366f1');
  });
});
