import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { shouldShowConversionNudge, computePackSpend, clampedNudgeSavings } from '../../shared/tier';
import { Button } from '../../shared/ui/Button';

function oneYearFromNow(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

// ── Main screen ───────────────────────────────────────────────

export function SubscriptionScreen() {
  const { state, dispatch } = useAppStore();
  const { userTier, tripPacks, packPurchaseCount } = state;

  const [coupon, setCoupon] = useState('');
  const [couponFeedback, setCouponFeedback] = useState('');

  const isPaywalled = userTier === 'free';

  function back() {
    dispatch({ type: 'GO_BACK' });
  }

  function buyPack(trips: number) {
    dispatch({
      type: 'ADD_TRIP_PACK',
      pack: { id: crypto.randomUUID(), trips, usedTrips: 0, expiresAt: oneYearFromNow() },
    });
  }

  function applyCoupon() {
    setCouponFeedback('Coupon validation coming soon.');
  }

  const packSpend = computePackSpend(tripPacks);
  const nudgeSavings = clampedNudgeSavings(packSpend, 9.99);

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
        '3 full trips — no restrictions',
        'Full persona experience',
        'Up to 2 cities per trip',
        'Explore + Wishlist',
        'Share itinerary',
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
          {plans.filter(p => !(isPaywalled && p.id === 'free')).map(plan => (
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PackRow
              name="5 Trips"
              meta="Full experience · $0.60/trip"
              price="$2.99"
              priceLocal="₹249"
              onBuy={() => buyPack(5)}
            />
            <PackRow
              name="10 Trips"
              meta="Full experience · $0.50/trip · saves 17%"
              price="$4.99"
              priceLocal="₹399"
              badge="BEST VALUE"
              onBuy={() => buyPack(10)}
            />
          </div>

          {/* Conversion nudge */}
          {shouldShowConversionNudge(packPurchaseCount) && (
            <div
              className="rounded-[16px] p-4 flex flex-col gap-1 text-xs"
              style={{ background: 'var(--color-sage-bg)', border: '1px solid var(--color-sage-bdr)' }}
            >
              <div className="font-semibold" style={{ color: 'var(--color-sage)' }}>
                You've spent ${packSpend.toFixed(2)} on packs
              </div>
              <div style={{ color: 'var(--color-text-3)' }}>
                {nudgeSavings > 0
                  ? `switching to Pro would save you $${nudgeSavings.toFixed(2)} from here.`
                  : 'a monthly subscription gives you unlimited trips for $9.99/mo.'
                }
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

function PackRow({
  name, meta, price, priceLocal, badge, onBuy,
}: {
  name: string; meta: string; price: string; priceLocal: string;
  badge?: string; onBuy: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl border"
      style={{
        background: badge ? 'rgba(212,168,83,.05)' : 'var(--color-surface)',
        borderColor: badge ? 'rgba(212,168,83,.3)' : 'var(--color-border)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-text-1)]">{name}</span>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-[#0f0d0c]">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-3)] mt-0.5">{meta}</div>
      </div>
      <div className="text-right mr-2 flex-shrink-0">
        <div className="text-[13px] font-bold text-[var(--color-text-1)]">{price}</div>
        <div className="text-[10px] text-[var(--color-text-3)]">{priceLocal}</div>
      </div>
      <button
        onClick={onBuy}
        className="h-8 px-3 rounded-xl font-bold text-[12px] text-[#0f0d0c] flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dk))' }}
      >
        Buy
      </button>
    </div>
  );
}
