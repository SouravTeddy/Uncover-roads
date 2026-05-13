import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import type { OBKidFocus } from '../../shared/types';

const OPTIONS = [
  { value: 'outdoor', label: 'Playgrounds & parks',    sublabel: 'Outdoor routing, open spaces',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  { value: 'edu',     label: 'Interactive museums',    sublabel: 'Educational, hands-on venues',
    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=400&q=80' },
  { value: 'food',    label: 'Kid-friendly food',      sublabel: 'Family menu spots, allergen-aware',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80' },
  { value: 'slow',    label: 'Slow pace',              sublabel: '+30 min buffer per stop',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80' },
];

export function OB8KidFocus() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.kid_focus ?? null) as OBKidFocus | null;

  return (
    <OnboardingShell step="ob8" canAdvance={value !== null}
      title="What matters most for the kids?"
      subtitle="Shapes venue filtering and pacing for little travellers.">
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'kid_focus', value: v as OBKidFocus })}
      />
    </OnboardingShell>
  );
}
