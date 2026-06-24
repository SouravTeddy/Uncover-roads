// frontend/src/modules/persona/PersonaScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import { syncPersonaProfile } from '../../shared/userSync';
import { PERSONA_DEFINITIONS } from './types';
import { resolvePersonaKey, legacyArchetypeToPersonaKey } from './persona-resolver';
import type { PersonaKey } from './types';

// ── Framer variants ───────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const sectionVariants = {
  hidden:   { opacity: 0, y: 20 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};
const tagContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } },
};
const tagItemVariants = {
  hidden:  { opacity: 0, y: 10, scale: 0.9 },
  visible: { opacity: 1, y: 0,  scale: 1,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

// ── Social context SVG icons ─────────────────────────────────────────────────
const SOCIAL_ICONS: Record<string, string> = {
  solo:   `<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>`,
  couple: `<path d="M12 21l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.2L12 21z"/>`,
  family: `<circle cx="8.5" cy="6" r="2.5"/><circle cx="15.5" cy="6" r="2.5"/><circle cx="12" cy="16" r="2"/><path d="M3 19c0-3 2.5-5.5 5.5-5.5h1.5M21 19c0-3-2.5-5.5-5.5-5.5h-1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  group:  `<circle cx="7" cy="7.5" r="2.5"/><circle cx="17" cy="7.5" r="2.5"/><circle cx="7" cy="16.5" r="2.5"/><circle cx="17" cy="16.5" r="2.5"/>`,
};

// ── Confetti burst ────────────────────────────────────────────────────────────
function ConfettiBurst({ primary }: { primary: string }) {
  const particles = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left:     12 + Math.random() * 76,
      size:      6 + Math.random() * 9,
      isCircle: Math.random() > 0.45,
      delay:    Math.random() * 0.42,
      duration: 1.6 + Math.random() * 1.3,
      cw:       Math.random() > 0.5,
      color:    Math.random() > 0.5
        ? primary
        : `rgba(245,240,234,${0.55 + Math.random() * 0.45})`,
    }))
  , [primary]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 50 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: '-12px', left: `${p.left}%`,
          width: p.size, height: p.size,
          borderRadius: p.isCircle ? '50%' : '2px',
          background: p.color,
          animationName:           p.cw ? 'persona-confetti-cw' : 'persona-confetti-ccw',
          animationDuration:       `${p.duration}s`,
          animationDelay:          `${p.delay}s`,
          animationTimingFunction: 'linear',
          animationFillMode:       'both',
        }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PersonaScreen() {
  const { state, dispatch } = useAppStore();
  const profile    = state.personaProfile;
  const rawAnswers = state.rawOBAnswers;

  // Beat 1: atmosphere (0–1.5s)
  // Beat 2: traits (1.5–4s)
  // Beat 3: statement + rings (4–6.5s)
  // Beat 4: content reveal (6.5s+)
  const [beat, setBeat] = useState<1 | 2 | 3 | 4>(1);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(2), 2500);
    const t2 = setTimeout(() => setBeat(3), 6500);
    const t3 = setTimeout(() => { setBeat(4); setShowConfetti(true); }, 11000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // ── Resolve persona ─────────────────────────────────────────────────────────
  const personaKey: PersonaKey = useMemo(() => {
    if (rawAnswers) return resolvePersonaKey(rawAnswers);
    // Fallback: if stored persona exists with old key, migrate it
    const stored = state.persona?.archetype;
    if (stored) return legacyArchetypeToPersonaKey(stored);
    return 'flaneur';
  }, [rawAnswers, state.persona?.archetype]);

  const def = PERSONA_DEFINITIONS[personaKey];

  // ── Social context ──────────────────────────────────────────────────────────
  const rawGroup = rawAnswers?.group ?? 'solo';
  const socialKey: 'solo' | 'couple' | 'family' | 'group' =
    rawGroup === 'friends' ? 'group' : rawGroup;

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

  const bgGradient = `linear-gradient(to bottom, ${def.bgFrom}, ${def.bgTo})`;
  const gradientText = `linear-gradient(135deg, ${def.primary}, ${def.secondary})`;

  function startPlanning() {
    dispatch({
      type: 'SET_PERSONA',
      persona: {
        archetype:      personaKey,
        archetype_name: def.name,
        archetype_desc: def.headline,
        ritual:         null, sensory: null, style: null,
        attractions: [], pace: null, social: null,
        insight:        def.social[socialKey],
        venue_filters:  def.placeTags,
        itinerary_bias: def.chips,
        archetypeData:  { name: def.name, desc: def.headline, venue_filters: def.placeTags, itinerary_bias: def.chips },
      },
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncPersonaProfile(session.user.id, personaKey, def.name, rawAnswers).catch((e) => console.warn('[persona] sync failed', e));
      }
    });
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  const statementLines = def.statement.split('\n');

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 20, background: bgGradient, animation: 'springUp 0.45s ease both' }}
    >
      {showConfetti && <ConfettiBurst primary={def.primary} />}

      {/* ── Cinematic overlay ── */}
      <AnimatePresence>
        {beat < 4 && (
          <motion.div
            className="fixed inset-0 flex flex-col items-center justify-center px-8"
            style={{ zIndex: 30, background: bgGradient }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Beat 1 — big emoji */}
            {beat === 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 0.35, scale: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ fontSize: 'clamp(80px, 22vw, 120px)', lineHeight: 1, filter: `drop-shadow(0 0 32px ${def.primary})` }}
              >
                {def.heroEmoji}
              </motion.div>
            )}

            {/* Beat 2 — trait lines */}
            {beat === 2 && (
              <div className="flex flex-col items-center justify-center gap-6">
                {def.traits.map((line, i) => (
                  <motion.p
                    key={i}
                    className="text-white/90 text-center font-light tracking-wide"
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px, 5vw, 22px)' }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.8, duration: 0.7 }}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
            )}

            {/* Beat 3 — statement + rings */}
            {beat === 3 && (
              <div className="relative flex flex-col items-center justify-center">
                {[0, 0.55].map((delay, i) => (
                  <div key={i} className="absolute" style={{
                    width: 200, height: 200, borderRadius: '50%',
                    border: `1px solid ${i === 0 ? def.primary + '55' : 'rgba(255,255,255,0.18)'}`,
                    animation: `persona-ring 2.2s ${delay}s ease-out infinite`,
                  }} />
                ))}
                <motion.div
                  className="relative flex flex-col items-center gap-3"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  {statementLines.map((line, i) => (
                    <span
                      key={i}
                      className="text-center leading-none"
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'clamp(44px, 13vw, 64px)',
                        fontWeight: 700,
                        ...(i === def.gradientLine
                          ? { background: gradientText, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                          : { color: '#fff' }
                        ),
                      }}
                    >
                      {line}
                    </span>
                  ))}
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <motion.div variants={containerVariants} initial="hidden" animate={beat >= 4 ? 'visible' : 'hidden'}>

        {/* Top bar */}
        <motion.div variants={sectionVariants} className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
          <span className="ms text-text-2 text-xl">explore</span>
          <span className="font-heading font-bold text-text-1 text-[15px]">Uncover Roads</span>
        </motion.div>

        {/* Header image */}
        <motion.div variants={sectionVariants} className="relative w-full overflow-hidden" style={{ height: 220 }}>
          <img
            src={def.image}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          {/* Color grade overlay */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to bottom, ${def.primary}44 0%, transparent 45%, ${def.bgFrom} 100%)`,
          }} />
          {/* Social badge */}
          <div
            className="absolute bottom-3 right-4 flex items-center justify-center"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)',
              border: `1.5px solid ${def.primary}`,
              color: def.primary,
              boxShadow: `0 0 10px ${def.primary}60`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"
              dangerouslySetInnerHTML={{ __html: SOCIAL_ICONS[socialKey] }}
            />
          </div>
        </motion.div>

        {/* Hero headline + social subtext */}
        <motion.div variants={sectionVariants} className="px-5 mt-4">
          <h1
            className="leading-tight"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(26px, 7vw, 32px)',
              fontWeight: 700,
              background: gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {def.headline}
          </h1>
          <p className="text-text-2 text-[13px] mt-2 leading-relaxed" style={{ maxWidth: 300 }}>
            {def.social[socialKey]}
          </p>
        </motion.div>

        {/* Instinct chips */}
        <motion.div variants={sectionVariants} className="px-5 mt-5">
          <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">Your travel instincts</p>
          <div className="flex gap-2 flex-wrap">
            {def.chips.map((chip, i) => (
              <div
                key={`chip-${i}`}
                className="px-3 h-9 rounded-full flex items-center text-[13px] font-semibold"
                style={{
                  background: i === 0 ? `${def.primary}20` : i === 1 ? `${def.secondary}18` : `${def.primary}12`,
                  border:     i === 0 ? `1px solid ${def.primary}45` : i === 1 ? `1px solid ${def.secondary}40` : `1px solid ${def.primary}30`,
                  color:      i === 1 ? def.secondary : def.primary,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Route style */}
        <motion.div variants={sectionVariants} className="px-5 mt-5">
          <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-2">How we build your day</p>
          <div className="flex items-start gap-3 py-3 px-4 rounded-2xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
            <span style={{ fontSize: 18 }}>🗺️</span>
            <p className="text-text-2 text-[13px] leading-relaxed">{def.route}</p>
          </div>
        </motion.div>

        {/* Prioritise / Skip */}
        <motion.div variants={sectionVariants} className="px-5 mt-4 flex flex-col gap-2">
          <div className="flex items-start gap-3 py-3 px-4 rounded-2xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
            <span className="text-[13px] font-bold mt-0.5" style={{ color: def.primary }}>✦</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: def.primary }}>We surface</p>
              <p className="text-text-2 text-[13px] leading-relaxed">{def.prioritise}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 py-3 px-4 rounded-2xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
            <span className="text-[13px] font-bold mt-0.5 opacity-40">✕</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-text-3">We skip</p>
              <p className="text-text-2 text-[13px] leading-relaxed">{def.skip}</p>
            </div>
          </div>
        </motion.div>

        {/* Place tags — per-tag stagger */}
        <motion.div variants={sectionVariants} className="px-5 mt-5">
          <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">Places for you</p>
          <motion.div
            className="flex flex-wrap gap-2"
            variants={tagContainerVariants}
            initial="hidden"
            animate={beat >= 4 ? 'visible' : 'hidden'}
          >
            {def.placeTags.map((tag, i) => (
              <motion.div
                key={`tag-${i}`}
                variants={tagItemVariants}
                className="flex items-center px-3 h-9 rounded-xl text-[13px] font-medium"
                style={{
                  background: i % 2 === 0 ? `${def.primary}14` : `${def.secondary}12`,
                  border:     i % 2 === 0 ? `1px solid ${def.primary}30` : `1px solid ${def.secondary}28`,
                  color:      i % 2 === 0 ? def.primary : def.secondary,
                }}
              >
                {tag}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* CTAs */}
        <motion.div variants={sectionVariants} className="px-5 mt-8 pb-14">
          <button
            onClick={startPlanning}
            className="relative overflow-hidden w-full h-14 rounded-2xl font-heading font-bold text-white text-[17px] flex items-center justify-center gap-2 mb-3"
            style={{ background: `linear-gradient(135deg, ${def.primary}, ${def.secondary})` }}
          >
            <motion.div
              className="absolute inset-y-0 pointer-events-none"
              style={{ width: '55%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }}
              initial={{ left: '-60%', skewX: -15 }}
              animate={{ left: '160%', skewX: -15 }}
              transition={{ delay: 0.9, duration: 0.62, ease: 'easeInOut' }}
            />
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
