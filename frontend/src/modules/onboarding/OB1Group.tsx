import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import type { OBGroup } from '../../shared/types';

const OPTIONS = [
  { value: 'solo',    label: 'Just me',         sublabel: 'Self-paced, flexible',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80' },
  { value: 'couple',  label: 'Partner',          sublabel: 'Romantic, shared pace',
    imageUrl: 'https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=400&q=80' },
  { value: 'family',  label: 'Family',           sublabel: 'Kid-accessible spots',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&q=80' },
  { value: 'friends', label: 'Friends',          sublabel: 'Group bookings, social',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80' },
];

export function OB1Group() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.group ?? null) as OBGroup | null;

  function handleSelect(v: string) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'group', value: v as OBGroup });
  }

  return (
    <OnboardingShell step="ob1" canAdvance={value !== null}>
      <PhotoGrid2x2 options={OPTIONS} selected={value} onSelect={handleSelect} />
    </OnboardingShell>
  );
}
