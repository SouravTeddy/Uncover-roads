import { useState, useRef } from 'react';
import { useAppStore } from '../../shared/store';

const CARDS = [
  {
    icon: 'rocket_launch',
    color: { primary: '#f59e0b', glow: 'rgba(245,158,11,.2)', border: 'rgba(245,158,11,.25)' },
    label: 'Early Access',
    title: "You're shaping the future of travel",
    desc: "Welcome to the Uncover Roads beta. Your feedback helps us build the best AI travel companion — explore freely and let us know what you think.",
  },
  {
    icon: 'psychology',
    color: { primary: '#3b82f6', glow: 'rgba(59,130,246,.2)', border: 'rgba(59,130,246,.25)' },
    label: 'Persona',
    title: 'Your travel DNA, unlocked',
    desc: 'Answer 5 quick questions and get your archetype — Historian, Wanderer, Epicurean and more. Every recommendation is tuned to who you are.',
  },
  {
    icon: 'travel_explore',
    color: { primary: '#14b8a6', glow: 'rgba(20,184,166,.2)', border: 'rgba(20,184,166,.25)' },
    label: 'Destination',
    title: 'Any city, anywhere',
    desc: 'Search any destination in the world and step straight onto its map — from Tokyo backstreets to Lisbon hilltops.',
  },
  {
    icon: 'map',
    color: { primary: '#22c55e', glow: 'rgba(34,197,94,.2)', border: 'rgba(34,197,94,.25)' },
    label: 'Explore',
    title: 'Pin what calls to you',
    desc: 'Browse an interactive map, discover hidden gems, and build your own shortlist. Restaurants, museums, parks — you choose.',
  },
  {
    icon: 'auto_fix',
    color: { primary: '#a855f7', glow: 'rgba(168,85,247,.2)', border: 'rgba(168,85,247,.25)' },
    label: 'Itinerary',
    title: 'AI builds your perfect day',
    desc: 'Your persona + your picks = a timed, ordered itinerary crafted just for you. No generic tourist lists — only what fits your style.',
  },
  {
    icon: 'navigation',
    color: { primary: '#f43f5e', glow: 'rgba(244,63,94,.2)', border: 'rgba(244,63,94,.25)' },
    label: 'Navigate',
    title: 'Save, revisit, explore again',
    desc: 'Every journey saved to your history. Follow your route stop by stop, or come back and relive the day whenever you like.',
  },
];

export function WalkthroughScreen() {
  const { dispatch } = useAppStore();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  function finish() {
    try { localStorage.setItem('ur_walkthrough_seen', '1'); } catch { /* ignore */ }
    dispatch({ type: 'GO_TO', screen: 'ob1' });
  }

  function next() {
    if (index < CARDS.length - 1) setIndex(i => i + 1);
    else finish();
  }

  function prev() {
    if (index > 0) setIndex(i => i - 1);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 48) {
      if (delta > 0) next();
      else prev();
    }
    touchStartX.current = null;
  }

  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: '#0a0e14' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip */}
      {!isLast && (
        <div
          className="flex-shrink-0 flex justify-end px-5"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <button
            onClick={finish}
            className="text-white/30 text-sm font-medium px-3 py-1.5 rounded-full hover:text-white/50 transition-colors"
          >
            Skip
          </button>
        </div>
      )}
      {isLast && <div style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', height: 44 }} />}

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
        <div className="w-full max-w-sm">

          {/* Glow backdrop */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 280,
              height: 280,
              background: card.color.glow,
              filter: 'blur(80px)',
              top: '25%',
              left: '50%',
              transform: 'translateX(-50%)',
              transition: 'background 0.4s ease',
            }}
          />

          {/* Icon */}
          <div className="flex justify-center mb-8 relative">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${card.color.glow}, rgba(255,255,255,.04))`,
                border: `1px solid ${card.color.border}`,
                boxShadow: `0 0 40px ${card.color.glow}`,
                transition: 'all 0.4s ease',
              }}
            >
              <span className="ms fill text-5xl" style={{ color: card.color.primary }}>{card.icon}</span>
            </div>
          </div>

          {/* Label */}
          <div className="flex justify-center mb-3">
            <span
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: `${card.color.glow}`,
                border: `1px solid ${card.color.border}`,
                color: card.color.primary,
                transition: 'all 0.4s ease',
              }}
            >
              {card.label}
            </span>
          </div>

          {/* Title */}
          <h2
            className="font-heading font-bold text-white text-2xl text-center leading-snug mb-4"
            style={{ transition: 'opacity 0.3s ease' }}
          >
            {card.title}
          </h2>

          {/* Description */}
          <p className="text-white/45 text-sm text-center leading-relaxed">
            {card.desc}
          </p>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="flex-shrink-0 px-6 pb-10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {CARDS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                background: i === index ? card.color.primary : 'rgba(255,255,255,.2)',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        {isLast ? (
          <button
            onClick={finish}
            className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${card.color.primary}, ${card.color.primary}cc)`,
              boxShadow: `0 8px 32px ${card.color.glow}`,
            }}
          >
            Get started
            <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span>
          </button>
        ) : (
          <button
            onClick={next}
            className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2"
            style={{
              background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.1)',
            }}
          >
            Next
            <span className="ms text-white/60" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        )}
      </div>
    </div>
  );
}
