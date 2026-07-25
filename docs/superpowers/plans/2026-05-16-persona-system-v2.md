# Persona System V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-archetype persona system with 8 behaviorally-distinct travel personas, each with unique vibrant color, header image, social context-aware messaging, and real impact on itinerary routing.

**Architecture:** Multi-signal scoring in a new `persona-resolver.ts` replaces the single-mood `MOOD_ARCHETYPE` lookup. `PersonaScreen.tsx` is fully rewritten with the new visual design (header image, behavioral statements, no archetype labels). `rec-rules.ts` and `pincard-persona.ts` are updated to understand the 8 new persona keys.

**Tech Stack:** React, TypeScript, Framer Motion, Tailwind v4, Supabase, Vercel (auto-deploy on push to main)

---

## File Map

| File | Change |
|---|---|
| `frontend/src/modules/persona/types.ts` | Replace archetype constants with `PERSONA_DEFINITIONS` for all 8 personas |
| `frontend/src/modules/persona/persona-resolver.ts` | **NEW** — multi-signal scoring algorithm |
| `frontend/src/modules/persona/PersonaScreen.tsx` | Full rewrite with new visual design |
| `frontend/src/modules/route/rec-rules.ts` | Update `PersonaName` type + `PERSONA_REC_MAP` |
| `frontend/src/modules/map/pincard-persona.ts` | Update `persona.archetype` badge logic for new keys |
| `frontend/src/index.css` | Already has required keyframes — verify only |

---

## Task 1: Define Persona Definitions in types.ts

**Files:**
- Modify: `frontend/src/modules/persona/types.ts`

- [ ] **Step 1: Replace types.ts entirely**

