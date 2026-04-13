import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBBudgetProtect } from '../../shared/types';

const OPTIONS: { value: OBBudgetProtect; label: string; description: string; imageUrl: string }[] = [
  { value: 'free_only',       label: 'Free attractions only',  description: 'No entry fees',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80' },
  { value: 'one_splurge',     label: 'One splurge per day',    description: '1 paid highlight allowed',
    imageUrl: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=120&q=80' },
  { value: 'street_food',     label: 'Street food only',       description: 'No sit-down restaurants',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
  { value: 'local_transport', label: 'Local transport only',   description: 'No taxis or private tours',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=120&q=80' },
];

export function OB9BudgetProtect() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.budget_protect ?? null) as OBBudgetProtect | null;

  return (
    <OnboardingShell step="ob9" canAdvance={value !== null}
      title="Where do you draw the line?"
      subtitle="Sets your hard budget constraints.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'budget_protect', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
