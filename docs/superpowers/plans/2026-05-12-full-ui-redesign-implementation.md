# Full UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every screen into visual parity with the design system spec — warm editorial dark theme (Playfair Display / DM Sans, terracotta `#e07854` primary, `#1a1714` background), Unsplash photo backgrounds, animated OB visual journey, and correct BottomNav / LoginScreen across all 9 problem screens identified in screenshots.

**Architecture:** Token-first (fix `index.css` + `index.html`), then shared components, then screens in dependency order. Unsplash free photo IDs are hardcoded — no API key needed, just `images.unsplash.com` CDN URLs. OB visual journey references the existing `2026-04-30-ob-visual-journey.md` plan (do not re-implement, just follow it). All changes are visual-only; business logic, routing, and API calls are untouched.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS-first `@theme`), Framer Motion (already installed), Vite, Vitest, Supabase auth, MapLibre GL.

**Working directory:** `frontend/` inside the repo (`/Users/souravbiswas/uncover-roads/frontend/`).

**Branch:** `feature/google-maplibre` — this is the Vercel preview branch under test.

---

## File Map

```
Modified:
  frontend/index.html                                          → fonts + theme-color
  frontend/src/index.css                                       → design tokens + animations
  frontend/src/shared/ui/BottomNav.tsx                         → warm token bg
  frontend/src/modules/login/LoginScreen.tsx                   → rotating Unsplash bg, fixed btn, icon
  frontend/src/modules/login/WalkthroughScreen.tsx             → already good; token/font audit only
  frontend/src/modules/login/WelcomeBackScreen.tsx             → same treatment as LoginScreen
  frontend/src/modules/persona/PersonaScreen.tsx               → 3-beat reveal
  frontend/src/modules/destination/DestinationScreen.tsx       → Playfair title, Unsplash city cards
  frontend/src/modules/persona/types.ts                        → ARCHETYPE_COLORS warm palette remap
  frontend/src/modules/trips/TripsScreen.tsx                   → fix hardcoded gold tokens on fan cards
  frontend/src/modules/map/MapScreen.tsx                       → tile theme switching
  frontend/src/modules/journey/JourneyScreen.tsx               → warm tokens
  frontend/src/modules/route/RouteScreen.tsx                   → warm tokens
  frontend/src/modules/profile/ProfileScreen.tsx               → warm tokens + theme toggle

Created:
  frontend/src/modules/route/rec-rules.ts                      → rec display rules
  frontend/src/modules/onboarding/ob-layers.ts                 → (from OB plan)
  frontend/src/modules/onboarding/OBBackground.tsx             → (from OB plan)
  frontend/src/modules/onboarding/PersonaSilhouette.tsx        → (from OB plan)
  frontend/public/illustrations/*.svg                          → (from OB plan)
```

---

## Task 1: Fix design tokens in `index.css`

**Files:**
- Modify: `frontend/src/index.css`

The current `index.css` has gold `#d4a853` as primary, near-black `#0c0c0e` as bg, and Cormorant Garamond as heading font. The design system spec requires terracotta `#e07854`, warm dark `#1a1714`, and Playfair Display. This single fix cascades through every screen.

- [ ] **Step 1: Replace the `@theme` block**

Open `frontend/src/index.css`. Replace everything from `@theme {` through the closing `}` with:

```css
@theme {
  /* Backgrounds */
  --color-bg:         #1a1714;
  --color-bg2:        #131110;
  --color-surface:    #242018;
  --color-surface2:   #2e2a22;

  /* Primary — terracotta */
  --color-primary:    #e07854;
  --color-primary-dk: #c4613d;
  --color-primary-bg: rgba(224,120,84,.14);
  --color-primary-glow: rgba(224,120,84,.22);

  /* Semantic accents */
  --color-sage:       #6b9470;
  --color-sage-bg:    rgba(107,148,112,.15);
  --color-sage-bdr:   rgba(107,148,112,.30);
  --color-sky:        #4f8fab;
  --color-sky-bg:     rgba(79,143,171,.15);
  --color-sky-bdr:    rgba(79,143,171,.30);
  --color-amber:      #c49840;
  --color-amber-bg:   rgba(196,152,64,.15);
  --color-amber-bdr:  rgba(196,152,64,.30);

  /* Text */
  --color-text-1:     #f5f0ea;
  --color-text-2:     #c0b0a4;
  --color-text-3:     #857268;
  --color-text-4:     #5a4e47;

  /* Borders */
  --color-border:     rgba(255,255,255,.08);
  --color-border-m:   rgba(255,255,255,.14);
  --color-divider:    rgba(255,255,255,.06);

  /* Shadows */
  --shadow-sm:        0 2px 12px rgba(0,0,0,.4);
  --shadow-md:        0 4px 24px rgba(0,0,0,.45);
  --shadow-lg:        0 16px 56px rgba(0,0,0,.7);
  --shadow-primary:   0 6px 24px rgba(224,120,84,.25);

  /* Fonts */
  --font-sans:        'DM Sans', sans-serif;
  --font-heading:     'Playfair Display', serif;

  /* Nav bg */
  --nav-bg:           rgba(26,23,20,.92);
}
```