```typescript
// frontend/src/modules/persona/types.ts

export type PersonaKey =
  | 'flaneur'
  | 'gastronaut'
  | 'slowScholar'
  | 'neighbourhoodLocal'
  | 'efficientExplorer'
  | 'aesthete'
  | 'nightCreature'
  | 'ritualSeeker';

export interface PersonaDefinition {
  key: PersonaKey;
  /** Short all-caps display label (used in Beat 3 statement prefix) */
  name: string;
  /** Cinematic Beat 3 statement — newline-separated, 3 lines */
  statement: string;
  /** Which line (0-indexed) gets the gradient color treatment */
  gradientLine: number;
  /** Hero card headline — one punchy sentence, no label */
  headline: string;
  /** Hero card subtext template — use {{social}} placeholder replaced per-context */
  heroEmoji: string;
  /** 3 short instinct chips, max 3 words each */
  chips: [string, string, string];
  /** Plain-language route style description */
  route: string;
  /** What the itinerary will surface */
  prioritise: string;
  /** What the itinerary will avoid */
  skip: string;
  /** 5 place tag labels */
  placeTags: [string, string, string, string, string];
  /** Beat 2 trait lines — 3 sentences */
  traits: [string, string, string];
  /** Accent (primary) color */
  primary: string;
  /** Secondary accent color */
  secondary: string;
  /** Background gradient dark from-color */
  bgFrom: string;
  /** Background gradient dark to-color */
  bgTo: string;
  /** Unsplash image URL for header */
  image: string;
  /** Social context messaging — short, punchy, 1–2 sentences */
  social: {
    solo: string;
    couple: string;
    family: string;
    group: string;
  };
}

export const PERSONA_DEFINITIONS: Record<PersonaKey, PersonaDefinition> = {
  flaneur: {
    key: 'flaneur',
    name: 'FLANEUR',
    statement: 'YOU FOLLOW\nWHAT LOOKS\nINTERESTING.',
    gradientLine: 1,
    headline: 'No plan. No problem.',
    heroEmoji: '🚶',
    chips: ['One neighbourhood', 'No fixed route', 'Follow curiosity'],
    route: 'Two or three spots, all walkable. No rush, no backtracking.',
    prioritise: 'Side streets, local cafés, hidden courtyards, accidental finds.',
    skip: 'Tourist clusters, timed entries, anything with a queue.',
    placeTags: ['Side Streets', 'Courtyards', 'Local Cafés', 'Markets', 'Parks'],
    traits: [
      'Instinct over itinerary.',
      'The street is the map.',
      'A detour is just the route.',
    ],
    primary: '#E07040',
    secondary: '#F0B060',
    bgFrom: '#1C0E04',
    bgTo: '#3A1C08',
    image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'No one to check with. You go where the street takes you.',
      couple: 'You wander together, meet at the café you both spotted.',
      family: 'The city is your kids\' classroom today.',
      group:  'Split up at the corner. Compare notes over lunch.',
    },
  },

  gastronaut: {
    key: 'gastronaut',
    name: 'GASTRONAUT',
    statement: 'YOU EAT YOUR\nWAY THROUGH\nCITIES.',
    gradientLine: 1,
    headline: 'The itinerary is the food.',
    heroEmoji: '🍜',
    chips: ['Market first', 'No tourist menus', 'Ask locals'],
    route: 'Built around meal times. Market in the morning, lunch, then wherever the food takes you.',
    prioritise: 'Street food stalls, local markets, neighbourhood restaurants, wine bars.',
    skip: 'Hotel restaurants, tourist menus, anything with photos on the menu.',
    placeTags: ['Street Food', 'Local Markets', 'Wine Bars', 'Chef\'s Tables', 'Food Halls'],
    traits: [
      'The best meal won\'t be in a guidebook.',
      'You know a good market from a great one.',
      'Food is never just food.',
    ],
    primary: '#E84A2A',
    secondary: '#F09030',
    bgFrom: '#1A0804',
    bgTo: '#380E06',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You eat at the bar. One dish, full attention.',
      couple: 'Long lunches. Wine you didn\'t plan to order.',
      family: 'The market stall your kids will still talk about.',
      group:  'You\'ve already sent the restaurant shortlist.',
    },
  },

  slowScholar: {
    key: 'slowScholar',
    name: 'SLOW SCHOLAR',
    statement: 'EVERY CITY\nHAS LAYERS.\nYOU FIND THEM.',
    gradientLine: 1,
    headline: 'You leave with context, not just photos.',
    heroEmoji: '🏛️',
    chips: ['Few stops', 'Long visits', 'Read everything'],
    route: 'Two, maybe three stops. You spend proper time at each one.',
    prioritise: 'Museums, archaeological sites, heritage districts, specialist bookshops.',
    skip: 'Rush-through highlights, Instagram stops, anything timed to 20 minutes.',
    placeTags: ['Heritage Sites', 'Museums', 'Old Quarters', 'Historic Squares', 'Bookshops'],
    traits: [
      'You read the plaques everyone else walks past.',
      'A place means more when you know what stood here before.',
      'You leave knowing the story behind the sign.',
    ],
    primary: '#7880D8',
    secondary: '#A8B0F0',
    bgFrom: '#080A1C',
    bgTo: '#141830',
    image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'Take as long as you need. Nobody\'s waiting.',
      couple: 'You read the same plaque and argue about what it means.',
      family: 'History as a story. Your kids actually listen.',
      group:  'You knew about this place before anyone else did.',
    },
  },

  neighbourhoodLocal: {
    key: 'neighbourhoodLocal',
    name: 'NEIGHBOURHOOD LOCAL',
    statement: 'YOU COULD\nALMOST\nLIVE HERE.',
    gradientLine: 2,
    headline: 'Zero tourist traps. All texture.',
    heroEmoji: '☕',
    chips: ['Stay local', 'Skip the centre', 'Return visits'],
    route: 'One neighbourhood, half a day. You go back to places you liked.',
    prioritise: 'Neighbourhood bars, local bakeries, residential parks, corner cafés.',
    skip: 'Landmark clusters, anything on TripAdvisor\'s front page, hotel picks.',
    placeTags: ['Local Cafés', 'Residential Streets', 'Corner Bars', 'Neighbourhood Parks', 'Bakeries'],
    traits: [
      'You\'ve sat at the same café table twice.',
      'The neighbourhood matters more than the sights.',
      'A good trip feels like you almost lived there.',
    ],
    primary: '#3AB898',
    secondary: '#6AD4B8',
    bgFrom: '#04181A',
    bgTo: '#083028',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You blend in. That\'s the point.',
      couple: 'You find your neighbourhood. You\'ll talk about it for years.',
      family: 'Kids in the park. You find the café the locals use.',
      group:  'You convince everyone the centre is overrated. You\'re right.',
    },
  },

  efficientExplorer: {
    key: 'efficientExplorer',
    name: 'EFFICIENT EXPLORER',
    statement: 'YOU PACK MORE\nINTO A DAY\nTHAN MOST.',
    gradientLine: 2,
    headline: 'Cover ground. Miss nothing.',
    heroEmoji: '🧭',
    chips: ['Early start', 'Nearby stops', 'No backtracking'],
    route: 'Six to eight stops, close together. Early start, everything fits.',
    prioritise: 'A curated mix of must-sees and hidden gems, all within walking range.',
    skip: 'Anything that adds more than 20 minutes of travel between stops.',
    placeTags: ['Viewpoints', 'Key Landmarks', 'Local Finds', 'Parks', 'Neighbourhood Gems'],
    traits: [
      'You fit more into a morning than most do in a day.',
      'No wasted walks. No backtracking.',
      'Efficient isn\'t rushed — it\'s deliberate.',
    ],
    primary: '#3A90D8',
    secondary: '#6AB8F0',
    bgFrom: '#04101C',
    bgTo: '#081C34',
    image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You move fast. Nobody needs to keep up.',
      couple: 'See more, rush nothing. Somehow it works.',
      family: 'Pre-booked, well-planned. The kids are impressed.',
      group:  'You sent the itinerary three days ago.',
    },
  },

  aesthete: {
    key: 'aesthete',
    name: 'AESTHETE',
    statement: 'YOU TRAVEL\nTHROUGH\nYOUR EYES.',
    gradientLine: 2,
    headline: 'Beautiful cities, beautifully spent.',
    heroEmoji: '🎨',
    chips: ['Design first', 'Beautiful spaces', 'Slow looking'],
    route: 'Gallery, then a beautiful walk, then a café worth sitting in.',
    prioritise: 'Design museums, contemporary galleries, architectural landmarks, beautiful interiors.',
    skip: 'Purely historical sites without visual interest, crowded viewpoints, anything ugly.',
    placeTags: ['Galleries', 'Architecture', 'Design Districts', 'Beautiful Cafés', 'Rooftops'],
    traits: [
      'You spend an hour in a room most people walk through in three minutes.',
      'Architecture, light, texture — you notice what others walk past.',
      'Beauty is never shallow when you really look.',
    ],
    primary: '#C870B8',
    secondary: '#E8A8D8',
    bgFrom: '#180A18',
    bgTo: '#2C1028',
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'An hour in a room most people walk through in three minutes.',
      couple: 'You find the most beautiful place in the city. You both know why.',
      family: 'You show your kids what good design actually feels like.',
      group:  'You found the rooftop nobody else knew about.',
    },
  },

  nightCreature: {
    key: 'nightCreature',
    name: 'NIGHT CREATURE',
    statement: 'YOUR CITY\nSTARTS AT\nSUNDOWN.',
    gradientLine: 2,
    headline: 'The night is the plan.',
    heroEmoji: '🌆',
    chips: ['Late start', 'Bar hop', 'Follow the energy'],
    route: 'Easy afternoon, then the city wakes up and so do you.',
    prioritise: 'Bars, rooftop terraces, late restaurants, live music, night markets.',
    skip: 'Morning-only museums, early closings, anything that needs a 6pm reservation.',
    placeTags: ['Rooftop Bars', 'Late Restaurants', 'Live Music', 'Night Markets', 'Cocktail Bars'],
    traits: [
      'The city comes alive after 9pm and so do you.',
      'Best nights have no ending time.',
      'Sleep is negotiable. Energy isn\'t.',
    ],
    primary: '#8A50D8',
    secondary: '#C888F0',
    bgFrom: '#0A0414',
    bgTo: '#180828',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You end up talking to strangers. That\'s half the point.',
      couple: 'No end time. No plan. That\'s the plan.',
      family: 'Daytime done early. The evenings are yours.',
      group:  'No itinerary needed. Everyone just follows.',
    },
  },

  ritualSeeker: {
    key: 'ritualSeeker',
    name: 'RITUAL SEEKER',
    statement: 'YOU SEEK THE\nRHYTHMS LOCALS\nLIVE BY.',
    gradientLine: 1,
    headline: 'The city\'s rituals become yours.',
    heroEmoji: '🌅',
    chips: ['Local rituals', 'Morning coffee', 'Cultural immersion'],
    route: 'You follow the city\'s rhythm — morning coffee, lunch, the afternoon slow-down.',
    prioritise: 'Traditional cafés, local institutions, Sunday markets, cultural events.',
    skip: 'Trendy spots, anything that opened recently, tourist-facing experiences.',
    placeTags: ['Morning Cafés', 'Sunday Markets', 'Local Institutions', 'Cultural Spots', 'Old Bars'],
    traits: [
      'The 7am coffee bar. The Sunday market. The afternoon that slows down.',
      'You find the rhythm before you find the sights.',
      'You leave knowing how the city actually works.',
    ],
    primary: '#D4A030',
    secondary: '#F0C860',
    bgFrom: '#141004',
    bgTo: '#281E08',
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You sit at the counter and order what the person next to you has.',
      couple: 'You find your morning ritual. You do it every day of the trip.',
      family: 'Your kids learn how a city actually works.',
      group:  'The thing that becomes the trip\'s running joke and best memory.',
    },
  },
};

// ── Legacy compat — kept for any downstream that reads ARCHETYPE_COLORS ─────
/** @deprecated Use PERSONA_DEFINITIONS[key].primary instead */
export const ARCHETYPE_COLORS: Record<string, { primary: string; glow: string }> = {
  flaneur:            { primary: '#E07040', glow: 'rgba(224,112,64,.22)' },
  gastronaut:         { primary: '#E84A2A', glow: 'rgba(232,74,42,.22)' },
  slowScholar:        { primary: '#7880D8', glow: 'rgba(120,128,216,.22)' },
  neighbourhoodLocal: { primary: '#3AB898', glow: 'rgba(58,184,152,.22)' },
  efficientExplorer:  { primary: '#3A90D8', glow: 'rgba(58,144,216,.22)' },
  aesthete:           { primary: '#C870B8', glow: 'rgba(200,112,184,.22)' },
  nightCreature:      { primary: '#8A50D8', glow: 'rgba(138,80,216,.22)' },
  ritualSeeker:       { primary: '#D4A030', glow: 'rgba(212,160,48,.22)' },
  // legacy keys (kept for stored personas)
  voyager:       { primary: '#4f8fab', glow: 'rgba(79,143,171,.22)' },
  wanderer:      { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' },
  epicurean:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)' },
  historian:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)' },
  pulse:         { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' },
  slowtraveller: { primary: '#6b9470', glow: 'rgba(107,148,112,.22)' },
  explorer:      { primary: '#6b9470', glow: 'rgba(107,148,112,.22)' },
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep persona/types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/persona/types.ts
git commit -m "feat(persona): define 8 PersonaDefinition constants replacing 4-archetype system"
```

