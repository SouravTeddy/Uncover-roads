import { describe, it, expect } from 'vitest';
import { filterTypes, getHoursLabel, parseOpenClose, getDirectionsUrl, getTravelDateBadge } from './pincard-utils';

const WEEKDAYS = [
  'Monday: 9:00 AM – 11:00 PM',
  'Tuesday: 9:00 AM – 11:00 PM',
  'Wednesday: 9:00 AM – 11:00 PM',
  'Thursday: 9:00 AM – 11:00 PM',
  'Friday: 9:00 AM – 12:00 AM',
  'Saturday: 10:00 AM – 12:00 AM',
  'Sunday: 11:00 AM – 10:00 PM',
];

describe('filterTypes', () => {
  it('removes noise types', () => {
    expect(filterTypes(['restaurant', 'food', 'establishment'])).toEqual(['Restaurant']);
  });

  it('title-cases underscore-separated types', () => {
    expect(filterTypes(['japanese_restaurant'])).toEqual(['Japanese Restaurant']);
  });

  it('limits output to 3 tags', () => {
    expect(filterTypes(['a', 'b', 'c', 'd'])).toHaveLength(3);
  });

  it('returns empty array when all types are noise', () => {
    expect(filterTypes(['point_of_interest', 'establishment', 'food'])).toEqual([]);
  });
});

describe('getHoursLabel', () => {
  it('returns Monday line for JS day 1 (Monday)', () => {
    expect(getHoursLabel(WEEKDAYS, 1)).toBe('Monday: 9:00 AM – 11:00 PM');
  });

  it('returns Sunday line for JS day 0 (Sunday)', () => {
    expect(getHoursLabel(WEEKDAYS, 0)).toBe('Sunday: 11:00 AM – 10:00 PM');
  });

  it('returns Saturday line for JS day 6 (Saturday)', () => {
    expect(getHoursLabel(WEEKDAYS, 6)).toBe('Saturday: 10:00 AM – 12:00 AM');
  });

  it('returns null for empty array', () => {
    expect(getHoursLabel([], 1)).toBeNull();
  });
});

describe('parseOpenClose', () => {
  it('shows closing time when open', () => {
    const result = parseOpenClose('Monday: 9:00 AM – 11:00 PM', true);
    expect(result).toBe('Open now · Closes 11:00 PM');
  });

  it('shows opening time when closed', () => {
    const result = parseOpenClose('Monday: 9:00 AM – 11:00 PM', false);
    expect(result).toBe('Closed · Opens 9:00 AM');
  });

  it('returns original line if unparseable', () => {
    expect(parseOpenClose('Monday: Closed', true)).toBe('Monday: Closed');
  });
});

describe('getDirectionsUrl', () => {
  it('returns Apple Maps URL for iPhone user agent', () => {
    const url = getDirectionsUrl(12.9, 77.6, 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)');
    expect(url).toBe('maps://maps.apple.com/?q=12.9,77.6');
  });

  it('returns Google Maps URL for Android user agent', () => {
    const url = getDirectionsUrl(12.9, 77.6, 'Mozilla/5.0 (Linux; Android 12)');
    expect(url).toBe('https://maps.google.com/maps?q=12.9,77.6');
  });
});

const HOURS = [
  'Monday: 9:00 AM – 6:00 PM',
  'Tuesday: 9:00 AM – 6:00 PM',
  'Wednesday: 9:00 AM – 6:00 PM',
  'Thursday: 9:00 AM – 6:00 PM',
  'Friday: Closed',
  'Saturday: 10:00 AM – 5:00 PM',
  'Sunday: 11:00 AM – 4:00 PM',
];

describe('getTravelDateBadge', () => {
  it('returns open badge when travel day has hours', () => {
    // 2026-06-13 is a Saturday
    const result = getTravelDateBadge(HOURS, '2026-06-13');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('open');
    expect(result!.text).toContain('Sat');
    expect(result!.text).toContain('5:00 PM');
  });

  it('returns closed badge when travel day is closed', () => {
    // 2026-06-12 is a Friday
    const result = getTravelDateBadge(HOURS, '2026-06-12');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('closed');
    expect(result!.text).toContain('Fri');
    expect(result!.text).toContain('Closed');
  });

  it('returns null for empty weekday_text', () => {
    expect(getTravelDateBadge([], '2026-06-12')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(getTravelDateBadge(HOURS, 'not-a-date')).toBeNull();
  });
});
