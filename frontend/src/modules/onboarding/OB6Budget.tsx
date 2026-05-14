import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ6Budget } from './ob-context-resolvers';
import type { OBBudget } from '../../shared/types';

const OPTIONS = [
  { value: 'budget',      label: 'Budget',      sublabel: 'Free attractions, street food',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80' },
  { value: 'mid_range',   label: 'Mid-range',   sublabel: 'Mix of free + paid, no limits',
    imageUrl: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&q=80' },
  { value: 'comfortable', label: 'Comfortable', sublabel: 'One premium experience per day',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
  { value: 'luxury',      label: 'Luxury',      sublabel: 'Fine dining, premium venues',
    imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&q=80' },
];

export function OB6Budget() {
  const { state, dispatch } = useAppStore();
  const answers = state.rawOBAnswers ?? {};
  const value = (answers.budget ?? null) as OBBudget | null;
  const ctx = resolveQ6Budget(answers);

  return (
    <OnboardingShell step="ob6" canAdvance={value !== null} title={ctx.title} subtitle={ctx.subtitle}>
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'budget', value: v as OBBudget })}
      />
    </OnboardingShell>
  );
}
