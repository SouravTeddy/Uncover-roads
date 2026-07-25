# Design System + Itinerary Reel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the full Uncover Roads design system from the HANDOFF.md and implement a new full-screen swipe-based Itinerary Reel with card-fan Trips view.

**Architecture:** Design tokens updated in `index.css` (single source of truth), shared UI components updated, new `ItineraryReelScreen` added as a full-screen snap-scroll experience with composable card types, `TripsScreen` replaced with a card-fan stack view per saved trip.

**Tech Stack:** React 18, Vite, Tailwind v4 (CSS-first), CSS animations (no external animation library), existing Zustand-like context store (`useAppStore`).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/index.css` | Modify | Update design tokens: gold primary, Cormorant Garamond, new shadow/radius vars |
| `index.html` | Modify | Add Cormorant Garamond to Google Fonts import |
| `src/shared/types.ts` | Modify | Add `'itinerary-reel'` to `Screen` type |
| `src/shared/store.tsx` | Modify | Add `reelSavedId` state field (which saved itinerary is playing, null = current) |
| `src/shared/ui/Button.tsx` | Modify | Update to gold gradient primary, new ghost/outline tokens |
| `src/shared/ui/BottomNav.tsx` | Modify | Update active state to gold, pill sizing matches HANDOFF |
| `src/modules/route/reel/types.ts` | Create | `ReelCard` discriminated union type |
| `src/modules/route/reel/reel-builder.ts` | Create | Pure fn: `engineItinerary + journey + persona + weather → ReelCard[]` |
| `src/modules/route/reel/reel-builder.test.ts` | Create | Tests for card sequencing and reco injection |
| `src/modules/route/reel/ReelIntroCard.tsx` | Create | Intro card component |
| `src/modules/route/reel/ReelStopCard.tsx` | Create | Stop card with why+consequence badge + swipe-to-remove |
| `src/modules/route/reel/ReelRecoCard.tsx` | Create | Recommendation card |
| `src/modules/route/reel/ReelTransitCard.tsx` | Create | City-change separator card |
| `src/modules/route/reel/ReelFinaleCard.tsx` | Create | Finale with save + collapse trigger |
| `src/modules/route/reel/ItineraryReelScreen.tsx` | Create | Container: snap-scroll, floating header, progress dots, undo toast |
| `src/modules/route/reel/index.ts` | Create | Re-exports |
| `src/modules/trips/TripsScreen.tsx` | Modify | Replace TripCard with card-fan design + play button |
| `src/modules/journey/JourneyScreen.tsx` | Modify | Build CTA navigates to `itinerary-reel` |
| `src/App.tsx` | Modify | Add `itinerary-reel` screen case |

---

## Task 1: Design Tokens + Fonts

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Update Google Fonts import in `index.html`**

Open `frontend/index.html`. Replace the existing `<link>` for fonts (or add if absent) so Cormorant Garamond is loaded alongside DM Sans:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update `@theme` block in `src/index.css`**

Replace the entire `@theme` block with:

```css
@theme {
  /* Backgrounds */
  --color-bg:         #0c0c0e;
  --color-bg2:        #111114;
  --color-surface:    #18181c;
  --color-surface2:   #1f1f24;

  /* Primary — warm amber/gold */
  --color-primary:    #d4a853;
  --color-primary-dk: #b8893a;
  --color-primary-bg: rgba(212,168,83,.10);
  --color-primary-glow: rgba(212,168,83,.22);

  /* Semantic accents */
  --color-sage:       #5a8a60;
  --color-sage-bg:    rgba(90,138,96,.12);
  --color-sage-bdr:   rgba(90,138,96,.28);
  --color-sky:        #4a7fa0;
  --color-sky-bg:     rgba(74,127,160,.12);
  --color-sky-bdr:    rgba(74,127,160,.28);
  --color-amber:      #b88c3a;
  --color-amber-bg:   rgba(184,140,58,.12);
  --color-amber-bdr:  rgba(184,140,58,.28);
  --color-cobalt:     #3b6bce;
  --color-cobalt-bg:  rgba(59,107,206,.12);
  --color-cobalt-bdr: rgba(59,107,206,.25);

  /* Text */
  --color-text-1:     #f2ede6;
  --color-text-2:     #a09888;
  --color-text-3:     #6a6058;
  --color-text-4:     #3e3830;

  /* Borders */
  --color-border:     rgba(242,237,230,.07);
  --color-border-m:   rgba(242,237,230,.13);
  --color-border-s:   rgba(242,237,230,.04);
  --color-divider:    rgba(242,237,230,.06);

  /* Shadows */
  --shadow-sm:        0 2px 12px rgba(0,0,0,.4);
  --shadow-md:        0 4px 28px rgba(0,0,0,.55);
  --shadow-lg:        0 16px 56px rgba(0,0,0,.7);
  --shadow-primary:   0 6px 28px rgba(212,168,83,.25);

  /* Fonts */
  --font-sans:        'DM Sans', sans-serif;
  --font-heading:     'Cormorant Garamond', serif;

  /* Nav bg */
  --nav-bg:           rgba(12,12,14,.92);
}
```

- [ ] **Step 3: Update light theme overrides and global resets**

Replace the `[data-theme=light]` block:

```css
[data-theme=light] {
  --color-bg:         #faf8f4;
  --color-bg2:        #f2ede5;
  --color-surface:    #ffffff;
  --color-surface2:   #f8f4ef;
  --color-text-1:     #2c2420;
  --color-text-2:     #6b5e57;
  --color-text-3:     #a09085;
  --color-text-4:     #c4b8b0;
  --color-border:     rgba(44,36,32,.08);
  --color-border-m:   rgba(44,36,32,.14);
  --color-divider:    rgba(44,36,32,.06);
  --color-primary-bg: rgba(212,168,83,.10);
  --shadow-md:        0 4px 24px rgba(44,36,32,.12);
  --nav-bg:           rgba(250,248,244,.94);
}
```

Update the global body/html reset to use new bg color:

```css
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: #0c0c0e;
  color: #f2ede6;
  font-family: 'DM Sans', sans-serif;
}
```

Add new keyframes needed by the reel (after existing keyframes):

```css
@keyframes fadeUp {
  0%   { transform: translateY(28px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}

@keyframes titleReveal {
  0%   { transform: translateY(48px) skewY(2deg); opacity: 0; }
  100% { transform: translateY(0)    skewY(0deg); opacity: 1; }
}

@keyframes glowPulse {
  0%, 100% { opacity: .6; }
  50%       { opacity: 1; }
}

@keyframes dotPop {
  0%   { transform: scale(0);    }
  70%  { transform: scale(1.3);  }
  100% { transform: scale(1);    }
}

@keyframes collapseToFan {
  0%   { transform: translateY(0) scale(1);    opacity: 1; }
  100% { transform: translateY(60px) scale(.1); opacity: 0; }
}
```

- [ ] **Step 4: Run dev server and visually verify no obvious breakage**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. The app should load with darker backgrounds and gold accent on buttons/nav. Check login, home, map screens for obvious regressions. It's okay if some text looks slightly off — full component updates come in later tasks.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "feat: apply design system tokens — gold primary, Cormorant Garamond, dark bg"
```

---

## Task 2: Shared UI Component Updates

**Files:**
- Modify: `src/shared/ui/Button.tsx`
- Modify: `src/shared/ui/BottomNav.tsx`

- [ ] **Step 1: Read current Button.tsx**

Read `src/shared/ui/Button.tsx` in full before editing.

- [ ] **Step 2: Update Button primary variant**

The primary button must use gold gradient, dark text, and gold shadow. Update the primary variant's className/style to:

```
background: linear-gradient(135deg, #d4a853, #b8893a)
color: #0c0c0e  (dark text on gold)
height: 54px default, borderRadius: 16px
boxShadow: 0 6px 28px rgba(212,168,83,.25)
font: DM Sans 700, 15px
press/active: scale(.97), shadow none
```

For the ghost variant:
```
background: transparent
border: 1px solid rgba(242,237,230,.07)
color: var(--color-text-2)
hover: background rgba(242,237,230,.06)
```

For the outline variant:
```
background: transparent
border: 1.5px solid var(--color-primary)
color: var(--color-primary)
hover: background var(--color-primary-bg)
```

- [ ] **Step 3: Update BottomNav**

Read `src/shared/ui/BottomNav.tsx` in full. Update the pill container and active tab styles to match HANDOFF:

```
container:
  background: rgba(12,12,14,.92)  (--nav-bg)
  backdropFilter: blur(20px)
  border: 1px solid rgba(242,237,230,.08)
  borderRadius: 999px
  padding: 6px 8px

active tab:
  background: var(--color-primary-bg)
  icon: filled variant, color var(--color-primary)
  label: var(--color-primary), font-weight 700

inactive tab:
  background: transparent
  icon: outlined, color var(--color-text-3)
  label: var(--color-text-3), font-weight 500

tab padding: 8px 14px, borderRadius 999px
icon size: 20px
label: 9px, 700 (active) / 500 (inactive), uppercase, letterSpacing .04em
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/ui/Button.tsx frontend/src/shared/ui/BottomNav.tsx
git commit -m "feat: update Button and BottomNav to gold design system"
```

---

## Task 3: Screen Type + Store Wiring

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/store.tsx`

- [ ] **Step 1: Add `itinerary-reel` to Screen type**

In `src/shared/types.ts`, find the `Screen` type and add `'itinerary-reel'`:

```typescript
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
  | 'ob8' | 'ob9'
  | 'persona'
  | 'destination'
  | 'map'
  | 'journey'
  | 'route'
  | 'itinerary-reel'   // ← add this
  | 'trips'
  | 'saved'
  | 'nav'
  | 'profile'
  | 'subscription';
```

- [ ] **Step 2: Add `reelSavedId` to AppState**

In `src/shared/store.tsx`, add to `AppState` interface:

```typescript
reelSavedId: string | null;  // null = playing current engineItinerary; string = replaying a saved trip
```

Add to `initialState`:

```typescript
reelSavedId: null,
```

Add action to `Action` type:

```typescript
| { type: 'SET_REEL_SAVED_ID'; id: string | null }
```

Add case to reducer:

```typescript
case 'SET_REEL_SAVED_ID':
  return { ...state, reelSavedId: action.id };
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.tsx
git commit -m "feat: add itinerary-reel screen type and reelSavedId store field"
```

---

## Task 4: Reel Card Types + Builder Logic

**Files:**
- Create: `src/modules/route/reel/types.ts`
- Create: `src/modules/route/reel/reel-builder.ts`
- Create: `src/modules/route/reel/reel-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/route/reel/reel-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildReelCards } from './reel-builder';
import type { EngineItinerary, WeatherData, JourneyLeg } from '../../../shared/types';

const STOP = (overrides = {}): import('../../../shared/types').EngineItineraryStop => ({
  id: 'stop-1',
  placeId: 'place-1',
  title: 'Test Place',
  area: 'Centre',
  day: 1,
  time: '09:00',
  durationMin: 90,
  category: 'museum',
  lat: 0,
  lon: 0,
  whyForYou: 'Matches your historian archetype',
  localTip: 'Go early',
  imageUrl: null,
  rating: null,
  priceLevel: null,
  openNow: null,
  weekdayText: null,
  orderReason: null,
  orderConsequence: null,
  movedFrom: null,
  ...overrides,
});

const WEATHER: WeatherData = { temp: 22, condition: 'sunny', icon: 'wb_sunny' };

const ITIN = (stops: ReturnType<typeof STOP>[]): EngineItinerary => ({
  id: 'itin-1',
  city: 'Paris',
  days: [{ city: 'Paris', date: '2026-05-20', stops }],
  summary: { pro_tip: '', total_places: stops.length },
  weights: {} as any,
});

describe('buildReelCards', () => {
  it('wraps stops in intro + stops + finale for single city', () => {
    const cards = buildReelCards(ITIN([STOP()]), null, null, WEATHER, 'explorer');
    expect(cards[0].type).toBe('intro');
    expect(cards[1].type).toBe('stop');
    expect(cards[cards.length - 1].type).toBe('finale');
  });

  it('injects a reco card at lunch window when no lunch stop exists', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' }),
      STOP({ id: 's2', time: '14:30', category: 'park' }),
    ];
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'epicurean');
    const recos = cards.filter(c => c.type === 'reco');
    expect(recos.length).toBeGreaterThan(0);
  });

  it('does not inject a reco card when a restaurant stop exists in lunch window', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' }),
      STOP({ id: 's2', time: '12:30', category: 'restaurant' }),
    ];
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'epicurean');
    const recos = cards.filter(c => c.type === 'reco');
    expect(recos.length).toBe(0);
  });

  it('inserts transit card between cities in multi-city journey', () => {
    const legs: JourneyLeg[] = [
      { type: 'transit', mode: 'train', from: 'Paris', to: 'Lyon', fromCoords: [0, 0], toCoords: [0, 0], durationMinutes: 120, distanceKm: 460 },
    ];
    const multiItin: EngineItinerary = {
      id: 'multi',
      city: 'Paris · Lyon',
      days: [
        { city: 'Paris', date: '2026-05-20', stops: [STOP({ id: 's1' })] },
        { city: 'Lyon', date: '2026-05-21', stops: [STOP({ id: 's2', day: 2 })] },
      ],
      summary: { pro_tip: '', total_places: 2 },
      weights: {} as any,
    };
    const cards = buildReelCards(multiItin, legs, null, WEATHER, 'explorer');
    const transit = cards.find(c => c.type === 'transit');
    expect(transit).toBeDefined();
    expect((transit as any).from).toBe('Paris');
    expect((transit as any).to).toBe('Lyon');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `types.ts`**

Create `src/modules/route/reel/types.ts`:

```typescript
import type { EngineItineraryStop, WeatherData } from '../../../shared/types';

export type ReelCardType = 'intro' | 'stop' | 'reco' | 'transit' | 'finale';

export interface ReelIntroCard {
  type: 'intro';
  city: string;
  imageUrl: string | null;
  totalStops: number;
  weather: WeatherData | null;
  proTip: string | null;
  persona: string;
}

export interface ReelStopCard {
  type: 'stop';
  stop: EngineItineraryStop;
  stopNumber: number;
  totalStops: number;
  // why + consequence from engine
  orderReason: string | null;
  orderConsequence: string | null;
  movedFrom: number | null;  // original position, null if not reordered
}

export interface ReelRecoCard {
  type: 'reco';
  trigger: 'lunch' | 'dinner' | 'coffee' | 'persona';
  label: string;         // "You haven't added lunch"
  consequence: string;   // "3 options near your next stop"
  nearbyCity: string;
  persona: string;
  afterStopId: string;   // which stop this follows
}

export interface ReelTransitCard {
  type: 'transit';
  mode: 'flight' | 'drive' | 'train' | 'bus';
  from: string;
  to: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  imageUrl: string | null;  // transport-type video/image
}

export interface ReelFinaleCard {
  type: 'finale';
  city: string;
  totalStops: number;
  persona: string;
}

export type ReelCard =
  | ReelIntroCard
  | ReelStopCard
  | ReelRecoCard
  | ReelTransitCard
  | ReelFinaleCard;
```

- [ ] **Step 4: Create `reel-builder.ts`**

Create `src/modules/route/reel/reel-builder.ts`:

```typescript
import type {
  EngineItinerary,
  EngineItineraryStop,
  JourneyLeg,
  WeatherData,
} from '../../../shared/types';
import { REC_RULES } from '../rec-rules';
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelTransitCard } from './types';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isInWindow(time: string, start: string, end: string): boolean {
  const t = timeToMinutes(time);
  return t >= timeToMinutes(start) && t <= timeToMinutes(end);
}

function hasMealInWindow(stops: EngineItineraryStop[], start: string, end: string): boolean {
  return stops.some(s => {
    const isMeal = s.category === 'restaurant' || s.category === 'cafe';
    return isMeal && isInWindow(s.time, start, end);
  });
}

/** Inject reco cards after stops that are followed by a meal-gap window */
function buildRecoCards(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
): Map<string, ReelRecoCard> {
  const recos = new Map<string, ReelRecoCard>();

  for (const window of REC_RULES.MEAL_WINDOWS) {
    if (hasMealInWindow(stops, window.start, window.end)) continue;

    // find the last stop before this window opens
    const beforeWindow = stops
      .filter(s => timeToMinutes(s.time) < timeToMinutes(window.start))
      .at(-1);
    if (!beforeWindow) continue;

    const label = window.type === 'lunch'
      ? "You haven't added lunch"
      : "No dinner planned yet";
    const consequence = `Options matching your taste near your next stop`;

    recos.set(beforeWindow.id, {
      type: 'reco',
      trigger: window.type,
      label,
      consequence,
      nearbyCity: city,
      persona,
      afterStopId: beforeWindow.id,
    });
  }

  return recos;
}

export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weather: WeatherData | null,
  persona: string,
): ReelCard[] {
  const cards: ReelCard[] = [];
  const allStops = itinerary.days.flatMap(d => d.stops);
  const stopCount = allStops.length;

  // Intro card
  cards.push({
    type: 'intro',
    city: itinerary.city,
    imageUrl: allStops[0]?.imageUrl ?? null,
    totalStops: stopCount,
    weather,
    proTip: itinerary.summary?.pro_tip ?? null,
    persona,
  });

  let globalStopNumber = 0;

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];

    // Transit separator between cities (multi-city trips)
    if (dayIdx > 0 && journeyLegs) {
      const prevCity = itinerary.days[dayIdx - 1].city;
      const transitLeg = journeyLegs.find(
        l => l.type === 'transit' &&
          (l as Extract<JourneyLeg, { type: 'transit' }>).from === prevCity &&
          (l as Extract<JourneyLeg, { type: 'transit' }>).to === day.city
      ) as Extract<JourneyLeg, { type: 'transit' }> | undefined;

      const transitCard: ReelTransitCard = {
        type: 'transit',
        mode: transitLeg?.mode ?? 'train',
        from: prevCity,
        to: day.city,
        durationMinutes: transitLeg?.durationMinutes ?? null,
        distanceKm: transitLeg?.distanceKm ?? null,
        imageUrl: null,
      };
      cards.push(transitCard);
    }

    const recos = buildRecoCards(day.stops, persona, day.city);

    for (const stop of day.stops) {
      globalStopNumber += 1;

      const stopCard: ReelStopCard = {
        type: 'stop',
        stop,
        stopNumber: globalStopNumber,
        totalStops: stopCount,
        orderReason: stop.orderReason ?? null,
        orderConsequence: stop.orderConsequence ?? null,
        movedFrom: stop.movedFrom ?? null,
      };
      cards.push(stopCard);

      // Inject reco after this stop if applicable
      if (recos.has(stop.id)) {
        cards.push(recos.get(stop.id)!);
      }
    }
  }

  // Finale card
  cards.push({
    type: 'finale',
    city: itinerary.city,
    totalStops: stopCount,
    persona,
  });

  return cards;
}
```

- [ ] **Step 5: Update `EngineItineraryStop` type to include new fields**

In `src/shared/types.ts`, find `EngineItineraryStop` and add these fields (they're optional — old itineraries won't have them):

```typescript
export interface EngineItineraryStop {
  // ... existing fields ...
  orderReason?: string | null;      // why engine put this stop here
  orderConsequence?: string | null; // consequence for the user
  movedFrom?: number | null;        // original index in user's pin order (null = not moved)
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```

Expected: PASS (4 tests green).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/route/reel/ frontend/src/shared/types.ts
git commit -m "feat: reel card types and builder logic with reco injection"
```

---

## Task 5: Individual Reel Card Components

**Files:**
- Create: `src/modules/route/reel/ReelIntroCard.tsx`
- Create: `src/modules/route/reel/ReelStopCard.tsx`
- Create: `src/modules/route/reel/ReelRecoCard.tsx`
- Create: `src/modules/route/reel/ReelTransitCard.tsx`
- Create: `src/modules/route/reel/ReelFinaleCard.tsx`

- [ ] **Step 1: Create `ReelIntroCard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { ReelIntroCard } from './types';
import type { WeatherData } from '../../../shared/types';

interface Props {
  card: ReelIntroCard;
  active: boolean;
}

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.5) 62%, rgba(0,0,0,.88) 82%, rgba(0,0,0,.97) 100%)';

