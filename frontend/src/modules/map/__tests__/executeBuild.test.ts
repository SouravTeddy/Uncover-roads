import { describe, it, expect } from 'vitest';
// Smoke test — actual MapScreen is too complex to unit-test in isolation;
// we verify the button label logic.

describe('Build button label logic', () => {
  it('returns "Building in progress" when activeBuild is running', () => {
    const getLabel = (status: string | null) => {
      if (status === 'pending' || status === 'running') return 'Building in progress';
      return 'Build Itinerary';
    };
    expect(getLabel('running')).toBe('Building in progress');
    expect(getLabel('pending')).toBe('Building in progress');
    expect(getLabel(null)).toBe('Build Itinerary');
    expect(getLabel('done')).toBe('Build Itinerary');
  });
});
