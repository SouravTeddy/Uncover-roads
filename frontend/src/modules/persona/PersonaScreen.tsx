import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import { syncPersonaProfile } from '../../shared/userSync';
import { ARCHETYPE_COLORS } from './types';

const MOOD_ARCHETYPE: Record<string, string> = {
  explore:   'explorer',
  relax:     'slowtraveller',
  eat_drink: 'epicurean',
  culture:   'historian',
};

const ARCHETYPE_META: Record<string, { name: string; tagline: string; emoji: string }> = {
  explorer:      { name: 'The Explorer',       emoji: '◆', tagline: 'You thrive on discovery — no plan survives contact with a great street.' },
  slowtraveller: { name: 'The Slow Traveller', emoji: '◇', tagline: 'One great café beats ten tourist spots. You\'re here to be, not to tick.' },
  epicurean:     { name: 'The Epicurean',      emoji: '◉', tagline: 'You travel stomach-first. Markets and hidden tables are your map.' },
  historian:     { name: 'The Scholar',        emoji: '◎', tagline: 'Every city has layers. You\'re the one who finds the story behind the sign.' },
};

const ARCHETYPE_TRAITS: Record<string, [string, string, string]> = {
  wanderer: [
    "You leave before the crowds arrive.",
    "You find the place they haven't named yet.",
    "You don't take photos of everything.",
  ],
  historian: [
    "You read the plaques everyone else walks past.",
    "A place means more when you know what stood here before.",
    "You leave with context, not just memories.",
  ],
  epicurean: [
    "The best meal of your trip won't be in a guidebook.",
    "You know the difference between a good market and a great one.",
    "You travel through your stomach, always.",
  ],
  pulse: [
    "You want to feel the city's heartbeat, not observe it.",
    "Sleep is negotiable. Energy isn't.",
    "The best nights are the ones with no plan.",
  ],
  slowtraveller: [
    "You've sat at the same café table twice.",
    "The neighbourhood matters more than the sights.",
    "A good trip feels like you almost lived there.",
  ],
  voyager: [
    "You know exactly how long it takes to get from A to B.",
    "You've seen more cities than most people dream of.",
    "Efficiency is how you fit more life in.",
  ],
  explorer: [
    "The map is a starting point, not a plan.",
    "You take the wrong turn on purpose sometimes.",
    "Familiar and surprising — you want both.",
  ],
};

// Inline hex colors — more reliable than dynamic Tailwind classes
const ARCHETYPE_BG_COLORS: Record<string, { from: string; via: string; to: string }> = {
  wanderer:      { from: '#1c1917', via: '#44403c', to: '#78350f' },
  historian:     { from: '#1e293b', via: '#334155', to: '#44403c' },
  epicurean:     { from: '#78350f', via: '#c2410c', to: '#b45309' },
  pulse:         { from: '#2e1065', via: '#5b21b6', to: '#312e81' },
  slowtraveller: { from: '#134e4a', via: '#115e59', to: '#44403c' },
  voyager:       { from: '#0c4a6e', via: '#075985', to: '#1e293b' },
  explorer:      { from: '#064e3b', via: '#065f46', to: '#44403c' },
};

const DAY_OPEN_LABELS: Record<string, string> = {
  coffee:    'Coffee first',
  breakfast: 'Sit-down breakfast',
  straight:  'Straight to it',
  grab_go:   'Grab & go',
};
const DAY_OPEN_ICONS: Record<string, string> = {
  coffee: 'local_cafe', breakfast: 'egg_alt', straight: 'directions_run', grab_go: 'takeout_dining',
};

const EVENING_LABELS: Record<string, string> = {
  bars:        'Bar hop',
  dinner_wind: 'Dinner & wind down',
  markets:     'Night markets',
  early:       'Early night in',
};
const EVENING_ICONS: Record<string, string> = {
  bars: 'local_bar', dinner_wind: 'restaurant', markets: 'storefront', early: 'bedtime',
};

