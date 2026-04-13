import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ4DayOpen } from './ob-context-resolvers';
import type { OBDayOpen } from '../../shared/types';

const OPTIONS: { value: OBDayOpen; label: string; description: string; imageUrl: string }[] = [
  { value: 'coffee',    label: 'Coffee shop ritual', description: 'Local café first · 30 min buffer before first spot',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&q=80' },
  { value: 'breakfast', label: 'Sit-down breakfast', description: 'Restaurant first · 45 min · then attractions',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=120&q=80' },
  { value: 'straight',  label: 'Straight to it',     description: 'Top attraction first · no food stop at start',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&q=80' },
  { value: 'grab_go',   label: 'Grab & go',           description: 'Street food en route · first attraction early',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
];

export function OB4DayOpen() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.day_open ?? null) as OBDayOpen | null;
  const ctx = resolveQ4DayOpen(state.rawOBAnswers ?? {});

  function handleChange(v: OBDayOpen) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'day_open', value: v });
  }

  return (
    <OnboardingShell step="ob4" canAdvance={value !== null} title={ctx.title} subtitle={ctx.subtitle}>
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