---

## Task 2: Create persona-resolver.ts

**Files:**
- Create: `frontend/src/modules/persona/persona-resolver.ts`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/modules/persona/persona-resolver.ts
import type { RawOBAnswers } from '../../shared/types';
import type { PersonaKey } from './types';

/**
 * Multi-signal persona scoring. Uses mood, pace, evening, day_open,
 * budget, and group to produce the best-matching PersonaKey.
 * Pure function — no side effects.
 */
export function resolvePersonaKey(raw: RawOBAnswers): PersonaKey {
  const scores: Record<PersonaKey, number> = {
    flaneur: 0, gastronaut: 0, slowScholar: 0, neighbourhoodLocal: 0,
    efficientExplorer: 0, aesthete: 0, nightCreature: 0, ritualSeeker: 0,
  };

  const mood    = raw.mood  ?? [];
  const pace    = raw.pace  ?? [];
  const evening = raw.evening  ?? null;
  const dayOpen = raw.day_open ?? null;
  const budget  = raw.budget   ?? null;
  const group   = raw.group    ?? null;

  // ── Mood (primary = full weight, secondary = 0.5, tertiary = 0.25) ─────────
  mood.forEach((m, i) => {
    const w = [1.0, 0.5, 0.25][i] ?? 0.1;
    if (m === 'explore') {
      scores.flaneur           += 3 * w;
      scores.efficientExplorer += 2 * w;
      scores.aesthete          += 1 * w;
    }
    if (m === 'relax') {
      scores.flaneur             += 1 * w;
      scores.slowScholar         += 1 * w;
      scores.neighbourhoodLocal  += 3 * w;
      scores.ritualSeeker        += 2 * w;
    }
    if (m === 'eat_drink') {
      scores.gastronaut         += 4 * w;
      scores.ritualSeeker       += 2 * w;
      scores.neighbourhoodLocal += 1 * w;
      scores.nightCreature      += 1 * w;
    }
    if (m === 'culture') {
      scores.slowScholar  += 3 * w;
      scores.aesthete     += 3 * w;
      scores.ritualSeeker += 1 * w;
    }
  });

  // ── Pace ───────────────────────────────────────────────────────────────────
  pace.forEach(p => {
    if (p === 'slow') {
      scores.flaneur            += 2;
      scores.slowScholar        += 3;
      scores.neighbourhoodLocal += 2;
      scores.ritualSeeker       += 2;
    }
    if (p === 'pack')        scores.efficientExplorer += 3;
    if (p === 'spontaneous') { scores.flaneur += 3; scores.nightCreature += 2; scores.neighbourhoodLocal += 1; }
    if (p === 'balanced')    { scores.efficientExplorer += 1; scores.aesthete += 1; }
  });

  // ── Evening ────────────────────────────────────────────────────────────────
  if (evening === 'bars')        scores.nightCreature += 4;
  if (evening === 'markets')     { scores.gastronaut += 2; scores.ritualSeeker += 2; scores.neighbourhoodLocal += 1; }
  if (evening === 'dinner_wind') { scores.gastronaut += 1; scores.aesthete += 1; }
  if (evening === 'early')       { scores.slowScholar += 1; scores.ritualSeeker += 2; scores.neighbourhoodLocal += 1; }

  // ── Day open ───────────────────────────────────────────────────────────────
  if (dayOpen === 'coffee')    { scores.ritualSeeker += 3; scores.flaneur += 1; scores.neighbourhoodLocal += 1; }
  if (dayOpen === 'breakfast') { scores.gastronaut += 2; scores.ritualSeeker += 1; scores.slowScholar += 1; }
  if (dayOpen === 'straight')  scores.efficientExplorer += 2;
  if (dayOpen === 'grab_go')   scores.efficientExplorer += 1;

  // ── Budget ─────────────────────────────────────────────────────────────────
  if (budget === 'budget')    scores.neighbourhoodLocal += 1;
  if (budget === 'luxury')    { scores.aesthete += 2; scores.gastronaut += 1; }
  if (budget === 'comfortable') scores.aesthete += 1;

  // ── Group ──────────────────────────────────────────────────────────────────
  if (group === 'solo')    { scores.flaneur += 1; scores.nightCreature += 1; scores.aesthete += 1; }
  if (group === 'family')  { scores.neighbourhoodLocal += 1; scores.ritualSeeker += 1; scores.nightCreature -= 2; }
  if (group === 'friends') scores.nightCreature += 2;

  // ── Compound signals ───────────────────────────────────────────────────────
  // Strong night creature signal: bars evening + late start
  if (evening === 'bars' && dayOpen !== 'coffee' && dayOpen !== 'breakfast') {
    scores.nightCreature += 2;
  }
  // Aesthete vs slowScholar tiebreaker: culture + balanced pace, not food-focused
  if (mood.includes('culture') && pace.includes('balanced') && !mood.includes('eat_drink')) {
    scores.aesthete += 2;
  }
  // Strong gastronaut: food primary AND market evening
  if (mood[0] === 'eat_drink' && (evening === 'markets' || evening === 'dinner_wind')) {
    scores.gastronaut += 2;
  }

  return (Object.entries(scores) as [PersonaKey, number][])
    .sort(([, a], [, b]) => b - a)[0][0];
}

