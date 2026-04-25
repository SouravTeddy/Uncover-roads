import { useAppStore } from '../../shared/store';

interface Props {
  onClose: () => void;
  /** Optional context label shown above the CTAs, e.g. "Our Picks + Live Events" */
  context?: string;
}

export function MiniPaywall({ onClose, context }: Props) {
  const { state, dispatch } = useAppStore();

  function handlePackPurchase(size: 1 | 5) {
    // TODO: integrate payment provider (Stripe / App Store / Play Store)
    // Currently simulates immediate success for UI development
    const current = state.packTripsRemaining;
    dispatch({ type: 'SET_TIER', tier: 'pack' });
    dispatch({ type: 'SET_PACK_TRIPS', count: current + size });
    onClose();
  }

  function handleViewAllPlans() {
    onClose();
    dispatch({ type: 'GO_TO', screen: 'subscription' });
  }

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
        background: '#111827',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        border: '1px solid rgba(255,255,255,.08)',
        padding: '20px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,.15)',
          margin: '0 auto 20px',
        }} />

        <p className="font-heading font-bold text-white text-base mb-1">Unlock this trip</p>
        {context ? (
          <p className="text-white/40 text-sm mb-5">{context}</p>
        ) : (
          <p className="text-white/40 text-sm mb-5">Full itinerary · Our Picks · Live Events</p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handlePackPurchase(1)}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm bg-primary"
          >
            Get 1 Trip · $0.99
          </button>
          <button
            onClick={() => handlePackPurchase(5)}
            className="w-full py-3.5 rounded-2xl font-bold text-sm border border-primary/40"
            style={{ background: 'rgba(249,115,22,.08)', color: '#f97316' }}
          >
            Get 5 Trips · $3.99
          </button>
        </div>

        <button
          onClick={handleViewAllPlans}
          className="w-full mt-4 text-white/35 text-sm text-center"
        >
          Or go Pro for $9.99/mo →
        </button>
      </div>
    </>
  );
}
