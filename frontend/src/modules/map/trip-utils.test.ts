import { describe, it, expect } from 'vitest';
import {
  generateDateStrip,
  computeRecommendedStartTime,
  formatTimeDisplay,
} from './trip-utils';
import type { Place } from '../../shared/types';
import type { PlaceDetails } from '../../shared/types';

const BASE_PLACE: Place = {
  id: 'p1', title: 'Test Place', category: 'restaurant', lat: 12.9, lon: 77.6,
};

const DETAILS_9AM: PlaceDetails = {
  place_id: 'g1', name: 'Test Place', address: '...', lat: 12.9, lon: 77.6,
  weekday_text: [
    'Monday: 9:00 AM – 11:00 PM',
    'Tuesday: 9:00 AM – 11:00 PM',
    'Wednesday: 9:00 AM – 11:00 PM',
    'Thursday: 9:00 AM – 11:00 PM',
    'Friday: 9:00 AM – 12:00 AM',
    'Saturday: 9:00 AM – 12:00 AM',
    'Sunday: 11:00 AM – 10:00 PM',
  ],
};

const DETAILS_7AM: PlaceDetails = {
  ...DETAILS_9AM,
  place_id: 'g2',
  weekday_text: DETAILS_9AM.weekday_text!.map(l => l.replace('9:00 AM', '7:00 AM').replace('11:00 AM', '7:00 AM')),
};

const DETAILS_11AM: PlaceDetails = {
  ...DETAILS_9AM,
  place_id: 'g3',
  weekday_text: DETAILS_9AM.weekday_text!.map(l => l.replace('9:00 AM', '11:00 AM')),
};

describe('generateDateStrip', () => {
  it('returns 7 entries by default', () => {
    expect(generateDateStrip()).toHaveLength(7);
  });

  it('first entry is today in ISO format', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(generateDateStrip()[0].isoDate).toBe(today);
  });

  it('each entry has isoDate, dayAbbr, and dayNum', () => {
    const strip = generateDateStrip(1);
    expect(strip[0]).toHaveProperty('isoDate');
    expect(strip[0]).toHaveProperty('dayAbbr');
    expect(strip[0]).toHaveProperty('dayNum');
  });
});

describe('computeRecommendedStartTime', () => {
  // Use a Monday as the date so index is predictable (Google index 0 = Monday)
  function nextMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 1 ? 0 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  const monday = nextMonday();

  it('returns default 09:00 when no places have details', () => {
    const result = computeRecommendedStartTime([BASE_PLACE], () => undefined, monday);
    expect(result).toBe('09:00');
  });

  it('returns earliest opening time across places', () => {
    const place2 = { ...BASE_PLACE, id: 'p2', title: 'P2' };
    const result = computeRecommendedStartTime(
      [BASE_PLACE, place2],
      p => {
        if (p === BASE_PLACE.title) return DETAILS_11AM;
        if (p === place2.title) return DETAILS_9AM;
        return undefined;
      },
      monday,
    );
    expect(result).toBe('09:00');
  });

  it('floors to 08:00 when earliest is before 8 AM', () => {
    const result = computeRecommendedStartTime(
      [BASE_PLACE],
      () => DETAILS_7AM,
      monday,
    );
    expect(result).toBe('08:00');
  });
});

describe('formatTimeDisplay', () => {
  it('converts 09:00 to 9:00 AM', () => {
    expect(formatTimeDisplay('09:00')).toBe('9:00 AM');
  });

  it('converts 13:30 to 1:30 PM', () => {
    expect(formatTimeDisplay('13:30')).toBe('1:30 PM');
  });

  it('converts 12:00 to 12:00 PM', () => {
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM');
  });

  it('converts 00:00 to 12:00 AM', () => {
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM');
  });
});