/**
 * Legacy archetype key → new PersonaKey fallback.
 * Used when a stored persona has an old archetype string.
 */
export function legacyArchetypeToPersonaKey(archetype: string): PersonaKey {
  const map: Record<string, PersonaKey> = {
    explorer:      'flaneur',
    wanderer:      'flaneur',
    slowtraveller: 'neighbourhoodLocal',
    epicurean:     'gastronaut',
    historian:     'slowScholar',
    voyager:       'efficientExplorer',
    pulse:         'nightCreature',
  };
  return map[archetype] ?? 'flaneur';
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep persona-resolver
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/persona/persona-resolver.ts
git commit -m "feat(persona): multi-signal persona resolver scoring 8 personas from OB answers"
```

---

## Task 3: Rewrite PersonaScreen.tsx

**Files:**
- Modify: `frontend/src/modules/persona/PersonaScreen.tsx`

- [ ] **Step 1: Replace PersonaScreen.tsx entirely**

```tsx
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
  solo:   `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`,
  couple: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.2L12 21z"/></svg>`,
  family: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8.5" cy="6" r="2.5"/><circle cx="15.5" cy="6" r="2.5"/><circle cx="12" cy="16" r="2"/><path d="M3 19c0-3 2.5-5.5 5.5-5.5h1.5M21 19c0-3-2.5-5.5-5.5-5.5h-1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  group:  `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="7.5" r="2.5"/><circle cx="17" cy="7.5" r="2.5"/><circle cx="7" cy="16.5" r="2.5"/><circle cx="17" cy="16.5" r="2.5"/></svg>`,
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
    const t1 = setTimeout(() => setBeat(2), 1500);
    const t2 = setTimeout(() => setBeat(3), 4000);
    const t3 = setTimeout(() => { setBeat(4); setShowConfetti(true); }, 6500);
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
  const socialCtx = (rawAnswers?.group ?? 'solo') as 'solo' | 'couple' | 'family' | 'group';
  // 'friends' maps to 'group' messaging
  const socialKey = socialCtx === 'friends' ? 'group' : socialCtx;

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
        syncPersonaProfile(session.user.id, personaKey, def.name, rawAnswers).catch(console.warn);
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
            dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">${
              SOCIAL_ICONS[socialKey].replace(/<svg[^>]*>/, '').replace('</svg>', '')
            }</svg>` }}
          />
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
                key={chip}
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
                key={tag}
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "(PersonaScreen|persona-resolver|types)"
```

