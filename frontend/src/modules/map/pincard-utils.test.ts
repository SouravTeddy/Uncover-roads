import { describe, it, expect } from 'vitest';
import { filterTypes, getHoursLabel, parseOpenClose } from './pincard-utils';

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