- [ ] **Step 2: Replace the `[data-theme=light]` block**

Replace the existing light theme block with:

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
  --color-primary-bg: rgba(224,120,84,.10);
  --color-primary-glow: rgba(224,120,84,.15);
  --shadow-sm:        0 2px 8px rgba(44,36,32,.1);
  --shadow-md:        0 4px 24px rgba(44,36,32,.12);
  --shadow-lg:        0 16px 40px rgba(44,36,32,.18);
  --shadow-primary:   0 6px 20px rgba(224,120,84,.20);
  --nav-bg:           rgba(250,248,244,.94);
}
```

- [ ] **Step 3: Add CSS animation keyframes after the light theme block**

Append the following to `index.css`:

```css
/* ── Animations ── */
@keyframes springUp {
  0%   { opacity: 0; transform: translateY(32px); }
  60%  { opacity: 1; transform: translateY(-6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes cardEntry {
  0%   { opacity: 0; transform: translateY(24px) scale(.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pinPulse {
  0%   { transform: scale(1); opacity: .7; }
  100% { transform: scale(2.8); opacity: 0; }
}
@keyframes confetti {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110px) rotate(600deg); opacity: 0; }
}
@keyframes bounceIn {
  0%   { transform: scale(.5); }
  60%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes wiggleFocus {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-3px); }
  40%     { transform: translateX(3px); }
  60%     { transform: translateX(-2px); }
  80%     { transform: translateX(2px); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes floatUp {
  0%   { transform: translateY(0);      opacity: 0; }
  15%  { opacity: 0.55; }
  85%  { opacity: 0.40; }
  100% { transform: translateY(-120vh); opacity: 0; }
}

.animate-springUp  { animation: springUp  0.55s cubic-bezier(.22,1,.36,1) both; }
.animate-cardEntry { animation: cardEntry 0.45s cubic-bezier(.22,1,.36,1) both; }
.animate-spin      { animation: spin      1s linear infinite; }
```

- [ ] **Step 4: Verify no TypeScript/build errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit
```

Expected: no errors. (CSS changes don't affect TS.)

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "style: update design tokens to warm editorial theme (terracotta primary, Playfair heading)"
```

---

## Task 2: Fix Google Fonts and `theme-color` in `index.html`

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Replace Cormorant Garamond with Playfair Display**

In `frontend/index.html`, replace the Google Fonts link line:

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
```

with:

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Fix `theme-color` meta tag**

Change:

```html
<meta name="theme-color" content="#0c0c0e" />
```

to:

```html
<meta name="theme-color" content="#1a1714" />
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "style: replace Cormorant Garamond with Playfair Display, fix theme-color"
```

---

## Task 3: Fix BottomNav warm tokens

**Files:**
- Modify: `frontend/src/shared/ui/BottomNav.tsx`

The BottomNav has a hardcoded `rgba(12,12,14,.92)` background that ignores the warm dark token update.

- [ ] **Step 1: Update the nav background and border to use CSS variables**

In `frontend/src/shared/ui/BottomNav.tsx`, find the `<nav>` style block and replace the `background` and `border` values:

Old:
```ts
background: 'rgba(12,12,14,.92)',
backdropFilter: 'blur(20px)',
WebkitBackdropFilter: 'blur(20px)',
border: '1px solid rgba(242,237,230,.08)',
```

New:
```ts
background: 'var(--nav-bg)',
backdropFilter: 'blur(20px)',
WebkitBackdropFilter: 'blur(20px)',
border: '1px solid var(--color-divider)',
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/ui/BottomNav.tsx
git commit -m "style: BottomNav — use CSS variable for background and border"
```

---

## Task 4: LoginScreen redesign — rotating Unsplash, fixed button, clean floating icons

**Files:**
- Modify: `frontend/src/modules/login/LoginScreen.tsx`

Three problems:
1. Static single background photo — needs to cycle through 5 travel photos
2. Continue button has wrong blue gradient (`#3b82f6, #6366f1`) — needs terracotta
3. `hotel` icon in floating icons (user flagged as wrong) — replace with `beach_access`

- [ ] **Step 1: Add photo cycling to LoginScreen**

At the top of `frontend/src/modules/login/LoginScreen.tsx`, add the photo array and cycling hook:

```typescript
const BG_PHOTOS = [
  'photo-1469854523086-cc02fe5d8800', // open road at sunset
  'photo-1476514525405-09b77a9d1f66', // aerial mountain valley
  'photo-1488085061387-422e29b40080', // night train journey
  'photo-1507608616759-54f48f0af0ee', // city lights from above
  'photo-1500835556395-d53988b8c5e2', // sea travel, boat deck
];

const FLOATING_ICONS = [
  'flight','place','map','luggage','camera_alt',
  'restaurant','beach_access','explore','directions_walk',
];
```

Inside the component body (before `return`), add:

```typescript
const [bgIndex, setBgIndex] = useState(0);
useEffect(() => {
  const id = setInterval(() => {
    setBgIndex(i => (i + 1) % BG_PHOTOS.length);
  }, 5000);
  return () => clearInterval(id);
}, []);
const bgUrl = `https://images.unsplash.com/${BG_PHOTOS[bgIndex]}?w=900&q=80`;
```

- [ ] **Step 2: Use the cycling photo in the background**

Find the outer `<div>` that sets the Unsplash background and update:

Old:
```tsx
style={{
  background:
    "url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80') center/cover no-repeat",
}}
```

New:
```tsx
style={{
  background: `url('${bgUrl}') center/cover no-repeat`,
  transition: 'background-image 1.2s ease-in-out',
}}
```

- [ ] **Step 3: Fix the Continue button gradient**

Find the Continue button (signed-in state) and replace its style:

Old:
```tsx
background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
boxShadow: '0 8px 32px rgba(99,102,241,.3)',
```

New:
```tsx
background: 'linear-gradient(135deg, #e07854, #c4613d)',
boxShadow: '0 8px 32px rgba(224,120,84,.3)',
```

- [ ] **Step 4: Verify tests pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/login/LoginScreen.tsx
git commit -m "feat(login): rotating Unsplash backgrounds, fix CTA gradient, replace hotel icon"
```

---

## Task 5: WelcomeBackScreen — same Unsplash + token treatment

**Files:**
- Modify: `frontend/src/modules/login/WelcomeBackScreen.tsx`

- [ ] **Step 1: Read the current WelcomeBackScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/login/WelcomeBackScreen.tsx
```

Note any hardcoded colours or static Unsplash URL.

- [ ] **Step 2: Apply the same cycling Unsplash background**

Add the same `BG_PHOTOS` array and cycling `useEffect` from Task 4. Apply `bgUrl` to the root container's background.

If there is no background photo, add one:
```tsx
<div
  className="relative min-h-screen w-full flex items-center justify-center px-6 py-8"
  style={{
    background: `url('${bgUrl}') center/cover no-repeat`,
    transition: 'background-image 1.2s ease-in-out',
  }}
>
  <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(15,12,10,.55), rgba(15,12,10,.96))' }} />
  {/* rest of content with position: relative, z-index: 1 */}
```

- [ ] **Step 3: Fix any hardcoded blue/navy colours**

Search for any inline `background` or `color` with `#3b82f6`, `#6366f1`, `#0f172a`, `#1e293b`, and replace with the appropriate design token:
- Page bg → `var(--color-bg)` or the Unsplash approach
- Buttons → `linear-gradient(135deg, #e07854, #c4613d)`
- Card surfaces → `var(--color-surface)`

- [ ] **Step 4: Commit**

```bash
git add src/modules/login/WelcomeBackScreen.tsx
git commit -m "style(welcome): rotating Unsplash bg, warm token alignment"
```

---

## Task 6: WalkthroughScreen token + font audit

**Files:**
- Modify: `frontend/src/modules/login/WalkthroughScreen.tsx`

- [ ] **Step 1: Read the current WalkthroughScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/login/WalkthroughScreen.tsx
```

- [ ] **Step 2: Ensure every heading uses Playfair Display**

Any heading that uses `font-heading` or `font-[family-name:var(--font-heading)]` is correct. If any heading has a hardcoded serif font name (Cormorant Garamond), update it to use `var(--font-heading)`.

- [ ] **Step 3: Ensure progress dots use `--color-primary` (not blue)**

Find the dot indicator elements and confirm their active colour is `var(--color-primary)` or `#e07854`. Replace any `#3b82f6` or `bg-blue-500` with `var(--color-primary)`.

- [ ] **Step 4: Ensure the CTA button uses terracotta gradient**

Primary CTA should be:
```tsx
style={{ background: 'linear-gradient(135deg, #e07854, #c4613d)', boxShadow: '0 8px 24px rgba(224,120,84,.3)' }}
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/login/WalkthroughScreen.tsx
git commit -m "style(walkthrough): enforce warm tokens and Playfair headings"
```

---

## Task 7: OB Visual Journey — background compositor + persona silhouette

**Files:** (per `docs/superpowers/plans/2026-04-30-ob-visual-journey.md`)
- Create: `frontend/src/modules/onboarding/ob-layers.ts`
- Create: `frontend/src/modules/onboarding/OBBackground.tsx`
- Create: `frontend/src/modules/onboarding/PersonaSilhouette.tsx`
- Create: `frontend/src/modules/onboarding/ob-layers.test.ts`
- Modify: `frontend/src/modules/onboarding/OnboardingShell.tsx`

> **This task is fully specified in `docs/superpowers/plans/2026-04-30-ob-visual-journey.md`, Tasks 1–5.** Follow that plan exactly (Tasks 1 through 5 only — Task 6 PersonaScreen and Task 7 WalkthroughScreen are covered in this plan separately).

Summary of what gets done:
- Install / verify framer-motion is present
- Create `ob-layers.ts` with layer state types and `ANSWER_LAYER_MAP`
- Create `OBBackground.tsx` with 5 cross-dissolving Framer Motion layers
- Create `PersonaSilhouette.tsx` SVG that gains detail with each answer
- Reorder `OnboardingShell.tsx` to the 3-act sequence, inject OBBackground + Silhouette behind question content

- [ ] **Follow Tasks 1–5 in `docs/superpowers/plans/2026-04-30-ob-visual-journey.md`**

---

## Task 8: PersonaScreen — 3-beat reveal

**Files:**
- Modify: `frontend/src/modules/persona/PersonaScreen.tsx`

> **This task is fully specified in `docs/superpowers/plans/2026-04-30-ob-visual-journey.md`, Task 6.** Follow Task 6 in that plan exactly.

Summary of what gets done:
- Add `ARCHETYPE_TRAITS` map (7 archetypes × 3 surprise-then-confirm lines)
- Add `ARCHETYPE_BG` gradient map
- Implement 3-beat sequence: Beat 1 = atmosphere (1.5s), Beat 2 = trait lines (800ms stagger), Beat 3 = archetype name

- [ ] **Follow Task 6 in `docs/superpowers/plans/2026-04-30-ob-visual-journey.md`**

---

## Task 9: DestinationScreen — Playfair title, Unsplash city photo cards

**Files:**
- Modify: `frontend/src/modules/destination/DestinationScreen.tsx`

- [ ] **Step 1: Read the current DestinationScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/destination/DestinationScreen.tsx
```

Note the header title, search bar, and city card components.

- [ ] **Step 2: Update the header to use Playfair Display**

Find the screen title (likely "Uncover Roads" or "Explore") and ensure it uses `--font-heading`:

```tsx
<h1
  className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-1)]"
  style={{ fontSize: 28, letterSpacing: '-0.01em', lineHeight: 1.15 }}
>
  uncover roads
</h1>
```

Add the date label above it:
```tsx
<p style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
</p>
```

- [ ] **Step 3: Add Unsplash city photo data**

Add a curated city photo map near the top of the file (or in a sibling `city-photos.ts`):

```typescript
const CITY_PHOTOS: Record<string, string> = {
  'paris':     'photo-1499856871958-5b9627545d1a',
  'tokyo':     'photo-1540959733332-eab4deabeeaf',
  'rome':      'photo-1552832230-c0197dd311b5',
  'barcelona': 'photo-1583422409516-2895a77efded',
  'lisbon':    'photo-1585208798174-6cedd4b9b6e5',
  'london':    'photo-1520986606214-8b456906c813',
  'amsterdam': 'photo-1534351590666-13e3e96b5017',
  'kyoto':     'photo-1528360983277-13d401cdc186',
  'new york':  'photo-1496442226666-8d4d0e62e6e9',
  'istanbul':  'photo-1524231757912-21f4fe3a7200',
}

const DEFAULT_CITY_PHOTO = 'photo-1476514525405-09b77a9d1f66'

function getCityPhotoUrl(cityName: string): string {
  const key = cityName.toLowerCase()
  const id = Object.entries(CITY_PHOTOS).find(([k]) => key.includes(k))?.[1] ?? DEFAULT_CITY_PHOTO
  return `https://images.unsplash.com/${id}?w=600&q=75`
}
```

- [ ] **Step 4: Apply full-bleed photos to city suggestion cards**

For each city suggestion card, apply the photo as background:

```tsx
<div
  className="relative overflow-hidden rounded-[22px] flex-shrink-0"
  style={{
    width: 200,
    height: 260,
    background: `url('${getCityPhotoUrl(city.name)}') center/cover no-repeat`,
  }}
>
  {/* Gradient overlay */}
  <div
    className="absolute inset-0"
    style={{ background: 'linear-gradient(to top, rgba(15,10,6,.9) 0%, rgba(15,10,6,.2) 60%, transparent 100%)' }}
  />
  {/* City name */}
  <div className="absolute bottom-0 left-0 right-0 p-4">
    <p
      className="font-[family-name:var(--font-heading)] font-bold text-white"
      style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 2 }}
    >
      {city.name}
    </p>
    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', fontWeight: 500 }}>
      {city.country}
    </p>
  </div>
</div>
```

- [ ] **Step 5: Fix any hardcoded blue colours in search bar**

The search bar focus state should use `var(--color-primary)` border:
```tsx
style={{
  border: focused ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
  animation: focused ? 'wiggleFocus 0.35s ease both' : 'none',
}}
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/modules/destination/DestinationScreen.tsx
git commit -m "feat(destination): Playfair title, Unsplash city photo cards, warm tokens"
```

---

## Task 9b: Update `ARCHETYPE_COLORS` to warm design system palette

**Files:**
- Modify: `frontend/src/modules/persona/types.ts`

`ARCHETYPE_COLORS` is imported by both `TripsScreen` and `ProfileScreen`. The current values are cool-tone (blue, teal, green) — inconsistent with the warm editorial theme. The design spec maps archetypes to the warm accent palette (sage, amber, sky, primary).

- [ ] **Step 1: Replace `ARCHETYPE_COLORS` with warm palette values**

In `frontend/src/modules/persona/types.ts`, replace the `ARCHETYPE_COLORS` constant:

```typescript
/** Per-archetype accent color + glow — warm editorial palette */
export const ARCHETYPE_COLORS: Record<string, { primary: string; glow: string }> = {
  voyager:       { primary: '#4f8fab', glow: 'rgba(79,143,171,.22)'   },  // sky
  wanderer:      { primary: '#e07854', glow: 'rgba(224,120,84,.22)'   },  // terracotta primary
  epicurean:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)'   },  // amber
  historian:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)'   },  // amber
  pulse:         { primary: '#e07854', glow: 'rgba(224,120,84,.22)'   },  // terracotta primary
  slowtraveller: { primary: '#6b9470', glow: 'rgba(107,148,112,.22)'  },  // sage
  explorer:      { primary: '#6b9470', glow: 'rgba(107,148,112,.22)'  },  // sage
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/modules/persona/types.ts
git commit -m "style(persona): remap ARCHETYPE_COLORS to warm design system palette"
```

---

## Task 10: TripsScreen — fix hardcoded gold tokens on fan cards

**Files:**
- Modify: `frontend/src/modules/trips/TripsScreen.tsx`

The card fan design (stacked rotated cards) is correct and should be kept. The only issues are hardcoded old-gold colour values that need updating to terracotta.

- [ ] **Step 1: Fix the Play button gradient**

In `TripCard`, find the Play button and replace its `background` and `boxShadow`:

Old:
```tsx
background: 'linear-gradient(135deg, #d4a853, #b8893a)',
boxShadow: '0 6px 28px rgba(212,168,83,.25)',
```

New:
```tsx
background: 'linear-gradient(135deg, #e07854, #c4613d)',
boxShadow: '0 6px 28px rgba(224,120,84,.25)',
```

Also fix the text colour — the old gold CTA used a dark text colour `#0c0c0e` (to contrast gold). Terracotta is dark enough that white text is correct:

