# Reel Frontend Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five frontend reel issues: reco card loading state (no forever spinner, proper error/empty feedback), intel card matching by `stopId` instead of fragile title substring, real scenic cards generated from walkable stop pairs (remove DEV-only gate), personalized balance card copy, and day divider time span.

**Architecture:** All changes in `frontend/src/modules/route/reel/`. No new files needed — modify existing components and `reel-builder.ts`. The `stopId` fix depends on the backend plan (Task 4 of `2026-06-02-reel-backend-enrichment.md`) having been deployed first.

**Tech Stack:** React/TypeScript, Vitest

---

### Task 1: Fix reco card loading state — timeout, error state, empty state

**Files:**
- Modify: `frontend/src/modules/route/reel/useReelRecommendations.ts`
- Modify: `frontend/src/modules/route/reel/ReelRecoCard.tsx`

**Context:** `useReelRecommendations` has no fetch timeout — if Railway is cold, the shimmer spins indefinitely. There's also no `error` state and no "no results found" feedback. When the fetch fails silently, the card just shows the trigger chip + headline with no explanation.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/route/reel/useReelRecommendations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReelRecommendations } from './useReelRecommendations';
import type { ReelRecoCard } from './types';
import * as api from '../../../shared/api';

const CARD: ReelRecoCard = {
  type: 'reco', id: 'c1', trigger: 'lunch', label: 'Lunch', consequence: 'x',
  nearbyCity: 'Bangalore', persona: 'explorer', afterStopId: 's1',
  stopLat: 12.97, stopLon: 77.59,
};

describe('useReelRecommendations', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns error=true when api throws', async () => {
    vi.spyOn(api.api, 'reelReco').mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('returns loading=false when api resolves empty', async () => {
    vi.spyOn(api.api, 'reelReco').mockResolvedValue([]);
    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.places).toEqual([]);
  });
});
```

Run:

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/useReelRecommendations.test.ts
```
Expected: FAIL — `error` property doesn't exist on hook result.

- [ ] **Step 2: Update `useReelRecommendations.ts` to add error state and fetch timeout**

Replace the entire file:

```typescript
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ReelRecoPlace } from '../../../shared/types';
import type { ReelRecoCard } from './types';

interface Result {
  places: ReelRecoPlace[];
  loading: boolean;
  error: boolean;
}

const FETCH_TIMEOUT_MS = 8000;

export function useReelRecommendations(
  card: ReelRecoCard,
  archetype: string,
  existingPlaceIds: string[],
  active: boolean,
): Result {
  const [places, setPlaces] = useState<ReelRecoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (!active || fetched.current) return;
    if (!card.stopLat || !card.stopLon) return;

    fetched.current = true;
    setLoading(true);
    setError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    api.reelReco({
      lat: card.stopLat,
      lon: card.stopLon,
      trigger: card.trigger,
      archetype,
      existingPlaceIds,
    })
      .then(setPlaces)
      .catch(() => {
        fetched.current = false; // allow retry on re-activation
        setError(true);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [active, card.id, card.stopLat, card.stopLon, card.trigger, archetype, existingPlaceIds]);

  return { places, loading, error };
}
```

- [ ] **Step 3: Add error and empty states to `ReelRecoCard.tsx`**

In `ReelRecoCard.tsx`, update the destructure of `useReelRecommendations`:

```typescript
const { places, loading, error } = useReelRecommendations(card, archetype, existingPlaceIds, active);
```

After the loading shimmer block (around line 154), add error and empty states:

```typescript
      {/* Error state */}
      {!loading && error && (
        <div style={{ padding: '14px 12px', borderRadius: 11, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: RECO_PLACE_ROWS_MB }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center', margin: 0 }}>
            Couldn't load nearby spots — check your connection.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && places.length === 0 && (
        <div style={{ padding: '14px 12px', borderRadius: 11, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: RECO_PLACE_ROWS_MB }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center', margin: 0 }}>
            No nearby spots found for this.
          </p>
        </div>
      )}
```

