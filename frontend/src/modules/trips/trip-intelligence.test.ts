import { describe, it, expect } from 'vitest';
import { getDaysUntilTravel, getCountdownColour } from './TripCountdown';
import { isOnCooldown, timeSinceLabel } from './SmartUpdates';

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

describe('isOnCooldown', () => {
  it('returns false for null', () => {
    expect(isOnCooldown(null)).toBe(false);
  });

  it('returns true when last check was 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isOnCooldown(oneHourAgo)).toBe(true);
  });

  it('returns false when last check was 5 hours ago', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(isOnCooldown(fiveHoursAgo)).toBe(false);
  });
});

describe('timeSinceLabel', () => {
  it('returns empty string for null', () => {
    expect(timeSinceLabel(null)).toBe('');
  });

  it('returns hours label for > 60 min', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeSinceLabel(twoHoursAgo)).toBe('Checked 2h ago');
  });

  it('returns minutes label for < 60 min', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(timeSinceLabel(tenMinAgo)).toBe('Checked 10m ago');
  });
});