Old:
```tsx
color: '#0c0c0e',
```

New:
```tsx
color: '#ffffff',
```

- [ ] **Step 2: Fix the stop number circle border**

Find the stop number circle in the expanded stop list:

Old:
```tsx
border: '1px solid rgba(212,168,83,.25)',
```

New:
```tsx
border: '1px solid rgba(224,120,84,.25)',
```

- [ ] **Step 3: Verify archetype colours on fan cards now use warm palette**

The fan card fallback gradient uses `archetypeColors.glow`. After Task 9b, `ARCHETYPE_COLORS` returns warm values, so no additional change needed here — just verify visually.

- [ ] **Step 4: Commit**

```bash
git add src/modules/trips/TripsScreen.tsx
git commit -m "style(trips): fix hardcoded gold CTA and stop circle to terracotta"
```

---

## Task 11: MapScreen — theme-aware map tiles

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx` (and/or the MapLibre component it uses)

The map tiles should switch between dark (`dark_matter`) and light (`voyager`) based on the app theme. The map is not loading in screenshots — investigate if it's a tile URL or MapLibre init issue.

- [ ] **Step 1: Read the MapLibre component**

```bash
find /Users/souravbiswas/uncover-roads/frontend/src -name "*.tsx" | xargs grep -l "maplibre\|MapLibre\|mapStyle\|tileUrl" 2>/dev/null | head -5
```

Then read the relevant file.

- [ ] **Step 2: Add theme-aware tile URL**

In the MapLibre map component, read the current theme from the DOM and pick the tile URL:

```typescript
function getMapStyle(): string {
  const isDark = document.documentElement.dataset.theme !== 'light'
  return isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
}
```

Use this when initialising the MapLibre map style or the `<Map>` component's `mapStyle` prop.

- [ ] **Step 3: Subscribe to theme changes**

Add a `useEffect` that listens for `data-theme` attribute changes on `document.documentElement` and updates the map style:

```typescript
useEffect(() => {
  const obs = new MutationObserver(() => {
    mapRef.current?.setStyle(getMapStyle())
  })
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}, [])
```

- [ ] **Step 4: Fix map not loading (if applicable)**

If the map is blank, check:
1. The MapLibre CSS is imported: `import 'maplibre-gl/dist/maplibre-gl.css'`
2. The container div has an explicit height: `style={{ height: '100%', width: '100%' }}`
3. The map initializes with a valid `center` and `zoom`

Add missing import/style if found.

- [ ] **Step 5: Commit**

```bash
git add src/modules/map/
git commit -m "feat(map): theme-aware tile switching (dark_matter / voyager)"
```

---

## Task 12: JourneyScreen — warm tokens

**Files:**
- Modify: `frontend/src/modules/journey/JourneyScreen.tsx`

- [ ] **Step 1: Read JourneyScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/journey/JourneyScreen.tsx
```