function WeatherPill({ weather }: { weather: WeatherData }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: 'rgba(18,18,22,.75)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(242,237,230,.07)',
    }}>
      <span className="ms fill" style={{ fontSize: 14, color: '#4a7fa0' }}>{weather.icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.8)' }}>{weather.temp}°</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{weather.condition}</span>
    </div>
  );
}

export function ReelIntroCard({ card, active }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); } }, [active]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', flexShrink: 0 }}>
      {/* Background */}
      {card.imageUrl
        ? <img src={card.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0c0c0e, #1a1420)' }} />
      }
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* Content — bottom anchored */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 88px' }}>
        <p style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.55)', marginBottom: 8,
          animation: visible ? 'fadeUp .5s .05s both' : 'none',
        }}>Your day</p>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 48, fontWeight: 700,
          color: '#fff', lineHeight: 1, marginBottom: 16,
          animation: visible ? 'fadeUp .5s .15s both' : 'none',
        }}>{card.city}</h1>

        {/* Stats pills */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
          animation: visible ? 'fadeUp .5s .28s both' : 'none',
        }}>
          {[
            { icon: 'place', label: `${card.totalStops} stops` },
            { icon: 'wb_sunny', label: card.weather?.condition ?? 'Checking weather' },
            { icon: 'person', label: card.persona },
          ].map(pill => (
            <span key={pill.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.08)',
            }}>
              <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{pill.icon}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{pill.label}</span>
            </span>
          ))}
        </div>

        {card.proTip && (
          <p style={{
            fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6,
            animation: visible ? 'fadeUp .5s .38s both' : 'none',
          }}>{card.proTip}</p>
        )}

        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 24, animation: 'bounceIn .6s .6s both' }}>
          <span className="ms" style={{ fontSize: 20, color: 'rgba(255,255,255,.35)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ReelStopCard.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react';
import type { ReelStopCard } from './types';

interface Props {
  card: ReelStopCard;
  active: boolean;
  onRemove: (stopId: string) => void;
}

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.5) 62%, rgba(0,0,0,.88) 82%, rgba(0,0,0,.97) 100%)';

