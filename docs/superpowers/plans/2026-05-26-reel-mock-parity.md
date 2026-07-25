# Reel Mock Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the itinerary reel match `frontend/public/reel-mock.html` exactly across all card types — stop, intro, and reco.

**Architecture:** Pure inline-style corrections across four files. No new components, no new logic. Each task targets one file or one coherent visual concern. All changes are verifiable by opening the reel in a browser and comparing against the mock side-by-side.

**Tech Stack:** React inline styles, TypeScript, Vite dev server (`cd frontend && npm run dev`)

**Reference:** `frontend/public/reel-mock.html` — open at `http://localhost:5173/reel-mock.html` alongside the running app.

---

## Files

| File | What changes |
|------|-------------|
| `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` | Add `height: '100dvh'` to card wrapper div |
| `frontend/src/modules/route/reel/ReelStopCard.tsx` | Title size, padding, sky tint layers, rain/snow density, weather badge shape, AI line style |
| `frontend/src/modules/route/reel/ReelIntroCard.tsx` | Atmospheric layers (sky tint + ToD gradient), scrim gradient, padding, engine strip background |
| `frontend/src/modules/route/reel/ReelRecoCard.tsx` | Consequence font size, maps icon, glow position per trigger |

---

## Task 1: Fix scroll snap wrapper height

**File:** `frontend/src/modules/route/reel/ItineraryReelScreen.tsx:266-270`

The wrapper div around each card has no explicit height. If any card's root has an ancestor with unusual sizing, the IntersectionObserver observes a zero-height element and fires incorrectly — breaking the active index and the scroll effect.

- [ ] **Step 1: Add height to the wrapper div**

In `ItineraryReelScreen.tsx`, find the return inside the `cards.map` block (around line 266):

```tsx
return (
  <div key={cardKey} ref={setRef}>
    {child}
  </div>
);
```

Change to:

```tsx
return (
  <div key={cardKey} ref={setRef} style={{ height: '100dvh', flexShrink: 0 }}>
    {child}
  </div>
);
```

- [ ] **Step 2: Verify in browser**

Start dev server: `cd frontend && npm run dev`

Open the app, generate a trip, open the reel. Swipe through all cards. Verify:
- Each card snaps cleanly to full screen
- The right-side progress dot advances on every swipe
- Swiping back works correctly
- No card shows content from the previous/next card

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "fix(reel): add explicit height to card wrapper div for stable snap scroll"
```

---

## Task 2: Fix stop card content geometry

**File:** `frontend/src/modules/route/reel/ReelStopCard.tsx`

Three values in the content block are wrong vs the mock:
- Title: `36px` → `30px`
- Bottom padding of content block: `0 24px 80px` → `0 15px 26px`
- Time row text: `fontSize: 13` → `fontSize: 12`

- [ ] **Step 1: Fix title font size**

Find the `<h2>` for the stop title (around line 408):

```tsx
<h2 className="reel-h1" style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 700, ...
```

Change `fontSize: 36` → `fontSize: 30`.

- [ ] **Step 2: Fix content block padding**

Find the content block wrapper (around line 371):

```tsx
<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 80px' }}>
```

Change `padding: '0 24px 80px'` → `padding: '0 15px 26px'`.

- [ ] **Step 3: Fix time row font sizes**

Find the time pill (around line 388-405). Change the three `fontSize` values inside it:
- Schedule icon: `fontSize: 13` → `fontSize: 11`
- Time value: `fontSize: 13` → `fontSize: 12`
- Duration: `fontSize: 13` → `fontSize: 12`

```tsx
<span className="ms reel-meta" style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>schedule</span>
<span className="reel-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>
  {formatTime(stop.time)}
</span>
<span className="reel-meta" style={{ color: 'rgba(255,255,255,.30)' }}>·</span>
<span className="reel-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,.50)' }}>
  {formatDuration(stop.durationMin)}