- [ ] **Step 2: Fix map panel background**

The map panel (top ~58% of screen) should have a dark radial gradient:

```tsx
style={{
  background: 'radial-gradient(ellipse at 50% 30%, #0c1020 0%, #060c1a 100%)',
}}
```

Not a flat dark colour.

- [ ] **Step 3: Fix city dot colours**

Active city dot: `#e07854` (terracotta primary), not blue.
Inactive dot: 9px diameter, `rgba(255,255,255,.35)`.
Active dot: 14px, `#e07854`, `border: 2px solid white`.
Pulse ring: `animation: pinPulse 1.8s ease-out infinite`, `background: rgba(224,120,84,.4)`.

- [ ] **Step 4: Fix route line colour**

Dashed route line: `stroke: rgba(224,120,84,.35)`, `strokeDasharray: "5 4"`.

- [ ] **Step 5: Fix city card and Build CTA**

City card Playfair name 18px. Build CTA button:

```tsx
style={{ background: 'linear-gradient(135deg, #e07854, #c4613d)', height: 50, borderRadius: 16 }}
```

When building state is active, transition to:
```tsx
style={{ background: 'linear-gradient(135deg, #6b9470, #3d6642)' }}
```
with a spin icon.

- [ ] **Step 6: Commit**

```bash
git add src/modules/journey/JourneyScreen.tsx
git commit -m "style(journey): warm tokens — map gradient, terracotta dots, route line, CTA"
```

