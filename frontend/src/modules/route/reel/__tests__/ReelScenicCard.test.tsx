import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReelScenicCard from '../ReelScenicCard';

const mockScenicCard = {
  type: 'scenic' as const,
  sceneType: 'walk' as const, accent: '#6b9470', cardType: 'NATURAL WALK', pos: 1, total: 2,
  timing: 'Morning · 9:30 AM', metaRight: 'Asakusa', place: 'Sumida Riverside',
  from: 'Asakusa', to: 'Ueno', modeIcon: 'walk' as const, tag: 'Natural',
  vizType: 'corridor' as const, persona: 'flaneur', personaDisplay: 'Flâneur',
  personaIcon: 'walk', why: 'A quiet riverside path through cherry trees.',
  sensory: 'Cool breeze off the river.', sensoryIcon: 'waves',
  reelPos: 'Between Stop 1 and Stop 2',
  photoUrl: null, originPhotoUrl: null, destPhotoUrl: null, transitInfo: null,
  detourKm: 1.4, detourMin: 18,
  routeLabel: 'Sumida Riverside Walk',
  conditionNote: null, characterDimensions: ['natural', 'waterfront'], landmarkPeek: null,
};

describe('ReelScenicCard', () => {
  it('renders route label', () => {
    // @ts-ignore minimal mock
    const { getByText } = render(<ReelScenicCard card={mockScenicCard} active={false} />);
    expect(getByText('Sumida Riverside Walk')).toBeInTheDocument();
  });

  it('renders LLM why text', () => {
    // @ts-ignore
    const { getByText } = render(<ReelScenicCard card={mockScenicCard} active={false} />);
    expect(getByText(/quiet riverside path/i)).toBeInTheDocument();
  });

  it('does not render a drag bar', () => {
    // @ts-ignore
    const { container } = render(<ReelScenicCard card={mockScenicCard} active={false} />);
    // drag bar has class "sc-drag" or similar — should not exist
    expect(container.querySelector('.sc-drag, [data-drag-bar]')).toBeNull();
  });

  it('renders conditionNote when present', () => {
    const cardWithNote = { ...mockScenicCard, conditionNote: 'High UV — shaded route available.' };
    // @ts-ignore
    const { getByText } = render(<ReelScenicCard card={cardWithNote} active={false} />);
    expect(getByText(/High UV/i)).toBeInTheDocument();
  });
});
