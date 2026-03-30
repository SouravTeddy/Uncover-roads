import { OnboardingShell } from './OnboardingShell';
import { MotivationQuestion } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { Sensory } from '../../shared/types';

export function OB2Motivation() {
  const { state, dispatch } = useAppStore();
  const value = state.obAnswers.sensory;

  function handleChange(v: Sensory) {
    dispatch({ type: 'SET_OB_ANSWER', key: 'sensory', value: v });
  }

  return (
    <OnboardingShell step="ob2" canAdvance={value !== null}>
      <MotivationQuestion value={value} onChange={handleChange} />
    </OnboardingShell>
  );
}
