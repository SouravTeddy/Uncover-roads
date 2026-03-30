import { OnboardingShell } from './OnboardingShell';
import { PaceQuestion } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { Pace } from '../../shared/types';

export function OB5Pace() {
  const { state, dispatch } = useAppStore();
  const value = state.obAnswers.pace;

  function handleChange(v: Pace) {
    dispatch({ type: 'SET_OB_ANSWER', key: 'pace', value: v });
  }

  return (
    <OnboardingShell step="ob5" canAdvance={value !== null}>
      <PaceQuestion value={value} onChange={handleChange} />
    </OnboardingShell>
  );
}
