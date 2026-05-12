import { useMemo, useState } from 'react';
import { useAppStore } from '../../../shared/store';

export function SubscriptionDetailsScreen({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useAppStore();
  const { userTier } = state;
  const [showDowngrade, setShowDowngrade] = useState(false);

  const tierLabel = userTier === 'pro' ? 'Pro Plan' : userTier === 'pack' ? 'Pack Plan' : 'Free Plan';
  const nextBilling = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  function handleDowngrade() {
    dispatch({ type: 'SET_USER_TIER', tier: 'free' });
    onBack();
  }

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col" style={{ zIndex: 20 }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
        <button
          className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          onClick={onBack}
        >
          <span className="ms text-[var(--color-text-2)]">arrow_back</span>
        </button>
        <h2 className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">
          {tierLabel}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>

        {/* Plan badge */}
        <div className="flex justify-center mb-6">
          <div className="px-5 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
            <span className="text-[#0f172a] font-bold text-sm">{tierLabel.toUpperCase()}</span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] overflow-hidden mb-4">
          {[
            { label: 'Billing cycle', value: 'Monthly' },
            { label: 'Next billing date', value: nextBilling },
            { label: 'Amount', value: '—' },
            { label: 'Status', value: 'Active', valueClass: 'text-amber-400' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-divider)] last:border-0">
              <span className="text-[14px] text-[var(--color-text-2)]">{row.label}</span>
              <span className={`flex items-center gap-1 text-[14px] font-medium ${row.valueClass ?? 'text-[var(--color-text-1)]'}`}>
                {row.value}
                {row.label === 'Status' && <span className="ms fill text-amber-400 text-sm">check_circle</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Downgrade */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
          <button
            onClick={() => setShowDowngrade(true)}
            className="w-full px-4 py-4 text-[14px] text-[var(--color-text-3)] text-center"
          >
            Downgrade to Free
          </button>
        </div>
      </div>

      {/* Downgrade confirm dialog */}
      {showDowngrade && (
        <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 60, background: 'rgba(0,0,0,.7)' }}>
          <div className="w-full max-w-sm rounded-2xl px-6 py-6" style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)' }}>
            <p className="text-white font-bold text-base mb-1">Downgrade to Free?</p>
            <p className="text-white/40 text-sm mb-6">You'll lose access to unlimited trips and curation features at the end of your billing period.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDowngrade(false)} className="flex-1 h-11 rounded-xl text-sm text-white/50 border border-white/10">Cancel</button>
              <button onClick={handleDowngrade} className="flex-1 h-11 rounded-xl text-sm font-semibold text-white/60 border border-white/20">
                Downgrade to Free
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
