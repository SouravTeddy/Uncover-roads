// frontend/src/modules/persona/PersonaScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import { syncPersonaProfile } from '../../shared/userSync';
import { PERSONA_DEFINITIONS } from './types';
import { resolvePersonaKey, legacyArchetypeToPersonaKey } from './persona-resolver';
import type { PersonaKey } from './types';
import type { RawOBAnswers } from '../../shared/types';

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

// ── Dynamic reveal content built from actual OB answers ──────────────────────
//
// love[3]    — WHO you are as a traveller (identity, emotional, travel-style)
// surface[4] — WHAT we'll literally do differently for you (product promise, functional)
//
// Rule: no concept appears in both sections.

function buildRevealContent(
  raw: RawOBAnswers | null,
  personaKey: PersonaKey,
): { love: [string, string, string]; surface: [string, string, string, string] } {

  // ── Base identity chip from persona (always 1st in love) ────────────────
  const personaLove: Record<PersonaKey, string> = {
    flaneur:            'Getting lost on purpose, following what looks interesting',
    gastronaut:         'Eating your way through a city, one neighbourhood at a time',
    slowScholar:        'Going deep on one thing rather than ticking off a list',
    neighbourhoodLocal: 'Living like a local, not a tourist passing through',
    efficientExplorer:  'Seeing the most of a place without wasting a minute',
    aesthete:           'Finding beauty in architecture, detail and light',
    nightCreature:      'Cities that come alive after dark',
    ritualSeeker:       'Morning coffee, local markets and the rhythm of daily life',
  };

  // ── Pace chips (for love[1]) ─────────────────────────────────────────────
  const pace = raw?.pace ?? [];
  let loveFromPace = 'Moving at your own pace, no fixed schedule';
  if (pace.includes('slow'))        loveFromPace = 'Taking it slow, staying long enough to actually feel a place';
  else if (pace.includes('pack'))   loveFromPace = 'Covering serious ground without burning out';
  else if (pace.includes('spontaneous')) loveFromPace = 'Waking up without a plan and seeing what happens';
  else if (pace.includes('balanced')) loveFromPace = 'Mixing structure with room to wander';

  // ── Group / situation chip (for love[2]) ────────────────────────────────
  const group = raw?.group ?? 'solo';
  let loveFromGroup = "Travelling on your own terms, nobody else's schedule";
  if (group === 'couple')  loveFromGroup = 'Discovering places that feel better shared with someone';
  if (group === 'family')  loveFromGroup = 'Making memories that actually stick for everyone';
  if (group === 'friends') loveFromGroup = 'Big plans and the chaos of making them work together';

  // ── Surface chips — built from answers, no overlap with love ────────────
  const surface: string[] = [];
  const usedConcepts = new Set<string>();

  // Evening → surface if not persona-already-nightCreature
  const evening = raw?.evening ?? null;
  if (evening === 'bars' && personaKey !== 'nightCreature') {
    surface.push('Late-night spots and bars that locals actually go to');
    usedConcepts.add('evening');
  } else if (evening === 'dinner_wind') {
    surface.push('Unhurried dinner spots over tourist-row restaurants');
    usedConcepts.add('evening');
  } else if (evening === 'markets') {
    surface.push('Evening markets and outdoor spots to wind down');
    usedConcepts.add('evening');
  } else if (evening === 'early') {
    surface.push('Places that close early so you can too — no late pressure');
    usedConcepts.add('evening');
  }

  // Dietary → always surface (very specific, never love)
  const dietary = raw?.dietary ?? [];
  if (dietary.includes('plant_based')) {
    surface.push('Plant-based spots worth going to, not just tolerating');
    usedConcepts.add('dietary');
  } else if (dietary.includes('halal')) {
    surface.push('Halal-friendly options that don\'t compromise on quality');
    usedConcepts.add('dietary');
  } else if (dietary.includes('kosher')) {
    surface.push('Kosher-certified places along your route');
    usedConcepts.add('dietary');
  } else if (dietary.includes('allergy')) {
    surface.push('Places with clear allergy info so you can eat without stress');
    usedConcepts.add('dietary');
  }

  // Budget → surface
  const budget = raw?.budget ?? null;
  const budgetProtect = raw?.budget_protect ?? null;
  if (budget === 'budget' || budgetProtect === 'free_only') {
    surface.push('Free entry, local pricing — real value over tourist markup');
    usedConcepts.add('budget');
  } else if (budgetProtect === 'street_food') {
    surface.push('Street food and market stalls over sit-down restaurants');
    usedConcepts.add('budget');
  } else if (budget === 'luxury') {
    surface.push('Higher-quality venues — the kind worth spending on');
    usedConcepts.add('budget');
  } else if (budget === 'comfortable') {
    surface.push('Solid mid-range spots that actually feel worth it');
    usedConcepts.add('budget');
  }

  // Kid focus (family) → surface
  if (group === 'family') {
    const kidFocus = raw?.kid_focus ?? null;
    if (kidFocus === 'outdoor') surface.push('Open outdoor spaces where kids can actually move around');
    else if (kidFocus === 'edu') surface.push('Interactive museums and places where kids learn something real');
    else if (kidFocus === 'food') surface.push('Places with proper kid-friendly menus, not just chips');
    else surface.push('A pace that works for all ages — no one gets left behind');
    usedConcepts.add('kids');
  }

  // Mood → surface (pick the strongest one not already expressed by persona)
  const mood = raw?.mood ?? [];
  if (!usedConcepts.has('mood')) {
    if (mood.includes('culture') && personaKey !== 'slowScholar' && personaKey !== 'aesthete') {
      surface.push('Galleries, museums and cultural sites timed before crowds arrive');
      usedConcepts.add('mood');
    } else if (mood.includes('eat_drink') && personaKey !== 'gastronaut') {
      surface.push('Places worth eating at — from market stalls to proper sit-downs');
      usedConcepts.add('mood');
    } else if (mood.includes('relax') && !pace.includes('slow')) {
      surface.push('Green spaces and quiet corners to actually slow down in');
      usedConcepts.add('mood');
    } else if (mood.includes('explore')) {
      surface.push('Off-the-main-drag spots that reward the detour');
      usedConcepts.add('mood');
    }
  }

  // Pace → surface timing signal (only if slow/pack, different angle from love chip)
  if (pace.includes('slow') && !usedConcepts.has('pace_timing')) {
    surface.push('Quieter visit windows so you\'re not fighting crowds at every stop');
    usedConcepts.add('pace_timing');
  } else if (pace.includes('pack') && !usedConcepts.has('pace_timing')) {
    surface.push('Tight routing so you cover more ground without doubling back');
    usedConcepts.add('pace_timing');
  }

  // Day open → surface the morning flavour
  const dayOpen = raw?.day_open ?? null;
  if (dayOpen === 'coffee' && !usedConcepts.has('morning')) {
    surface.push('A good first coffee stop before anything else gets planned');
    usedConcepts.add('morning');
  } else if (dayOpen === 'breakfast' && !usedConcepts.has('morning')) {
    surface.push('Proper breakfast spots to start the day right');
    usedConcepts.add('morning');
  }

  // Persona-specific surface chip (if we still need more)
  const personaSurface: Record<PersonaKey, string> = {
    flaneur:            'Side streets and courtyards that most visitors walk straight past',
    gastronaut:         'Local market stalls and neighbourhood restaurants over tourist menus',
    slowScholar:        'Lesser-known historical sites alongside the main ones',
    neighbourhoodLocal: 'One neighbourhood in depth rather than five places by taxi',
    efficientExplorer:  'The highest-impact stops sequenced so you waste no time',
    aesthete:           'Striking architecture and design spaces that most people overlook',
    nightCreature:      'Bars and live music venues locals actually go to after dark',
    ritualSeeker:       'Morning cafes, local markets and the quieter cultural rhythm',
  };

  // Fill to exactly 4 surface chips
  if (surface.length < 4) surface.push(personaSurface[personaKey]);
  if (surface.length < 4) {
    // Generic catch-all fillers covering dimensions not already used
    const fillers = [
      'Spots that earn their place — nothing just to fill the day',
      'Walking routes that connect stops naturally, less time in taxis',
      'Real neighbourhood life over the usual tourist circuit',
      'A mix of well-known and genuinely off-radar to keep it interesting',
    ];
    for (const f of fillers) {
      if (surface.length >= 4) break;
      surface.push(f);
    }
  }

  return {
    love: [personaLove[personaKey], loveFromPace, loveFromGroup],
    surface: [surface[0], surface[1], surface[2], surface[3]] as [string, string, string, string],
  };
}

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
  const { love: loveChips, surface: surfaceChips } = useMemo(
    () => buildRevealContent(rawAnswers, personaKey),
    [rawAnswers, personaKey],
  );

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
          fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.55)', marginBottom: 18,
        }}>
          Based on your answers
        </p>

        {/* We think you love */}
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', marginBottom: 10 }}>
          We think you love
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          {loveChips.map((chip, i) => (
            <div key={i} style={{
              padding: '8px 16px', borderRadius: 999,
              background: 'rgba(56,210,255,.18)',
              border: '1px solid rgba(56,210,255,.55)',
              color: '#fff',
              fontSize: 14, fontWeight: 600,
            }}>
              {chip}
            </div>
          ))}
        </div>

        {/* We'll surface */}
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
          We'll surface
        </p>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 32 }}>
          {surfaceChips.map((chip, i) => (
            <div key={i} style={{
              padding: '7px 14px', borderRadius: 999,
              background: 'rgba(255,255,255,.12)',
              border: '1px solid rgba(255,255,255,.24)',
              color: 'rgba(255,255,255,.90)',
              fontSize: 13, fontWeight: 500,
            }}>
              {chip}
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
