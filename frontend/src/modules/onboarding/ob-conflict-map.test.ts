import { describe, it, expect } from 'vitest';
import {
  HARD_CONFLICTS,
  SOFT_CONFLICTS,
  PACE_ALIGNMENT,
  PRICE_ALIGNMENT,
  ANSWER_WEIGHTS,
  detectHardConflict,
  scoreOptions,
} from './ob-conflict-map';

describe('HARD_CONFLICTS', () => {
  it('contains C1 slow+pack', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C1', a: 'slow', b: 'pack' })
    );
  });
  it('contains C2 budget+luxury', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C2', a: 'budget', b: 'luxury' })
    );
  });
  it('contains C3 early+bars', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C3', a: 'early', b: 'bars' })
    );
  });
  it('contains C4 budget+comfortable', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C4', a: 'budget', b: 'comfortable' })
    );
  });
});

describe('detectHardConflict', () => {
  it('detects slow+pack conflict', () => {
    expect(detectHardConflict('slow', 'pack')).toEqual(
      expect.objectContaining({ id: 'C1' })
    );
  });
  it('detects pack+slow in reverse order', () => {
    expect(detectHardConflict('pack', 'slow')).toEqual(
      expect.objectContaining({ id: 'C1' })
    );
  });
  it('returns null for non-conflicting pair', () => {
    expect(detectHardConflict('slow', 'balanced')).toBeNull();
  });
  it('returns null for same value', () => {
    expect(detectHardConflict('slow', 'slow')).toBeNull();
  });
});

describe('PACE_ALIGNMENT', () => {
  it('slow vs pack alignment is 0', () => {
    expect(PACE_ALIGNMENT['slow']['pack']).toBe(0);
  });
  it('slow vs slow alignment is 1', () => {
    expect(PACE_ALIGNMENT['slow']['slow']).toBe(1.0);
  });
  it('balanced vs spontaneous > 0.5', () => {
    expect(PACE_ALIGNMENT['balanced']['spontaneous']).toBeGreaterThan(0.5);
  });
});

describe('scoreOptions', () => {
  it('penalizes pack for relax+solo context', () => {
    // relax mood signals alignment with slow; solo adds slight spontaneous preference
    const accumulatedWeights = { slow: 1.5, spontaneous: 0.2 };
    const scores = scoreOptions(['slow', 'balanced', 'pack', 'spontaneous'], accumulatedWeights, PACE_ALIGNMENT);
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winner = sorted[0][0];
    const loser  = sorted[sorted.length - 1][0];
    expect(['slow', 'balanced', 'spontaneous']).toContain(winner);
    expect(loser).toBe('pack');
  });
});

describe('ANSWER_WEIGHTS', () => {
  it('slow pace sets stops_per_day to 2.5', () => {
    expect(ANSWER_WEIGHTS.pace.slow.stops_per_day).toBe(2.5);
  });
  it('pack pace sets stops_per_day to 7', () => {
    expect(ANSWER_WEIGHTS.pace.pack.stops_per_day).toBe(7.0);
  });
  it('luxury budget sets price_min to 3', () => {
    expect(ANSWER_WEIGHTS.budget.luxury.price_min).toBe(3);
  });
});