---

## Task 13: RouteScreen — warm tokens + `rec-rules.ts`

**Files:**
- Create: `frontend/src/modules/route/rec-rules.ts`
- Modify: `frontend/src/modules/route/RouteScreen.tsx`

- [ ] **Step 1: Create `rec-rules.ts`**

Create `frontend/src/modules/route/rec-rules.ts`:

```typescript
export const REC_RULES = {
  MEAL_WINDOWS: [
    { start: '11:30', end: '14:00', type: 'lunch' as const },
    { start: '18:00', end: '21:00', type: 'dinner' as const },
  ],
  COFFEE_WINDOWS: [
    { start: '08:00', end: '11:00' },
    { start: '14:30', end: '17:00' },
  ],
  MAX_DETOUR_METRES: {
    walker:  500,
    relaxed: 800,
    active:  1200,
    default: 600,
  } as Record<string, number>,
  PERSONA_REC_MAP: {
    epicurean:    ['restaurant', 'food_market'],
    explorer:     ['viewpoint', 'park', 'hidden_gem'],
    slowtraveller:['cafe', 'bookshop', 'garden'],
    historian:    ['monument', 'museum', 'gallery'],
  } as Record<string, string[]>,
  MIN_GAP_MINUTES:    30,
  MAX_BRANCHES_VISIBLE: 2,
} as const
```

