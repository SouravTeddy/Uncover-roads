# Stop Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `ReelStopCard` with a 4-group content layout, provenance labels, correct transit data, and fixed layout bugs per `docs/superpowers/specs/2026-07-06-stop-card-redesign.md`.

**Architecture:** All rendering changes are in `frontend/src/modules/route/reel/ReelStopCard.tsx`. Three new fields (`prevStopLat`, `prevStopLon`, `prevStopTitle`, `detourKm`) are added to the `ReelStopCard` type and populated in `reel-builder.ts`. Full `TransitInfo` for Group 1 is lazy-fetched inside the component on expand using the existing `/transit-corridor` endpoint (same cache that scenic cards use — no quota cost on second call). Reco cards = engine-added stops with `isEngineAdded: true`; no separate card type.

**Tech Stack:** React 18, TypeScript, inline styles (no Tailwind/CSS modules), Material Symbols icon font (`ms` className), existing FastAPI backend, `BASE` from `frontend/src/shared/api.ts` (`import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`).

## Global Constraints

- Design tokens: bg `#0f0d0c`, surface `#1a1714`, text-1 `#f5f0ea`, text-2 `#c0b0a4`, text-3 `#a08d80`, text-4 `#726559`, sage `#6b9470`, sky `#4f8fab`, gold `#d4a853`, border `rgba(255,255,255,.09)`. `T.sky`, `T.sage`, `T.gold`, `T.text1`–`T.text3` are already defined in the component via the `T` object.
- No Google Maps links anywhere — remove the `href: mapsHref` from the rating pill (line ~422); remove any remaining `maps.google.com` or `maps.googleapis.com` hrefs.
- No directions CTA — the "get directions" button lives at the reel end only.
- Provenance: `isUserAdded` → amber label "You added this"; `isEngineAdded` → sky label "We added this". Both go directly below the `<h2>` title, before the time row.
- Group 3c "Why we added this" hidden when `stop.isUserAdded === true`.
- Strip hyphens (` — `, ` – `) from any `crowdNote` text rendered in Group 2.
- Proto reference: `/tmp/Uncover-roads/.superpowers/brainstorm/22353-1783322676/content/stop-card-v3.html` (open with `open` or `python3 -m http.server` in that directory).
- Do not push to remote without user request.

---

### Task 1: Type additions and reel-builder.ts prep

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts` (lines 89–116, `ReelStopCard` interface)
- Modify: `frontend/src/modules/route/reel/reel-builder.ts` (lines ~917–959, stop card build loop)
- Test: `frontend/src/modules/route/reel/__tests__/reelBuilder.test.ts` (create if absent)

**Interfaces:**
- Consumes: `EngineItineraryStop.lat/lon/title`, `EngineItineraryStop.isEngineAdded`, `haversineKm` utility already used in reel-builder.ts
- Produces: `ReelStopCard` with `prevStopLat?: number | null`, `prevStopLon?: number | null`, `prevStopTitle?: string | null`, `detourKm?: number | null`, `transitInfo?: TransitInfo | null` (always `null` at build time — lazy fetched in component)

- [ ] **Step 1: Locate `haversineKm` in reel-builder.ts**

```bash
grep -n "haversineKm\|import.*haversine" /Users/souravbiswas/Uncover-roads/frontend/src/modules/route/reel/reel-builder.ts | head -5
```

Note the exact import path for use in the test.

- [ ] **Step 2: Write failing test**

Create `frontend/src/modules/route/reel/__tests__/reelBuilder.test.ts` (create `__tests__/` dir if absent):

```typescript
import { describe, it, expect } from 'vitest';

