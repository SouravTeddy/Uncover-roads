import { describe, it, expect } from 'vitest';
import { getLocalFoodFact } from './local-food-facts';

describe('getLocalFoodFact', () => {
  it('returns fact for known city', () => {
    const fact = getLocalFoodFact('Tokyo');
    expect(fact).not.toBeNull();
    expect(fact!.dish).toBe('Tonkotsu ramen');
  });

  it('is case-insensitive', () => {
    expect(getLocalFoodFact('PARIS')).not.toBeNull();
    expect(getLocalFoodFact('paris')).not.toBeNull();
  });

  it('returns null for unknown city', () => {
    expect(getLocalFoodFact('Nowhere City')).toBeNull();
  });

  it('returns bangalore fact', () => {
    const fact = getLocalFoodFact('Bangalore');
    expect(fact?.dish).toBe('Masala dosa');
  });
});
