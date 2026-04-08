import { describe, it, expect } from 'vitest';
import { getContextualChips, buildDirectUrl } from './chip-utils';

// ── getContextualChips ───────────────────────────────────────────

describe('getContextualChips — type matching', () => {
  it('returns museum chips for museum type', () => {
    const chips = getContextualChips(['museum'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Museum café ›');
    expect(labels).toContain('Gift shop ›');
    expect(labels).toContain('Book tickets ↗');
    expect(labels).toContain('Restrooms ↗');
    expect(chips.length).toBeLessThanOrEqual(4);
  });

  it('returns museum chips for art_gallery type', () => {
    const chips = getContextualChips(['art_gallery'], 10 * 60);
    expect(chips.map(c => c.label)).toContain('Museum café ›');
  });

  it('returns worship chips for church type', () => {
    const chips = getContextualChips(['church'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Prayer times ↗');
    expect(labels).toContain('Dress code ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns park chips for park type', () => {
    const chips = getContextualChips(['park'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Photo spots ›');
    expect(labels).toContain('Trail map ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns attraction chips for tourist_attraction type', () => {
    const chips = getContextualChips(['tourist_attraction'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Best angles ›');
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Street view ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns food chips for restaurant type', () => {
    const chips = getContextualChips(['restaurant'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Dessert nearby ›');
    expect(labels).toContain('Walk it off ↗');
    expect(labels).toContain('Leave review ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns food chips for cafe type', () => {
    const chips = getContextualChips(['cafe'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Dessert nearby ›');
  });

  it('returns historic chips for castle type', () => {
    const chips = getContextualChips(['castle'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Photo spots ›');
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Book ahead ↗');
  });

  it('returns fallback chips for unknown type', () => {
    const chips = getContextualChips(['unknown_type'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Explore nearby ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('first matching group wins — does not mix groups', () => {
    // museum + park: should match museum group only
    const chips = getContextualChips(['museum', 'park'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Museum café ›');
    expect(labels).not.toContain('Trail map ↗');
  });
});

describe('getContextualChips — time-based chips', () => {
  it('adds Lunch nearby at 11:00', () => {
    const chips = getContextualChips(['park'], 11 * 60);
    expect(chips.map(c => c.label)).toContain('Lunch nearby ›');
  });

  it('adds Lunch nearby at 13:59', () => {
    const chips = getContextualChips(['park'], 13 * 60 + 59);
    expect(chips.map(c => c.label)).toContain('Lunch nearby ›');
  });

  it('does not add Lunch at 14:00', () => {
    const chips = getContextualChips(['park'], 14 * 60);
    expect(chips.map(c => c.label)).not.toContain('Lunch nearby ›');
  });

  it('adds Afternoon coffee at 15:00', () => {
    const chips = getContextualChips(['park'], 15 * 60);
    expect(chips.map(c => c.label)).toContain('Afternoon coffee ›');
  });

  it('adds Afternoon coffee at 16:59', () => {
    const chips = getContextualChips(['park'], 16 * 60 + 59);
    expect(chips.map(c => c.label)).toContain('Afternoon coffee ›');
  });

  it('does not add Afternoon coffee at 17:00', () => {
    const chips = getContextualChips(['park'], 17 * 60);
    expect(chips.map(c => c.label)).not.toContain('Afternoon coffee ›');
  });

  it('adds Dinner nearby at 18:00', () => {
    const chips = getContextualChips(['park'], 18 * 60);
    expect(chips.map(c => c.label)).toContain('Dinner nearby ›');
  });

  it('never exceeds 4 chips total', () => {
    // park has 4 type chips; time chip must replace one
    const chips = getContextualChips(['park'], 11 * 60);
    expect(chips.length).toBeLessThanOrEqual(4);
  });

  it('time chip replaces first chip when row is already 4', () => {
    // park → [Café nearby ›, Photo spots ›, Trail map ↗, Restrooms ↗] = 4
    // at 11am, Lunch nearby › should appear, first chip removed
    const chips = getContextualChips(['park'], 11 * 60);
    expect(chips[0].label).toBe('Lunch nearby ›');
    expect(chips.length).toBe(4);
  });
});

describe('getContextualChips — chip shape', () => {
  it('expand chips have kind expand and nearbyType', () => {
    const chips = getContextualChips(['park'], 10 * 60);
    const expand = chips.filter(c => c.kind === 'expand');
    expect(expand.length).toBeGreaterThan(0);
    expand.forEach(c => {
      expect(c.nearbyType).toBeTruthy();
    });
  });

  it('direct chips have kind direct and no nearbyType', () => {
    const chips = getContextualChips(['park'], 10 * 60);
    const direct = chips.filter(c => c.kind === 'direct');
    expect(direct.length).toBeGreaterThan(0);
    direct.forEach(c => {
      expect(c.nearbyType).toBeUndefined();
    });
  });
});

// ── buildDirectUrl ───────────────────────────────────────────────

describe('buildDirectUrl', () => {
  const stop = { place: 'Monsanto Forest', lat: 38.72, lon: -9.18 };

  it('Restrooms — search near coordinates', () => {
    const url = buildDirectUrl('Restrooms ↗', stop, false);
    expect(url).toContain('restroom');
    expect(url).toContain('38.72');
  });

  it('Trail map — search near coordinates', () => {
    const url = buildDirectUrl('Trail map ↗', stop, false);
    expect(url).toContain('hiking');
  });

  it('Walk it off — walking directions from coordinates', () => {
    const url = buildDirectUrl('Walk it off ↗', stop, false);
    expect(url).toContain('38.72');
    expect(url).toContain('-9.18');
  });

  it('Leave review — Google Maps search for place', () => {
    const url = buildDirectUrl('Leave review ↗', stop, false);
    expect(url).toContain('maps.google.com');
    expect(url).toContain(encodeURIComponent('Monsanto Forest'));
  });

  it('Street view — Google Maps street view layer', () => {
    const url = buildDirectUrl('Street view ↗', stop, false);
    expect(url).toContain('layer=c');
  });

  it('Book tickets — Google search', () => {
    const url = buildDirectUrl('Book tickets ↗', stop, false);
    expect(url).toContain('google.com/search');
    expect(url).toContain('tickets');
  });

  it('Book ahead — Google search', () => {
    const url = buildDirectUrl('Book ahead ↗', stop, false);
    expect(url).toContain('google.com/search');
    expect(url).toContain('tickets');
  });

  it('Prayer times — Google search', () => {
    const url = buildDirectUrl('Prayer times ↗', stop, false);
    expect(url).toContain('prayer+times');
  });

  it('Dress code — Google search', () => {
    const url = buildDirectUrl('Dress code ↗', stop, false);
    expect(url).toContain('dress+code');
  });

  it('Explore nearby — Maps near coordinates', () => {
    const url = buildDirectUrl('Explore nearby ↗', stop, false);
    expect(url).toContain('38.72');
    expect(url).toContain('-9.18');
  });

  it('uses Apple Maps base on iOS/Mac', () => {
    const url = buildDirectUrl('Restrooms ↗', stop, true);
    expect(url).toContain('maps.apple.com');
  });

  it('uses Google Maps base on non-Mac', () => {
    const url = buildDirectUrl('Restrooms ↗', stop, false);
    expect(url).toContain('maps.google.com');
  });
});
