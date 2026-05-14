import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ2Mood } from './ob-context-resolvers';

const OPTIONS = [
  {
    value: 'explore',   label: 'Explore',     sublabel: 'Hidden streets, surprises',
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80',
  },
  {
    value: 'relax',     label: 'Unwind',      sublabel: 'Slow pace, cafés, parks',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  },
  {
    value: 'eat_drink', label: 'Eat & Drink', sublabel: 'Markets, tables, tastings',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  },
  {
    value: 'culture',   label: 'Culture',     sublabel: 'Museums, history, art',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  },
];

const FAMILY_HERO = 'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=800&q=80';

export function OB2Mood() {
  const { state, dispatch } = useAppStore();
  const raw = state.rawOBAnswers;
  const value = raw?.mood?.[0] ?? null;
  const ctx = resolveQ2Mood(raw ?? {});
  const heroUrl = raw?.group === 'family' ? FAMILY_HERO : undefined;

  return (
    <OnboardingShell
      step="ob2"
      canAdvance={value !== null}
      title={ctx.title}
      subtitle={ctx.subtitle}
      heroUrl={heroUrl}
    >
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'mood', value: [v] })}
      />
    </OnboardingShell>
  );
}