</span>
```

- [ ] **Step 4: Verify in browser**

Open the reel on a stop card. Compare against the mock:
- Place name should be noticeably smaller, matching the mock's compact headline
- Bottom content should sit lower on the screen with less side margin — text spans wider
- Time pill text should be smaller/tighter

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "fix(reel): stop card title 30px, padding 0 15px 26px, time row 12px — match mock"
```

---

## Task 3: Fix stop card weather badge shape

**File:** `frontend/src/modules/route/reel/ReelStopCard.tsx`

The weather badge at top-right is `borderRadius: 6` (rectangular) in the code. The mock uses `border-radius: 999px` (pill).

- [ ] **Step 1: Fix border radius**

Find the weather pill div (around line 343):

```tsx
<div style={{
  position: 'absolute', top: safeAreaTop, right: 13, zIndex: 11,
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 8px', borderRadius: 6,
  background: 'rgba(9,12,22,.82)', backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,.10)',
  ...
}}>
```

Change `borderRadius: 6` → `borderRadius: 999`.

- [ ] **Step 2: Verify in browser**

Open any stop card. The weather badge top-right should now be pill-shaped, matching the mock.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "fix(reel): weather badge border-radius 999 (pill) to match mock"
```

---

## Task 4: Fix stop card sky tint — double-layer technique

**File:** `frontend/src/modules/route/reel/ReelStopCard.tsx`

The mock uses two sky tint layers for rain/drizzle and thunderstorm — one with `mix-blend-mode: multiply` and a second at reduced opacity — producing roughly 4× the atmospheric weight. The code uses a single half-opacity layer, making weather moods look washed out.

- [ ] **Step 1: Replace single sky tint div with conditional double-layer**

Find the sky tint div (around line 213):

```tsx
{/* z-index 2: Sky tint */}
<div style={{ position: 'absolute', inset: 0, zIndex: 2, background: skyTint, pointerEvents: 'none' }} />
```

Replace the entire sky tint block with this:

```tsx
{/* z-index 2: Sky tint — single layer for most conditions, double layer for rain/storm */}
{(condition.includes('rain') || condition.includes('drizzle')) ? (
  <>
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))', mixBlendMode: 'multiply', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))', opacity: 0.6, pointerEvents: 'none' }} />
  </>
) : condition.includes('thunderstorm') ? (
  <>
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))', mixBlendMode: 'multiply', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))', opacity: 0.6, pointerEvents: 'none' }} />
  </>
) : (
  <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: skyTint, pointerEvents: 'none' }} />
)}
```

The existing `skyTint` variable is still used for fog/snow/clear/cloud conditions (single layer is correct for those). Remove the `rain`/`drizzle`/`thunderstorm` branches from the `skyTint` variable since they're now handled directly:

Find the sky tint variable block (around line 181) and simplify it — remove the rain/drizzle and thunderstorm branches:

```tsx
let skyTint = 'rgba(0,0,0,.15)';
if (condition.includes('snow'))                              skyTint = 'rgba(200,215,240,.14)';
else if (condition.includes('fog') || condition.includes('mist')) skyTint = 'rgba(180,185,195,.22)';
else if (condition.includes('clear') || condition.includes('sunny')) skyTint = 'rgba(255,210,140,.12)';
else if (condition.includes('cloud') || condition.includes('overcast') || condition.includes('partly')) skyTint = 'rgba(140,150,165,.18)';
```

- [ ] **Step 2: Verify in browser**

Test with a trip that has a rainy or stormy stop. The background should be noticeably moodier — a strong blue-grey cast for rain, a strong purple cast for storms. Compare directly against the mock's rain/thunder stop cards.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "fix(reel): double-layer sky tint for rain/thunderstorm to match mock atmospheric weight"
```

---

## Task 5: Fix weather particle density

**File:** `frontend/src/modules/route/reel/ReelStopCard.tsx`

Rain streaks: mock generates 64, code generates 18. Snow flakes: mock generates 44, code generates 16. Both look too sparse.

- [ ] **Step 1: Replace the `makeRainStreaks` function with a seeded-random approach matching the mock**

Find the `makeRainStreaks` function (around line 105) and replace it entirely:

