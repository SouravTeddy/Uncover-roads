import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReelScenicCard from '../ReelScenicCard';

const mockCard = {
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
  conditionNote: null, characterDimensions: { natural: 0.8 }, landmarkPeek: null,
};

const mockScenicCard = mockCard;

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

  it('renders characterDimensions pills (up to 3 top dimensions)', () => {
    const cardWithDims = {
      ...mockCard,
      characterDimensions: { natural: 0.95, waterfront: 0.87, viewpoint: 0.72, historic: 0.40 },
      landmarkPeek: null,
    };
    // @ts-ignore
    const { getByText, container } = render(<ReelScenicCard card={cardWithDims} active={false} />);
    // Top 3 by score: natural (0.95), waterfront (0.87), viewpoint (0.72)
    // historic (0.40) should not appear
    expect(getByText('Natural')).toBeInTheDocument();
    expect(getByText('Waterfront')).toBeInTheDocument();
    expect(getByText('Viewpoint')).toBeInTheDocument();
    // Verify "Along the way" section exists
    expect(getByText(/Along the way/i)).toBeInTheDocument();
  });

  it('renders landmark peek as "Glimpse of X" (first 2 only)', () => {
    const cardWithPeeks = {
      ...mockCard,
      landmarkPeek: ['Eiffel Tower', 'Notre-Dame', 'Louvre'],
    };
    // @ts-ignore
    const { getByText, queryByText } = render(<ReelScenicCard card={cardWithPeeks} active={false} />);
    expect(getByText(/Glimpse of Eiffel Tower/i)).toBeInTheDocument();
    expect(getByText(/Glimpse of Notre-Dame/i)).toBeInTheDocument();
    // Only first 2 should show
    expect(queryByText(/Glimpse of Louvre/i)).toBeNull();
  });
});