const REASON_ICONS: Record<string, string> = {
  opening_hours: 'schedule',
  golden_hour:   'wb_sunny',
  walking:       'directions_walk',
  crowd:         'groups',
  meal:          'restaurant',
  default:       'auto_fix_high',
};

function inferReasonIcon(reason: string | null): string {
  if (!reason) return REASON_ICONS.default;
  if (/hour|open|clos/i.test(reason)) return REASON_ICONS.opening_hours;
  if (/light|golden|sunset|sunrise/i.test(reason)) return REASON_ICONS.golden_hour;
  if (/walk|distance|km/i.test(reason)) return REASON_ICONS.walking;
  if (/crowd|busy|quiet/i.test(reason)) return REASON_ICONS.crowd;
  return REASON_ICONS.default;
}

export function ReelStopCard({ card, active, onRemove }: Props) {
  const [visible, setVisible] = useState(false);
  // Swipe-to-remove state
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }
    setVisible(false);
  }, [active]);

  // Touch handlers for swipe-to-remove
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -120));
  }
  function onTouchEnd() {
    setSwiping(false);
    if (swipeX < -80) {
      onRemove(card.stop.id);
    } else {
      setSwipeX(0);
    }
  }

  const { stop, stopNumber, totalStops, orderReason, orderConsequence, movedFrom } = card;

  return (
    <div
      ref={cardRef}
      style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', flexShrink: 0 }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background */}
      {stop.imageUrl
        ? <img src={stop.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${swipeX * 0.1}px)`, transition: swiping ? 'none' : 'transform .3s ease' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #111114, #1a1420)' }} />
      }
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* Delete reveal (left swipe) */}
      <div style={{
        position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
        opacity: Math.min(1, Math.abs(swipeX) / 80),
        transition: swiping ? 'none' : 'opacity .3s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ fontSize: 22, color: '#ef4444' }}>delete</span>
        </div>
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Remove</span>
      </div>

      {/* Card content — swipes with gesture */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${swipeX}px)`, transition: swiping ? 'none' : 'transform .3s cubic-bezier(.25,0,0,1)' }}>

        {/* Stop counter */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 80px',
        }}>

          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,.5)', marginBottom: 4,
            opacity: visible ? 1 : 0, transition: 'opacity .4s',
          }}>Stop {stopNumber} of {totalStops}</p>

          {/* Time + duration */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 8 }}>
            {stop.time}
            <span style={{ color: 'rgba(255,255,255,.4)', margin: '0 6px' }}>·</span>
            {stop.durationMin}min
          </p>

          {/* Place name */}
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 700,
            color: '#fff', lineHeight: 1.05, marginBottom: 12,
            animation: visible ? 'fadeUp .5s .12s both' : 'none',
          }}>{stop.title}</h2>

          {/* Quick pills */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12,
            animation: visible ? 'fadeUp .5s .2s both' : 'none',
          }}>
            <span style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(6px)', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
              {stop.category}
            </span>
            {stop.area && (
              <span style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(6px)', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
                {stop.area}
              </span>
            )}
            {movedFrom !== null && (
              <span style={{
                padding: '4px 9px', borderRadius: 999,
                background: 'rgba(212,168,83,.08)', border: '1px solid rgba(212,168,83,.18)',
                fontSize: 11, color: '#d4a853', fontWeight: 700,
              }}>↑ moved</span>
            )}
          </div>

          {/* Why + consequence badge */}
          {orderReason && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10,
              background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.08)',
              padding: '8px 12px', borderRadius: 12,
              animation: visible ? 'fadeUp .5s .25s both' : 'none',
            }}>
              <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', flexShrink: 0, marginTop: 1 }}>{inferReasonIcon(orderReason)}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                {orderReason}
                {orderConsequence && (
                  <> · <span style={{ color: 'rgba(255,255,255,.45)' }}>{orderConsequence}</span></>
                )}
              </span>
            </div>
          )}

          {/* Local tip */}
          {stop.localTip && (
            <p style={{
              fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              animation: visible ? 'fadeUp .5s .3s both' : 'none',
            }}>{stop.localTip}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ReelRecoCard.tsx`**

```tsx
import type { ReelRecoCard } from './types';

interface Props {
  card: ReelRecoCard;
  active: boolean;
}

export function ReelRecoCard({ card }: Props) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100dvh', flexShrink: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg, #0c0c0e, #0c1020)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '0 22px 88px',
    }}>
      {/* Transit strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.18)',
        padding: '7px 12px', borderRadius: 10,
      }}>
        <span className="ms" style={{ fontSize: 15, color: '#38bdf8' }}>near_me</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Near your next stop</span>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>
        While you're here
      </p>

      <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
        {card.label}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 20 }}>
        {card.consequence}
      </p>

      {/* Placeholder chip row — real data would come from a nearby API call */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['Best match', 'Near route', 'Open now'].map(tag => (
          <span key={tag} style={{
            padding: '6px 14px', borderRadius: 999,
            background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.22)',
            fontSize: 12, fontWeight: 600, color: 'rgba(167,139,250,.9)',
          }}>{tag}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `ReelTransitCard.tsx`**

```tsx
import type { ReelTransitCard } from './types';

interface Props { card: ReelTransitCard; active: boolean; }

const MODE_ICONS: Record<string, string> = {
  flight: 'flight', train: 'train', drive: 'directions_car', bus: 'directions_bus',
};

export function ReelTransitCard({ card }: Props) {
  const icon = MODE_ICONS[card.mode] ?? 'directions_transit';

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100dvh', flexShrink: 0,
      background: 'radial-gradient(ellipse at 50% 60%, #0c1020, #060c1a)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      {/* Visual dashed line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, width: '100%', maxWidth: 280 }}>
        <div style={{ flex: 1, height: 1, borderTop: '1.5px dashed rgba(212,168,83,.35)' }} />
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(74,127,160,.12)', border: '1px solid rgba(74,127,160,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms fill" style={{ fontSize: 22, color: '#4a7fa0' }}>{icon}</span>
        </div>
        <div style={{ flex: 1, height: 1, borderTop: '1.5px dashed rgba(212,168,83,.35)' }} />
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>
        Now travelling to
      </p>

      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 20 }}>
        {card.to}
      </h2>

      <div style={{ display: 'flex', gap: 10 }}>
        {card.durationMinutes && (
          <span style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(74,127,160,.12)', border: '1px solid rgba(74,127,160,.28)', fontSize: 12, color: '#4a7fa0', fontWeight: 600 }}>
            {card.durationMinutes >= 60 ? `${Math.floor(card.durationMinutes / 60)}h ${card.durationMinutes % 60}m` : `${card.durationMinutes}m`}
          </span>
        )}
        {card.distanceKm && (
          <span style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(242,237,230,.05)', border: '1px solid rgba(242,237,230,.07)', fontSize: 12, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>
            {card.distanceKm} km
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 16, fontStyle: 'italic' }}>
        Swipe to continue to {card.to}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create `ReelFinaleCard.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { ReelFinaleCard } from './types';

interface Props {
  card: ReelFinaleCard;
  active: boolean;
  onSave: () => void;
  saved: boolean;
}

const CONFETTI_COLORS = ['#d4a853', '#5a8a60', '#4a7fa0', '#8878b8', '#a06070'];

export function ReelFinaleCard({ card, active, onSave, saved }: Props) {
  const confettiRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!active || animating) return;
    setAnimating(true);
    if (!confettiRef.current) return;
    const wrap = confettiRef.current;
    wrap.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      const size = 6 + Math.random() * 8;
      el.style.cssText = `
        position:absolute; top:-20px;
        left:${Math.random() * 100}%;
        width:${size}px; height:${size}px;
        background:${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
        border-radius:${Math.random() > .5 ? '50%' : '2px'};
        opacity:${0.7 + Math.random() * .3};
        animation: confetti ${1.2 + Math.random() * 1.5}s ${Math.random() * .5}s linear forwards;
      `;
      wrap.appendChild(el);
    }
  }, [active]);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100dvh', flexShrink: 0,
      background: 'linear-gradient(to bottom, #0c0c0e, #111114)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      <div ref={confettiRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />

      <span className="ms fill" style={{
        fontSize: 64, color: '#facc15',
        filter: 'drop-shadow(0 0 20px rgba(250,204,21,.5))',
        animation: active ? 'bounceIn .5s cubic-bezier(.16,1,.3,1) both' : 'none',
        marginBottom: 16,
      }}>star</span>

      <h2 style={{
        fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 700, color: '#fff',
        textAlign: 'center', marginBottom: 8,
        animation: active ? 'fadeUp .5s .15s both' : 'none',
      }}>{card.city}, done.</h2>

      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 40,
        animation: active ? 'fadeUp .5s .25s both' : 'none',
      }}>{card.totalStops} stops · Saved to your trips</p>

      {/* Save CTA */}
      <button
        onClick={onSave}
        style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: saved ? '#16a34a' : 'linear-gradient(135deg, #d4a853, #b8893a)',
          color: saved ? '#fff' : '#0c0c0e',
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: saved ? '0 4px 20px rgba(22,163,74,.3)' : '0 6px 28px rgba(212,168,83,.25)',
          transition: 'background .3s ease, box-shadow .3s ease',
          marginBottom: 12,
          animation: active ? 'fadeUp .5s .35s both' : 'none',
        }}
      >
        <span className="ms fill" style={{ fontSize: 18 }}>{saved ? 'check_circle' : 'bookmark_add'}</span>
        {saved ? 'Saved to trips' : 'Save trip'}
      </button>

      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>
        Find it in Saved Trips · Tap play to relive it
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/
git commit -m "feat: reel card components — intro, stop, reco, transit, finale"
```

---

## Task 6: ItineraryReelScreen Container

**Files:**
- Create: `src/modules/route/reel/ItineraryReelScreen.tsx`
- Create: `src/modules/route/reel/index.ts`

- [ ] **Step 1: Create `ItineraryReelScreen.tsx`**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../../shared/store';
import { buildReelCards } from './reel-builder';
import { ReelIntroCard } from './ReelIntroCard';
import { ReelStopCard } from './ReelStopCard';
import { ReelRecoCard } from './ReelRecoCard';
import { ReelTransitCard } from './ReelTransitCard';
import { ReelFinaleCard } from './ReelFinaleCard';
import type { ReelCard } from './types';
import type { SavedItinerary } from '../../../shared/types';

const UNDO_DURATION = 3500;

export function ItineraryReelScreen() {
  const { state, dispatch } = useAppStore();
  const {
    engineItinerary, reelSavedId, savedItineraries,
    journey, weather, persona, personaProfile, city,
  } = state;

  // Resolve which itinerary we're playing
  const savedItem: SavedItinerary | null = reelSavedId
    ? savedItineraries.find(s => s.id === reelSavedId) ?? null
    : null;

  const activeItinerary = savedItem
    ? savedItem.itinerary as unknown as import('../../../shared/types').EngineItinerary
    : engineItinerary;

  const personaName = savedItem?.persona?.archetype_name
    ?? persona?.archetype_name
    ?? personaProfile?.archetype
    ?? 'Explorer';

  const [cards, setCards] = useState<ReelCard[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [removedStopIds, setRemovedStopIds] = useState<Set<string>>(new Set());
  const [undoPending, setUndoPending] = useState<{ id: string; label: string } | null>(null);
  const [saved, setSaved] = useState(!!savedItem);
  const scrollRef = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build reel cards whenever source data changes
  useEffect(() => {
    if (!activeItinerary) return;
    const built = buildReelCards(activeItinerary, journey ?? null, reelSavedId, weather, personaName);
    // Filter removed stops
    const filtered = built.filter(c => {
      if (c.type === 'stop') return !removedStopIds.has(c.stop.id);
      if (c.type === 'reco') return !removedStopIds.has(c.afterStopId);
      return true;
    });
    setCards(filtered);
  }, [activeItinerary, journey, weather, personaName, removedStopIds, reelSavedId]);

  // Snap-scroll observer to track active card
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      setActiveIdx(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRemove = useCallback((stopId: string) => {
    const stopCard = cards.find(c => c.type === 'stop' && (c as any).stop.id === stopId) as any;
    const label = stopCard?.stop.title ?? 'Stop';

    if (undoTimer.current) clearTimeout(undoTimer.current);

    setUndoPending({ id: stopId, label });
    setRemovedStopIds(prev => new Set([...prev, stopId]));

    undoTimer.current = setTimeout(() => {
      setUndoPending(null);
      // Trigger itinerary rebuild (dispatch to re-generate without this stop)
      dispatch({ type: 'SET_SELECTED_PLACES', places: state.selectedPlaces.filter(p => p.id !== stopId) });
      dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
      dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: null });
    }, UNDO_DURATION);
  }, [cards, dispatch, state.selectedPlaces]);

  const handleUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (undoPending) setRemovedStopIds(prev => { const s = new Set(prev); s.delete(undoPending.id); return s; });
    setUndoPending(null);
  }, [undoPending]);

  const handleSave = useCallback(() => {
    if (saved || !activeItinerary) return;
    const id = `reel-${Date.now()}`;
    dispatch({
      type: 'SAVE_ITINERARY',
      saved: {
        id,
        city: city || activeItinerary.city,
        date: new Date().toISOString(),
        travelDate: state.travelStartDate,
        cityLat: state.cityGeo?.lat ?? null,
        cityLon: state.cityGeo?.lon ?? null,
        selectedPlaces: state.selectedPlaces,
        itinerary: activeItinerary as any,
        persona: persona!,
        lastUpdateCheck: null,
        pendingSwapCards: [],
      },
    });
    setSaved(true);
  }, [saved, activeItinerary, city, dispatch, state, persona]);

  if (!activeItinerary) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="ms" style={{ fontSize: 32, color: 'rgba(255,255,255,.2)', animation: 'spin 1s linear infinite' }}>autorenew</span>
      </div>
    );
  }

  // Progress dots — only count stop + intro + finale (not reco, not transit)
  const dotCards = cards.filter(c => c.type !== 'reco' && c.type !== 'transit');
  const activeDotIdx = dotCards.indexOf(cards[activeIdx]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

      {/* Snap-scroll container */}
      <div
        ref={scrollRef}
        style={{
          width: '100%', height: '100%',
          overflowY: 'scroll', overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
        }}
        className="no-scrollbar"
      >
        {cards.map((card, idx) => {
          const isActive = idx === activeIdx;
          if (card.type === 'intro')    return <ReelIntroCard   key={idx} card={card} active={isActive} />;
          if (card.type === 'stop')     return <ReelStopCard    key={card.stop.id} card={card} active={isActive} onRemove={handleRemove} />;
          if (card.type === 'reco')     return <ReelRecoCard    key={`reco-${card.afterStopId}`} card={card} active={isActive} />;
          if (card.type === 'transit')  return <ReelTransitCard key={`transit-${card.from}-${card.to}`} card={card} active={isActive} />;
          if (card.type === 'finale')   return <ReelFinaleCard  key="finale" card={card} active={isActive} onSave={handleSave} saved={saved} />;
          return null;
        })}
      </div>

      {/* Floating header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        paddingTop: 48, paddingLeft: 16, paddingRight: 16, paddingBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,.52), transparent)',
        pointerEvents: 'none',
      }}>
        <button
          onClick={() => { dispatch({ type: 'SET_REEL_SAVED_ID', id: null }); dispatch({ type: 'GO_TO', screen: reelSavedId ? 'trips' : 'route' }); }}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', pointerEvents: 'all',
          }}
        >
          <span className="ms" style={{ fontSize: 18, color: '#fff' }}>arrow_back</span>
        </button>

        {/* Weather pill */}
        {weather && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(18,18,22,.75)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(242,237,230,.07)',
          }}>
            <span className="ms fill" style={{ fontSize: 14, color: '#4a7fa0' }}>{weather.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{weather.temp}°</span>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{
        position: 'fixed', right: 14, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 5, zIndex: 30,
        pointerEvents: 'none',
      }}>
        {dotCards.map((_, i) => (
          <div key={i} style={{
            borderRadius: 99,
            background: i === activeDotIdx ? '#fff' : 'rgba(255,255,255,.3)',
            width: i === activeDotIdx ? 5 : 4,
            height: i === activeDotIdx ? 18 : 4,
            transition: 'all .3s cubic-bezier(.25,0,0,1)',
          }} />
        ))}
      </div>

      {/* Undo toast */}
      {undoPending && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(18,18,22,.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(242,237,230,.07)',
          padding: '12px 18px', borderRadius: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          zIndex: 40, animation: 'springUp .35s both',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
            <strong style={{ color: '#fff' }}>{undoPending.label}</strong> removed
          </span>
          <button
            onClick={handleUndo}
            style={{ fontSize: 13, fontWeight: 700, color: '#d4a853', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `scroll-snap-align` via CSS class**

In `src/index.css`, add after the scrollbar hide rules:

```css
/* ── Reel snap alignment ──────────────────────────────── */
.reel-card {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  flex-shrink: 0;
}
```

Then add `className="reel-card"` to each card's root `<div>` in each card component (ReelIntroCard, ReelStopCard, etc.).

- [ ] **Step 3: Create `index.ts`**

```typescript
export { ItineraryReelScreen } from './ItineraryReelScreen';
```

- [ ] **Step 4: Wire into `App.tsx`**

Read `src/App.tsx`. Find the screen-switching logic (likely a switch/conditional rendering on `state.currentScreen`). Add:

```tsx
import { ItineraryReelScreen } from './modules/route/reel';
// ...
case 'itinerary-reel':
  return <ItineraryReelScreen />;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ frontend/src/index.css frontend/src/App.tsx
