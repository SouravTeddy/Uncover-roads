import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { shouldShowConversionNudge } from '../../shared/tier';

const VALID_COUPONS = ['LAUNCH50', 'UNCOVERTEST'];

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
  isCurrent?: boolean;
  badge?: string;
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
  borderStyle,
  onCta,
}: PlanCardProps) {
  return (
    <div
      className="flex flex-col rounded-xl p-3 gap-3 flex-1"
      style={{ background: '#1e293b', minWidth: 0, ...borderStyle }}
    >
      {badge && (
        <div className="self-center">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#f97316', color: 'white' }}
          >
            {badge}
          </span>
        </div>
      )}
      <div>
        <div className="font-bold text-white text-base">{title}</div>
        <div className="font-bold text-white text-xl leading-tight">{price}</div>
        <div className="text-xs" style={{ color: '#94a3b8' }}>{priceSub}</div>
      </div>
      <ul className="flex flex-col gap-1.5 flex-1">
        {features.map((f, i) => (
          <FeatureRow key={i} text={f.text} muted={f.muted} />
        ))}
      </ul>
      <button
        onClick={onCta}
        disabled={ctaDisabled}
        className="w-full py-2 rounded-lg text-sm font-semibold mt-auto transition-opacity"
        style={
          ctaDisabled
            ? { background: '#334155', color: '#64748b', cursor: 'not-allowed' }
            : ctaStyle
        }
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
    if (VALID_COUPONS.includes(coupon.trim().toUpperCase())) {
      alert('Coupon applied!');
    } else {
      alert('Invalid coupon code.');
    }
  }

  // Conversion nudge math
  const packSpend = packPurchaseCount * 17.99;
  const proEquivalent = packPurchaseCount * 6.99;
  const nudgeSavings = packSpend - proEquivalent;

  const freeCta =
    userTier === 'free'
      ? { label: 'Current Plan', disabled: true }
      : null; // hide if already pro/unlimited

  const proCta =
    userTier === 'pro'
      ? { label: 'Current Plan', disabled: true }
      : { label: 'Get Pro', disabled: false };

  const unlimitedCta =
    userTier === 'unlimited'
      ? { label: 'Current Plan', disabled: true }
      : { label: 'Go Unlimited', disabled: false };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto"
      style={{ zIndex: 20, background: '#0f172a' }}
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
              borderStyle={{ border: '1px solid #334155' }}
              features={[
                { text: '3 lifetime itinerary attempts' },
                { text: '1st trip: full experience' },
                { text: '2nd–3rd: itinerary only, curation locked', muted: true },
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
            <div
              className="rounded-xl p-3 flex flex-col gap-3"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            >
              <div>
                <div className="font-bold text-white text-sm">Buy a Trip Pack</div>
                <div className="text-xs leading-tight mt-0.5" style={{ color: '#64748b' }}>
                  One-time purchase · 1-year validity · Full experience · Hard stop when trips run out
                </div>
              </div>

              {/* 5 Trips pack */}
              <div
                className="rounded-lg p-3 flex flex-col gap-1.5"
                style={{ background: '#0f172a', border: '1px solid #334155' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">5 Trips 🗺️</span>
                  <span className="font-bold text-white text-sm">$9.99</span>
                </div>
                <div className="text-xs" style={{ color: '#64748b' }}>
                  $2.00/trip · expires in 1 year
                </div>
                <button
                  onClick={() => buyPack(5)}
                  className="w-full py-1.5 rounded-lg text-sm font-semibold mt-1"
                  style={{
                    border: '1.5px solid #f97316',
                    color: '#f97316',
                    background: 'transparent',
                  }}
                >
                  Buy
                </button>
              </div>

              {/* 10 Trips pack */}
              <div
                className="rounded-lg p-3 flex flex-col gap-1.5 relative"
                style={{ background: '#0f172a', border: '2px solid #f97316' }}
              >
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#f97316', color: 'white' }}
                  >
                    BEST VALUE
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-semibold text-white">10 Trips 🧳</span>
                  <span className="font-bold text-white text-sm">$17.99</span>
                </div>
                <div className="text-xs" style={{ color: '#64748b' }}>
                  $1.80/trip · expires in 1 year
                </div>
                <button
                  onClick={() => buyPack(10)}
                  className="w-full py-1.5 rounded-lg text-sm font-semibold mt-1"
                  style={{ background: '#f97316', color: 'white' }}
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
                    onClick={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
                    className="text-left font-semibold mt-0.5"
                    style={{ color: '#f97316' }}
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
            borderStyle={{ border: '2px solid #f97316' }}
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
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: '#1e293b', border: '1px solid #334155' }}
        >
          <div className="font-bold text-white text-sm">Have a coupon?</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: 'white',
              }}
            />
            <button
              onClick={applyCoupon}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#f97316', color: 'white' }}
            >
              Apply
            </button>
          </div>
          <p className="text-xs" style={{ color: '#64748b' }}>
            Valid coupons unlock free access or bonus trips for the specified period.
          </p>
        </div>
      </div>
    </div>
  );
}
