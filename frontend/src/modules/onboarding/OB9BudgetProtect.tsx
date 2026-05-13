import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import type { OBBudgetProtect } from '../../shared/types';

const OPTIONS = [
  { value: 'free_only',       label: 'Free only',          sublabel: 'No entry fees',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80' },
  { value: 'one_splurge',     label: 'One splurge/day',    sublabel: '1 paid highlight allowed',
    imageUrl: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&q=80' },
  { value: 'street_food',     label: 'Street food only',   sublabel: 'No sit-down restaurants',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
  { value: 'local_transport', label: 'Local transport',    sublabel: 'No taxis or private tours',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80' },
];

export function OB9BudgetProtect() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.budget_protect ?? null) as OBBudgetProtect | null;

  return (
    <OnboardingShell step="ob9" canAdvance={value !== null}
      title="Where do you draw the line?"
      subtitle="Sets your hard budget constraints.">
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'budget_protect', value: v as OBBudgetProtect })}
      />
    </OnboardingShell>
  );
}