- [ ] **Step 4: Run all reel tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/useReelRecommendations.ts \
        frontend/src/modules/route/reel/ReelRecoCard.tsx \
        frontend/src/modules/route/reel/useReelRecommendations.test.ts
git commit -m "fix: reco card error/empty states and fetch timeout"
```

---

### Task 2: Fix intel card matching — use `stopId` instead of title substring

**Files:**
- Modify: `frontend/src/shared/types.ts:502-510` (`EngineMessage` interface)
- Modify: `frontend/src/modules/route/reel/types.ts:93-101` (`ReelIntelCard` interface)
- Modify: `frontend/src/modules/route/reel/reel-builder.ts:325-337` (`buildIntelCards`)
- Modify: `frontend/src/modules/route/reel/reel-builder.ts:544-548` (match filter in loop)
- Test: `frontend/src/modules/route/reel/reel-builder.test.ts`

**Context:** `buildIntelCards` creates `ReelIntelCard` objects, and in `buildReelCards` these are matched to stops via `ic.headline.toLowerCase().includes(stop.title.toLowerCase())`. This is fragile — it misses messages whose `what` text doesn't contain the exact stop title. After backend Task 4, messages carry `stopId` (the `place_id` of the anchor stop). Use that for matching.

**Dependency:** Backend plan Task 4 must be deployed before this task ships, or `stopId` will always be `null` (intel cards will float to end of day — acceptable fallback).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/modules/route/reel/reel-builder.test.ts`:

```typescript
it('intel card with stopId is anchored to matching stop', () => {
  const s1 = STOP({ id: 'stop-1', placeId: 'place-abc', title: 'Museum' });
  const s2 = STOP({ id: 'stop-2', placeId: 'place-xyz', title: 'Cafe', time: '13:00' });
  const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
  const itin = ITIN([s1, s2]);
  // Message anchored to s1's placeId — headline does NOT contain "Museum"
  day.messages = [{
    id: 'msg-1', type: 'insert', what: 'Added a rest break',
    why: 'Long gap', consequence: '30 min added',
    dismissable: true, stopId: 'place-abc',
  }];
  const cards = buildReelCards({ ...itin, days: [day] }, null, null, null, 'explorer');
  const intelCards = cards.filter(c => c.type === 'intel');
  expect(intelCards.length).toBe(1);
  // Intel card should appear BEFORE stop-2 card (i.e. anchored after stop-1)
  const stopIdx1 = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-1');
  const intelIdx = cards.findIndex(c => c.type === 'intel');
  const stopIdx2 = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-2');
  expect(intelIdx).toBeGreaterThan(stopIdx1);
  expect(intelIdx).toBeLessThan(stopIdx2);
});
```

Run:

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```
Expected: FAIL — new test fails because current matching is title-based.

- [ ] **Step 2: Add `stopId` to `EngineMessage` in `frontend/src/shared/types.ts`**

In the `EngineMessage` interface (around line 502), add `stopId` field:

```typescript
export interface EngineMessage {
  id: string
  type: 'swap' | 'insert' | 'resequence' | 'weather' | 'transit' | 'advisory' | 'event'
  what: string
  why: string
  consequence: string
  dismissable: boolean
  undo_action?: string
  stopId?: string | null    // place_id of anchor stop; null for day-level messages
}
```

- [ ] **Step 3: Add `stopId` to `ReelIntelCard` in `types.ts`**

```typescript
export interface ReelIntelCard {
  type: 'intel';
  id: string;
  messageType: 'swap' | 'insert' | 'resequence' | 'weather' | 'transit' | 'advisory' | 'evening' | 'culture';
  headline: string;
  detail: string;
  afterStopId: string | null;
  imageUrl: string | null;
  stopId: string | null;    // add this — place_id for per-stop anchoring
}
```

- [ ] **Step 4: Update `buildIntelCards` in `reel-builder.ts` to carry `stopId`**

In `buildIntelCards` (around line 325), update the map:

```typescript
function buildIntelCards(day: EngineItineraryDay, anchorImageUrl: string | null): ReelIntelCard[] {
  if (!day.messages?.length) return [];

  return day.messages.map(msg => ({
    type: 'intel' as const,
    id: msg.id,
    messageType: msg.type as ReelIntelCard['messageType'],
    headline: msg.what,
    detail: `${msg.why}${msg.consequence ? ' · ' + msg.consequence : ''}`,
    afterStopId: null,
    imageUrl: anchorImageUrl,
    stopId: msg.stopId ?? null,    // propagate from message
  }));
}
```

- [ ] **Step 5: Update intel card placement in `buildReelCards` to match by `stopId`**

In the stop loop in `buildReelCards`, replace the title-based filter (around line 544):

```typescript
      // Intel cards anchored to this stop by place_id — replace fragile title match
      const stopIntelCards = buildIntelCards(day, stopImageUrl).filter(
        ic => ic.stopId != null && ic.stopId === stop.placeId,
      );
      cards.push(...stopIntelCards);
