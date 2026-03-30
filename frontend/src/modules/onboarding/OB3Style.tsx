import { OnboardingShell } from './OnboardingShell';
import { StyleQuestion } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { TravelStyle } from '../../shared/types';

export function OB3Style() {
  const { state, dispatch } = useAppStore();
  const value = state.obAnswers.style;

  function handleChange(v: TravelStyle) {
    dispatch({ type: 'SET_OB_ANSWER', key: 'style', value: v });
  }

  return (
    <OnboardingShell step="ob3" canAdvance={value !== null}>
      <StyleQuestion value={value} onChange={handleChange} />
    </OnboardingShell>
  );
}