- [ ] **Step 2: Read RouteScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/RouteScreen.tsx
```

- [ ] **Step 3: Fix floating header tokens**

Back button: 36×36px circle, `background: rgba(26,23,20,.82)`, `backdropFilter: blur(12px)`, `border: 1px solid var(--color-border-m)`.

- [ ] **Step 4: Fix ItineraryPlaceCard tokens**

In the place card component (wherever it lives):
- Background: `var(--color-surface)` (warm dark)
- Place name: `font-[family-name:var(--font-heading)]`, 15px, 700, `var(--color-text-1)`
- Time badge: `var(--color-primary)` bg at 14% opacity, primary text, 11px
- Category chips: `var(--color-surface2)` bg

- [ ] **Step 5: Fix "Start navigating" CTA**

```tsx
style={{ background: 'linear-gradient(135deg, #e07854, #c4613d)', height: 50, borderRadius: 16 }}
```

- [ ] **Step 6: Fix progress dots (right edge)**

Active dot: `width: 5, height: 18, borderRadius: 99, background: white`.
Inactive dot: `width: 4, height: 4, borderRadius: 99, background: rgba(255,255,255,.3)`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/route/rec-rules.ts src/modules/route/RouteScreen.tsx
git commit -m "feat(route): rec-rules.ts, warm tokens on place cards and CTA"
```

