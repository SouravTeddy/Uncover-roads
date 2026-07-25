# Screen Design Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all screens (excluding OB and Profile) to exact visual parity with the design spec in `docs/superpowers/specs/2026-04-28-full-ui-redesign-design.md`.

**Architecture:** Token-first fixes (font, Button) propagate to all screens for free. Screen-specific changes are then applied top-to-bottom in user flow order. No logic changes — visual/token fixes only.

**Tech Stack:** React + TypeScript + Tailwind v4 + CSS custom properties. CSS keyframe animations only (no Framer Motion additions). Amber/gold primary (#d4a853 / #b8893a) — kept from current token set.

---

## File Map

| File | Change |
|---|---|
| `src/index.css` | Fix `--font-heading` token |
| `src/shared/ui/Button.tsx` | CSS vars for primary gradient, height 52, fix ghost border |
| `src/modules/login/LoginScreen.tsx` | Floating icons + entry animation |
| `src/modules/login/WelcomeBackScreen.tsx` | Fix avatar ring color, add springUp entry |
| `src/modules/login/WalkthroughScreen.tsx` | CTA gradient → CSS vars |
| `src/modules/destination/ExploreSearchBar.tsx` | "Near me" button → warm tokens |
| `src/modules/trips/TripsScreen.tsx` | Replace fan card with flat 145px spec card |
| `src/modules/journey/JourneyScreen.tsx` | Build CTA → CSS vars, add grid SVG overlay |
| `src/modules/route/ItineraryStopCard.tsx` | Primary-bg var, staggered entry animation |
| `src/modules/route/ItineraryPlaceCard.tsx` | Primary-bg var, CTA gradient → CSS vars |

---

## Task 1: Fix `--font-heading` token

**Files:**
- Modify: `src/index.css` (line 47)

`index.html` loads **Playfair Display** but `--font-heading` points to `'Cormorant Garamond'` which is not loaded. Every heading falls back to the system serif. One character fix.

- [ ] **Step 1: Edit `src/index.css`**

Change line 47 from:
```css
  --font-heading:     'Cormorant Garamond', serif;
```
to:
```css
  --font-heading:     'Playfair Display', serif;
```

- [ ] **Step 2: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/index.css && git commit -m "fix: --font-heading token → Playfair Display (was Cormorant Garamond, not loaded)"
```

---

## Task 2: Fix `Button.tsx` — CSS vars + height

**Files:**
- Modify: `src/shared/ui/Button.tsx`

Primary gradient uses hardcoded `#d4a853, #b8893a` — breaks light mode. Ghost border uses hardcoded `rgba(242,237,230,.07)`. Height is 54 (spec says 52).

- [ ] **Step 1: Update `src/shared/ui/Button.tsx`**

Replace the `baseStyle` and `variantStyles` block (lines 11–47):

```tsx
const baseStyle: React.CSSProperties = {
  height: 52,
  borderRadius: 16,
  padding: '0 24px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  transition: 'transform 0.1s, box-shadow 0.1s',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
    color: '#ffffff',
    boxShadow: 'var(--shadow-primary)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-2)',
  },
  outline: {
    background: 'transparent',
    border: '1.5px solid var(--color-primary)',
    color: 'var(--color-primary)',
  },
  danger: {
    background: 'rgba(220,60,60,.12)',
    border: '1px solid rgba(239,68,68,.4)',
    color: '#f87171',
  },
};
```

- [ ] **Step 2: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/shared/ui/Button.tsx && git commit -m "fix(button): primary gradient → CSS vars, ghost border → color-border, height 54→52"
```

---

## Task 3: LoginScreen — floating icons + entry animation

**Files:**
- Modify: `src/modules/login/LoginScreen.tsx`

Missing: 9 Material Symbol icons rising from bottom with `floatUp` animation (defined in index.css). Also missing: entry animation on the main content block (opacity 0→1 + translateY(16px)→0).

- [ ] **Step 1: Update `src/modules/login/LoginScreen.tsx`**

The icons array and both the icons layer and the entry animation wrapper go inside the outer `div` return. Replace the return JSX starting at `return (` with:

```tsx
  const FLOAT_ICONS = [
    'explore', 'restaurant', 'directions_car', 'photo_camera',
    'hotel', 'map', 'flight', 'local_cafe', 'luggage',
  ];

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6 py-8"
      style={{
        background:
          "linear-gradient(rgba(15,12,10,.55), rgba(15,12,10,.96)), url('https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80') center/cover no-repeat",
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Floating background icons */}
      {FLOAT_ICONS.map((icon, i) => (
        <span
          key={icon}
          className="ms"
          style={{
            position: 'absolute',
            bottom: '-10%',
            left: `${8 + i * 10}%`,
            fontSize: 28,
            color: 'rgba(255,255,255,0.07)',
            animation: `floatUp ${7 + (i % 3)}s ease-in-out ${i * 0.9}s infinite`,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {icon}
        </span>
      ))}

      <div
        className="w-full max-w-[380px]"
        style={{ animation: 'cardEntry 0.6s ease both' }}
      >
```

Note: The `FLOAT_ICONS` constant must be placed **inside the component function body**, before the `return`. Place it right before `return (` at line ~72.

The rest of the JSX (brand mark, card, etc.) stays unchanged. Close the outer `div` at the end as before.

- [ ] **Step 2: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/login/LoginScreen.tsx && git commit -m "feat(login): floating icons with floatUp animation + entry animation on content"
```

---

## Task 4: WelcomeBackScreen — fix avatar ring + springUp entry

**Files:**
- Modify: `src/modules/login/WelcomeBackScreen.tsx`

Avatar ring uses hardcoded blue `rgba(99,130,246,.25), rgba(59,130,246,.1)`. Center content has no entry animation. Spec says: avatar circle in `--color-primary-bg`, springUp on center content.

- [ ] **Step 1: Fix avatar ring — line ~100**

Replace:
```tsx
            style={{
              boxShadow: '0 0 0 2px rgba(99,130,246,.25), 0 0 0 4px rgba(59,130,246,.1)',
            }}
```
With:
```tsx
            style={{
              boxShadow: '0 0 0 2px var(--color-primary-bg), 0 0 0 4px rgba(212,168,83,.06)',
            }}
```

- [ ] **Step 2: Add springUp to center content wrapper — line ~93**

Replace:
```tsx
      <div className="relative flex flex-col items-center gap-6 w-full max-w-[340px]">
```
With:
```tsx
      <div className="relative flex flex-col items-center gap-6 w-full max-w-[340px]" style={{ animation: 'springUp 0.55s cubic-bezier(.22,1,.36,1) both' }}>
```

- [ ] **Step 3: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/login/WelcomeBackScreen.tsx && git commit -m "fix(welcome-back): avatar ring → primary tint, add springUp entry animation"
```

---

## Task 5: WalkthroughScreen — CTA gradient → CSS vars

**Files:**
- Modify: `src/modules/login/WalkthroughScreen.tsx`

Each slide card has `ctaStyle: 'linear-gradient(135deg,#d4a853,#b8893a)'` hardcoded. These don't respond to CSS var changes (e.g. future token updates). Replace with the CSS var equivalents.

- [ ] **Step 1: Update ctaStyle in each slide card**

In `WalkthroughScreen.tsx`, find the slide definitions array (starts around line 10). There are 5 slides. For every slide whose `ctaStyle` is the amber gradient `linear-gradient(135deg,#d4a853,#b8893a)`, replace that value with `'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))'`.

The slides at index 0, 4 use the amber gradient — update both. Slides 1–3 use sky/amber/sage variants which are intentional per-slide accents — leave those unchanged.

Find and replace (there are 2 occurrences of `linear-gradient(135deg,#d4a853,#b8893a)`):
```
'linear-gradient(135deg,#d4a853,#b8893a)'
```
→
```
'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))'
```

- [ ] **Step 2: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/login/WalkthroughScreen.tsx && git commit -m "fix(walkthrough): primary CTA gradient → CSS vars"
```

---

## Task 6: ExploreSearchBar — warm "Near me" button

**Files:**
- Modify: `src/modules/destination/ExploreSearchBar.tsx`

The "Near me" button uses a blue/purple gradient (`rgba(108,143,255,0.16)`, `#8aa8ff`) — an old token. Spec says warm neutral: surface bg, border-color, text-2, location icon in text-3.

- [ ] **Step 1: Replace the "Near me" button styles in `ExploreSearchBar.tsx`**

Find the button (lines ~78–89):
```tsx
        <button
          onClick={useLocation}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 h-11 rounded-2xl text-xs font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgba(108,143,255,0.16), rgba(176,108,255,0.16))',
            border: '1px solid rgba(108,143,255,0.22)',
            color: '#8aa8ff',
          }}
        >
          <span className="ms text-sm">my_location</span>
          Near me
        </button>
```

Replace with:
```tsx
        <button
          onClick={useLocation}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 h-11 rounded-2xl text-xs font-semibold"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-m)',
            color: 'var(--color-text-2)',
          }}
        >
          <span className="ms text-sm" style={{ color: 'var(--color-text-3)' }}>my_location</span>
          Near me
        </button>
```

- [ ] **Step 2: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/destination/ExploreSearchBar.tsx && git commit -m "fix(search): Near me button → warm surface tokens"
```

---

## Task 7: TripsScreen — flat 145px spec card

**Files:**
- Modify: `src/modules/trips/TripsScreen.tsx`

Replace the `TripCard` component (fan design: 3 stacked rotated images + separate meta block + Play button) with the spec's flat 145px full-bleed card. The card is a single `div` with: city photo as background, gradient overlay `linear-gradient(160deg, rgba(20,16,12,.22) 0%, rgba(20,16,12,.8) 100%)`, Playfair city name 22px top-left, country/date/stops caption 11px below city, archetype badge top-right, "Continue trip" pill bottom-left with `play_arrow` icon.

Remove the `TripCountdown`, `SmartUpdates`, `ArrivalBanner`, `RecalibrationStack` components from the card — these move into an expandable drawer that toggles on tap of the card. The expandable drawer preserves this functionality.

- [ ] **Step 1: Replace `TripCard` in `src/modules/trips/TripsScreen.tsx`**

Delete the existing `TripCard` function (lines 24–208) and replace with:

```tsx
function TripCard({ item, index }: { item: SavedItinerary; index: number }) {
  const { dispatch } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [autoRunRecalibration, setAutoRunRecalibration] = useState(false);

  const archetypeKey    = item.persona?.archetype ?? '';
  const archetypeColors = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' };
  const archetypeEmoji  = ARCHETYPE_EMOJI[archetypeKey]  ?? '◆';
  const archetypeName   = ARCHETYPE_SHORT[archetypeKey]  ?? (item.persona?.archetype_name ?? archetypeKey);

  const days    = getDaysUntilTravel(item.travelDate);
  const isToday = days === 0;
  const isPast  = days !== null && days < 0;
  const hasUnresolved = (item.pendingSwapCards ?? []).some(c => !c.resolved);

  const stops = (item.itinerary as any)?.days?.flatMap((d: any) => d.stops) ?? item.itinerary?.itinerary ?? [];
  const cityName  = item.city;
  const country   = (item as any).country ?? '';
  const date      = item.travelDate ? formatDate(item.travelDate) : formatDate(item.date);

  // Pick the first stop with a photo for the card background
  const heroPhoto = stops.find((s: any) => s.imageUrl)?.imageUrl ?? null;

  function handlePlay() {
    dispatch({ type: 'SET_REEL_SAVED_ID', id: item.id });
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
  }

  function handleArrivalCheck() {
    setExpanded(true);
    setAutoRunRecalibration(true);
  }

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    height: 145,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 4,
    cursor: 'pointer',
    animation: `cardEntry 0.4s ease ${index * 0.09}s both`,
    background: heroPhoto
      ? `url('${heroPhoto}') center/cover no-repeat`
      : `linear-gradient(135deg, ${archetypeColors.glow}, rgba(20,16,12,1))`,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Main card */}
      <div style={cardStyle} onClick={() => setExpanded(e => !e)}>
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(20,16,12,.22) 0%, rgba(20,16,12,.80) 100%)',
        }} />

        {/* Top-left: city + caption */}
        <div style={{ position: 'absolute', top: 14, left: 16 }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700,
            color: '#fff', lineHeight: 1.1, marginBottom: 3,
          }}>
            {cityName}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>
            {[country, date, `${stops.length} stops${isPast ? ' · Completed' : ''}`].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Top-right: archetype badge */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 9px', borderRadius: 999,
          fontSize: 10, fontWeight: 700,
          background: archetypeColors.glow,
          border: `1px solid ${archetypeColors.primary}66`,
          color: archetypeColors.primary,
          backdropFilter: 'blur(6px)',
        }}>
          {archetypeEmoji} {archetypeName}
        </div>

        {/* Bottom-left: continue pill */}
        <div style={{
          position: 'absolute', bottom: 14, left: 16,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(255,255,255,.12)',
          backdropFilter: 'blur(8px)',
          fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.85)',
          border: '1px solid rgba(255,255,255,.15)',
        }} onClick={e => { e.stopPropagation(); handlePlay(); }}>
          <span className="ms fill" style={{ fontSize: 14 }}>play_arrow</span>
          Continue trip
        </div>
      </div>

      {/* Expandable drawer */}
      {expanded && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '12px 16px 16px',
          animation: 'springUp 0.3s ease both',
        }}>
          <TripCountdown travelDate={item.travelDate} />
          {isToday && !hasUnresolved && (
            <ArrivalBanner tripId={item.id} travelDate={item.travelDate} city={item.city} onCheckNow={handleArrivalCheck} />
          )}
          {!isToday && !isPast && item.travelDate && <SmartUpdates trip={item} />}
          {isToday && <RecalibrationStack trip={item} autoRun={autoRunRecalibration} />}

          {/* Stop list */}
          <div style={{ marginTop: 10 }}>
            {stops.map((stop: any, i: number) => {
              const moved = stop.movedFrom !== null && stop.movedFrom !== undefined;
              return (
                <div key={stop.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
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
                      {moved && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', border: '1px solid rgba(212,168,83,.18)', padding: '1px 5px', borderRadius: 999 }}>↑ moved</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{stop.time ?? ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

You also need to add `import React from 'react';` at the top if not already present (check — it may be imported via `useState`). The `React.CSSProperties` type requires the React import.

- [ ] **Step 2: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/trips/TripsScreen.tsx && git commit -m "feat(trips): replace fan card with flat 145px full-bleed spec card"
```

---

## Task 8: JourneyScreen — Build CTA vars + grid overlay

**Files:**
- Modify: `src/modules/journey/JourneyScreen.tsx`

Two fixes:
1. Build CTA uses hardcoded amber gradient — replace with CSS vars
2. Map panel (58% height div) is missing the spec's grid SVG overlay at 0.06 opacity

- [ ] **Step 1: Fix Build CTA gradient (around line 402)**

Find:
```tsx
              : { background: 'linear-gradient(135deg, #d4a853, #b8893a)', height: 50, borderRadius: 16, boxShadow: 'var(--shadow-primary)' }
```
Replace with:
```tsx
              : { background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))', height: 50, borderRadius: 16, boxShadow: 'var(--shadow-primary)' }
```

- [ ] **Step 2: Add grid overlay to map panel (around line 215)**

Find the map panel div (the one with `style={{ height: '58%', background: 'radial-gradient(...)' }}`). Inside it, immediately after the opening tag, add the grid overlay as the first child:

```tsx
        {/* Grid overlay */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="journey-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#journey-grid)" />
        </svg>
```

The map panel div already has `position: relative` implied by its children — ensure it has `position: 'relative'` in its style object so the absolute SVG is contained. If it doesn't, add `position: 'relative'` to that div's style.

- [ ] **Step 3: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/journey/JourneyScreen.tsx && git commit -m "fix(journey): Build CTA gradient → CSS vars, add grid SVG overlay on map panel"
```

---

## Task 9: ItineraryStopCard — primary-bg var + staggered entry

**Files:**
- Modify: `src/modules/route/ItineraryStopCard.tsx`

Time badge on line 25 uses hardcoded `rgba(224,120,84,.14)` instead of `var(--color-primary-bg)`. No staggered entry animation.

- [ ] **Step 1: Check component signature**

Read the top of `src/modules/route/ItineraryStopCard.tsx` to confirm the props interface. The `stopNumber` prop (number) already exists — use it for animation delay.

- [ ] **Step 2: Fix hardcoded rgba on time badge (line ~25)**

Find:
```tsx
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(224,120,84,.14)', padding: '2px 8px', borderRadius: 999, display: 'inline-block', marginBottom: 4 }}>
```
Replace:
```tsx
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '2px 8px', borderRadius: 999, display: 'inline-block', marginBottom: 4 }}>
```

- [ ] **Step 3: Add staggered entry animation**

Find the outermost wrapper div of the card. It should be something like:
```tsx
  return (
    <div className="px-4 mb-3">
```
Add the animation delay based on `stopNumber`:
```tsx
  return (
    <div
      className="px-4 mb-3"
      style={{
        opacity: 0,
        animation: 'cardEntry 0.4s ease both',
        animationDelay: `${(stopNumber - 1) * 0.08}s`,
      }}
    >
```

- [ ] **Step 4: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/route/ItineraryStopCard.tsx && git commit -m "fix(itinerary-stop): primary-bg CSS var on time badge, staggered cardEntry animation"
```

---

## Task 10: ItineraryPlaceCard — primary-bg var + CTA CSS vars

**Files:**
- Modify: `src/modules/route/ItineraryPlaceCard.tsx`

Two hardcoded values:
- Line 133: `rgba(212,168,83,.14)` on time badge → `var(--color-primary-bg)`
- Line 248: `#d4a853, #b8893a` on "Start navigating" CTA → CSS vars

- [ ] **Step 1: Fix time badge background (line ~133)**

Find:
```tsx
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(212,168,83,.14)', padding: '2px 8px', borderRadius: 999 }}>
```
Replace:
```tsx
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '2px 8px', borderRadius: 999 }}>
```

- [ ] **Step 2: Fix "Start navigating" CTA (line ~248)**

Find:
```tsx
        <Button variant="primary" className="w-full mt-4" style={{ background: 'linear-gradient(135deg, #d4a853, #b8893a)', height: 50, borderRadius: 16 }}>Start navigating</Button>
```
Replace:
```tsx
        <Button variant="primary" className="w-full mt-4" style={{ height: 50, borderRadius: 16 }}>Start navigating</Button>
```
(The `style` override for `background` is removed — `Button` now uses `var(--color-primary)` via Task 2.)

- [ ] **Step 3: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/route/ItineraryPlaceCard.tsx && git commit -m "fix(itinerary-place): primary-bg CSS var, remove hardcoded gradient from Start navigating CTA"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `--font-heading` fix → Task 1
- [x] Button.tsx tokens → Task 2
- [x] LoginScreen floating icons + entry → Task 3
- [x] WelcomeBackScreen avatar ring + springUp → Task 4
- [x] WalkthroughScreen CTA vars → Task 5
- [x] ExploreSearchBar Near me warm tokens → Task 6
- [x] TripsScreen flat card → Task 7
- [x] JourneyScreen CTA vars + grid overlay → Task 8
- [x] ItineraryStopCard primary-bg + animation → Task 9
- [x] ItineraryPlaceCard primary-bg + CTA fix → Task 10

**Screens confirmed already spec-compliant (no changes needed):**
- `DestinationScreen`: header, date label, avatar, city cards ✓
- `CitySearch` (search bar): h-50, rounded-18, wiggleFocus, primary focus border ✓
- `MapScreen` + `PinCard` + `SearchDropdown` + `FilterBar`: all use CSS vars ✓
- `RouteScreen`: header, day tabs, back button ✓
- `SubscriptionScreen` + `MiniPaywall`: amber Pro tier, sage check_circle, surface cards ✓
- `NavScreen`: surface tokens, font-heading ✓
- `JourneyScreen` map panel (radial gradient, pinPulse, dashed route) ✓
- `PersonaScreen` (OB done) ✓

**Placeholder scan:** None found.

**Type consistency:** `React.CSSProperties` used in Task 7 — ensure `import React from 'react'` exists in `TripsScreen.tsx`. Current file uses `useState` from React destructuring — may need to add `import React from 'react'` or use `import { useState } from 'react'` (already present on line 1) and type as `{ [key: string]: any }` instead, OR just inline styles without explicit type annotation (TypeScript infers from JSX).
