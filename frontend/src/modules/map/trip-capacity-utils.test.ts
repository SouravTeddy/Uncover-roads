import { describe, it, expect } from 'vitest';
import {
  getTripCapacityStatus,
  computeTotalDays,
  addDaysToIso,
} from './trip-capacity-utils';

describe('getTripCapacityStatus', () => {
  it('returns unset when totalDays is 0', () => {
    expect(getTripCapacityStatus(5, 0)).toBe('unset');
  });
  it('returns unset when placeCount is 0', () => {
    expect(getTripCapacityStatus(0, 3)).toBe('unset');
  });
  it('returns shortage when placeCount < totalDays', () => {
    expect(getTripCapacityStatus(2, 5)).toBe('shortage');
  });
  it('returns ok when exactly 1 place per day', () => {
    expect(getTripCapacityStatus(3, 3)).toBe('ok');
  });
  it('returns ok when 4 places per day (mid range)', () => {
    expect(getTripCapacityStatus(8, 2)).toBe('ok'); // 8 <= 2*5=10
  });
  it('returns overflow when > 5 places per day', () => {
    expect(getTripCapacityStatus(11, 2)).toBe('overflow'); // 11 > 2*5=10
  });
});

describe('computeTotalDays', () => {
  it('returns 0 when start is null', () => {
    expect(computeTotalDays(null, '2026-04-14')).toBe(0);
  });
  it('returns 0 when end is null', () => {
    expect(computeTotalDays('2026-04-10', null)).toBe(0);
  });
  it('returns 1 for same-day range', () => {
    expect(computeTotalDays('2026-04-10', '2026-04-10')).toBe(1);
  });
  it('returns 5 for a 5-day range', () => {
    expect(computeTotalDays('2026-04-10', '2026-04-14')).toBe(5);
  });
});

describe('addDaysToIso', () => {
  it('adds 0 days (no change)', () => {
    expect(addDaysToIso('2026-04-10', 0)).toBe('2026-04-10');
  });
  it('adds 1 day', () => {
    expect(addDaysToIso('2026-04-10', 1)).toBe('2026-04-11');
  });
  it('handles month boundary', () => {
    expect(addDaysToIso('2026-04-30', 1)).toBe('2026-05-01');
  });
});
