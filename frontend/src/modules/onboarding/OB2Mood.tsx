import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ2Mood } from './ob-context-resolvers';
import type { RawOBAnswers } from '../../shared/types';

const DEFAULT_OPTIONS = [
  {
    value: 'explore',   label: 'Explore',      sublabel: 'Hidden streets, surprises',
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80',
  },
  {
    value: 'relax',     label: 'Unwind',        sublabel: 'Slow pace, cafés, parks',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  },
  {
    value: 'eat_drink', label: 'Eat & Drink',   sublabel: 'Markets, tables, tastings',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  },
  {
    value: 'culture',   label: 'Culture',       sublabel: 'Museums, history, art',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  },
];

const FAMILY_OPTIONS = [
  {
    value: 'explore',   label: 'Outdoors',      sublabel: 'Parks, nature, hikes',
    imageUrl: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80',
  },
  {
    value: 'culture',   label: 'Educational',   sublabel: 'Museums, history, hands-on',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  },
  {
    value: 'eat_drink', label: 'Eat & Explore',  sublabel: 'Kid-friendly food & markets',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  },
  {
    value: 'relax',     label: 'Slow & Easy',   sublabel: 'Relaxed pace, no rushing',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  },
];

const FAMILY_HERO = 'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=800&q=80';

function getMoodOptions(answers: Partial<RawOBAnswers>) {
  return answers.group === 'family' ? FAMILY_OPTIONS : DEFAULT_OPTIONS;
}

export function OB2Mood() {
  const { state, dispatch } = useAppStore();
  const answers = state.rawOBAnswers ?? {};
  const value = answers.mood?.[0] ?? null;
  const ctx = resolveQ2Mood(answers);
  const options = getMoodOptions(answers);
  const heroUrl = answers.group === 'family' ? FAMILY_HERO : undefined;

  return (
    <OnboardingShell
      step="ob2"
      canAdvance={value !== null}
      title={ctx.title}
      subtitle={ctx.subtitle}
      heroUrl={heroUrl}
    >
      <PhotoGrid2x2
        options={options}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'mood', value: [v] })}
      />
    </OnboardingShell>
  );
}
