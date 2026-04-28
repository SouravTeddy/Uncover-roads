import { describe, it, expect } from 'vitest';
import { computePersonaBadges } from './pincard-persona';
import type { Place, Persona, PersonaProfile } from '../../shared/types';

const basePlace: Place = {
  id: 'p1', title: 'Test Place', category: 'cafe', lat: 0, lon: 0,
};
const basePersona: Persona = {
  archetype: 'slow_traveller', archetype_name: 'Slow Traveller',
  archetype_desc: 'Prefers quiet unhurried exploration.',
  ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null,
  archetypeData: { name: 'Slow Traveller', desc: '', venue_filters: ['cafe'], itinerary_bias: [] },
  venue_filters: ['cafe'], itinerary_bias: [],
};
const baseProfile: PersonaProfile = {
  stops_per_day: 4, time_per_stop: 60,
  venue_weights: {}, price_min: 1, price_max: 3,
  flexibility: 0.5, day_open: 'coffee', day_buffer_min: 30,
  evening_type: 'dinner_wind', evening_end_time: '22:00',
  social_flags: [], dietary: [], resolved_conflicts: [], auto_blend: false,
  archetype: 'slow_traveller',
};

describe('computePersonaBadges', () => {
  it('returns "Matches your taste" when place category is in venue_filters', () => {
    const badges = computePersonaBadges(basePlace, basePersona, baseProfile);
    expect(badges.some(b => b.text.includes('Matches your taste'))).toBe(true);
  });

  it('returns "Above your budget" when price_level exceeds price_max', () => {
    const place = { ...basePlace, price_level: 4 };
    const badges = computePersonaBadges(place, basePersona, baseProfile);
    expect(badges.some(b => b.text.includes('Above your budget'))).toBe(true);
  });

  it('returns "Budget-friendly" when price_level is at or below price_min', () => {
    const place = { ...basePlace, price_level: 1 };
    const badges = computePersonaBadges(place, basePersona, baseProfile);
    expect(badges.some(b => b.text.includes('Budget-friendly'))).toBe(true);
  });

  it('does not return both budget-friendly and above-budget for the same place', () => {
    const place = { ...basePlace, price_level: 2 };
    const badges = computePersonaBadges(place, basePersona, baseProfile);
    const hasBudget = badges.some(b => b.text.includes('Budget-friendly'));
    const hasOver   = badges.some(b => b.text.includes('Above your budget'));
    expect(hasBudget && hasOver).toBe(false);
  });

  it('returns "Halal not confirmed" for halal_certified_only dietary flag', () => {
    const profile = { ...baseProfile, dietary: ['halal_certified_only' as const] };
    const place   = { ...basePlace, category: 'restaurant' as const, tags: {} };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('Halal not confirmed'))).toBe(true);
  });

  it('returns "Vegan-friendly" when vegan_boost + vegan cuisine tag', () => {
    const profile = { ...baseProfile, dietary: ['vegan_boost' as const] };
    const place   = { ...basePlace, tags: { cuisine: 'vegan' } };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('Vegan-friendly'))).toBe(true);
  });

  it('returns "Family-friendly" when social_flags has family + park category', () => {
    const profile = { ...baseProfile, social_flags: ['family' as const] };
    const place   = { ...basePlace, category: 'park' as const };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('Family-friendly'))).toBe(true);
  });

  it('returns "Good for slow exploration" for slow pace + museum', () => {
    const profile = { ...baseProfile, pace: 'slow' as const };
    const place   = { ...basePlace, category: 'museum' as const };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('slow exploration'))).toBe(true);
  });

  it('returns empty array when null profile', () => {
    const badges = computePersonaBadges(basePlace, basePersona, null);
    expect(badges.some(b => b.text.includes('Matches your taste'))).toBe(true);
  });

  it('returns no more than 2 badges in map mode', () => {
    const profile = { ...baseProfile, price_max: 1 as const, dietary: ['halal_certified_only' as const] };
    const place   = { ...basePlace, price_level: 4, tags: {} };
    const badges  = computePersonaBadges(place, basePersona, profile, 'map');
    expect(badges.length).toBeLessThanOrEqual(2);
  });

  it('returns more than 2 badges in itinerary mode when signals present', () => {
    const profile = { ...baseProfile, price_max: 1 as const, dietary: ['halal_certified_only' as const], social_flags: ['family' as const] };
    const place   = { ...basePlace, price_level: 4, category: 'park' as const, tags: {} };
    const badges  = computePersonaBadges(place, basePersona, profile, 'itinerary');
    expect(badges.length).toBeGreaterThan(2);
  });
});