const VENUE_LABELS: Record<string, string> = {
  neighbourhood: 'Neighbourhoods', landmark: 'Landmarks', viewpoint: 'Viewpoints',
  park: 'Parks', spa: 'Spas', cafe: 'Cafés', restaurant: 'Restaurants',
  market: 'Markets', street_food: 'Street food', museum: 'Museums',
  heritage: 'Heritage sites', gallery: 'Galleries', romantic: 'Romantic spots',
  table_for_2: 'Intimate dining', family: 'Family spots', communal: 'Communal dining',
  social: 'Social venues', group_booking: 'Group spots',
};
const VENUE_ICONS: Record<string, string> = {
  neighbourhood: 'home_pin', landmark: 'account_balance', viewpoint: 'landscape',
  park: 'park', spa: 'spa', cafe: 'local_cafe', restaurant: 'restaurant',
  market: 'storefront', street_food: 'ramen_dining', museum: 'museum',
  heritage: 'account_balance', gallery: 'palette', romantic: 'favorite',
  table_for_2: 'dinner_dining', family: 'family_restroom', communal: 'groups',
  social: 'diversity_3', group_booking: 'groups',
};

const SOCIAL_LABELS: Record<string, string> = {
  solo: 'Solo', couple: 'Couple', family: 'Family', kids: 'Kid-friendly', group: 'Group',
};
const SOCIAL_ICONS: Record<string, string> = {
  solo: 'person', couple: 'people', family: 'family_restroom', kids: 'child_care', group: 'groups',
};

const DIETARY_LABELS: Record<string, string> = {
  vegan_boost: 'Plant-based', meat_flag: 'Meat-friendly',
  halal_certified_only: 'Halal', kosher_certified_only: 'Kosher',
  allergy_warning: 'Allergy aware',
};
const DIETARY_ICONS: Record<string, string> = {
  vegan_boost: 'eco', meat_flag: 'set_meal',
  halal_certified_only: 'mosque', kosher_certified_only: 'synagogue',
  allergy_warning: 'warning',
};

function priceRange(min: number, max: number): string {
  const symbols = ['', '$', '$$', '$$$', '$$$$'];
  return min === max ? symbols[min] : `${symbols[min]} – ${symbols[max]}`;
}

function flexLabel(f: number): string {
  if (f >= 0.7) return 'Flexible';
  if (f >= 0.4) return 'Balanced';
  return 'Structured';
}