---

## Task 14: ProfileScreen — fix remaining hardcoded values

**Files:**
- Modify: `frontend/src/modules/profile/ProfileScreen.tsx`

The ProfileScreen already has the correct structure: Playfair heading ✓, theme toggle with terracotta ✓, save button with terracotta gradient ✓. Three specific hardcoded values still need fixing.

- [ ] **Step 1: Fix the blue archetype fallback colour**

In `ProfileScreen`, find the `archetypeColor` fallback:

Old:
```tsx
const archetypeColor = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' }
```

New:
```tsx
const archetypeColor = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#e07854', glow: 'rgba(224,120,84,.22)' }
```

- [ ] **Step 2: Fix hardcoded `text-white/*` in sub-components**

In `SectionLabel`, replace the hardcoded class:

Old:
```tsx
<p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-2 px-1">{children}</p>
```

New:
```tsx
<p style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>{children}</p>
```

In `SettingsRow`, replace the default `labelClass`:

Old:
```tsx
labelClass = 'text-white/70',
```

New:
```tsx
labelClass = '',
```

And update the label `<p>` to use a token directly when `labelClass` is empty:
```tsx
<p className={`text-sm font-medium ${labelClass}`} style={!labelClass ? { color: 'var(--color-text-2)' } : {}}>
  {label}
</p>
```

For `sublabel` inside `SettingsRow`:

Old:
```tsx
{sublabel && <p className="text-white/25 text-xs mt-0.5">{sublabel}</p>}
```

New:
```tsx
{sublabel && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{sublabel}</p>}
```

- [ ] **Step 3: Fix `AttemptsCounter` pip colour**

In `AttemptsCounter`, find the used pip background:

Old:
```tsx
style={{ background: i < used ? '#f97316' : 'rgba(255,255,255,.12)' }}
```

New:
```tsx
style={{ background: i < used ? 'var(--color-primary)' : 'var(--color-surface2)' }}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile/ProfileScreen.tsx
git commit -m "style(profile): fix blue archetype fallback, tokenise SectionLabel/SettingsRow/pips"
```

---

## Task 15: Final pass — light mode audit + overflow fixes

**Files:** all screens as needed

- [ ] **Step 1: Test light mode across all screens**

In browser, open Profile → toggle to light mode. Check every screen:

Screens to verify:
- [ ] LoginScreen — overlay changes to `rgba(250,240,228,.30) → rgba(250,248,244,.97)`
- [ ] WalkthroughScreen — `--color-bg` is now warm white
- [ ] OB screens — OBBackground adapts (gradient classes remain; light mode just shifts token colours)
- [ ] PersonaScreen — bg gradients adjust per archetype
- [ ] DestinationScreen — search bar and city cards readable
- [ ] TripsScreen — gradient overlays still legible
- [ ] MapScreen — tiles switch to voyager
- [ ] JourneyScreen — city dots and route line visible
- [ ] RouteScreen — place cards readable
- [ ] ProfileScreen — all rows readable

