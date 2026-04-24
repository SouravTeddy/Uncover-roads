import { useAppStore } from '../../shared/store';

export function useProfile() {
  const { state, dispatch } = useAppStore();

  function startOBRedo() {
    dispatch({ type: 'GO_TO', screen: 'ob1' });
  }

  function goToSubscription() {
    dispatch({ type: 'GO_TO', screen: 'subscription' });
  }

  return {
    persona: state.persona,
    userTier: state.userTier,
    generationCount: state.generationCount,
    startOBRedo,
    goToSubscription,
  };
}