// Framer-motion variants for staggered content reveal
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export function PersonaScreen() {
  const { state, dispatch } = useAppStore();
  const profile = state.personaProfile;
  const rawAnswers = state.rawOBAnswers;

  // Beat 1: atmosphere (0–1500ms)
  // Beat 2: traits appear (1500–3900ms)
  // Beat 3: "YOU ARE / Name" full-screen (3900–5800ms)
  // Beat 4: overlay exits, main content reveals (5800ms+)
  const [beat, setBeat] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(2), 1500);
    const t2 = setTimeout(() => setBeat(3), 3900);
    const t3 = setTimeout(() => setBeat(4), 5800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center gap-5 px-8" style={{ zIndex: 20 }}>
        <span className="ms text-text-3 text-4xl">sentiment_dissatisfied</span>
        <p className="text-text-2 text-sm text-center">No persona data found.</p>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'ob1' })}
          className="px-6 py-3 bg-primary text-white rounded-xl font-heading font-bold text-sm"
        >
          Take the Assessment
        </button>
      </div>
    );
  }

  const primaryMood = rawAnswers?.mood?.[0] ?? 'explore';
  const archetypeKey = MOOD_ARCHETYPE[primaryMood] ?? 'explorer';
  const meta = ARCHETYPE_META[archetypeKey] ?? ARCHETYPE_META.explorer;
  const color = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' };
  const traits = ARCHETYPE_TRAITS[archetypeKey] ?? ARCHETYPE_TRAITS.explorer;
  const bgColors = ARCHETYPE_BG_COLORS[archetypeKey] ?? ARCHETYPE_BG_COLORS.explorer;
  const bgGradient = `linear-gradient(to bottom, ${bgColors.from}, ${bgColors.via} 50%, ${bgColors.to})`;

  const topVenues = Object.entries(profile.venue_weights)
    .filter(([, w]) => (w ?? 0) > 0.1)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 5)
    .map(([k]) => k);

  function startPlanning() {
    dispatch({
      type: 'SET_PERSONA',
      persona: {
        archetype:      archetypeKey,
        archetype_name: meta.name,
        archetype_desc: meta.tagline,
        ritual:         null,
        sensory:        null,
        style:          null,
        attractions:    [],
        pace:           null,
        social:         null,
        insight:        meta.tagline,
        venue_filters:  [],
        itinerary_bias: [],
        archetypeData:  { name: meta.name, desc: meta.tagline, venue_filters: [], itinerary_bias: [] },
      },
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncPersonaProfile(session.user.id, archetypeKey, meta.name, rawAnswers).catch(console.warn);
      }
    });
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 20, background: bgGradient, animation: 'springUp 0.45s ease both' }}
    >
      {/* ── Cinematic reveal overlay (Beats 1–3) ── */}
      {/* AnimatePresence enables proper fade-out when beat hits 4 */}
      <AnimatePresence>
        {beat < 4 && (
          <motion.div
            className="fixed inset-0 flex flex-col items-center justify-center px-8"
            style={{ zIndex: 30, background: bgGradient }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Beat 1 — Atmosphere: just the archetype symbol */}
            {beat === 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.3, scale: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="text-white text-center"
                style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(80px, 22vw, 120px)', fontWeight: 700 }}
              >
                {meta.emoji}
              </motion.div>
            )}

            {/* Beat 2 — Trait lines */}
            {beat === 2 && (
              <div className="flex flex-col items-center justify-center gap-6">
                {traits.map((line, i) => (
                  <motion.p
                    key={i}
                    className="text-white/90 text-center font-light tracking-wide"
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px, 5vw, 22px)' }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.75, duration: 0.7 }}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
            )}

            {/* Beat 3 — "YOU ARE / Name" */}
            {beat === 3 && (
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-white/50 text-[11px] tracking-[0.3em] uppercase">You are</p>
                <h1
                  className="text-white text-center leading-none"
                  style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(48px, 14vw, 72px)', fontWeight: 700 }}
                >
                  {meta.name}
                </h1>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main screen content — staggered section-by-section reveal ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={beat >= 4 ? 'visible' : 'hidden'}
      >
        {/* Top bar */}
        <motion.div variants={sectionVariants} className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
          <span className="ms text-text-2 text-xl">explore</span>
          <span className="font-heading font-bold text-text-1 text-[15px]">Uncover Roads</span>
        </motion.div>

        {/* Hero card */}
        <motion.div
          variants={sectionVariants}
          className="rounded-[20px] p-5 relative overflow-hidden mx-4 mt-5"
          style={{
            background: `linear-gradient(150deg, ${color.glow}, rgba(255,255,255,.02))`,
            border: `1px solid ${color.primary}28`,
          }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at left, ${color.primary}18, transparent 70%)` }}
          />
          <span
            className="text-[42px] relative"
            style={{ filter: `drop-shadow(0 0 16px ${color.primary}70)` }}
          >
            {meta.emoji}
          </span>
          <div className="font-[family-name:var(--font-heading)] text-[19px] font-bold text-[var(--color-text-1)] mt-2">
            {meta.name}
          </div>
          <div className="text-[13px] text-[var(--color-text-3)] mt-0.5">{meta.tagline}</div>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={sectionVariants} className="px-4 mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: 'place', label: 'Stops / day', value: String(profile.stops_per_day) },
            { icon: 'payments', label: 'Budget range', value: priceRange(profile.price_min, profile.price_max) },
            { icon: 'tune', label: 'Pacing', value: flexLabel(profile.flexibility) },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 py-3 rounded-2xl"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}
            >
              <span className="ms text-text-3 text-lg">{stat.icon}</span>
              <span className="text-white font-heading font-bold text-[17px] leading-none">{stat.value}</span>
              <span className="text-text-3 text-[11px]">{stat.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Your Day — animated chips slide in from opposite sides */}
        <motion.div variants={sectionVariants} className="px-5 mt-6">
          <p className="text-text-3 text-[11px] font-bold uppercase tracking-widest mb-3">Your Day</p>
          <div className="flex items-center gap-3">
            {/* Morning chip — slides from left */}
            <motion.div
              initial={{ opacity: 0, x: -28 }}
              animate={beat >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: -28 }}
              transition={{ delay: 0.25, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-1.5 px-3 h-10 rounded-full flex-shrink-0"
              style={{ background: `${color.primary}18`, border: `1px solid ${color.primary}35` }}
            >
              <span className="ms fill text-sm" style={{ color: color.primary }}>
                {DAY_OPEN_ICONS[profile.day_open] ?? 'wb_sunny'}
              </span>
              <span className="text-white text-[13px] font-semibold">
                {DAY_OPEN_LABELS[profile.day_open] ?? profile.day_open}
              </span>
            </motion.div>

            {/* Animated arrow */}
            <motion.span
              initial={{ opacity: 0, scale: 0.4 }}
              animate={beat >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
              transition={{ delay: 0.45, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="ms text-text-3 text-base flex-shrink-0"
            >
              arrow_forward
            </motion.span>

            {/* Evening chip — slides from right */}
            <motion.div
              initial={{ opacity: 0, x: 28 }}
              animate={beat >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 28 }}
              transition={{ delay: 0.6, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-1.5 px-3 h-10 rounded-full flex-shrink-0"
              style={{ background: `${color.primary}18`, border: `1px solid ${color.primary}35` }}
            >
              <span className="ms fill text-sm" style={{ color: color.primary }}>
                {EVENING_ICONS[profile.evening_type] ?? 'nightlife'}
              </span>
              <span className="text-white text-[13px] font-semibold">
                {EVENING_LABELS[profile.evening_type] ?? profile.evening_type}
              </span>
            </motion.div>
          </div>
        </motion.div>

        {/* Top venues */}
        {topVenues.length > 0 && (
          <motion.div variants={sectionVariants} className="px-5 mt-5">
            <p className="text-text-3 text-[11px] font-bold uppercase tracking-widest mb-3">
              Places we'll surface
            </p>
            <div className="flex flex-wrap gap-2">
              {topVenues.map(v => (
                <div
                  key={v}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-surface border border-white/10"
                >
                  <span className="ms text-[13px] text-text-3">{VENUE_ICONS[v] ?? 'place'}</span>
                  <span className="text-text-2 text-[13px] font-medium">{VENUE_LABELS[v] ?? v}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Social + dietary flags */}
        {(profile.social_flags.length > 0 || profile.dietary.length > 0) && (
          <motion.div variants={sectionVariants} className="px-5 mt-4 flex flex-wrap gap-2">
            {profile.social_flags.map(f => (
              <div
                key={f}
                className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-surface border border-white/8"
              >
                <span className="ms fill text-[13px] text-text-3">{SOCIAL_ICONS[f] ?? 'person'}</span>
                <span className="text-text-2 text-[13px]">{SOCIAL_LABELS[f] ?? f}</span>
              </div>
            ))}
            {profile.dietary.map(f => (
              <div
                key={f}
                className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-surface border border-white/8"
              >
                <span className="ms fill text-[13px] text-text-3">{DIETARY_ICONS[f] ?? 'info'}</span>
                <span className="text-text-2 text-[13px]">{DIETARY_LABELS[f] ?? f}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div variants={sectionVariants} className="px-5 mt-8 pb-14">
          <button
            onClick={startPlanning}
            className="w-full h-14 rounded-2xl font-heading font-bold text-white text-[17px] flex items-center justify-center gap-2 mb-3"
            style={{ background: `linear-gradient(135deg, ${color.primary}, ${color.primary}bb)` }}
          >
            Start Planning
            <span className="ms text-base">arrow_forward</span>
          </button>
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'ob1' })}
            className="w-full h-12 rounded-2xl bg-transparent text-text-3 text-[14px] flex items-center justify-center gap-1.5 border border-white/8"
          >
            <span className="ms text-base">refresh</span>
            Retake Assessment
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
