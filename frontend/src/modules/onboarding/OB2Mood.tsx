import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ2Mood } from './ob-context-resolvers';
import type { OBMood } from '../../shared/types';

const OPTIONS: { value: OBMood; label: string; description: string; imageUrl: string }[] = [
  { value: 'explore',   label: 'Explore & discover', description: 'Neighbourhoods, landmarks, viewpoints',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80' },
  { value: 'relax',     label: 'Relax & recharge',   description: 'Parks, cafés, spas — fewer stops, longer stays',
    imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=120&q=80' },
  { value: 'eat_drink', label: 'Eat & drink',         description: 'Markets, culinary streets, food as anchor',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'culture',   label: 'Deep culture dive',   description: 'Museums, history, context-rich stops',
    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=120&q=80' },
];

const MAX = 3;

export function OB2Mood() {
  const { state, dispatch } = useAppStore();
  const values: OBMood[] = state.rawOBAnswers?.mood ?? [];
  const ctx = resolveQ2Mood(state.rawOBAnswers ?? {});

  function toggle(v: OBMood) {
    const next = values.includes(v)
      ? values.filter(x => x !== v)
      : values.length < MAX ? [...values, v] : values;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'mood', value: next });
  }

  return (
    <OnboardingShell step="ob2" canAdvance={values.length > 0} title={ctx.title} subtitle={ctx.subtitle}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={values.includes(opt.value)}
            onSelect={() => toggle(opt.value)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
