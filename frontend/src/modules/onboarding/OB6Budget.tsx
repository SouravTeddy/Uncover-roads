import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBBudget } from '../../shared/types';

const OPTIONS: { value: OBBudget; label: string; description: string; imageUrl: string }[] = [
  { value: 'budget',      label: 'Budget-conscious', description: 'Free attractions first · street food preferred',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=120&q=80' },
  { value: 'mid_range',   label: 'Mid-range',         description: 'Mix of free + paid · no restrictions',
    imageUrl: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=120&q=80' },
  { value: 'comfortable', label: 'Comfortable',       description: 'Quality prioritised · one premium experience per day',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'luxury',      label: 'Luxury',            description: 'Fine dining, premium venues, private options',
    imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=120&q=80' },
];

export function OB6Budget() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.budget ?? null) as OBBudget | null;

  return (
    <OnboardingShell step="ob6" canAdvance={value !== null}
      title="How are you travelling budget-wise?"
      subtitle="Sets your price range across venues.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'budget', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
