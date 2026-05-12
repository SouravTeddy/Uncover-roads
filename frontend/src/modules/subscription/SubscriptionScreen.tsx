import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { shouldShowConversionNudge } from '../../shared/tier';
import { Button } from '../../shared/ui/Button';

function oneYearFromNow(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

// ── Main screen ───────────────────────────────────────────────

export function SubscriptionScreen() {
  const { state, dispatch } = useAppStore();
  const { userTier, packPurchaseCount } = state;

  const [coupon, setCoupon] = useState('');
  const [couponFeedback, setCouponFeedback] = useState('');

  function back() {
    dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  function buyPack(trips: number) {
    dispatch({
      type: 'ADD_TRIP_PACK',
      pack: {
        id: crypto.randomUUID(),
        trips,
        usedTrips: 0,
        expiresAt: oneYearFromNow(),
      },
    });
  }

  function applyCoupon() {
    // Coupon validation is server-side — not implemented yet
    setCouponFeedback('Coupon validation coming soon.');
  }

  // Conversion nudge math (assumes user bought 5-trip packs at $2.99 each)
  const packSpend = packPurchaseCount * 2.99;
  const proEquivalent = packPurchaseCount * 6.99;
  const nudgeSavings = packSpend - proEquivalent;

  const freeCta =
    userTier === 'free'
      ? { label: 'Current Plan', disabled: true }
      : { label: 'Downgrade to Free', disabled: false };

  const proCta =
    userTier === 'pro'
      ? { label: 'Current Plan', disabled: true }
      : { label: 'Go Pro · $9.99/mo', disabled: false };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      priceSub: 'forever',
      features: [
        '3 lifetime itinerary attempts',
        '1st & 2nd trip: full experience',
        '3rd: itinerary only, curation locked',
        'Up to 2 cities per trip',
        'Full persona experience',
        'Share itinerary',
        'Explore + Wishlist',
      ],
      cta: freeCta,
      onCta: undefined as (() => void) | undefined,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$6.99/mo',
      priceSub: 'billed monthly',
      features: [
        '5 saved trips per month',
        'Our Picks + Live Events on all trips',
        'Up to 5 cities per trip',
        'Full persona experience',
        'Share itinerary',
        'Explore + Wishlist',
      ],
      cta: proCta,
      onCta: proCta.disabled ? undefined : () => dispatch({ type: 'SET_USER_TIER', tier: 'pro' }),
    },
  ];

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-[var(--color-bg)]"
      style={{ zIndex: 20 }}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
        <button
          className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          onClick={back}
        >
          <span className="ms text-[var(--color-text-2)]">arrow_back</span>
        </button>
        <h2 className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">
          Choose a Plan
        </h2>
      </div>

      <div className="flex flex-col gap-6 px-4 py-5 pb-10">

        {/* ── Plan cards ── */}
        <div className="flex flex-col gap-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-[var(--color-surface)] border rounded-[20px] p-5 ${
                plan.id === 'pro' ? 'border-[var(--color-amber)]' :
                'border-[var(--color-border)]'
              }`}
            >
              {plan.id === 'pro' && (
                <div className="text-[11px] font-bold text-[var(--color-amber)] uppercase tracking-wide mb-2">
                  Most Popular
                </div>
              )}
              <div className="font-[family-name:var(--font-heading)] text-[20px] font-bold text-[var(--color-text-1)]">
                {plan.name}
              </div>
              <div className="text-[13px] text-[var(--color-text-3)] mb-3">{plan.price} · {plan.priceSub}</div>

              {/* Feature rows */}
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-2 mt-3">
                  <span className="ms fill text-[var(--color-sage)] text-[18px]">check_circle</span>
                  <span className="text-[13px] text-[var(--color-text-2)]">{f}</span>
                </div>
              ))}

              <Button
                variant="primary"
                className="w-full mt-6 h-[52px] rounded-2xl"
                disabled={plan.cta.disabled}
                onClick={plan.onCta}
              >
                {plan.cta.label}
              </Button>
            </div>
          ))}
        </div>

        {/* ── Trip Packs ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-5">
          <div className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)] mb-1">
            Buy a Trip Pack
          </div>
          <div className="text-[12px] text-[var(--color-text-3)] mb-4">
            One-time purchase · 1-year validity · Full experience · Hard stop when trips run out
          </div>

          {/* 1 Trip pack */}
          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[16px] p-4 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px] font-semibold text-[var(--color-text-1)]">1 Trip</span>
              <div className="text-right">
                <span className="font-bold text-[var(--color-text-1)] text-sm">$0.99</span>
                <span className="text-[10px] text-[var(--color-text-3)] ml-1">/ ₹50</span>
              </div>
            </div>
            <div className="text-[12px] text-[var(--color-text-3)] mb-3">
              Try it once · expires in 1 year
            </div>
            <Button variant="primary" className="w-full" onClick={() => buyPack(1)}>Buy</Button>
          </div>

          {/* 5 Trips pack */}
          <div className="bg-[var(--color-bg)] border-2 border-[var(--color-amber)] rounded-[16px] p-4 relative mb-3">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-amber)] text-[var(--color-bg)]">
                BEST VALUE
              </span>
            </div>
            <div className="flex items-center justify-between mb-1 mt-1">
              <span className="text-[14px] font-semibold text-[var(--color-text-1)]">5 Trips</span>
              <div className="text-right">
                <span className="font-bold text-[var(--color-text-1)] text-sm">$2.99</span>
                <span className="text-[10px] text-[var(--color-text-3)] ml-1">/ ₹199</span>
              </div>
            </div>
            <div className="text-[12px] text-[var(--color-text-3)] mb-3">
              ₹39.80/trip · saves ₹51 vs buying solo · expires in 1 year
            </div>
            <Button variant="primary" className="w-full" onClick={() => buyPack(5)}>Buy</Button>
          </div>

          {/* Conversion nudge */}
          {shouldShowConversionNudge(packPurchaseCount) && (
            <div
              className="rounded-[16px] p-4 flex flex-col gap-1 text-xs"
              style={{ background: '#1c2f1e', border: '1px solid #16a34a' }}
            >
              <div className="font-semibold" style={{ color: '#86efac' }}>
                You've spent ${packSpend.toFixed(2)} on packs
              </div>
              <div style={{ color: '#94a3b8' }}>
                Pro plan for the same period would've cost ${proEquivalent.toFixed(2)} — saving
                you ${nudgeSavings.toFixed(2)}.
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_USER_TIER', tier: 'pro' })}
                className="text-left font-semibold mt-0.5 text-[var(--color-primary)]"
              >
                Switch to Pro →
              </button>
            </div>
          )}
        </div>

        {/* ── Coupon ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-5">
          <div className="font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--color-text-1)] mb-3">
            Have a coupon?
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 rounded-[12px] px-3 py-2 text-sm outline-none bg-[var(--color-bg)] text-[var(--color-text-1)] border border-[var(--color-border)]"
            />
            <Button variant="primary" onClick={applyCoupon}>Apply</Button>
          </div>
          {couponFeedback && (
            <p className="text-xs mt-2 text-[var(--color-text-2)]">{couponFeedback}</p>
          )}
          <p className="text-xs text-[var(--color-text-3)] mt-2">
            Valid coupons unlock free access or bonus trips for the specified period.
          </p>
        </div>
      </div>
    </div>
  );
}
