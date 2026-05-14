import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ5Dietary } from './ob-context-resolvers';
import type { OBDietary } from '../../shared/types';

const OPTIONS = [
  { value: 'none',        label: 'No restrictions',  sublabel: 'Full range — no filtering',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80' },
  { value: 'plant_based', label: 'Plant-based',       sublabel: 'Vegan/vegetarian boosted',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80' },
  { value: 'halal',       label: 'Halal',             sublabel: 'Certified venues only',
    imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&q=80' },
  { value: 'kosher',      label: 'Kosher',            sublabel: 'Certified venues only',
    imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=80' },
  { value: 'allergy',     label: 'Allergy',           sublabel: 'Warning badges on places',
    imageUrl: 'https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=400&q=80' },
];

export function OB5Dietary() {
  const { state, dispatch } = useAppStore();
  const answers = state.rawOBAnswers ?? {};
  const values: OBDietary[] = answers.dietary ?? [];
  const ctx = resolveQ5Dietary(answers);

  function toggle(v: string) {
    const val = v as OBDietary;
    if (val === 'none') {
      dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'dietary', value: ['none'] });
      return;
    }
    const without_none = values.filter(x => x !== 'none');
    const next = without_none.includes(val)
      ? without_none.filter(x => x !== val)
      : [...without_none, val];
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'dietary', value: next.length === 0 ? [] : next });
  }

  return (
    <OnboardingShell step="ob5" canAdvance={true} title={ctx.title} subtitle={ctx.subtitle}>
      <PhotoGrid2x2 options={OPTIONS} selected={values} multi onSelect={toggle} />
    </OnboardingShell>
  );
}
