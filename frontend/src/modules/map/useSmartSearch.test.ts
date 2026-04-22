// frontend/src/modules/map/useSmartSearch.test.ts
import { describe, it, expect } from 'vitest';
import { extractSearchIntent, bboxDiagonalKm } from './useSmartSearch';

describe('extractSearchIntent', () => {
  it('extracts a single direct type', () => {
    const result = extractSearchIntent('museum');
    expect(result.types).toEqual(['museum']);
    expect(result.locationQuery).toBeNull();
    expect(result.chips).toHaveLength(0);
  });

  it('extracts multiple types', () => {
    const result = extractSearchIntent('museums and parks');
    expect(result.types).toContain('museum');
    expect(result.types).toContain('park');
  });

  it('extracts a named location after "near"', () => {
    const result = extractSearchIntent('hotels near the Eiffel Tower');
    expect(result.types).toContain('tourism');
    expect(result.locationQuery).toBe('the Eiffel Tower');
  });

  it('extracts a named location after "in"', () => {
    const result = extractSearchIntent('cafes in Montmartre');
    expect(result.types).toContain('cafe');
    expect(result.locationQuery).toBe('Montmartre');
  });

  it('returns null locationQuery when no preposition present', () => {
    const result = extractSearchIntent('museum');
    expect(result.locationQuery).toBeNull();
  });

  it('returns intent chips for morning query with no direct type match', () => {
    const result = extractSearchIntent('somewhere cozy for morning');
    expect(result.types).toHaveLength(0);
    expect(result.chips.map(c => c.type)).toContain('cafe');
  });

  it('returns default chips for completely unrecognised query', () => {
    const result = extractSearchIntent('xyzzy foobar');
    expect(result.types).toHaveLength(0);
    expect(result.chips).toHaveLength(3);
    expect(result.chips.map(c => c.label)).toContain('museum');
  });

  it('does not produce chips when types are found', () => {
    const result = extractSearchIntent('museum');
    expect(result.chips).toHaveLength(0);
  });
});

describe('bboxDiagonalKm', () => {
  it('returns ~0 for zero-size bbox', () => {
    expect(bboxDiagonalKm([48.8, 48.8, 2.3, 2.3])).toBeCloseTo(0, 0);
  });

  it('returns > 15 for Paris city bbox', () => {
    expect(bboxDiagonalKm([48.815, 48.902, 2.224, 2.470])).toBeGreaterThan(15);
  });

  it('returns < 5 for a small neighbourhood bbox', () => {
    expect(bboxDiagonalKm([48.858, 48.870, 2.330, 2.345])).toBeLessThan(5);
  });
});
