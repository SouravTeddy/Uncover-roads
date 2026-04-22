import { describe, it, expect } from 'vitest';
import { parseSearchQuery, validateSearchDate } from './parseSearchQuery';

describe('parseSearchQuery', () => {
  it('detects museum category', () => {
    expect(parseSearchQuery('museum near shinjuku').category).toBe('museum');
  });
  it('detects gallery as museum', () => {
    expect(parseSearchQuery('art gallery in roppongi').category).toBe('museum');
  });
  it('detects event category', () => {
    expect(parseSearchQuery('live events on april 23').category).toBe('event');
  });
  it('detects park category', () => {
    expect(parseSearchQuery('park near harajuku').category).toBe('park');
  });
  it('detects restaurant category', () => {
    expect(parseSearchQuery('restaurant near shibuya').category).toBe('restaurant');
  });
  it('extracts location after near', () => {
    expect(parseSearchQuery('museum near shinjuku station').locationString).toBe('shinjuku station');
  });
  it('extracts location after in', () => {
    expect(parseSearchQuery('park in ueno').locationString).toBe('ueno');
  });
  it('returns null location when no prefix', () => {
    expect(parseSearchQuery('museum').locationString).toBeNull();
  });
  it('detects date "april 23"', () => {
    expect(parseSearchQuery('events on april 23').dateString).toBe('april 23');
  });
  it('detects date "23rd april"', () => {
    expect(parseSearchQuery('events 23rd april near shinjuku').dateString).toBe('23rd april');
  });
  it('returns null category for unrecognized input', () => {
    expect(parseSearchQuery('shinjuku station').category).toBeNull();
  });
});

describe('validateSearchDate', () => {
  it('resolves "april 23" to ISO date', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('april 23', null, null);
    expect(result.isoDate).toBe(`${year}-04-23`);
  });
  it('resolves "23rd april" to ISO date', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('23rd april', null, null);
    expect(result.isoDate).toBe(`${year}-04-23`);
  });
  it('withinTrip is null when no travel dates', () => {
    const result = validateSearchDate('april 23', null, null);
    expect(result.withinTrip).toBeNull();
    expect(result.nudgeMessage).toBeNull();
  });
  it('withinTrip is true when date is inside window', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('april 23', `${year}-04-20`, `${year}-04-26`);
    expect(result.withinTrip).toBe(true);
    expect(result.nudgeMessage).toBeNull();
  });
  it('withinTrip is false and nudgeMessage set when date is outside window', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('may 10', `${year}-04-20`, `${year}-04-26`);
    expect(result.withinTrip).toBe(false);
    expect(result.nudgeMessage).toContain('outside your trip');
  });
});