```

And in the "unplaced intel" section after the loop (around line 556), update the already-placed check:

```typescript
    const allIntelIds = new Set(cards.filter(c => c.type === 'intel').map(c => (c as ReelIntelCard).id));
    const unplacedIntel = buildIntelCards(day, lastStopImage).filter(
      ic => !allIntelIds.has(ic.id),
    );
    cards.push(...unplacedIntel);
```

(This part is unchanged — unanchored intel still floats to end of day.)

- [ ] **Step 6: Run all reel tests and type check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/ && npx tsc --noEmit
```
Expected: all PASS, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/types.ts \
        frontend/src/modules/route/reel/types.ts \
        frontend/src/modules/route/reel/reel-builder.ts \
        frontend/src/modules/route/reel/reel-builder.test.ts
git commit -m "fix: intel card placement via stopId instead of title substring matching"
```

---

### Task 3: Remove DEV gate from scenic cards + generate from walkable stop pairs

**Files:**
- Modify: `frontend/src/modules/route/reel/reel-builder.ts`
- Test: `frontend/src/modules/route/reel/reel-builder.test.ts`

**Context:** All 6 scenic cards are hardcoded test data behind `if (import.meta.env.DEV)` — they never appear in production. Replace with a real generator: for each consecutive stop pair where haversine distance < 2km and `w_scenic >= 0.4`, emit a walk-spine card placed between the two stop cards.

- [ ] **Step 1: Write the failing test**

Add to `reel-builder.test.ts`:

```typescript
it('generates scenic walk card between close stops when w_scenic is high', () => {
  const s1 = STOP({ id: 'stop-1', lat: 12.97, lon: 77.59, time: '09:00', durationMin: 60 });
  // s2 is ~0.2km from s1 — well within walkable range
  const s2 = STOP({ id: 'stop-2', lat: 12.972, lon: 77.591, time: '11:00', durationMin: 60 });
  const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
  const itin = {
    ...ITIN([s1, s2]),
    days: [day],
    personaSnapshot: { ...DEFAULT_WEIGHTS, w_scenic: 0.7 },
  };
  const cards = buildReelCards(itin, null, null, null, 'explorer');
  const scenicCards = cards.filter(c => c.type === 'scenic');
  expect(scenicCards.length).toBeGreaterThanOrEqual(1);
  const s1Idx = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-1');
  const scenicIdx = cards.findIndex(c => c.type === 'scenic');
  const s2Idx = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-2');
  expect(scenicIdx).toBeGreaterThan(s1Idx);
  expect(scenicIdx).toBeLessThan(s2Idx);
});

it('does not generate scenic cards when w_scenic is low', () => {
  const s1 = STOP({ id: 'stop-1', lat: 12.97, lon: 77.59, time: '09:00' });
  const s2 = STOP({ id: 'stop-2', lat: 12.972, lon: 77.591, time: '11:00' });
  const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
  const itin = {
    ...ITIN([s1, s2]),
    days: [day],
    personaSnapshot: { ...DEFAULT_WEIGHTS, w_scenic: 0.2 },
  };
  const cards = buildReelCards(itin, null, null, null, 'explorer');
  const scenicCards = cards.filter(c => c.type === 'scenic');
  expect(scenicCards.length).toBe(0);
});