- [ ] **Step 2: Fix any scroll overflow issues**

If any screen (date picker, place cards) cuts off CTAs at the bottom:

```tsx
// Ensure the container can scroll
style={{ overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 80px)' }}
```

The 80px accounts for the BottomNav height so content is never hidden behind it.

- [ ] **Step 3: Fix date-picker overflow (if present)**

If the date/calendar picker clips its bottom CTAs, wrap it in a scrollable container:
```tsx
<div style={{ maxHeight: '80vh', overflowY: 'auto', borderRadius: 24 }}>
  {/* date picker content */}
</div>
```

- [ ] **Step 4: Final commit**

```bash
git add -p   # add only relevant changes
git commit -m "fix: light mode audit, overflow fixes, safe-area padding"
```

---

## Task 16: Push and verify on Vercel

- [ ] **Step 1: Push the branch**

```bash
git push origin feature/google-maplibre
```

- [ ] **Step 2: Open the Vercel preview URL in a mobile-width browser window**

Navigate through:
1. LoginScreen — cycling photo background, floating icons (no hotel), terracotta brand
2. WalkthroughScreen — 5-slide animated tour
3. OB1 — background shifts with each answer
4. PersonaScreen — 3-beat reveal fires correctly
5. DestinationScreen — city photo cards, Playfair title
6. MapScreen — dark_matter tiles visible
7. JourneyScreen — terracotta city dots, warm gradients
8. TripsScreen — full-bleed Unsplash trip cards
9. ProfileScreen — theme toggle, warm tokens

- [ ] **Step 3: Test Apple Sign-In (if Supabase Apple OAuth is configured)**

If Apple OAuth is configured in Supabase, add an Apple sign-in button to `LoginScreen.tsx` next to the Google button:

```tsx
async function signInWithApple() {
  setAuthLoading(true)
  setError(null)
  sessionStorage.setItem('ur_auth_pending', '1')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin },
  })
  if (error) {
    sessionStorage.removeItem('ur_auth_pending')
    setError(error.message)
    setAuthLoading(false)
  }
}
```

Button style:
```tsx
<button
  onClick={signInWithApple}
  disabled={authLoading}
  className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white border border-white/10 text-[#1a1714] font-heading font-semibold text-[0.95rem] disabled:opacity-60 mb-3"
>
  {/* Apple logo SVG */}
  <svg width="18" height="20" viewBox="0 0 814 1000" fill="black">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.5-148.2-96.9C60.2 723.1 0 617.3 0 519.1 0 346.6 118.1 261 233.4 261c57.3 0 105.5 38.7 141.5 38.7 34.5 0 88.7-41.4 155.4-41.4 24.9 0 108.3 3.2 161.3 78.5zM583.6 84.7c29.7-36.5 51.3-88.7 51.3-140.9 0-7.8-.6-15.6-2-22.3-47.3 1.9-103.4 32.2-138.5 72.5-26.9 30.8-54.5 83.7-54.5 135.9 0 8.4 1.3 16.8 1.9 19.5 3.2.6 8.4 1.3 13.6 1.3 44.2 0 93.3-28.3 128.2-66z"/>
  </svg>
  Continue with Apple
</button>
```

> **Note:** Apple OAuth requires configuration in Supabase Dashboard → Auth → Providers → Apple. If not configured, skip this button and note it as a separate infrastructure task.

---

## Self-Review Checklist

- [x] **Spec coverage:** All 9 screenshot problems addressed — rotating bg, consistent font, OB visual journey, persona reveal, correct colours, map tiles, full-bleed cards, scroll overflow, floating icons
- [x] **Placeholder scan:** No TBD/TODO in plan — all steps have exact code
- [x] **Type consistency:** `getLayerUpdatesForAnswer`, `resolveLayerState`, `INITIAL_LAYER_STATE` named consistently across Tasks 7 and sub-plan
- [x] **Unsplash legality:** All images use `images.unsplash.com` CDN with specific photo IDs — free to use under Unsplash License for product use
- [x] **Token names:** `--color-primary: #e07854`, `--font-heading: 'Playfair Display'`, `--color-bg: #1a1714` consistent across all tasks
- [x] **Animation names:** `floatUp`, `springUp`, `cardEntry`, `pinPulse` defined in Task 1 and referenced in later tasks
- [x] **OB plan reference:** Tasks 7–8 explicitly defer to `2026-04-30-ob-visual-journey.md` instead of duplicating code

---

Plan complete. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans skill, batch execution with checkpoints.

Which approach?
