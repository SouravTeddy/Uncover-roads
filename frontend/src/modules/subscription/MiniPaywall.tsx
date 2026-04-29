import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { PackPurchaseConfirm } from './PackPurchaseConfirm';
import { Button } from '../../shared/ui/Button';

interface Props {
  onClose: () => void;
  /** Optional context label shown above the CTAs, e.g. "Our Picks + Live Events" */
  context?: string;
}

export function MiniPaywall({ onClose, context }: Props) {
  const { state, dispatch } = useAppStore();
  const [purchaseConfirm, setPurchaseConfirm] = useState<{ tripsAdded: number } | null>(null);

  function handlePackPurchase(size: 1 | 5) {
    // TODO: integrate payment provider (Stripe / App Store / Play Store)
    // Currently simulates immediate success for UI development
    const current = state.packTripsRemaining;
    dispatch({ type: 'SET_TIER', tier: 'pack' });
    dispatch({ type: 'SET_PACK_TRIPS', count: current + size });
    setPurchaseConfirm({ tripsAdded: size });
  }

  function handleViewAllPlans() {
    onClose();
    dispatch({ type: 'GO_TO', screen: 'subscription' });
  }

  if (purchaseConfirm) {
    return (
      <PackPurchaseConfirm
        tripsAdded={purchaseConfirm.tripsAdded}
        onDone={() => {
          setPurchaseConfirm(null);
          onClose();
        }}
      />
    );
  }

  const title = 'Unlock this trip';
  const body = context ?? 'Full itinerary · Our Picks · Live Events';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 59,
          background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-6 [box-shadow:var(--shadow-md)] mx-4 mb-4">
          {/* Handle */}
          <div className="w-9 h-1 rounded-full bg-[var(--color-border)] mx-auto mb-5" />

          <h3 className="font-[family-name:var(--font-heading)] text-[20px] font-bold text-[var(--color-text-1)] mb-2">
            {title}
          </h3>
          <p className="text-[13px] text-[var(--color-text-2)] mb-5">{body}</p>

          <div className="flex flex-col gap-3">
            <Button variant="primary" className="w-full" onClick={() => handlePackPurchase(1)}>
              Get 1 Trip · $0.99
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handlePackPurchase(5)}>
              Get 5 Trips · $3.99
            </Button>
          </div>

          <button
            onClick={handleViewAllPlans}
            className="w-full mt-4 text-[var(--color-text-3)] text-sm text-center"
          >
            Or go Pro for $9.99/mo →
          </button>
        </div>
      </div>
    </>
  );
}
