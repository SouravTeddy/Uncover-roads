import { useAppStore } from '../../shared/store';
import type { Screen } from '../../shared/types';
import { OB_STEPS, OB_STEP_INDEX, type ObStep } from './types';

export function useOnboarding(step: ObStep) {
  const { state, dispatch } = useAppStore();
  const { obAnswers } = state;

  const currentIndex = OB_STEP_INDEX[step];
  const totalSteps = OB_STEPS.length;
  const progress = ((currentIndex + 1) / totalSteps) * 100;

  function goBack() {
    if (currentIndex === 0) {
      dispatch({ type: 'GO_TO', screen: 'login' });
    } else {
      dispatch({ type: 'GO_TO', screen: OB_STEPS[currentIndex - 1] as Screen });
    }
  }

  function goNext() {
    if (currentIndex < totalSteps - 1) {
      dispatch({ type: 'GO_TO', screen: OB_STEPS[currentIndex + 1] as Screen });
    }
  }

  function finish() {
    dispatch({ type: 'GO_TO', screen: 'persona' });
  }

  const isLast = currentIndex === totalSteps - 1;
  const isFirst = currentIndex === 0;

  return {
    obAnswers,
    dispatch,
    progress,
    currentIndex,
    totalSteps,
    goBack,
    goNext,
    finish,
    isLast,
    isFirst,
  };
}
