import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ3Pace } from './ob-context-resolvers';
import type { OBPace } from '../../shared/types';

const OPTIONS = [
  { value: 'slow',        label: 'Slow',        sublabel: '2–3 places, deep dives',
    imageUrl: 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=400&q=80' },
  { value: 'balanced',    label: 'Balanced',    sublabel: '4–5 places, good mix',
    imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80' },
  { value: 'pack',        label: 'Packed',      sublabel: '6–8 places, full day',
    imageUrl: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=400&q=80' },
  { value: 'spontaneous', label: 'Flexible',    sublabel: 'Decide on the day',
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&q=80' },
];

const MAX = 2;

export function OB3Pace() {
  const { state, dispatch } = useAppStore();
  const raw = state.rawOBAnswers;
  const values: OBPace[] = raw?.pace ?? [];
  const ctx = resolveQ3Pace(raw ?? {});

  function toggle(v: string) {
    const val = v as OBPace;
    const next = values.includes(val)
      ? values.filter(x => x !== val)
      : values.length < MAX ? [...values, val] : values;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'pace', value: next });
  }

  return (
    <OnboardingShell step="ob3" canAdvance={values.length > 0} title={ctx.title} subtitle={ctx.subtitle}>
      <PhotoGrid2x2
        options={OPTIONS}
        selected={values}
        multi
        onSelect={toggle}
      />
    </OnboardingShell>
  );
}
