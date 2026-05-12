import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBDietary } from '../../shared/types';

const OPTIONS: { value: OBDietary; label: string; description: string; imageUrl: string }[] = [
  { value: 'none',        label: 'No restrictions',  description: 'Full range — no filtering',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&q=80' },
  { value: 'plant_based', label: 'Plant-based',       description: 'Vegan/vegetarian venues boosted, meat flagged',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&q=80' },
  { value: 'halal',       label: 'Halal',             description: 'Certified or clearly compatible venues only',
    imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=120&q=80' },
  { value: 'kosher',      label: 'Kosher',            description: 'Certified venues only, others get disclaimer',
    imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=120&q=80' },
  { value: 'allergy',     label: 'I have an allergy', description: 'Warning badge on relevant places',
    imageUrl: 'https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=120&q=80' },
];

export function OB5Dietary() {
  const { state, dispatch } = useAppStore();
  const values: OBDietary[] = state.rawOBAnswers?.dietary ?? [];

  function toggle(v: OBDietary) {
    if (v === 'none') {
      dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'dietary', value: ['none'] });
      return;
    }
    const without_none = values.filter(x => x !== 'none');
    const next = without_none.includes(v)
      ? without_none.filter(x => x !== v)
      : [...without_none, v];
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'dietary', value: next.length === 0 ? [] : next });
  }

  return (
    <OnboardingShell step="ob5" canAdvance={true} title="Any food situation we should know?"
      subtitle="Pick all that apply. Shapes restaurant filtering.">
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
