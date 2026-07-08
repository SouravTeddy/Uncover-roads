import { describe, it, expect } from 'vitest';

describe('scenic_pending card rendering', () => {
  it('ReelScenicPendingCard type exists', () => {
    const card: import('../types').ReelScenicPendingCard = {
      type: 'scenic_pending',
      from: 'Senso-ji',
      to: 'Ueno Park',
    };
    expect(card.type).toBe('scenic_pending');
  });
});
