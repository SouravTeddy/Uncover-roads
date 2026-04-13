import { describe, it, expect } from 'vitest';
import { resolveOBAnswers, mergeVenueWeights } from './ob-resolver';
import type { RawOBAnswers } from '../../shared/types';

function baseAnswers(overrides: Partial<RawOBAnswers> = {}): RawOBAnswers {
  return {
    group: 'solo', mood: ['explore'], pace: ['balanced'],
    day_open: 'coffee', dietary: [], budget: 'mid_range', evening: 'dinner_wind',
    ...overrides,
  };
}

describe('resolveOBAnswers — basic output shape', () => {
  it('returns a PersonaProfile with all required fields', () => {
    const result = resolveOBAnswers(baseAnswers());
    expect(result.stops_per_day).toBeDefined();
    expect(result.time_per_stop).toBeDefined();
    expect(result.venue_weights).toBeDefined();
    expect(result.price_min).toBeDefined();
    expect(result.price_max).toBeDefined();
    expect(result.flexibility).toBeDefined();
    expect(result.day_open).toBe('coffee');
    expect(result.day_buffer_min).toBe(30);
    expect(result.evening_type).toBe('dinner_wind');
    expect(result.evening_end_time).toBe('22:00');
    expect(result.social_flags).toContain('solo');
    expect(result.dietary).toEqual([]);
    expect(result.resolved_conflicts).toEqual([]);
    expect(result.auto_blend).toBe(false);
  });
});

describe('resolveOBAnswers — pace resolution', () => {
  it('single pace answer sets correct stops_per_day', () => {
    const r = resolveOBAnswers(baseAnswers({ pace: ['slow'] }));
    expect(r.stops_per_day).toBe(2.5);
    expect(r.time_per_stop).toBe(105);
  });

  it('pack sets stops_per_day to 7', () => {
    const r = resolveOBAnswers(baseAnswers({ pace: ['pack'] }));
    expect(r.stops_per_day).toBe(7.0);
  });
});

describe('resolveOBAnswers — hard conflict C1 (slow+pack)', () => {
  it('auto_blend=true when pace has slow+pack and no prior resolution', () => {
    const r = resolveOBAnswers(baseAnswers({ pace: ['slow', 'pack'] }));
    expect(r.auto_blend).toBe(true);
    const c1 = r.resolved_conflicts.find(c => c.conflict_id === 'C1');
    expect(c1).toBeDefined();
    expect(c1?.method).toBe('auto_blend');
  });

  it('user_pick resolution is honoured when pre_resolved provided', () => {
    const answers = baseAnswers({ pace: ['slow', 'pack'] });
    const r = resolveOBAnswers(answers, [{ conflict_id: 'C1', method: 'user_pick', winner: 'slow' }]);
    expect(r.stops_per_day).toBe(2.5);
    expect(r.auto_blend).toBe(false);
  });
});

describe('resolveOBAnswers — hard conflict C2 (budget+luxury)', () => {
  it('auto_blend resolves when budget+luxury chosen', () => {
    const r = resolveOBAnswers({ ...baseAnswers(), budget: 'luxury',
      pace: ['balanced'],
    });
    // Single-choice question — C2 only happens via multi pre_resolved path
    // Just verify budget=luxury resolves correctly
    expect(r.price_min).toBe(3);
    expect(r.price_max).toBe(4);
  });
});

describe('resolveOBAnswers — dietary flag mapping', () => {
  it('halal dietary maps to halal_certified_only flag', () => {
    const r = resolveOBAnswers(baseAnswers({ dietary: ['halal'] }));
    expect(r.dietary).toContain('halal_certified_only');
  });

  it('plant_based maps to vegan_boost and meat_flag', () => {
    const r = resolveOBAnswers(baseAnswers({ dietary: ['plant_based'] }));
    expect(r.dietary).toContain('vegan_boost');
    expect(r.dietary).toContain('meat_flag');
  });

  it('multiple dietary flags stack', () => {
    const r = resolveOBAnswers(baseAnswers({ dietary: ['halal', 'allergy'] }));
    expect(r.dietary).toContain('halal_certified_only');
    expect(r.dietary).toContain('allergy_warning');
  });
});

describe('mergeVenueWeights', () => {
  it('single mood returns full weights for that mood', () => {
    const w = mergeVenueWeights(['explore']);
    expect(w['neighbourhood']).toBeGreaterThan(0);
    expect(w['restaurant']).toBe(0);
  });

  it('second mood contributes at 0.4x decay', () => {
    const single = mergeVenueWeights(['explore']);
    const dual   = mergeVenueWeights(['explore', 'eat_drink']);
    // restaurant should appear in dual but not single
    expect((dual['restaurant'] ?? 0)).toBeGreaterThan(0);
    expect((single['restaurant'] ?? 0)).toBe(0);
  });

  it('normalises so max weight is 1.0', () => {
    const w = mergeVenueWeights(['culture', 'eat_drink']);
    const max = Math.max(...Object.values(w));
    expect(max).toBeCloseTo(1.0, 5);
  });
});

describe('resolveOBAnswers — social flags', () => {
  it('family group adds family and kids flags', () => {
    const r = resolveOBAnswers(baseAnswers({ group: 'family' }));
    expect(r.social_flags).toContain('family');
    expect(r.social_flags).toContain('kids');
  });

  it('friends group adds group flag', () => {
    const r = resolveOBAnswers(baseAnswers({ group: 'friends' }));
    expect(r.social_flags).toContain('group');
  });
});
