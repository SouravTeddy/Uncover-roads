import { useState } from 'react';
import { useAppStore } from '../../shared/store';

interface Props {
  tripsAdded: number;   // 1 or 5
  onDone: () => void;
}

export function PackPurchaseConfirm({ tripsAdded, onDone }: Props) {
  const { state, dispatch } = useAppStore();
  const [autoReplenish, setAutoReplenish] = useState(false);

  function handleDone() {
    dispatch({ type: 'SET_AUTO_REPLENISH', enabled: autoReplenish });
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center px-6" style={{ zIndex: 60 }}>
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(34,197,94,.12)', border: '1.5px solid rgba(34,197,94,.25)' }}
      >
        <span className="ms fill text-green-400 text-4xl">check_circle</span>
      </div>

      <p className="font-heading font-bold text-white text-xl mb-1 text-center">
        {tripsAdded} trip{tripsAdded !== 1 ? 's' : ''} added!
      </p>
      <p className="text-white/40 text-sm text-center mb-8">
        Balance: {state.packTripsRemaining} trip{state.packTripsRemaining !== 1 ? 's' : ''}
      </p>

      {/* Auto-replenish toggle */}
      <div
        className="w-full rounded-2xl p-4 mb-6 flex items-start gap-3"
        style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div className="flex-1">
          <p className="text-white/80 text-sm font-semibold">Auto top-up when trips run out</p>
          <p className="text-white/35 text-xs mt-0.5">
            Automatically buy {tripsAdded} more trip{tripsAdded !== 1 ? 's' : ''} when your balance hits zero.
          </p>
        </div>
        <button
          onClick={() => setAutoReplenish(v => !v)}
          className="flex-shrink-0 mt-0.5 w-11 h-6 rounded-full relative transition-colors"
          style={{ background: autoReplenish ? '#f97316' : 'rgba(255,255,255,.12)' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ left: autoReplenish ? '50%' : 4, transform: autoReplenish ? 'translateX(2px)' : 'none' }}
          />
        </button>
      </div>

      <button
        onClick={handleDone}
        className="w-full py-4 rounded-2xl font-bold text-white text-base bg-primary"
      >
        Done
      </button>
    </div>
  );
}