it('does not generate scenic cards between stops more than 2km apart', () => {
  const s1 = STOP({ id: 'stop-1', lat: 12.97, lon: 77.59, time: '09:00' });
  // s2 is ~5km away
  const s2 = STOP({ id: 'stop-2', lat: 13.02, lon: 77.59, time: '11:00' });
  const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
  const itin = {
    ...ITIN([s1, s2]),
    days: [day],
    personaSnapshot: { ...DEFAULT_WEIGHTS, w_scenic: 0.9 },
  };
  const cards = buildReelCards(itin, null, null, null, 'explorer');
  expect(cards.filter(c => c.type === 'scenic').length).toBe(0);
});
```

Run:

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```
Expected: FAIL — new tests fail; DEV gate blocks production scenic cards.

- [ ] **Step 2: Replace the DEV scenic block in `reel-builder.ts` with a real generator**

Remove the entire `if (import.meta.env.DEV)` block (lines ~394–441).

Add a new `buildScenicCards` function above `buildReelCards`:

```typescript
const SCENIC_ARCHETYPES = new Set(['flaneur', 'aesthete', 'slowscholar', 'naturelover']);

function buildScenicCards(
  stops: EngineItineraryStop[],
  persona: string,
  weights: EngineWeights,
): Array<ReelScenicCard & { _afterStopId: string }> {
  const archetypeLower = persona.toLowerCase().replace(/\s+/g, '');
  const threshold = SCENIC_ARCHETYPES.has(archetypeLower) ? 0.2 : 0.4;
  if (weights.w_scenic < threshold) return [];

  const results: Array<ReelScenicCard & { _afterStopId: string }> = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (distKm > 2.0) continue;

    const distLabel = distKm < 1
      ? `${Math.round(distKm * 1000)}m walk`
      : `${distKm.toFixed(1)} km walk`;
    const walkMins = Math.round((distKm / 5) * 60); // ~5km/h walking pace

    results.push({
      type: 'scenic',
      sceneType: 'walk',
      accent: '#c4b5fd',
      cardType: 'WALK SPINE',
      pos: results.length + 1,
      total: -1,
      timing: minutesToTime(timeToMinutes(a.time) + a.durationMin),
      metaRight: distLabel,
      place: `${a.area || a.title} → ${b.area || b.title}`,
      from: a.area || a.title,
      to: b.area || b.title,
      modeIcon: 'walk',
      tag: 'Walk',
      vizType: 'corridor',
      persona: archetypeLower,
      personaIcon: 'walk',
      why: `${distLabel} connecting ${a.title} and ${b.title}.`,
      sensory: `~${walkMins} min on foot.`,
      sensoryIcon: 'directions_walk',
      reelPos: `Between Stop ${i + 1} and Stop ${i + 2}`,
      photoUrl: null,
      _afterStopId: a.id,
    });
  }

  const total = results.length;
  return results.map((c, idx) => ({ ...c, pos: idx + 1, total }));
}
```

In `buildReelCards`, after calling `buildIntelCards` per-stop, add the scenic card for this stop:

```typescript
      // After: cards.push(stopCard);
      // After: const recos = recosByStop.get(stop.id);
      // After: if (recos) cards.push(...recos);
      
      // Scenic cards for the walk AFTER this stop
      const scenicForStop = scenicByStopId.get(stop.id);
      if (scenicForStop) cards.push(scenicForStop);
```

And before the day loop, build the scenic lookup map:

```typescript
  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];
    // ... (existing transit + divider card code)
    const sortedStops = [...day.stops].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );

    // Build scenic card lookup: stop.id → scenic card (placed after that stop)
    const dayScenic = buildScenicCards(sortedStops, persona, weights);
    const scenicByStopId = new Map<string, ReelScenicCard>(
      dayScenic.map(c => [c._afterStopId, c]),
    );
```

