import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { shouldShowConversionNudge } from '../../shared/tier';

function oneYearFromNow(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

// ── Feature row ───────────────────────────────────────────────

interface FeatureRowProps {
  text: string;
  muted?: boolean;
}

function FeatureRow({ text, muted }: FeatureRowProps) {
  return (
    <li className="flex items-start gap-1.5 text-sm" style={{ color: muted ? '#64748b' : '#94a3b8' }}>
      <span style={{ color: muted ? '#64748b' : '#22c55e', flexShrink: 0, marginTop: '1px' }}>✓</span>
      <span>{text}</span>
    </li>
  );
}

// ── Plan card ────────────────────────────────────────────────

interface PlanCardProps {
  title: string;
  price: string;
  priceSub: string;
  features: Array<{ text: string; muted?: boolean }>;
  ctaLabel: string;
  ctaStyle?: React.CSSProperties;
  ctaDisabled?: boolean;
  badge?: string;
  borderClass?: string;
  borderStyle?: React.CSSProperties;
  onCta?: () => void;
}

function PlanCard({
  title,
  price,
  priceSub,
  features,
  ctaLabel,
  ctaStyle,
  ctaDisabled,
  badge,
  borderClass,
  borderStyle,
  onCta,
}: PlanCardProps) {
  return (
    <div
      className={`flex flex-col rounded-xl p-3 gap-3 flex-1 bg-surface${borderClass ? ` ${borderClass}` : ''}`}
      style={{ minWidth: 0, ...borderStyle }}
    >
      {badge && (
        <div className="self-center">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange text-white"
          >
            {badge}
          </span>
        </div>
      )}
      <div>
        <div className="font-bold text-white text-base">{title}</div>
        <div className="font-bold text-white text-xl leading-tight">{price}</div>
        <div className="text-xs text-[#94a3b8]">{priceSub}</div>
      </div>
      <ul className="flex flex-col gap-1.5 flex-1">
        {features.map((f) => (
          <FeatureRow key={f.text} text={f.text} muted={f.muted} />
        ))}
      </ul>
      <button
        onClick={onCta}
        disabled={ctaDisabled}
        className={`w-full py-2 rounded-lg text-sm font-semibold mt-auto transition-opacity${ctaDisabled ? ' bg-surf-hst text-[#64748b] cursor-not-allowed' : ''}`}
        style={ctaDisabled ? undefined : ctaStyle}
      >
        {ctaLabel}
      </button>
    </div>
  );
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

  const unlimitedCta =
    userTier === 'unlimited'
      ? { label: 'Current Plan', disabled: true }
      : { label: 'Go Unlimited', disabled: false };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-bg"
      style={{ zIndex: 20 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        }}
      >
        <button onClick={back} style={{ color: '#94a3b8' }}>
          <span className="ms text-xl">arrow_back</span>
        </button>
        <span className="font-heading font-bold text-white text-lg">Choose a Plan</span>
      </div>

      <div className="flex flex-col gap-6 px-4 py-5 pb-10">

        {/* ── Section 1: 3-column plan cards ── */}
        <div className="flex gap-2">

          {/* Free */}
          <div className="flex flex-col flex-1 gap-3" style={{ minWidth: 0 }}>
            <PlanCard
              title="Free"
              price="$0"
              priceSub="forever"
              borderClass="border border-surf-hst"
              features={[
                { text: '3 lifetime itinerary attempts' },
                { text: '1st & 2nd trip: full experience' },
                { text: '3rd: itinerary only, curation locked', muted: true },
                { text: 'Up to 2 cities per trip' },
                { text: 'Full persona experience' },
                { text: 'Share itinerary' },
                { text: 'Explore + Wishlist' },
              ]}
              ctaLabel={freeCta?.label ?? ''}
              ctaDisabled={freeCta?.disabled ?? false}
              onCta={undefined}
            />

            {/* ── Section 2: Trip Packs (below Free column) ── */}
            <div className="rounded-xl p-3 flex flex-col gap-3 bg-surface border border-surf-hst">
              <div>
                <div className="font-bold text-white text-sm">Buy a Trip Pack</div>
                <div className="text-xs leading-tight mt-0.5 text-[#64748b]">
                  One-time purchase · 1-year validity · Full experience · Hard stop when trips run out
                </div>
              </div>

              {/* 1 Trip pack */}
              <div className="rounded-lg p-3 flex flex-col gap-1.5 bg-bg border border-surf-hst">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">1 Trip 🗺️</span>
                  <div className="text-right">
                    <span className="font-bold text-white text-sm">$0.99</span>
                    <span className="text-[10px] text-[#64748b] ml-1">/ ₹50</span>
                  </div>
                </div>
                <div className="text-xs text-[#64748b]">
                  Try it once · expires in 1 year
                </div>
                <button
                  onClick={() => buyPack(1)}
                  className="w-full py-1.5 rounded-lg text-sm font-semibold mt-1 border border-orange text-orange bg-transparent"
                >
                  Buy
                </button>
              </div>

              {/* 5 Trips pack */}
              <div className="rounded-lg p-3 flex flex-col gap-1.5 relative bg-bg border-2 border-orange">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange text-white"
                  >
                    BEST VALUE
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-semibold text-white">5 Trips 🧳</span>
                  <div className="text-right">
                    <span className="font-bold text-white text-sm">$2.99</span>
                    <span className="text-[10px] text-[#64748b] ml-1">/ ₹199</span>
                  </div>
                </div>
                <div className="text-xs text-[#64748b]">
                  ₹39.80/trip · saves ₹51 vs buying solo · expires in 1 year
                </div>
                <button
                  onClick={() => buyPack(5)}
                  className="w-full py-1.5 rounded-lg text-sm font-semibold mt-1 bg-orange text-white"
                >
                  Buy
                </button>
              </div>

              {/* Conversion nudge */}
              {shouldShowConversionNudge(packPurchaseCount) && (
                <div
                  className="rounded-lg p-3 flex flex-col gap-1 text-xs"
                  style={{ background: '#1c2f1e', border: '1px solid #16a34a' }}
                >
                  <div className="font-semibold" style={{ color: '#86efac' }}>
                    💡 You've spent ${packSpend.toFixed(2)} on packs
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    Pro plan for the same period would've cost ${proEquivalent.toFixed(2)} — saving
                    you ${nudgeSavings.toFixed(2)}.
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'SET_USER_TIER', tier: 'pro' })}
                    className="text-left font-semibold mt-0.5 text-orange"
                  >
                    Switch to Pro →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pro */}
          <PlanCard
            title="Pro"
            price="$6.99/mo"
            priceSub="billed monthly"
            badge="MOST POPULAR"
            borderClass="border-2 border-orange"
            features={[
              { text: '5 saved trips per month' },
              { text: 'Our Picks + Live Events on all trips' },
              { text: 'Up to 5 cities per trip' },
              { text: 'Full persona experience' },
              { text: 'Share itinerary' },
              { text: 'Explore + Wishlist' },
            ]}
            ctaLabel={proCta.label}
            ctaDisabled={proCta.disabled}
            ctaStyle={{ background: '#f97316', color: 'white' }}
            onCta={
              proCta.disabled
                ? undefined
                : () => dispatch({ type: 'SET_USER_TIER', tier: 'pro' })
            }
          />

          {/* Unlimited */}
          <PlanCard
            title="Unlimited"
            price="$13.99/mo"
            priceSub="billed monthly"
            borderStyle={{ border: '1px solid #f59e0b' }}
            features={[
              { text: 'Endless trips — no monthly cap' },
              { text: 'Our Picks + Live Events always on' },
              { text: 'Unlimited cities per trip' },
              { text: 'Full persona experience' },
              { text: 'Share itinerary' },
              { text: 'Explore + Wishlist' },
              { text: 'Early access to new features' },
            ]}
            ctaLabel={unlimitedCta.label}
            ctaDisabled={unlimitedCta.disabled}
            ctaStyle={{
              background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              color: '#1e293b',
            }}
            onCta={
              unlimitedCta.disabled
                ? undefined
                : () => dispatch({ type: 'SET_USER_TIER', tier: 'unlimited' })
            }
          />
        </div>

        {/* ── Section 3: Coupon ── */}
        <div className="rounded-xl p-4 flex flex-col gap-3 bg-surface border border-surf-hst">
          <div className="font-bold text-white text-sm">Have a coupon?</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none bg-bg text-white border border-surf-hst"
            />
            <button
              onClick={applyCoupon}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange text-white"
            >
              Apply
            </button>
          </div>
          {couponFeedback && (
            <p className="text-xs mt-2 text-[#94a3b8]">{couponFeedback}</p>
          )}
          <p className="text-xs text-[#64748b]">
            Valid coupons unlock free access or bonus trips for the specified period.
          </p>
        </div>
      </div>
    </div>
  );
}

