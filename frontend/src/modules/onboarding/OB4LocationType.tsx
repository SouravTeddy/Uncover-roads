import { OnboardingShell } from './OnboardingShell';
import { AttractionQuestion } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { Attraction } from '../../shared/types';

export function OB4LocationType() {
  const { state, dispatch } = useAppStore();
  const value = state.obAnswers.attractions;

  function handleChange(v: Attraction[]) {
    dispatch({ type: 'SET_OB_ANSWER', key: 'attractions', value: v });
  }

  return (
    <OnboardingShell step="ob4" canAdvance={value.length > 0}>
      <AttractionQuestion value={value} onChange={handleChange} />
    </OnboardingShell>
  );
}