Expected: no errors.

- [ ] **Step 3: Visual smoke test — start dev server and open persona screen**

```bash
cd frontend && npm run dev
```

Navigate to persona screen, verify: hero image loads, headline in gradient text, social badge shows, place tags stagger in.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/persona/PersonaScreen.tsx
git commit -m "feat(persona): rewrite PersonaScreen with 8-persona system, header image, social context messaging"
```

---

## Task 4: Update rec-rules.ts

**Files:**
- Modify: `frontend/src/modules/route/rec-rules.ts`

- [ ] **Step 1: Update PersonaName type and PERSONA_REC_MAP**

```typescript
// frontend/src/modules/route/rec-rules.ts
type MealWindow   = { start: string; end: string; type: 'lunch' | 'dinner' };
type CoffeeWindow = { start: string; end: string };
type PaceName     = 'walker' | 'relaxed' | 'active' | 'default';
type PersonaName  =
  | 'flaneur' | 'gastronaut' | 'slowScholar' | 'neighbourhoodLocal'
  | 'efficientExplorer' | 'aesthete' | 'nightCreature' | 'ritualSeeker'
  // legacy keys kept for stored personas
  | 'epicurean' | 'explorer' | 'slowtraveller' | 'historian' | 'voyager' | 'wanderer' | 'pulse';

