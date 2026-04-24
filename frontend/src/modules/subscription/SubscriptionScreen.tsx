import { useAppStore } from '../../shared/store';

export function SubscriptionScreen() {
  const { dispatch } = useAppStore();

  function back() {
    dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={back} className="text-text-3">
          <span className="ms text-xl">arrow_back</span>
        </button>
        <span className="font-heading font-bold text-text-1 text-lg">Choose a Plan</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-3 text-sm">Subscription screen — coming in Task 8</p>
      </div>
    </div>
  );
}
