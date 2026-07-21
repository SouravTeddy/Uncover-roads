import { useAppStore } from '../../shared/store';
import { getPackRemainingTrips } from '../../shared/tier';

export function SubscriptionScreen() {
  const { state, dispatch } = useAppStore();
  const { userTier, tripPacks, packTripsRemaining, generationCount } = state;

  function back() { dispatch({ type: 'GO_BACK' }); }

  function handlePurchase() {
    alert('Payment integration in progress.');
  }

  function handleDowngrade() {
    dispatch({ type: 'SET_USER_TIER', tier: 'free' });
    back();
  }

  // Derive active state
  const isPro  = userTier === 'pro';
  const isPack = !isPro && (userTier === 'pack' || getPackRemainingTrips(tripPacks) > 0 || packTripsRemaining > 0);

  // Pack counter: total purchased is always 10; track used vs remaining
  const tripsRemaining = isPack
    ? (getPackRemainingTrips(tripPacks) || packTripsRemaining)
    : 0;
  const tripsTotal = 5;
  const tripsUsed  = Math.max(0, tripsTotal - tripsRemaining);
  const progressPct = Math.min(100, (tripsUsed / tripsTotal) * 100);

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--color-bg)]" style={{ zIndex: 20 }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-divider)] flex-shrink-0">
        <button
          className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          onClick={back}
        >
          <span className="ms text-[var(--color-text-2)]" style={{ fontSize: 18 }}>arrow_back</span>
        </button>
        <span className="text-[16px] font-semibold text-[var(--color-text-1)] tracking-tight">
          Plans &amp; Pricing
        </span>
      </div>

      {/* Scroll body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >

        {/* Hero */}
        <div className="px-5 pt-6 pb-5">
          {isPro ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[.07em] text-[var(--color-sage)] mb-1.5">
                Pro · Active
              </div>
              <div className="text-[22px] font-bold text-[var(--color-text-1)] tracking-tight leading-snug">
                All features on
              </div>
            </>
          ) : isPack ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[.07em] text-[var(--color-primary)] mb-1.5">
                Active trip pack
              </div>
              <div className="text-[22px] font-bold text-[var(--color-text-1)] tracking-tight leading-snug">
                Trips remaining
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[.07em] text-[var(--color-primary)] mb-1.5">
                {generationCount} of 3 free trips used
              </div>
              <div className="text-[22px] font-bold text-[var(--color-text-1)] tracking-tight leading-snug">
                Keep exploring
              </div>
            </>
          )}
        </div>

        {/* Pro plan card */}
        <div
          className="mx-4 rounded-[20px] overflow-hidden bg-[var(--color-surface)]"
          style={{ border: '1.5px solid rgba(212,168,83,.28)' }}
        >
          <div className="p-[18px] pb-4">

            {/* Pill */}
            {isPro ? (
              <div
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-bold uppercase tracking-[.04em] mb-3.5"
                style={{ background: 'rgba(107,148,112,.15)', border: '1px solid rgba(107,148,112,.3)', color: 'var(--color-sage)' }}
              >
                <span className="ms" style={{ fontSize: 12 }}>check_circle</span> Current plan
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-bold uppercase tracking-[.04em] mb-3.5"
                style={{ background: 'var(--color-primary-bg)', border: '1px solid rgba(212,168,83,.28)', color: 'var(--color-primary)' }}
              >
                <span className="ms" style={{ fontSize: 12 }}>workspace_premium</span> Pro · Best value
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-1 mb-0.5">
              <span
                className="text-[34px] font-bold text-[var(--color-text-1)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                ₹299
              </span>
              <span className="text-[13px] text-[var(--color-text-3)]">/month</span>
            </div>
            <div className="text-[13px] text-[var(--color-text-3)] mb-4">
              Billed monthly · Cancel anytime
            </div>

            {/* Features */}
            <div className="flex flex-col gap-2">
              {[
                ['all_inclusive', 'Unlimited trips'],
                ['star',         'Our Picks + Live Events'],
                ['face',         'Full persona experience'],
              ].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="ms text-[var(--color-sage)]" style={{ fontSize: 15 }}>{icon}</span>
                  <span className="text-[13px] text-[var(--color-text-2)]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA strip */}
          {isPro ? (
            <>
              <div style={{ height: 1, background: 'var(--color-divider)', margin: '0 18px' }} />
              <button
                onClick={handleDowngrade}
                className="w-full flex items-center justify-center gap-1.5 py-3"
              >
                <span className="ms text-[var(--color-text-4)]" style={{ fontSize: 14 }}>south</span>
                <span className="text-[12px] text-[var(--color-text-3)]">
                  Downgrade to Free — cancels at end of billing period
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={handlePurchase}
              className="w-full flex items-center justify-center gap-2 py-[15px] text-[15px] font-bold text-[#0f0d0c] active:opacity-80"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))' }}
            >
              <span className="ms" style={{ fontSize: 17 }}>bolt</span>
              Go Pro · ₹299/mo
            </button>
          )}
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-2.5 mx-5 my-4">
          <div className="flex-1 h-px bg-[var(--color-divider)]" />
          <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)]">or</span>
          <div className="flex-1 h-px bg-[var(--color-divider)]" />
        </div>

        {/* Trip pack card */}
        <div
          className="mx-4 rounded-[20px] bg-[var(--color-surface)] p-4 transition-opacity"
          style={{
            border: '1px solid var(--color-border)',
            opacity: isPro ? 0.35 : 1,
            pointerEvents: isPro ? 'none' : undefined,
          }}
        >
          {/* Pack header */}
          <div className="flex items-start justify-between mb-3.5">
            <div>
              <div className="text-[16px] font-semibold text-[var(--color-text-1)]">Trip Pack</div>
              <div className="text-[13px] text-[var(--color-text-3)] mt-0.5">One-time · 1-year validity</div>
            </div>
            <span
              className="text-[12px] font-bold text-[var(--color-text-3)] px-2.5 py-1 rounded-full flex-shrink-0 ml-2"
              style={{ background: 'var(--color-surface2)', border: '1px solid var(--color-border)' }}
            >
              No subscription
            </span>
          </div>

          {/* Counter (pack state only) */}
          {isPack && (
            <div className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-[var(--color-text-2)]">Trips used</span>
                <span className="text-[12px] font-bold text-[var(--color-text-1)]">
                  {tripsUsed} <span className="font-normal text-[var(--color-text-3)]">of {tripsTotal}</span>
                </span>
              </div>
              <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface2)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-dk))',
                  }}
                />
              </div>
            </div>
          )}

          {/* Buy row */}
          <div
            className="flex items-center gap-3 p-[11px] rounded-[14px]"
            style={{ border: '1px solid rgba(212,168,83,.2)', background: 'rgba(212,168,83,.03)' }}
          >
            <div
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-primary-bg)' }}
            >
              <span className="ms text-[var(--color-primary)]" style={{ fontSize: 16 }}>travel_explore</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[var(--color-text-1)]">5 Trips</div>
              <div className="text-[13px] text-[var(--color-text-3)] mt-0.5">₹19/trip · full experience</div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className="text-[14px] font-bold text-[var(--color-text-1)]">₹99</span>
              <button
                onClick={handlePurchase}
                className="h-8 px-3 rounded-[10px] text-[12px] font-bold text-[#0f0d0c] active:opacity-80"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))' }}
              >
                Buy
              </button>
            </div>
          </div>

          {isPro && (
            <div className="text-[11px] text-[var(--color-text-4)] text-center pt-2.5">
              Not needed on Pro — you have unlimited trips
            </div>
          )}
        </div>

        {/* Free plan note */}
        {!isPro && (
          <div
            className="mx-4 mt-3.5 p-4 rounded-[14px] text-[14px] text-[var(--color-text-3)] leading-relaxed"
            style={{ border: '1px solid var(--color-divider)' }}
          >
            <span className="text-[var(--color-text-2)] font-semibold">Free plan</span> includes 3 complete trips. Top up with a 5-trip pack or go Pro for unlimited.
          </div>
        )}

      </div>
    </div>
  );
}
