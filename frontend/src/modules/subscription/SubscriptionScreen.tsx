import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { getPackRemainingTrips } from '../../shared/tier';
import { purchaseProMonthly, purchaseTripPack, restorePurchases } from '../../shared/purchases';
import { Capacitor } from '@capacitor/core';

const TERMS_URL   = 'https://uncoverroads.com/terms';
const PRIVACY_URL = 'https://uncoverroads.com/privacy';

async function openLegalUrl(url: string) {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function SubscriptionScreen() {
  const { state, dispatch } = useAppStore();
  const { userTier, tripPacks, packTripsRemaining, generationCount } = state;
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');

  function back() {
    if (state.screenStack.length > 1) {
      dispatch({ type: 'GO_BACK' });
    } else {
      dispatch({ type: 'GO_TO', screen: 'profile' });
    }
  }

  async function handlePurchase(type: 'pro' | 'pack') {
    if (!Capacitor.isNativePlatform()) {
      setShowComingSoon(true);
      return;
    }
    setPurchasing(true);
    setPurchaseError('');
    const result = await (type === 'pro' ? purchaseProMonthly() : purchaseTripPack());
    setPurchasing(false);
    if (result === 'success') {
      dispatch({ type: 'SET_USER_TIER', tier: type === 'pro' ? 'pro' : 'pack' });
      if (type === 'pack') {
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        dispatch({ type: 'ADD_TRIP_PACK', pack: { id: `pack_${Date.now()}`, trips: 5, usedTrips: 0, expiresAt } });
      }
      back();
    } else if (result === 'error') {
      setPurchaseError('Purchase failed. Please try again.');
    }
  }

  async function handleRestore() {
    setRestoring(true);
    setRestoreMsg('');
    const result = await restorePurchases();
    setRestoring(false);
    if (result === 'pro') {
      dispatch({ type: 'SET_USER_TIER', tier: 'pro' });
      setRestoreMsg('Pro restored successfully.');
    } else if (result === 'none') {
      setRestoreMsg('No previous purchases found.');
    } else {
      setRestoreMsg('Restore failed. Please try again.');
    }
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
      <div className="flex items-center gap-3 px-4 pb-3 border-b border-[var(--color-divider)] flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
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
              onClick={() => handlePurchase('pro')}
              disabled={purchasing}
              className="w-full flex items-center justify-center py-[15px] text-[15px] font-bold text-[#0f0d0c] active:opacity-80 rounded-[14px] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))' }}
            >
              Go Pro
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

          {/* Price + CTA */}
          <div className="flex items-baseline gap-1 mb-0.5">
            <span className="text-[34px] font-bold text-[var(--color-text-1)]" style={{ fontFamily: 'var(--font-heading)' }}>₹99</span>
            <span className="text-[13px] text-[var(--color-text-3)]">one-time</span>
          </div>
          <div className="text-[13px] text-[var(--color-text-3)] mb-4">5 trips · ₹19/trip · full experience</div>
          <button
            onClick={() => handlePurchase('pack')}
            disabled={purchasing}
            className="w-full flex items-center justify-center gap-2 py-[15px] text-[15px] font-bold text-[#0f0d0c] active:opacity-80 rounded-[14px] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))' }}
          >
            Buy Trip Pack
          </button>

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

        {/* Restore Purchases — required by App Store guideline 3.1.1 */}
        {Capacitor.isNativePlatform() && (
          <div className="flex flex-col items-center mt-5 mb-2 gap-2">
            <button
              onClick={handleRestore}
              disabled={restoring || purchasing}
              className="text-[13px] text-[var(--color-text-3)] underline underline-offset-2 disabled:opacity-40"
            >
              {restoring ? 'Restoring…' : 'Restore Purchases'}
            </button>
            {restoreMsg ? (
              <span className="text-[12px] text-[var(--color-text-3)]">{restoreMsg}</span>
            ) : null}
          </div>
        )}

        {/* Subscription disclosure + legal links — required by App Store guideline 3.1.2 */}
        {!isPro && !isPack && (
          <div className="px-6 mt-4 text-center">
            <p className="text-[13px] text-[var(--color-text-4)] leading-relaxed mb-2">
              Pro is a monthly auto-renewing subscription (₹299/month). Your payment method will be
              charged at confirmation and renews automatically unless cancelled at least 24 hours
              before the end of the current period. Manage or cancel anytime in your App Store
              account settings.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => openLegalUrl(TERMS_URL)}
                className="text-[13px] text-[var(--color-text-3)] underline underline-offset-2"
              >
                Terms of Use
              </button>
              <span className="text-[var(--color-text-4)]">·</span>
              <button
                onClick={() => openLegalUrl(PRIVACY_URL)}
                className="text-[13px] text-[var(--color-text-3)] underline underline-offset-2"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Purchase error */}
      {purchaseError ? (
        <div className="fixed bottom-24 left-4 right-4 bg-red-900/80 text-red-200 text-sm px-4 py-3 rounded-xl text-center" style={{ zIndex: 50 }}>
          {purchaseError}
        </div>
      ) : null}

      {/* Coming soon modal (web only) */}
      {showComingSoon && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 60, background: 'rgba(0,0,0,.7)' }}
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl px-6 py-6 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <span className="ms fill text-[var(--color-primary)] text-4xl mb-3 block">rocket_launch</span>
            <p className="text-[var(--color-text-1)] font-bold text-base mb-2">Coming soon</p>
            <p className="text-[var(--color-text-3)] text-sm mb-5 leading-relaxed">
              In-app purchases are being set up. Check back shortly — Pro and Pack plans will be available here.
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="w-full h-11 rounded-xl text-sm font-semibold text-[var(--color-bg)]"
              style={{ background: 'var(--color-primary)' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