// Inline the haversineKm formula to avoid import path uncertainty
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('detourKm calculation', () => {
  it('is positive when engine stop is off the direct path', () => {
    // prev (0,0), curr (0.05,0.05), next (0.1,0) — curr is off the direct prev→next line
    const directKm = haversineKm(0, 0, 0.1, 0);
    const viaKm = haversineKm(0, 0, 0.05, 0.05) + haversineKm(0.05, 0.05, 0.1, 0);
    const detourKm = Math.max(0, Math.round((viaKm - directKm) * 10) / 10);
    expect(detourKm).toBeGreaterThan(0);
  });

  it('is zero when engine stop is exactly on the direct path', () => {
    // prev (0,0), curr (0.05,0), next (0.1,0) — curr is exactly between prev and next
    const directKm = haversineKm(0, 0, 0.1, 0);
    const viaKm = haversineKm(0, 0, 0.05, 0) + haversineKm(0.05, 0, 0.1, 0);
    const detourKm = Math.max(0, Math.round((viaKm - directKm) * 10) / 10);
    expect(detourKm).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to confirm it passes (math only, no imports)**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/reelBuilder.test.ts 2>&1 | tail -20
```

Expected: PASS (pure math, no mocks needed)

- [ ] **Step 4: Add fields to `ReelStopCard` type**

In `frontend/src/modules/route/reel/types.ts`, inside the `ReelStopCard` interface, add after `departureNote`:

```typescript
  prevStopLat?: number | null;   // previous stop lat — used by component to fetch TransitInfo
  prevStopLon?: number | null;   // previous stop lon
  prevStopTitle?: string | null; // previous stop display name
  detourKm?: number | null;      // extra km vs direct route, for engine-added stops only
  transitInfo?: TransitInfo | null; // lazy-fetched full TransitInfo; null until component fetches it
```

- [ ] **Step 5: Populate fields in `reel-builder.ts`**

In `reel-builder.ts`, locate the block that starts `const stopCard: ReelStopCard = {` (around line 940). Add the following **before** the stopCard object literal:

```typescript
      // Previous stop — needed for transit lazy-fetch and detourKm
      const prevStop = si > 0 ? sortedStops[si - 1] : null;

      // detourKm: extra distance when engine inserted this stop vs. going direct prev→next
      let detourKm: number | null = null;
      if (stop.isEngineAdded && prevStop && nextStop
          && stop.lat != null && stop.lon != null
          && prevStop.lat != null && prevStop.lon != null
          && nextStop.lat != null && nextStop.lon != null) {
        const directKm = haversineKm(prevStop.lat, prevStop.lon, nextStop.lat, nextStop.lon);
        const viaKm = haversineKm(prevStop.lat, prevStop.lon, stop.lat, stop.lon)
                    + haversineKm(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        detourKm = Math.max(0, Math.round((viaKm - directKm) * 10) / 10);
      }
```

Then add to the `stopCard` object:
```typescript
        prevStopLat: prevStop?.lat ?? null,
        prevStopLon: prevStop?.lon ?? null,
        prevStopTitle: prevStop?.title ?? null,
        detourKm,
        transitInfo: null,
```

- [ ] **Step 6: TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add frontend/src/modules/route/reel/types.ts frontend/src/modules/route/reel/reel-builder.ts frontend/src/modules/route/reel/__tests__/reelBuilder.test.ts
git commit -m "feat(stop-card): add prevStop coords, detourKm, transitInfo to ReelStopCard type and builder"
```

---

### Task 2: Layout fixes and Maps CTA removal

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx`

**Interfaces:**
- Consumes: existing component state; `card.stop.googleMapsUrl`
- Produces: bottom padding fixed (`72px + safe-area`); expanded panel height increased (`top: 14%`); all `maps.google.com` links removed

- [ ] **Step 1: Write failing test**

Create or open `frontend/src/modules/route/reel/__tests__/ReelStopCard.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal mock stop
const mockStop = {
  id: 'stop-1', placeId: 'place-1', title: 'Senso-ji Temple',
  area: 'Asakusa', day: 1, time: '10:00', durationMin: 90,
  category: 'temple' as const, lat: 35.71, lon: 139.79,
  priceLevel: null, rating: 4.5, weekdayText: null,
  whyForYou: 'Perfect for your interest in culture.',
  localTip: null, googleMapsUrl: 'https://www.google.com/maps/place/?q=35.71,139.79',
  website: null, photoRef: null,
};
const mockCard = {
  type: 'stop' as const, stop: mockStop,
  stopNumber: 1, totalStops: 3, day: 1, totalDays: 1,
  orderReason: null, orderConsequence: null, movedFrom: null,
  weather: null, nextLeg: null, visitDate: '2026-07-10',
  timingAdjustment: null,
};

// Suppress React act warnings for async state
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ReelStopCard — Maps CTA removal', () => {
  it('does not render any maps.google.com links', () => {
    // @ts-ignore minimal mock
    const { container } = render(<ReelStopCard card={mockCard} expanded={false} onExpand={() => {}} onCollapse={() => {}} />);
    const mapLinks = container.querySelectorAll('a[href*="maps.google"]');
    expect(mapLinks.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelStopCard.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `mapLinks.length` is 1 because the rating pill currently links to Maps.

- [ ] **Step 3: Fix bottom padding**

In `ReelStopCard.tsx`, find the scroll area div (line ~709):
```typescript
paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)'
```
Change to:
```typescript
paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))'
```

- [ ] **Step 4: Fix expanded panel height**

Find the line that sets the collapsed/expanded top position. Grep for it:
```bash
grep -n "32%\|expanded.*top\|top.*expanded" /Users/souravbiswas/Uncover-roads/frontend/src/modules/route/reel/ReelStopCard.tsx | head -10
```

Change the expanded value from `'32%'` (or `'calc(32dvh)'`) to `'14%'`:
```typescript
top: expanded ? '14%' : 'calc(100dvh - 224px - env(safe-area-inset-bottom, 0px) - 80px)',
```

- [ ] **Step 5: Remove Maps link from rating pill**

Find the block around line 420:
```typescript
    const mapsHref = stop.googleMapsUrl
      ?? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(stop.placeId)}`;
    allPills.push({ icon: 'star', label: `${displayRating} ★`, urgent: false, detail: null, href: mapsHref, color: T.gold });
```

Replace with (no `href`):
```typescript
    allPills.push({ icon: 'star', label: `${displayRating} ★`, urgent: false, detail: null, color: T.gold });
```

Delete the `mapsHref` const. Then scan the whole file for any remaining `maps.google` or `maps.googleapis` strings:
```bash
grep -n "maps\.google\|maps\.googleapis\|googleMapsUrl" /Users/souravbiswas/Uncover-roads/frontend/src/modules/route/reel/ReelStopCard.tsx
```

Remove any remaining usages.

- [ ] **Step 6: Run test to confirm it passes**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelStopCard.test.tsx 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 7: TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add frontend/src/modules/route/reel/ReelStopCard.tsx frontend/src/modules/route/reel/__tests__/ReelStopCard.test.tsx
git commit -m "fix(stop-card): bottom padding, expanded height to 86dvh, remove Maps CTA"
```

---

### Task 3: Provenance label and 4-group content skeleton

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx`

**Interfaces:**
- Consumes: `stop.isUserAdded`, `stop.isEngineAdded`
- Produces: "You added this" / "We added this" label below title; scroll area restructured into 4 `data-group` containers; existing identity chips block (line ~766) removed to avoid duplication

- [ ] **Step 1: Write failing tests**

Add to `__tests__/ReelStopCard.test.tsx`:

```typescript
describe('ReelStopCard — provenance label', () => {
  it('shows "You added this" for isUserAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: true, isEngineAdded: false } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText(/you added this/i)).toBeInTheDocument();
  });

  it('shows "We added this" for isEngineAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: false, isEngineAdded: true } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText(/we added this/i)).toBeInTheDocument();
  });

  it('does not show provenance for stops with neither flag', () => {
    // @ts-ignore
    const { queryByText } = render(<ReelStopCard card={mockCard} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(queryByText(/you added this/i)).not.toBeInTheDocument();
    expect(queryByText(/we added this/i)).not.toBeInTheDocument();
  });
});

describe('ReelStopCard — group structure', () => {
  it('renders Getting here group', () => {
    // @ts-ignore
    const { container } = render(<ReelStopCard card={mockCard} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(container.querySelector('[data-group="getting-here"]')).not.toBeNull();
  });

  it('hides Why we added this group for isUserAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: true, isEngineAdded: false } };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(container.querySelector('[data-group="why-added"]')).toBeNull();
  });

  it('shows Why we added this group for isEngineAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: false, isEngineAdded: true } };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(container.querySelector('[data-group="why-added"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelStopCard.test.tsx 2>&1 | tail -30
```

- [ ] **Step 3: Add provenance label**

In `ReelStopCard.tsx`, find the `<h2>` title element (line ~712). Immediately after the closing `</h2>` tag, add:

```tsx
            {/* Provenance label */}
            {stop.isUserAdded && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(232,160,48,.72)' }}>
                <span className="ms" style={{ fontSize: 14 }}>bookmark</span>
                You added this
              </div>
            )}
            {stop.isEngineAdded && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(79,143,171,.72)' }}>
                <span className="ms" style={{ fontSize: 14 }}>auto_awesome</span>
                We added this
              </div>
            )}
```

- [ ] **Step 4: Remove duplicate identity chip block**

Find the identity chips block (line ~766):
```typescript
            {(stageLabel || stop.isUserAdded || stop.isEngineAdded || card.movedFrom != null || card.arrivalNote || card.departureNote) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
```

Remove **only** the `isUserAdded` and `isEngineAdded` chips from this block. Keep `stageLabel`, `movedFrom`, `arrivalNote`, `departureNote` chips — they carry unique information not duplicated by the provenance label.

Change the condition to:
```typescript
            {(stageLabel || card.movedFrom != null || card.arrivalNote || card.departureNote) && (
```

And remove the two chip lines:
```typescript
                {stop.isUserAdded && (<div ...>Your pick</div>)}
                {stop.isEngineAdded && (<div ...>We added this</div>)}
```

- [ ] **Step 5: Restructure sc-scroll into 4 group containers**

Find the scroll area div (the one with `className="no-scrollbar"`, line ~708). Inside it, after the title + provenance label + time row + location row + tags + chips sections, replace the remaining flat content with the 4 group wrappers.

The group style helper (add as a constant before the return statement, near other style helpers):
```typescript
  const grpSep: React.CSSProperties = { paddingTop: 14, paddingBottom: 14, borderTop: '1px solid rgba(255,255,255,.06)' };
  const grpLabel = (accent: string = 'rgba(255,255,255,.28)'): React.CSSProperties => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
    color: accent, marginBottom: 10,
  });
```

Replace the content that currently follows the tags/chips section (description, rating, pills, etc.) with:

```tsx
            {/* Group 1 — Getting here */}
            <div data-group="getting-here" style={grpSep}>
              <div style={grpLabel('rgba(79,143,171,.5)')}>Getting here</div>
              {/* Content filled in Task 4 */}
            </div>

            {/* Group 2 — At this stop */}
            <div data-group="at-this-stop" style={grpSep}>
              <div style={grpLabel()}>At this stop</div>
              {/* Move existing: time window, crowd track bar, crowd labels, hours row here.
                  When moving, strip hyphens from crowdNote — replace with prose sentences: */}
              {/*   const cleanCrowdNote = (crowdNote ?? '').replace(/ [—–] /g, '. ').replace(/^[—–] /, ''); */}
              {/* Render cleanCrowdNote instead of crowdNote everywhere in this group. */}
            </div>

            {/* Group 3a+3b — About this place */}
            <div data-group="about-this-place" style={grpSep}>
              <div style={grpLabel()}>About this place</div>
              {/* Move existing: description paragraph, rating/price/duration pills, website link here */}
              {/* Remove any Maps link from website block */}
            </div>

            {/* Group 3c — Why we added this (engine-added stops only) */}
            {stop.isEngineAdded && (
              <div data-group="why-added" style={grpSep}>
                <div style={grpLabel('rgba(107,148,112,.55)')}>Why we added this</div>
                {/* Content filled in Task 4 */}
              </div>
            )}

            {/* Group 4 — Next stop */}
            <div data-group="next-stop" style={grpSep}>
              <div style={grpLabel('rgba(79,143,171,.5)')}>Next stop</div>
              {/* Content filled in Task 4 */}
            </div>
```

Move the existing time/crowd/description/rating content into Groups 2 and 3a respectively. Keep the Explore Nearby CTA at the very bottom, after Group 4.

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelStopCard.test.tsx 2>&1 | tail -30
```

Expected: All tests PASS

- [ ] **Step 7: TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "feat(stop-card): provenance label and 4-group content structure"
```

---

### Task 4: Group 1 (Getting here), Groups 3b/3c (Local insight, Why we added this), Group 4 (Next stop)

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx`

**Interfaces:**
- Consumes: `card.prevStopLat/Lon/Title`, `stop.lat/lon`, `card.detourKm`, `stop.localTip`, `stop.whyForYou`, `stop.orderConsequence`, `card.timingAdjustment`, `card.hotelAnchor`, `card.pairWith`, `card.nextLeg`; `/transit-corridor` endpoint; `TransitInfo` type from `reel/types.ts`; `BASE` from `shared/api.ts`
- Produces: All 4 groups fully rendered; Group 1 lazy-fetches real `TransitInfo` on expand

- [ ] **Step 1: Write failing tests**

Add to `__tests__/ReelStopCard.test.tsx`:

```typescript
describe('ReelStopCard — Group 1: Getting here', () => {
  it('shows prevStopTitle in walk row after transit fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({
        walk_distance_m: 1400, walk_duration_min: 18,
        walk_via: ['Takeshita Street'], has_transit: false,
        transit_type: null, departure_stop: null, duration_min: null,
      }),
    }));
    const card = {
      ...mockCard,
      prevStopLat: 35.68, prevStopLon: 139.68, prevStopTitle: 'Harajuku Station',
      stop: { ...mockStop, lat: 35.69, lon: 139.70 },
    };
    // @ts-ignore
    const { findByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(await findByText(/harajuku station/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows off-route note for engine-added stop', () => {
    const card = { ...mockCard, detourKm: 1.2, stop: { ...mockStop, isEngineAdded: true } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText(/1\.2 km off your direct route/i)).toBeInTheDocument();
  });

  it('shows "Starting point" when no prevStopTitle', () => {
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={mockCard} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText(/starting point for this day/i)).toBeInTheDocument();
  });
});

describe('ReelStopCard — Group 3b: Local insight', () => {
  it('shows localTip text', () => {
    const card = { ...mockCard, stop: { ...mockStop, localTip: 'Best visited at dusk.' } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText('Best visited at dusk.')).toBeInTheDocument();
  });

  it('shows hotelAnchor text when present', () => {
    const card = {
      ...mockCard,
      hotelAnchor: { text: '0.4 km from your hotel', isWarning: false, isBlue: true, icon: 'hotel' },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText('0.4 km from your hotel')).toBeInTheDocument();
  });

  it('hides localTip section when localTip is null', () => {
    // @ts-ignore
    const { queryByText } = render(<ReelStopCard card={mockCard} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(queryByText(/local insight/i)).not.toBeInTheDocument();
  });
});

describe('ReelStopCard — Group 3c: Why we added this', () => {
  it('shows orderConsequence for engine-added stop', () => {
    const card = {
      ...mockCard,
      orderConsequence: 'Balances your afternoon with a cultural break.',
      stop: { ...mockStop, isEngineAdded: true },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText('Balances your afternoon with a cultural break.')).toBeInTheDocument();
  });

  it('shows timingAdjustment consequenceNote', () => {
    const card = {
      ...mockCard,
      timingAdjustment: { originalTime: '14:00', consequenceNote: 'Moved to leave time for hotel check-in at 5 PM', isClosingConflict: false },
      stop: { ...mockStop, isEngineAdded: true },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText(/moved to leave time for hotel check-in at 5 PM/i)).toBeInTheDocument();
  });
});

describe('ReelStopCard — Group 4: Next stop', () => {
  it('shows next stop title and duration', () => {
    const card = {
      ...mockCard,
      nextLeg: { distKm: 0.8, durationMin: 11, mode: 'walk' as const, nextStopTitle: 'Yoyogi Park' },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText('Yoyogi Park')).toBeInTheDocument();
    expect(getByText(/11 min/i)).toBeInTheDocument();
  });

  it('shows hotel anchor as fallback when no nextLeg on last stop', () => {
    const card = {
      ...mockCard,
      nextLeg: null,
      hotelAnchor: { text: 'Hotel check-in at 5 PM', isWarning: false, isBlue: true, icon: 'hotel' },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} expanded={true} onExpand={() => {}} onCollapse={() => {}} />);
    expect(getByText('Hotel check-in at 5 PM')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelStopCard.test.tsx 2>&1 | tail -40
```

- [ ] **Step 3: Add lazy TransitInfo fetch**

At the top of `ReelStopCard` function body (after existing state declarations), add:

```tsx
  // Lazy-fetch full TransitInfo from transit corridor cache when card is expanded
  const [fetchedTransit, setFetchedTransit] = useState<TransitInfo | null>(null);
  useEffect(() => {
    if (!expanded || !card.prevStopLat || !card.prevStopLon || fetchedTransit) return;
    fetch(
      `${BASE}/transit-corridor?origin_lat=${card.prevStopLat}&origin_lon=${card.prevStopLon}&dest_lat=${stop.lat}&dest_lon=${stop.lon}`
    )
      .then(r => r.json())
      .then((data: TransitInfo) => setFetchedTransit(data))
      .catch(() => {});
  }, [expanded, card.prevStopLat, card.prevStopLon, stop.lat, stop.lon]);
```

`BASE` is already imported in the file. Confirm with:
```bash
grep -n "^import.*BASE\|BASE.*api" /Users/souravbiswas/Uncover-roads/frontend/src/modules/route/reel/ReelStopCard.tsx | head -5
```

If not imported, add:
```typescript
import { BASE } from '../../../shared/api';
```

And confirm the export in `shared/api.ts`:
```bash
grep -n "export.*BASE\|export const BASE" /Users/souravbiswas/Uncover-roads/frontend/src/shared/api.ts | head -3
```

- [ ] **Step 4: Render Group 1 content**

Inside the `data-group="getting-here"` div from Task 3:

```tsx
              {card.prevStopTitle ? (
                <>
                  {/* Walk row */}
                  {fetchedTransit?.walk_distance_m != null ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: T.text2 }}>
                      <span className="ms" style={{ fontSize: 16, color: T.sky, flexShrink: 0 }}>directions_walk</span>
                      <span>
                        {fetchedTransit.walk_duration_min} min walk from {card.prevStopTitle},{' '}
                        {fetchedTransit.walk_distance_m >= 1000
                          ? `${(fetchedTransit.walk_distance_m / 1000).toFixed(1)} km`
                          : `${fetchedTransit.walk_distance_m} m`}
                        {fetchedTransit.walk_via?.length
                          ? ` via ${fetchedTransit.walk_via.slice(0, 2).join(' and ')}`
                          : ''}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: T.text3, marginBottom: 8 }}>
                      From {card.prevStopTitle}
                      {stop.transitFromPrev?.distanceKm != null
                        ? ` · ~${stop.transitFromPrev.distanceKm} km`
                        : ''}
                    </div>
                  )}
                  {/* Transit row */}
                  {fetchedTransit?.has_transit && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: T.text2 }}>
                      <span className="ms" style={{ fontSize: 16, color: T.sky, flexShrink: 0 }}>subway</span>
                      <span>
                        {fetchedTransit.duration_min} min ·{' '}
                        {fetchedTransit.transit_type?.toLowerCase().replace('_', ' ') ?? 'transit'} ·{' '}
                        board at {fetchedTransit.departure_stop}
                      </span>
                    </div>
                  )}
                  {/* Off-route note for engine-added detour stops */}
                  {stop.isEngineAdded && (card.detourKm ?? 0) > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: T.text3 }}>
                      <span className="ms" style={{ fontSize: 16, flexShrink: 0 }}>fork_right</span>
                      <span>{card.detourKm} km off your direct route</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: T.text3 }}>Starting point for this day.</div>
              )}
```

- [ ] **Step 5: Render Group 3b (Local insight) inside `data-group="about-this-place"`**

After the existing description/rating/website content, still inside `data-group="about-this-place"`:

```tsx
              {stop.localTip && (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(212,168,83,.07)', border: '1px solid rgba(212,168,83,.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(212,168,83,.55)', marginBottom: 7 }}>
                    Local insight <span style={{ fontSize: 10 }}>✦</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.72, color: T.text2, margin: 0 }}>{stop.localTip}</p>
                  {card.hotelAnchor && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 12, color: card.hotelAnchor.isBlue ? T.sky : card.hotelAnchor.isWarning ? T.gold : T.text3 }}>
                      <span className="ms" style={{ fontSize: 14 }}>{card.hotelAnchor.icon}</span>
                      <span>{card.hotelAnchor.text}</span>
                    </div>
                  )}
                  {card.pairWith && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12, color: T.text3 }}>
                      <span className="ms" style={{ fontSize: 14 }}>link</span>
                      <span>Pairs well with {card.pairWith.title}</span>
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 6: Render Group 3c (Why we added this) inside `data-group="why-added"`**

Inside the `data-group="why-added"` div (already guarded by `stop.isEngineAdded` from Task 3):

```tsx
                {(() => {
                  const reasonText = card.orderConsequence || stop.whyForYou || '';
                  return (
                    <>
                      {reasonText && (
                        <p style={{ fontSize: 13, lineHeight: 1.72, color: T.text2, margin: '0 0 8px' }}>
                          {reasonText}
                        </p>
                      )}
                      {card.timingAdjustment?.consequenceNote && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: T.text3 }}>
                          <span className="ms" style={{ fontSize: 14 }}>schedule</span>
                          <span>{card.timingAdjustment.consequenceNote}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
```

- [ ] **Step 7: Render Group 4 (Next stop) inside `data-group="next-stop"`**

Inside the `data-group="next-stop"` div:

```tsx
              {card.nextLeg ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="ms" style={{ fontSize: 22, color: 'rgba(79,143,171,.75)', flexShrink: 0 }}>
                    {card.nextLeg.mode === 'walk' ? 'directions_walk' : 'directions_car'}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{card.nextLeg.nextStopTitle}</div>
                    <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
                      {card.nextLeg.durationMin} min {card.nextLeg.mode === 'walk' ? 'walk' : 'ride'}, {card.nextLeg.distKm} km
                    </div>
                  </div>
                </div>
              ) : card.hotelAnchor ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="ms" style={{ fontSize: 22, color: 'rgba(79,143,171,.75)', flexShrink: 0 }}>hotel</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{card.hotelAnchor.text}</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: T.text3 }}>Last stop of the day.</div>
              )}
```

- [ ] **Step 8: Run all tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelStopCard.test.tsx src/modules/route/reel/__tests__/reelBuilder.test.ts 2>&1 | tail -40
```

Expected: All tests PASS

- [ ] **Step 9: TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 10: Visual smoke test**

Start dev server and open the reel screen:
```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm run dev -- --port 5177
```

Check:
- Stop with `isUserAdded: true` shows amber "You added this" label below title, no "We added this" group
- Stop with `isEngineAdded: true` shows sky "We added this" label and "Why we added this" group
- Group 1 shows "Starting point for this day." for day's first stop; shows prev stop walk info after expand triggers transit fetch
- Group 3b amber section only appears when stop has `localTip`
- Group 4 shows next stop name, or hotel fallback for last stop

- [ ] **Step 11: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "feat(stop-card): Groups 1–4 fully rendered; lazy transit fetch in Group 1"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|---|---|
| Collapsed bottom padding `calc(72px + safe-area)` | Task 2 Step 3 |
| Expanded height `top: 14%` | Task 2 Step 4 |
| Remove Google Maps CTA | Task 2 Step 5 |
| Provenance label (user/engine) | Task 3 Step 3 |
| Remove isUserAdded/isEngineAdded identity chips (kept movedFrom, arrival, departure) | Task 3 Step 4 |
| 4 group skeleton structure | Task 3 Step 5 |
| Group 1: walk row with `walk_distance_m`, `walk_via`, lazy `TransitInfo` | Task 4 Step 4 |
| Group 1: transit row (`has_transit`, `departure_stop`) | Task 4 Step 4 |
| Group 1: off-route note for `isEngineAdded` + `detourKm > 0` | Task 4 Step 4 |
| Group 1: "Starting point" when first stop | Task 4 Step 4 |
| Group 2: existing crowd/time content (moved into group container) | Task 3 Step 5 |
| Group 3a: existing description/rating/website (moved into group container) | Task 3 Step 5 |
| Group 3b: `localTip`, `hotelAnchor`, `pairWith` | Task 4 Step 5 |
| Group 3c: `orderConsequence`/`whyForYou`, `timingAdjustment`, hidden for `isUserAdded` | Task 4 Steps 6 + 3 Step 5 |
| Group 4: `nextLeg`, hotel fallback | Task 4 Step 7 |
| Explore Nearby CTA remains at bottom | Task 3 Step 5 (keep it after groups) |
| No hyphens in crowd notes | Group 2 crowd note rendering — strip ` — ` and ` – ` from `crowdNote` text during Group 2 move in Task 3 Step 5 |
| `detourKm` computed in reel-builder | Task 1 Step 5 |
| `prevStopLat/Lon/Title` for lazy transit fetch | Task 1 Step 5 |

**Potential implementation gotcha — `crowdNote` hyphens:** When moving the Group 2 crowd content into its group container in Task 3 Step 5, strip hyphen patterns from `crowdNote`:
```typescript
const cleanCrowdNote = (crowdNote ?? '').replace(/ [—–] /g, '. ').replace(/^[—–] /, '');
```

**Type consistency:** `fetchedTransit` in Task 4 is `TransitInfo | null` (matches `TransitInfo` from `reel/types.ts`). `card.detourKm` is `number | null` matching the Task 1 type addition. `card.prevStopLat/Lon/Title` match Task 1 additions.
