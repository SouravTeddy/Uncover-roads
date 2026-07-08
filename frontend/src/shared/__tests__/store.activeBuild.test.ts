import { describe, it, expect } from 'vitest';

// Minimal reducer extraction — we test the shape, not the full store.
describe('ActiveBuild store shape', () => {
  it('ActiveBuild interface has required fields', () => {
    // This is a type-level test — it compiles only if the type is correct.
    // Import will fail at build time if the type is missing.
    const build: import('../types').ActiveBuild = {
      id: 'abc',
      cityName: 'Tokyo',
      status: 'pending',
    };
    expect(build.id).toBe('abc');
    expect(build.cityName).toBe('Tokyo');
    expect(build.status).toBe('pending');
  });
});
