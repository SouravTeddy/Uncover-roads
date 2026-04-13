import { useAppStore } from '../../shared/store';
import type { Screen } from '../../shared/types';
import { BASE_OB_STEPS, type ObStep } from './types';
import { resolveOBAnswers } from './ob-resolver';

export function useOnboarding(step: ObStep) {
  const { state, dispatch } = useAppStore();

  // Build active step list: base steps + triggered conditional steps
  const rawAnswers = state.rawOBAnswers;
  const activeSteps: ObStep[] = [...BASE_OB_STEPS];
  if (rawAnswers?.group === 'family')          activeSteps.push('ob8');
  if (rawAnswers?.budget === 'budget')         activeSteps.push('ob9');
  if (rawAnswers?.mood?.includes('eat_drink')) activeSteps.push('ob10');

  const currentIndex = activeSteps.indexOf(step);
  const totalSteps   = activeSteps.length;
  const progress     = ((currentIndex + 1) / totalSteps) * 100;
  const isLast       = currentIndex === totalSteps - 1;

  function goBack() {
    if (currentIndex === 0) {
      dispatch({ type: 'GO_TO', screen: 'login' });
    } else {
      dispatch({ type: 'GO_TO', screen: activeSteps[currentIndex - 1] as Screen });
    }
  }

  function goNext() {
    if (currentIndex < totalSteps - 1) {
      dispatch({ type: 'GO_TO', screen: activeSteps[currentIndex + 1] as Screen });
    }
  }

  function finish() {
    if (!rawAnswers) return;
    const profile = resolveOBAnswers(rawAnswers, state.obPreResolved ?? []);
    dispatch({ type: 'SET_PERSONA_PROFILE', profile });
    dispatch({ type: 'GO_TO', screen: 'persona' });
  }

  return { progress, currentIndex, totalSteps, goBack, goNext, finish, isLast };
}