git commit -m "feat: ItineraryReelScreen — full-screen snap-scroll reel with progress dots and undo toast"
```

---

## Task 7: Journey Screen — Build CTA Navigation

**Files:**
- Modify: `src/modules/journey/JourneyScreen.tsx`

- [ ] **Step 1: Read current build CTA logic in JourneyScreen**

Read `src/modules/journey/JourneyScreen.tsx` lines 60–130 to find the `building` state and build button logic.

- [ ] **Step 2: Update navigation target**

In `JourneyScreen.tsx`, find where the build button navigates after the 800ms delay (currently goes to `'route'`). Change to `'itinerary-reel'`:

```tsx
// After the itinerary build completes:
setTimeout(() => {
  setBuilding(false);
  dispatch({ type: 'SET_REEL_SAVED_ID', id: null });
  dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
}, 800);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/journey/JourneyScreen.tsx
git commit -m "feat: build itinerary CTA navigates directly to itinerary-reel"
```

---

## Task 8: Trips Screen — Card Fan Design

**Files:**
- Modify: `src/modules/trips/TripsScreen.tsx`

- [ ] **Step 1: Read full TripsScreen.tsx**

Read `src/modules/trips/TripsScreen.tsx` in full.

- [ ] **Step 2: Replace TripCard with card-fan design**

Replace the `TripCard` function with this new version (keep all existing logic for `expanded`, `SmartUpdates`, `RecalibrationStack`, `ArrivalBanner` — those are unchanged):

```tsx
function TripCard({ item, index }: { item: SavedItinerary; index: number }) {
  const { dispatch } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [autoRunRecalibration, setAutoRunRecalibration] = useState(false);

  const archetypeKey    = item.persona?.archetype ?? '';
  const archetypeColors = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' };
  const archetypeEmoji  = ARCHETYPE_EMOJI[archetypeKey]  ?? '◆';
  const archetypeName   = ARCHETYPE_SHORT[archetypeKey]  ?? (item.persona?.archetype_name ?? archetypeKey);

  const stops    = (item.itinerary as any)?.days?.flatMap((d: any) => d.stops) ?? item.itinerary?.itinerary ?? [];
  const cityName = item.city;
  const date     = item.travelDate ? formatDate(item.travelDate) : formatDate(item.date);

  // Up to 3 card images for the fan
  const fanImages = stops
    .filter((s: any) => s.imageUrl ?? s.photo_ref)
    .slice(0, 3)
    .map((s: any) => s.imageUrl ?? null);
  // Pad with null if fewer than 3
  while (fanImages.length < 3) fanImages.unshift(null);

  function handlePlay() {
    dispatch({ type: 'SET_REEL_SAVED_ID', id: item.id });
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
  }

  const FAN_ROTATIONS = [-6, -3, 0];
  const FAN_TRANSLATE = [8, 4, 0];

  return (
    <div style={{ marginBottom: 32, animation: `cardEntry 0.4s ease ${index * 0.09}s both` }}>

      {/* Card fan */}
      <div style={{ position: 'relative', height: 240, marginBottom: 16 }}>
        {fanImages.map((img, i) => (
          <div
            key={i}
            onClick={i === 2 ? handlePlay : undefined}
            style={{
              position: 'absolute',
              width: 220, height: 280,
              top: 0, left: '50%', marginLeft: -110,
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,.7)',
              transform: `rotate(${FAN_ROTATIONS[i]}deg) translateY(${FAN_TRANSLATE[i]}px)`,
              zIndex: i + 1,
              cursor: i === 2 ? 'pointer' : 'default',
              transition: 'transform .4s cubic-bezier(.16,1,.3,1)',
            }}
          >
            {img
              ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${archetypeColors.glow}, rgba(255,255,255,.02))` }} />
            }
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.85))' }} />
            {i === 2 && (
              <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                  Stop 1
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {(stops[0] as any)?.title ?? cityName}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Trip meta */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)' }}>{cityName}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{date} · {stops.length} stops</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: `${archetypeColors.glow}`,
            border: `1px solid ${archetypeColors.primary}40`,
            color: archetypeColors.primary,
          }}>
            {archetypeEmoji} {archetypeName}
          </span>
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={handlePlay}
        style={{
          width: '100%', height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #d4a853, #b8893a)',
          color: '#0c0c0e', fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 28px rgba(212,168,83,.25)',
          marginBottom: 16,
        }}
      >
        <span className="ms fill" style={{ fontSize: 20 }}>play_arrow</span>
        Play Itinerary
      </button>

      {/* Stop list — expandable */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-3)' }}>
          {stops.length} stops in order
        </span>
        <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-3)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {stops.map((stop: any, i: number) => {
            const reason = stop.orderReason ?? stop.whyForYou ?? null;
            const consequence = stop.orderConsequence ?? null;
            const moved = stop.movedFrom !== null && stop.movedFrom !== undefined;
            return (
              <div key={stop.id ?? i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: i < stops.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-bg)',
                  border: '1px solid rgba(212,168,83,.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {stop.title ?? stop.place}
                    {moved && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', border: '1px solid rgba(212,168,83,.18)', padding: '1px 5px', borderRadius: 999 }}>↑ moved</span>}
                  </div>
                  {reason && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>
                      {reason}{consequence ? ` · ${consequence}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>{stop.time ?? ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart updates and recalibration (existing) */}
      <SmartUpdates item={item} onArrivalCheck={() => { setExpanded(true); setAutoRunRecalibration(true); }} />
      {expanded && <RecalibrationStack item={item} autoRun={autoRunRecalibration} onDone={() => setAutoRunRecalibration(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Verify the screen renders multiple trip cards without regression**

Start dev server and navigate to trips screen. Each trip should show the card fan, play button, and expandable stop list.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/trips/TripsScreen.tsx
git commit -m "feat: trips screen — card fan design with play button and stop list"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Apply full design system (tokens, fonts) | Task 1 |
| Button + BottomNav gold update | Task 2 |
| `itinerary-reel` screen type | Task 3 |
| Swipe-based full-bleed cards | Tasks 4–6 |
| Place image on background | ReelStopCard, ReelIntroCard |
| Weather in header | ItineraryReelScreen floating header |
| Why + consequence badge on stop cards | ReelStopCard (orderReason + orderConsequence) |
| Recommendation cards | ReelRecoCard + reel-builder injection |
| Multi-city transit separator | ReelTransitCard + reel-builder |
| `↑ moved` indicator | ReelStopCard movedFrom field |
| Swipe to remove + undo toast | ItineraryReelScreen handleRemove + toast |
| Finale saves itinerary | ReelFinaleCard onSave |
| Card fan in Trips | Task 8 TripCard rewrite |
| Play button opens reel from saved | TripCard handlePlay + reelSavedId |
| Stop list with why+consequence | TripCard expanded stop list |
| Build CTA → reel direct | Task 7 |

**Gaps found and resolved:**
- `EngineItineraryStop` needs `orderReason`, `orderConsequence`, `movedFrom` fields — added in Task 4 Step 5.
- `reel-card` CSS class for snap alignment — added in Task 6 Step 2.
- `reelSavedId` store field needed for saved-trip playback — added in Task 3.
