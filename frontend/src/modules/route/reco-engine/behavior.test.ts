import { describe, it, expect } from 'vitest';
import { buildInteraction } from './behavior';
import type { ReelRecoCard } from '../reel/types';

const CARD: ReelRecoCard = {
  type: 'reco', id: 'hasLunch-s1', trigger: 'lunch',
  label: 'No lunch', consequence: 'Grab something near here',
  nearbyCity: 'Paris', persona: 'epicurean', afterStopId: 's1',
  weightScore: 0.6,
};

describe('buildInteraction', () => {
  it('builds a valid interaction object', () => {
    const interaction = buildInteraction(CARD, 'tapped', false, 'epicurean', 'moderate', null, 1, null);
    expect(interaction.recoId).toBe('hasLunch-s1');
    expect(interaction.dimension).toBe('hasLunch');
    expect(interaction.action).toBe('tapped');
    expect(interaction.archetype).toBe('epicurean');
    expect(interaction.conflictPresent).toBe(false);
    expect(interaction.significance).toBeCloseTo(0.6);
  });

  it('extracts dimension from card id prefix', () => {
    const card = { ...CARD, id: 'densityScore-conflict-s2' };
    const interaction = buildInteraction(card, 'dismissed', true, 'slowtraveller', 'slow', null, 1, null);
    expect(interaction.dimension).toBe('densityScore');
    expect(interaction.conflictPresent).toBe(true);
  });
});