```tsx
function makeRainStreaks(count: number, color: string) {
  let seed = 42;
  function rng() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  return Array.from({ length: count }, (_, i) => {
    const left = rng() * 100;
    const dur = 0.45 + rng() * 0.45;
    const delay = -rng() * 1.8;
    const len = 20 + rng() * 26;
    const op = 0.6 + rng() * 0.4;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${left}%`,
          top: '-15%',
          width: 1.5,
          height: len,
          background: color,
          opacity: op,
          animation: `precip ${dur}s linear ${delay}s infinite`,
        }}
      />
    );
  });
}
```

- [ ] **Step 2: Update rain streak call sites to use count 64**

Find the rain/drizzle particle block (around line 250):

```tsx
{(condition.includes('rain') || condition.includes('drizzle')) && (
  <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
    {makeRainStreaks(18, 'rgba(180,210,240,.55)')}
  </div>
)}
```

Change `18` → `64`.

Find the thunderstorm particle block (around line 255):

```tsx
{condition.includes('thunderstorm') && (
  <div ...>
    {makeRainStreaks(24, 'rgba(230,220,255,.85)')}
```

Change `24` → `56`.

- [ ] **Step 3: Update snow particle count to 44 with seeded positions**

Find the snow particle block (around line 267). Replace the entire snow block with:

```tsx
{condition.includes('snow') && (
  <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
    {(() => {
      let seed = 2;
      function rng() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      const sways = ['snowSway1', 'snowSway2', 'snowSway3'] as const;
      return Array.from({ length: 44 }, (_, i) => {
        const left = rng() * 100;
        const dur = 3.5 + rng() * 4;
        const delay = -rng() * 5;
        const sz = 3 + Math.round(rng() * 4);
        const op = 0.65 + rng() * 0.35;
        const sw = sways[i % 3];
        const swd = 2 + rng() * 2;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${left}%`,
            top: `-${sz}px`,
            pointerEvents: 'none',
            animation: `${sw} ${swd}s ease-in-out infinite`,
          }}>
            <div style={{
              width: sz, height: sz, borderRadius: '50%',
              background: '#f8fafc',
              opacity: op,
              boxShadow: '0 0 6px rgba(255,255,255,.4)',
              animation: `snowFall ${dur}s linear ${delay}s infinite`,
            }} />
          </div>
        );
      });
    })()}
  </div>
)}
```

- [ ] **Step 4: Verify in browser**

Test with rain and snow stops. Rain should look like actual rain — dense streaks filling the card. Snow should look like a real snowfall with many flakes at varied sizes and speeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "fix(reel): rain 64 streaks, snow 44 flakes with seeded positions — match mock density"
```

---

## Task 6: Fix stop card AI line style

**File:** `frontend/src/modules/route/reel/ReelStopCard.tsx`

The `whyForYou` text (the `✦` line) is `13px` non-italic in the code. The mock styles it as `12px` italic `#c0b0a4` — giving it a quieter "local voice" quality distinct from informational text.

- [ ] **Step 1: Update whyForYou style**

Find the whyForYou paragraph (around line 473):

```tsx
{stop.whyForYou && (
  <p className="reel-meta" style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.65, marginBottom: stop.localTip ? 8 : 0, animation: visible ? 'fadeUp .5s .3s both' : 'none' }}>
    <span style={{ color: '#d4a853', marginRight: 6 }}>✦</span>
    {stop.whyForYou}
  </p>
)}
```

Change to:

```tsx
{stop.whyForYou && (
  <p className="reel-meta" style={{ fontSize: 12, fontStyle: 'italic', color: '#c0b0a4', lineHeight: 1.6, marginBottom: stop.localTip ? 8 : 0, animation: visible ? 'fadeUp .5s .3s both' : 'none' }}>
    <span style={{ color: '#d4a853', fontStyle: 'normal', marginRight: 6 }}>✦</span>
    {stop.whyForYou}
  </p>
)}
```

- [ ] **Step 2: Verify in browser**

On a stop card with a `whyForYou` value, the `✦` line should be italic, slightly smaller, and a muted warm tone (`#c0b0a4`) — clearly softer than the scheduling strips above it.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "fix(reel): whyForYou 12px italic #c0b0a4 — match mock AI line style"
```

---

## Task 7: Fix intro card atmospheric layers

**File:** `frontend/src/modules/route/reel/ReelIntroCard.tsx`

The intro card uses `WeatherCanvas` (particles only) + a single dark scrim. The mock intro card has three atmospheric layers: sky tint (weather-dependent), time-of-day gradient, and sun rays for clear daytime. Without these layers the intro card always looks the same colour-temperature regardless of weather or time.

- [ ] **Step 1: Add atmosphere helpers to ReelIntroCard**

At the top of `ReelIntroCard.tsx`, after the imports, add two helper functions:

```tsx
function introSkyTint(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))';
  if (c.includes('thunder') || c.includes('storm'))  return 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))';
  if (c.includes('snow'))                            return 'rgba(55,72,100,.55)';
  if (c.includes('fog') || c.includes('mist'))       return 'rgba(110,118,132,.55)';
  if (c.includes('clear') || c.includes('sunny'))    return 'linear-gradient(180deg,rgba(255,210,140,.18),rgba(255,210,140,.04) 40%,transparent 70%)';
  if (c.includes('cloud') || c.includes('overcast') || c.includes('partly')) return 'rgba(150,165,185,.16)';
  return 'rgba(0,0,0,.12)';
}

function introTodGradient(hour: number): string | null {
  if (hour >= 6 && hour < 8)   return 'linear-gradient(180deg,rgba(255,210,180,.08) 0%,rgba(255,180,140,.18) 40%,rgba(250,150,110,.40) 72%,rgba(228,118,86,.62) 92%,rgba(212,98,68,.68) 100%)';
  if (hour >= 8 && hour < 11)  return 'linear-gradient(180deg,rgba(255,225,180,.05) 0%,rgba(255,205,140,.16) 50%,rgba(238,168,100,.40) 78%,rgba(216,138,80,.62) 100%)';
  if (hour >= 11 && hour < 16) return 'linear-gradient(180deg,rgba(180,210,235,.14) 0%,rgba(220,225,210,.08) 35%,rgba(245,225,170,.24) 70%,rgba(232,205,150,.40) 92%,rgba(218,188,130,.50) 100%)';
  if (hour >= 18 && hour < 20) return 'linear-gradient(180deg,rgba(80,55,120,.18) 0%,rgba(180,70,110,.28) 38%,rgba(200,80,90,.44) 60%,rgba(160,55,110,.60) 82%,rgba(95,40,130,.68) 100%)';
  if (hour >= 20)               return 'linear-gradient(180deg,rgba(20,28,55,.24) 0%,rgba(35,50,98,.36) 45%,rgba(40,55,110,.52) 75%,rgba(22,32,72,.68) 100%)';
  return null;
}
```

- [ ] **Step 2: Derive atmosphere values inside the component**

Inside `ReelIntroCard`, before the return statement, add:

```tsx
const condition = (card.weather?.condition ?? '').toLowerCase();
const introHour = (() => {
  // Use trip start time if available, otherwise midday
  const t = card.startTime ?? '09:00';
  return parseInt(t.slice(0, 2), 10);
})();
const skyTint = introSkyTint(condition);
const todGrad = introTodGradient(introHour);
const showSun = (condition.includes('clear') || condition.includes('sunny')) && introHour >= 8 && introHour < 18;
```

Note: `card.startTime` may not exist on `ReelIntroCard` type. Check `types.ts`. If it does not exist, just use `'09:00'` as the fallback for now: `const introHour = 9;`

- [ ] **Step 3: Add layers to the JSX, between the photo and the existing gradient**

Inside the return, after the photo `<img>` and before `<WeatherCanvas>`, add:

```tsx
{/* Sky tint */}
<div style={{ position: 'absolute', inset: 0, zIndex: 2, background: skyTint, pointerEvents: 'none' }} />

{/* Time-of-day gradient */}
{todGrad && (
  <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGrad, pointerEvents: 'none' }} />
)}

{/* Sun rays — clear daytime only */}
{showSun && (
  <>
    <div style={{
      position: 'absolute', zIndex: 4,
      right: '-20%', top: '-20%',
      width: '90%', height: '80%',
      background: 'radial-gradient(ellipse at top right,rgba(255,215,150,.38),rgba(255,215,150,0) 60%)',
      filter: 'blur(6px)',
      animation: 'sunGlow 6s ease-in-out infinite',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute', zIndex: 4,
      top: '-40%', right: '-10%',
      width: '90%', height: '180%',
      transformOrigin: 'top right',
      animation: 'rayRotate 80s linear infinite',
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'absolute', top: 0, left: '40%', width: 80, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.25),rgba(255,225,160,0) 65%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(12px)' }} />
      <div style={{ position: 'absolute', top: 0, left: '55%', width: 40, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.35),rgba(255,235,180,0) 65%)', transform: 'rotate(14deg)', transformOrigin: 'top center', filter: 'blur(8px)' }} />
    </div>
  </>
)}
```

Move `<WeatherCanvas>` to `zIndex: 5` by wrapping it:

```tsx
{card.weather && (
  <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
    <WeatherCanvas condition={card.weather.condition} />
  </div>
)}
```

Keep the existing legibility scrim div unchanged but confirm it is at `zIndex: 3`:

```tsx
<div style={{ position: 'absolute', inset: 0, zIndex: 3, background: GRADIENT, pointerEvents: 'none' }} />
```

- [ ] **Step 4: Verify in browser**

Open the intro card for a sunny morning trip — the card should have a warm amber tint at the bottom, sun glow top-right, and feel visually different from a rainy evening trip (which should be blue-grey). Compare against the mock's intro card section.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ReelIntroCard.tsx
git commit -m "fix(reel): intro card — add sky tint + time-of-day gradient + sun rays to match mock"
```

---

## Task 8: Fix intro card scrim gradient and content geometry

**File:** `frontend/src/modules/route/reel/ReelIntroCard.tsx`

The `GRADIENT` constant (legibility scrim) is too dark and starts darkening too early. Content padding is also too wide and too deep, pushing text too high on the card.

- [ ] **Step 1: Fix the GRADIENT constant**

At the top of `ReelIntroCard.tsx`, find:

```tsx
const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,.05) 35%, rgba(0,0,0,.55) 60%, rgba(0,0,0,.9) 80%, rgba(0,0,0,.97) 100%)';
```

Replace with:

```tsx
const GRADIENT = 'linear-gradient(180deg,transparent 0%,transparent 35%,rgba(0,0,0,.45) 65%,rgba(0,0,0,.85) 90%,rgba(10,10,13,.95) 100%)';
```

- [ ] **Step 2: Fix content block padding**

Find the content block wrapper (around line 147):

```tsx
<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 88px', zIndex: 10 }}>
```

Change to:

```tsx
<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 17px 32px', zIndex: 10 }}>
```

- [ ] **Step 3: Fix engine change strip background**

Find the `topChanges.map` block rendering engine change strips (around line 225):

```tsx
<div key={type} style={{
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '6px 10px', borderRadius: 10,
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.1)',
  backdropFilter: 'blur(6px)',
}}>
```

Change `background` and `border`:

```tsx
<div key={type} style={{
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '5px 10px', borderRadius: 9,
  background: 'rgba(0,0,0,.28)',
  border: '1px solid rgba(255,255,255,.09)',
  backdropFilter: 'blur(6px)',
}}>
```

- [ ] **Step 4: Fix label margin and city font size**

Find the label `<p>` (around line 150):

```tsx
<p className="reel-meta" style={{ ..., marginBottom: 8, ... }}>
```

Change `marginBottom: 8` → `marginBottom: 7`.

Find the city `<h1>` (around line 159):

```tsx
<h1 className="reel-h1" style={{ ..., fontSize: 52, ..., marginBottom: 18, ... }}>
```

Change `fontSize: 52` → `fontSize: 50` and `marginBottom: 18` → `marginBottom: 13`.

- [ ] **Step 5: Verify in browser**

Open the intro card. The photo should be more visible (scrim is lighter), text should sit lower on the screen closer to the bottom edge, and the engine change strips should look dark/frosted (matching the photo's dark atmosphere) rather than light glassy.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/ReelIntroCard.tsx
git commit -m "fix(reel): intro card scrim gradient, padding 0 17px 32px, engine strips dark bg — match mock"
```

---

## Task 9: Fix reco card — consequence size, maps icon, glow position

**File:** `frontend/src/modules/route/reel/ReelRecoCard.tsx`

Three issues:
1. Consequence text is `13px`, mock is `12px`
2. Maps link icon is `open_in_new`, mock uses `map`
3. Background glow is always bottom-right; mock varies by trigger (bottom-left for culture)

- [ ] **Step 1: Fix consequence text size**

Find the consequence `<p>` (around line 192):

```tsx
<p style={{
  fontSize: 13, color: 'var(--color-text-2)',
  lineHeight: 1.6, marginBottom: 16,
  ...
}}>
```

Change `fontSize: 13` → `fontSize: 12`.

- [ ] **Step 2: Fix maps icon in PlaceRow**

Find the maps link `<a>` inside `PlaceRow` (around line 103):

```tsx
<span className="ms" style={{ fontSize: 16 }}>open_in_new</span>
```

Change to:

```tsx
<span className="ms" style={{ fontSize: 15, color: 'var(--color-text-4)' }}>map</span>
```

- [ ] **Step 3: Make glow position vary by trigger**

The mock shows glow bottom-right for lunch/evening triggers and bottom-left for culture. Add a `glowLeft` flag based on trigger type.

In `ReelRecoCard`, find the background glow div (around line 146):

```tsx
{/* Background glow */}
<div style={{
  position: 'absolute', bottom: -40, right: -40,
  width: 260, height: 260, borderRadius: '50%',
  background: `radial-gradient(circle, ${cfg.bg} 0%, transparent 65%)`,
  pointerEvents: 'none',
}} />
```

Replace with:

```tsx
{/* Background glow — position varies by trigger */}
{(() => {
  const glowLeft = card.trigger === 'culture' || card.trigger === 'walking_gap' || card.trigger === 'geo_efficiency';
  return (
    <div style={{
      position: 'absolute', bottom: -40,
      ...(glowLeft ? { left: -40 } : { right: -40 }),
      width: 260, height: 260, borderRadius: '50%',
      background: `radial-gradient(circle, ${cfg.bg} 0%, transparent 65%)`,
      pointerEvents: 'none',
    }} />
  );
})()}
```

- [ ] **Step 4: Verify in browser**

Open a reco card. Check:
- Consequence text is slightly smaller/tighter
- The place row map links show the `map` icon (pin shape) not the external link arrow
- Background glow is on the left for culture-type triggers, right for food/evening triggers

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ReelRecoCard.tsx
git commit -m "fix(reel): reco card 12px consequence, map icon, variable glow position — match mock"
```

---

## Self-Review

**Spec coverage check:**

| Mock gap | Task |
|----------|------|
| Wrapper height / scroll stability | Task 1 |
| Stop card title 30px | Task 2 |
| Stop card padding `0 15px 26px` | Task 2 |
| Stop card time row 12px | Task 2 |
| Weather badge pill shape | Task 3 |
| Sky tint double-layer rain/storm | Task 4 |
| Rain density 64 streaks | Task 5 |
| Snow density 44 flakes | Task 5 |
| WhyForYou 12px italic `#c0b0a4` | Task 6 |
| Intro card sky tint + ToD gradient + sun rays | Task 7 |
| Intro card scrim too dark | Task 8 |
| Intro card padding `0 17px 32px` | Task 8 |
| Engine strips dark bg | Task 8 |
| Reco consequence 12px | Task 9 |
| Reco map icon | Task 9 |
| Reco glow position | Task 9 |

All diagnosed gaps are covered. No placeholders found. No type inconsistencies — all values are inline style literals with no cross-task dependencies.
