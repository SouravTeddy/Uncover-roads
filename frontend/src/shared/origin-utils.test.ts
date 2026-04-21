import { describe, it, expect } from 'vitest';
import { classifyOriginType } from './origin-utils';

describe('classifyOriginType', () => {
  it('classifies lodging as hotel', () => {
    expect(classifyOriginType(['lodging', 'establishment'])).toBe('hotel');
  });

  it('classifies airport type as airport', () => {
    expect(classifyOriginType(['airport', 'establishment'])).toBe('airport');
  });

  it('classifies street_address as custom', () => {
    expect(classifyOriginType(['street_address', 'geocode'])).toBe('custom');
  });

  it('classifies premise as custom', () => {
    expect(classifyOriginType(['premise'])).toBe('custom');
  });

  it('defaults to custom for unknown types', () => {
    expect(classifyOriginType(['point_of_interest'])).toBe('custom');
  });

  it('defaults to custom for empty array', () => {
    expect(classifyOriginType([])).toBe('custom');
  });

  it('lodging takes priority over street_address', () => {
    expect(classifyOriginType(['lodging', 'street_address'])).toBe('hotel');
  });
});