export const REC_RULES = {
  MEAL_WINDOWS: [
    { start: '11:30', end: '14:00', type: 'lunch'  },
    { start: '18:00', end: '21:00', type: 'dinner' },
  ] as MealWindow[],

  COFFEE_WINDOWS: [
    { start: '08:00', end: '11:00' },
    { start: '14:30', end: '17:00' },
  ] as CoffeeWindow[],

  MAX_DETOUR_METRES: {
    walker:  500, relaxed: 800, active: 1200, default: 600,
  } as Record<PaceName, number>,

  PERSONA_REC_MAP: {
    // ── New personas ──────────────────────────────────────────────────────────
    flaneur:            ['neighbourhood', 'park', 'hidden_gem', 'local_cafe'],
    gastronaut:         ['restaurant', 'food_market', 'street_food', 'wine_bar'],
    slowScholar:        ['museum', 'heritage', 'gallery', 'bookshop'],
    neighbourhoodLocal: ['cafe', 'local_bar', 'neighbourhood', 'bakery'],
    efficientExplorer:  ['viewpoint', 'landmark', 'park', 'hidden_gem'],
    aesthete:           ['gallery', 'architecture', 'design_museum', 'rooftop'],
    nightCreature:      ['bar', 'rooftop', 'live_music', 'night_market'],
    ritualSeeker:       ['cafe', 'market', 'cultural_event', 'local_institution'],
    // ── Legacy keys (fallback for stored personas) ────────────────────────────
    epicurean:          ['restaurant', 'food_market'],
    explorer:           ['viewpoint', 'park', 'hidden_gem'],
    slowtraveller:      ['cafe', 'bookshop', 'garden'],
    historian:          ['monument', 'museum', 'gallery'],
    voyager:            ['viewpoint', 'landmark', 'hidden_gem'],
    wanderer:           ['neighbourhood', 'park', 'local_cafe'],
    pulse:              ['bar', 'rooftop', 'live_music'],
  } as Record<PersonaName, string[]>,

  MIN_GAP_MINUTES:      30,
  MAX_BRANCHES_VISIBLE: 2,
} as const;
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep rec-rules
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/rec-rules.ts
git commit -m "feat(persona): expand PERSONA_REC_MAP to cover all 8 new personas"
```

---

## Task 5: Update pincard-persona.ts

**Files:**
- Modify: `frontend/src/modules/map/pincard-persona.ts`

- [ ] **Step 1: Update slow-pace badge logic — `profile.pace` doesn't exist on PersonaProfile**

The existing code has `if (profile.pace === 'slow' ...)` but `PersonaProfile` has no `pace` field — it uses `flexibility` instead. Fix this:

```typescript
// In computePersonaBadges(), replace the slow pace check:

    // 6. Slow-paced persona + museum/historic
    const isSlow = profile.flexibility >= 0.6;
    if (isSlow && (place.category === 'museum' || place.category === 'historic')) {
      badges.push({ text: '✓ Good for slow exploration', ...BADGE_INDIGO });
    }

    // 7. Night creature persona badge (bar venues)
    const isNightPersona = ['nightCreature', 'pulse'].includes(persona.archetype);
    if (isNightPersona && place.category === 'bar') {
      badges.push({ text: '✓ Fits your night style', ...BADGE_INDIGO });
    }

    // 8. Gastronaut persona + food venues
    const isFoodPersona = ['gastronaut', 'epicurean'].includes(persona.archetype);
    if (isFoodPersona && ['restaurant', 'food_market', 'street_food'].includes(place.category)) {
      badges.push({ text: '✓ Right up your street', ...BADGE_GREEN });
    }
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep pincard
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/pincard-persona.ts
git commit -m "feat(persona): update pincard badges for new persona keys and fix profile.pace bug"
```

---

## Task 6: Verify index.css has required keyframes

**Files:**
- Verify: `frontend/src/index.css`

- [ ] **Step 1: Check keyframes exist**

```bash
grep -n "persona-ring\|persona-confetti-cw\|persona-confetti-ccw" frontend/src/index.css
```

Expected output (all 3 should be present):
```
<line>: @keyframes persona-ring {
<line>: @keyframes persona-confetti-cw {
<line>: @keyframes persona-confetti-ccw {
```

If any are missing, add at end of file:

```css
/* ── Persona reveal animations ──────────────────────────── */
@keyframes persona-ring {
  0%   { transform: scale(0.3); opacity: 0.55; }
  100% { transform: scale(5.5); opacity: 0;    }
}
@keyframes persona-confetti-cw {
  0%   { transform: translateY(0)    translateX(0)     rotate(0deg);    opacity: 1; }
  18%  { opacity: 1; }
  100% { transform: translateY(82vh) translateX(-32px) rotate(-560deg); opacity: 0; }
}
@keyframes persona-confetti-ccw {
  0%   { transform: translateY(0)    translateX(0)    rotate(0deg);   opacity: 1; }
  18%  { opacity: 1; }
  100% { transform: translateY(82vh) translateX(32px) rotate(560deg); opacity: 0; }
}
```

- [ ] **Step 2: Full TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ built in X.Xs` with no errors.

---

## Task 7: Export persona-resolver from index.ts

**Files:**
- Modify: `frontend/src/modules/persona/index.ts`

- [ ] **Step 1: Check current exports and add resolver**

```bash
cat frontend/src/modules/persona/index.ts
```

Add `persona-resolver` export if not present:

```typescript
export { PersonaScreen }  from './PersonaScreen';
export { PersonaModal }   from './PersonaModal';
export { resolvePersonaKey, legacyArchetypeToPersonaKey } from './persona-resolver';
export type { PersonaKey, PersonaDefinition } from './types';
export { PERSONA_DEFINITIONS, ARCHETYPE_COLORS }          from './types';
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/persona/index.ts
git commit -m "feat(persona): export resolvePersonaKey and PersonaDefinition types from module index"
```

---

## Task 8: Commit remaining changes + push to prod

- [ ] **Step 1: Check git status**

```bash
cd /Users/souravbiswas/uncover-roads && git status --short
```

- [ ] **Step 2: Stage any unstaged persona/CSS files**

```bash
git add frontend/src/index.css frontend/src/modules/persona/
```

- [ ] **Step 3: Final build before push**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 4: Push to main → triggers Vercel deploy**

```bash
cd /Users/souravbiswas/uncover-roads && git push origin main
```

- [ ] **Step 5: Verify Vercel deployment**

```bash
cd /Users/souravbiswas/uncover-roads && gh run list --limit 3
```

Or check Vercel dashboard for deploy status.

---

## Self-Review

**Spec coverage:**
- ✅ 8 personas with unique colors, images, messaging
- ✅ Multi-signal resolver (mood × pace × evening × day_open × budget × group)
- ✅ Social context messaging (solo/couple/family/group) per persona
- ✅ No archetype label — behavioral statements only
- ✅ Header image with color-grade overlay
- ✅ Vibrant dual-color gradient system (primary + secondary)
- ✅ Per-tag stagger animation
- ✅ Confetti burst on reveal
- ✅ Beat 3 radial rings
- ✅ CTA shine sweep
- ✅ rec-rules.ts updated — personas flow into routing
- ✅ pincard-persona.ts updated — new badge logic for new keys
- ✅ Legacy archetype keys handled (backwards compat for stored personas)
- ✅ Push to prod via git push → Vercel

**Placeholder scan:** None found. All tasks have complete code.

**Type consistency:** `PersonaKey` defined in Task 1, used identically in Tasks 2, 3, 4, 5, 7.
