import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReelScenicCard from '../ReelScenicCard';

const baseCard = {
  type: 'scenic' as const,
  sceneType: 'walk' as const,
  accent: '#6b9470',
  cardType: 'WALK · NATURAL',
  pos: 1, total: 2,
  timing: 'Morning', metaRight: '1.2 km',
  place: 'Yanaka Ginza',
  from: 'Senso-ji', to: 'Ueno Park',
  modeIcon: 'walk' as const,
  tag: 'Natural', vizType: 'corridor' as const,
  persona: 'explorer', personaDisplay: 'Explorer', personaIcon: 'walk',
  why: 'A natural walk.', sensory: '', sensoryIcon: 'waves',
  reelPos: 'Between Stop 1 and Stop 2',
  detourKm: 1.2, detourMin: 18,
};

describe('ReelScenicCard trend badge', () => {
  it('shows "Trending now" pill when isTrending is true', () => {
    const card = { ...baseCard, isTrending: true, trendNote: 'Trending spot' };
    // @ts-ignore minimal mock
    const { getByText } = render(<ReelScenicCard card={card} active={true} />);
    expect(getByText(/trending now/i)).toBeInTheDocument();
  });

  it('does not render trend pill when isTrending is false', () => {
    const card = { ...baseCard, isTrending: false, trendNote: null };
    // @ts-ignore minimal mock
    const { queryByText } = render(<ReelScenicCard card={card} active={true} />);
    expect(queryByText(/trending now/i)).not.toBeInTheDocument();
  });
});