Remove `_afterStopId` from the type used in the Map — it's an internal field, not part of `ReelScenicCard`. Cast to `ReelScenicCard` when pushing:

```typescript
      if (scenicForStop) cards.push({ ...scenicForStop } as ReelScenicCard);
```

- [ ] **Step 3: Run all tests and type check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/ && npx tsc --noEmit
```
Expected: all PASS, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/reel-builder.ts \
        frontend/src/modules/route/reel/reel-builder.test.ts
git commit -m "feat: real scenic walk cards from walkable stop pairs, remove DEV gate"
```

---

### Task 4: Personalize balance card message

**Files:**
- Modify: `frontend/src/modules/route/reel/reel-builder.ts:563-567` (balance card block)
- Test: `frontend/src/modules/route/reel/reel-builder.test.ts`

**Context:** The balance card currently always shows `'Your day looks well-balanced for your style.'` regardless of persona, stop count, or category mix. The card appears when the engine ran but found zero reco gaps — a positive signal worth personalizing.

- [ ] **Step 1: Write the failing test**

Add to `reel-builder.test.ts`:

```typescript
it('balance card message varies by stop count', () => {
  const stops = [
    STOP({ id: 's1', time: '09:00', category: 'museum' }),
    STOP({ id: 's2', time: '11:00', category: 'restaurant' }),
    STOP({ id: 's3', time: '14:00', category: 'park' }),
  ];
  const day = DAY('Bangalore', '2026-06-10', stops);
  const itin = { ...ITIN(stops), days: [day] };
  const cards = buildReelCards(itin, null, null, null, 'explorer', new Map([[0, []]]));
  const balance = cards.find(c => c.type === 'balance') as any;
  expect(balance).toBeDefined();
  // Should mention stop count or categories — not the generic string
  expect(balance.message).not.toBe('Your day looks well-balanced for your style.');
  expect(typeof balance.message).toBe('string');
  expect(balance.message.length).toBeGreaterThan(5);
});
```

Run:

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```
Expected: FAIL — balance message still generic.

- [ ] **Step 2: Add `buildBalanceMessage` function to `reel-builder.ts`**

Add before `buildReelCards`:

```typescript
function buildBalanceMessage(
  persona: string,
  stopCount: number,
  categories: Set<string>,
): string {
  const hasFood = categories.has('restaurant') || categories.has('cafe');
  const hasCulture = categories.has('museum') || categories.has('gallery') || categories.has('historic');
  const hasNature = categories.has('park') || categories.has('viewpoint') || categories.has('beach');

  if (stopCount <= 2) return `A focused ${stopCount}-stop day — everything at your pace.`;
  if (hasCulture && hasFood && hasNature) return `Culture, food, and open space. A complete day.`;
  if (hasCulture && hasFood) return `${stopCount} stops — culture and meals balanced.`;
  if (hasNature && hasFood) return `${stopCount} stops — outdoor and food covered.`;
  if (hasFood) return `${stopCount} stops with meals built in.`;
  return `${stopCount} stops, well-paced for ${persona}.`;
}
```

- [ ] **Step 3: Use `buildBalanceMessage` in the balance card block**

Replace the balance card block (around line 563):

```typescript
  if (recosByDayIdx.size > 0 && allRecosCount === 0) {
    const allCategories = new Set(allStops.map(s => s.category));
    cards.push({
      type: 'balance',
      message: buildBalanceMessage(persona, stopCount, allCategories),
      persona,
    });
  }
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/reel-builder.ts \
        frontend/src/modules/route/reel/reel-builder.test.ts
git commit -m "feat: personalized balance card message based on stop count and category mix"
```

---

### Task 5: Add time span to day divider card

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts` (`ReelDayDividerCard`)
- Modify: `frontend/src/modules/route/reel/reel-builder.ts` (divider card construction)
- Modify: `frontend/src/modules/route/reel/ReelDayDividerCard.tsx`
- Test: `frontend/src/modules/route/reel/reel-builder.test.ts`

