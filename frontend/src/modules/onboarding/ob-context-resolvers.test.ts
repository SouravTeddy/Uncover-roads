import { describe, it, expect } from 'vitest';
import { resolveQ7Evening, resolveQ4DayOpen, resolveQ3Pace } from './ob-context-resolvers';
import type { RawOBAnswers } from '../../shared/types';

function partial(overrides: Partial<RawOBAnswers> = {}): Partial<RawOBAnswers> {
  return { group: 'solo', mood: ['explore'], pace: ['balanced'], ...overrides };
}

describe('resolveQ7Evening', () => {
  it('returns family-specific title for family group', () => {
    const out = resolveQ7Evening(partial({ group: 'family' }));
    expect(out.title).toContain('end time');
  });
  it('returns food-specific title for eat_drink mood', () => {
    const out = resolveQ7Evening(partial({ mood: ['eat_drink'] }));
    expect(out.title.toLowerCase()).toMatch(/evening|end up/);
  });
  it('returns default title when no signals match', () => {
    const out = resolveQ7Evening(partial());
    expect(out.title).toBe("What does a good evening look like?");
  });
});

describe('resolveQ4DayOpen', () => {
  it('returns relax-specific title', () => {
    const out = resolveQ4DayOpen(partial({ mood: ['relax'] }));
    expect(out.title.toLowerCase()).toContain('slow');
  });
  it('returns pack-specific title', () => {
    const out = resolveQ4DayOpen(partial({ pace: ['pack'] }));
    expect(out.title.toLowerCase()).toMatch(/fast|going|morning/);
  });
  it('returns default title', () => {
    const out = resolveQ4DayOpen(partial());
    expect(out.title).toBe("How do you ease into the day?");
  });
});

describe('resolveQ3Pace', () => {
  it('returns family-specific subtitle', () => {
    const out = resolveQ3Pace(partial({ group: 'family' }));
    expect(out.subtitle.toLowerCase()).toContain('kid');
  });
  it('returns default title', () => {
    const out = resolveQ3Pace(partial());
    expect(out.title).toBe("How do you pace a day?");
  });
});
