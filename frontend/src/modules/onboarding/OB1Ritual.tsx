import { OnboardingShell } from './OnboardingShell';
import { RitualQuestion } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { Ritual } from '../../shared/types';

export function OB1Ritual() {
  const { state, dispatch } = useAppStore();
  const value = state.obAnswers.ritual;

  function handleChange(v: Ritual) {
    dispatch({ type: 'SET_OB_ANSWER', key: 'ritual', value: v });
  }

  return (
    <OnboardingShell step="ob1" canAdvance={value !== null}>
      <RitualQuestion value={value} onChange={handleChange} />
    </OnboardingShell>
  );
}
