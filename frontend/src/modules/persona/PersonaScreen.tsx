// frontend/src/modules/persona/PersonaScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import { syncPersonaProfile } from '../../shared/userSync';
import { PERSONA_DEFINITIONS } from './types';
import { resolvePersonaKey, legacyArchetypeToPersonaKey } from './persona-resolver';
import type { PersonaKey } from './types';

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

// ── Interest-style chips (replaces behaviour-style chips for the reveal card) ─
const LOVE_CHIPS: Record<PersonaKey, [string, string, string]> = {
  flaneur:            ['Hidden Streets',    'Local Wandering',      'Unexpected Finds'],
  gastronaut:         ['Street Food',       'Local Markets',        'Authentic Flavours'],
  slowScholar:        ['History & Heritage','Museums',              'Deep Culture'],
  neighbourhoodLocal: ['Local Life',        'Neighbourhood Texture','Quiet Corners'],
  efficientExplorer:  ['Key Landmarks',     'City Highlights',      'Local Finds'],
  aesthete:           ['Art & Design',      'Architecture',         'Beautiful Spaces'],
  nightCreature:      ['Nightlife',         'Late Bars',            'Live Music'],
  ritualSeeker:       ['Local Rituals',     'Morning Culture',      'Cultural Events'],
};

// ── Main component ────────────────────────────────────────────────────────────
export function PersonaScreen() {
  const { state, dispatch } = useAppStore();
  const profile    = state.personaProfile;
  const rawAnswers = state.rawOBAnswers;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(true), 350);
    return () => clearTimeout(t);
  }, []);

  const personaKey: PersonaKey = useMemo(() => {
    if (rawAnswers) return resolvePersonaKey(rawAnswers);
    const stored = state.persona?.archetype;
    if (stored) return legacyArchetypeToPersonaKey(stored);
    return 'flaneur';
  }, [rawAnswers, state.persona?.archetype]);

  const def = PERSONA_DEFINITIONS[personaKey];
  const loveChips = LOVE_CHIPS[personaKey];

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

  function startPlanning() {
    dispatch({
      type: 'SET_PERSONA',
      persona: {
        archetype:      personaKey,
        archetype_name: def.name,
        archetype_desc: def.headline,
        ritual:         null, sensory: null, style: null,
        attractions: [], pace: null, social: null,
        insight:        def.social['solo'],
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

  return (
    <div className="fixed inset-0" style={{ zIndex: 20, animation: 'springUp 0.38s ease both' }}>
      {showConfetti && <ConfettiBurst primary={def.primary} />}

      {/* Full-bleed hero image */}
      <img
        src={def.image}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        loading="eager"
      />

      {/* Gradient scrim — darkens toward the bottom for legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(to bottom, rgba(0,0,0,.12) 0%, ${def.bgFrom}bb 45%, ${def.bgFrom}f5 72%, ${def.bgFrom} 100%)`,
      }} />

      {/* Content — bottom-anchored */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 24px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        animation: 'springUp 0.52s 0.18s ease both',
      }}>
        {/* Eyebrow */}
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.38)', marginBottom: 20,
        }}>
          Based on your answers
        </p>

        {/* We think you love */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(100,220,255,.7)', marginBottom: 10 }}>
          We think you love
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          {loveChips.map((chip, i) => (
            <div key={i} style={{
              padding: '7px 15px', borderRadius: 999,
              background: 'rgba(56,210,255,.12)',
              border: '1px solid rgba(56,210,255,.45)',
              color: '#38D2FF',
              fontSize: 13, fontWeight: 600,
            }}>
              {chip}
            </div>
          ))}
        </div>

        {/* We'll surface */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.38)', marginBottom: 10 }}>
          We'll surface
        </p>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 32 }}>
          {def.placeTags.slice(0, 4).map((tag, i) => (
            <div key={i} style={{
              padding: '6px 13px', borderRadius: 999,
              background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.16)',
              color: 'rgba(255,255,255,.75)',
              fontSize: 12, fontWeight: 500,
            }}>
              {tag}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={startPlanning}
          style={{
            position: 'relative', overflow: 'hidden',
            width: '100%', height: 56, borderRadius: 18,
            background: `linear-gradient(135deg, ${def.primary}, ${def.secondary})`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: '#fff',
          }}
        >
          Start exploring
          <span className="ms" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>

        {/* Retake — subtle link */}
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'ob1' })}
          style={{
            width: '100%', marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'rgba(255,255,255,.3)', fontFamily: 'var(--font-sans)',
          }}
        >
          Retake assessment
        </button>
      </div>
    </div>
  );
}
