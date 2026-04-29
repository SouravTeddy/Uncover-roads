import { describe, it, expect } from 'vitest';
import { REC_RULES } from './rec-rules';

describe('REC_RULES', () => {
  it('defines lunch and dinner meal windows', () => {
    const lunch = REC_RULES.MEAL_WINDOWS.find(w => w.type === 'lunch');
    const dinner = REC_RULES.MEAL_WINDOWS.find(w => w.type === 'dinner');
    expect(lunch).toEqual({ start: '11:30', end: '14:00', type: 'lunch' });
    expect(dinner).toEqual({ start: '18:00', end: '21:00', type: 'dinner' });
  });

  it('defines two coffee windows', () => {
    expect(REC_RULES.COFFEE_WINDOWS).toHaveLength(2);
    expect(REC_RULES.COFFEE_WINDOWS[0]).toEqual({ start: '08:00', end: '11:00' });
    expect(REC_RULES.COFFEE_WINDOWS[1]).toEqual({ start: '14:30', end: '17:00' });
  });

  it('has detour metres for all pace types', () => {
    expect(REC_RULES.MAX_DETOUR_METRES.walker).toBe(500);
    expect(REC_RULES.MAX_DETOUR_METRES.relaxed).toBe(800);
    expect(REC_RULES.MAX_DETOUR_METRES.active).toBe(1200);
    expect(REC_RULES.MAX_DETOUR_METRES.default).toBe(600);
  });

  it('maps epicurean persona to food categories', () => {
    expect(REC_RULES.PERSONA_REC_MAP.epicurean).toContain('restaurant');
    expect(REC_RULES.PERSONA_REC_MAP.epicurean).toContain('food_market');
  });

  it('MIN_GAP_MINUTES is 30', () => {
    expect(REC_RULES.MIN_GAP_MINUTES).toBe(30);
  });

  it('MAX_BRANCHES_VISIBLE is 2', () => {
    expect(REC_RULES.MAX_BRANCHES_VISIBLE).toBe(2);
  });
});
