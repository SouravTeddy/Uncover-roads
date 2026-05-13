import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ4DayOpen } from './ob-context-resolvers';
import type { OBDayOpen } from '../../shared/types';

const OPTIONS = [
  { value: 'coffee',    label: 'Morning market', sublabel: 'Local café first, early start',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80' },
  { value: 'breakfast', label: 'Hotel breakfast', sublabel: 'Sorted before exploring',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80' },
  { value: 'straight',  label: 'Late start',      sublabel: 'Straight to it, no food stop',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  { value: 'grab_go',   label: 'Grab & go',       sublabel: 'Street food en route',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
];

export function OB4DayOpen() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.day_open ?? null) as OBDayOpen | null;
  const ctx = resolveQ4DayOpen(state.rawOBAnswers ?? {});

  return (
    <OnboardingShell step="ob4" canAdvance={value !== null} title={ctx.title} subtitle={ctx.subtitle}>
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'day_open', value: v as OBDayOpen })}
      />
    </OnboardingShell>
  );
}
