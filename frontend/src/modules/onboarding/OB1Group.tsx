import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBGroup } from '../../shared/types';

const OPTIONS: { value: OBGroup; label: string; description: string; imageUrl: string }[] = [
  { value: 'solo',    label: 'Just me',          description: 'Self-paced, flexible, communal spaces OK',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80' },
  { value: 'couple',  label: 'Partner / couple',  description: 'Romantic spots, table-for-two, shared pace',
    imageUrl: 'https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=120&q=80' },
  { value: 'family',  label: 'Family with kids',  description: 'Kid-accessible, playgrounds, early dinner',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=120&q=80' },
  { value: 'friends', label: 'Friends group',     description: 'Group bookings, sharable food, social vibe',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=120&q=80' },
];

export function OB1Group() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.group ?? null) as OBGroup | null;

  function handleChange(v: OBGroup) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'group', value: v });
  }

  return (
    <OnboardingShell step="ob1" canAdvance={value !== null}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => handleChange(opt.value)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
