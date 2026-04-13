import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBKidFocus } from '../../shared/types';

const OPTIONS: { value: OBKidFocus; label: string; description: string; imageUrl: string }[] = [
  { value: 'outdoor', label: 'Playgrounds & parks',    description: 'Outdoor routing, open spaces',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&q=80' },
  { value: 'edu',     label: 'Interactive museums',    description: 'Educational, hands-on venues',
    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=120&q=80' },
  { value: 'food',    label: 'Kid-friendly food',      description: 'Family menu spots, allergen-aware',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&q=80' },
  { value: 'slow',    label: 'Slow pace, rest breaks', description: '+30 min buffer per stop',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&q=80' },
];

export function OB8KidFocus() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.kid_focus ?? null) as OBKidFocus | null;

  return (
    <OnboardingShell step="ob8" canAdvance={value !== null}
      title="What matters most for the kids?"
      subtitle="Shapes venue filtering and pacing for little travellers.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'kid_focus', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