**Context:** The day divider card shows date, day number, city name, and stop count. Adding a time span (e.g. "9:00 AM → 7:30 PM") derived from the day's first and last stop times gives users a useful at-a-glance overview of the day ahead.

- [ ] **Step 1: Write the failing test**

Add to `reel-builder.test.ts`:

```typescript
it('day divider card includes startTime and endTime for multi-day itinerary', () => {
  const day1Stops = [STOP({ id: 's1', time: '09:00', durationMin: 90 })];
  const day2Stops = [
    STOP({ id: 's2', time: '10:00', durationMin: 120, day: 2 }),
    STOP({ id: 's3', time: '14:00', durationMin: 60, day: 2 }),
  ];
  const day1 = DAY('Bangalore', '2026-06-10', day1Stops, 1);
  const day2 = DAY('Bangalore', '2026-06-11', day2Stops, 2);
  const itin = {
    ...ITIN([...day1Stops, ...day2Stops]),
    days: [day1, day2],
  };
  const cards = buildReelCards(itin, null, null, null, 'explorer');
  const divider = cards.find(c => c.type === 'day_divider') as any;
  expect(divider).toBeDefined();
  expect(divider.startTime).toBe('10:00');   // first stop time on day 2
  expect(divider.endTime).toBe('15:00');     // last stop time + duration on day 2
});
```

Run:

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```
Expected: FAIL — `startTime`/`endTime` don't exist on divider card.

- [ ] **Step 2: Add `startTime` and `endTime` to `ReelDayDividerCard` in `types.ts`**

```typescript
export interface ReelDayDividerCard {
  type: 'day_divider';
  day: number;
  city: string;
  date: string;
  stopCount: number;
  startTime: string | null;  // "09:00" — first stop's scheduled time
  endTime: string | null;    // "18:30" — last stop's end time (time + duration)
}
```

- [ ] **Step 3: Populate `startTime` and `endTime` in `buildReelCards`**

In the divider card construction (around line 489):

```typescript
    if (day.day > 1) {
      const sortedForDivider = [...day.stops].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
      );
      const firstStop = sortedForDivider[0] ?? null;
      const lastStop = sortedForDivider.at(-1) ?? null;
      const endMin = lastStop
        ? timeToMinutes(lastStop.time) + lastStop.durationMin
        : null;

      const dividerCard: ReelDayDividerCard = {
        type: 'day_divider',
        day: day.day,
        city: day.city,
        date: day.date,
        stopCount: day.stops.length,
        startTime: firstStop?.time ?? null,
        endTime: endMin !== null ? minutesToTime(endMin) : null,
      };
      cards.push(dividerCard);
    }
```

- [ ] **Step 4: Render time span in `ReelDayDividerCard.tsx`**

After the `{card.stopCount} stops` line (around line 51), add:

```tsx
        {(card.startTime || card.endTime) && (
          <div style={{ fontSize: 10, color: 'var(--color-text-4)', marginTop: 4 }}>
            {card.startTime && fmt12h(card.startTime)}
            {card.startTime && card.endTime && ' → '}
            {card.endTime && fmt12h(card.endTime)}
          </div>
        )}
```

Add `fmt12h` helper at the top of `ReelDayDividerCard.tsx` (or import from a shared util if one exists):

```tsx
function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}
```

- [ ] **Step 5: Run all reel tests and type check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/ && npx tsc --noEmit
```
Expected: all PASS, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/types.ts \
        frontend/src/modules/route/reel/reel-builder.ts \
        frontend/src/modules/route/reel/ReelDayDividerCard.tsx \
        frontend/src/modules/route/reel/reel-builder.test.ts
git commit -m "feat: add day time span to day divider card"
```

---

### Final verification

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/ && npx tsc --noEmit
```

All tests pass. No TypeScript errors.
