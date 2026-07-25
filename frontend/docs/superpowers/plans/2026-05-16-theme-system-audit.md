# App-wide Theme System Audit — Implementation Plan
*2026-05-16 · Spec: `docs/superpowers/specs/2026-05-16-theme-system-audit-design.md`*

## Branch
`feature/theme-system-audit`

## Context
~60 component files use hardcoded `rgba(255,255,255,...)` and `rgba(0,0,0,...)` values instead of the CSS token system. This makes the light theme toggle mostly non-functional. The fix is mechanical: token system gets two additions, then each module's files are swept to replace hardcoded values with tokens.

The token system is in `frontend/src/index.css`. The light override block is `[data-theme=light]`.

---

## Tasks

### Task 1 — Extend token system in `index.css`

**File:** `src/index.css`

**Changes:**

1. Add `--color-primary-text` to both themes:
```css
/* in @theme (dark default) */
--color-primary-text: #d4a853;   /* same as --color-primary; gold text on dark #111111 → 8.9:1 */

/* in [data-theme=light] */
--color-primary-text: #7a5c18;   /* darkened gold; on #faf8f4 cream → 5.8:1 */
```

2. Shift dark bg tokens for warmth (aesthetic, no contrast impact):
```css
/* in @theme */
--color-bg:       #0f0d0c;   /* was #111111 */
--color-surface:  #1a1714;   /* was #1a1a1a */
--color-surface2: #221e1b;   /* was #222222 */
```

3. Add light-mode shimmer override:
```css
[data-theme=light] .shimmer::after {
  background: linear-gradient(90deg, transparent, rgba(44,36,32,.05), transparent);
}
```

**Verify:** `tsc --noEmit` still passes (CSS-only change).

---

### Task 2 — Audit + fix shared UI
**Files:** `src/shared/ui/BottomNav.tsx`, `src/shared/Shimmer.tsx`, `src/shared/ui/PhotoGrid2x2.tsx`

- `BottomNav`: nav inactive labels and icons are hardcoded. Replace with `var(--color-text-3)` for inactive, `var(--color-primary-text)` for active label, `var(--color-primary)` for active icon.
- `Shimmer`: check `.shimmer` class is applied (CSS handles it), no TSX changes needed unless inline styles override.
- `PhotoGrid2x2`: any hardcoded text colors → tokens.

---

### Task 3 — Audit + fix map module
**Files:** (20 files in `src/modules/map/`)

Priority order within this batch:

**3a — PinCard, FilterBar, SearchDropdown** (user touches these on every session)
- Replace `rgba(255,255,255,.88)` → `var(--color-text-1)`
- Replace `rgba(255,255,255,.5-.6)` → `var(--color-text-2)`
- Replace `rgba(255,255,255,.28-.35)` → `var(--color-text-3)`
- Replace `rgba(255,255,255,.06-.09)` borders → `var(--color-border)`
- Replace `#1a1a1a` / `#111111` bg → `var(--color-surface)` / `var(--color-bg)`
- Replace `#d4a853` text → `var(--color-primary-text)`

**3b — TravelDateBar, BuildItineraryBar, MultiCityHeader**
- Same token replacements
- Date/city text: `var(--color-primary-text)` for accent text

**3c — SearchResultCard, SearchResultRow, SearchResultsStrip, SearchNudge**
- Text token replacements
- Card backgrounds: `var(--color-surface)`

**3d — ViewAllSheet, MapLoadingOverlay, MapStatusIndicator, DiscoveryModeToggle, SurpriseMeButton, CityHopOverlay, OriginSearchCard, FootprintChips**
- Text token replacements
- Sheet/overlay bg: `var(--color-surface)` or `var(--color-bg)` depending on context

**3e — Pin layers** (`ExploreMapMarkers`, `NumberedPinsLayer`, `UserPinsLayer`, `OurPicksPinsLayer`, `FamousPinsLayer`, `LiveEventPinsLayer`, `ReferencePinsLayer`, `JourneyBreadcrumb`, `CityArcLayer`, `MapLibreMarkers`, `MapLibreRoute`)
- These render canvas/SVG/DOM markers over map tiles. Colors here are intentionally hardcoded to be legible over the map, not the UI theme. **Do not tokenise these.** Only fix any text elements that appear in regular UI context.

---

### Task 4 — Audit + fix route/itinerary module
**Files:** 14 files in `src/modules/route/`

**4a — RouteScreen, ItineraryDayView, TravelDayCard**
- Background panels: `var(--color-bg)` / `var(--color-surface)`
- Section headers: `var(--color-text-3)`
- Body text: `var(--color-text-1)` / `var(--color-text-2)`

**4b — ItineraryStopCard, ItineraryPlaceCard, ItineraryMapCard, DayStops, RecSheet**
- Card surfaces: `var(--color-surface)`
- Label text: `var(--color-text-3)`
- Accent (times, pins): `var(--color-primary-text)`

**4c — EngineMessageBanner, DayShimmer**
- `DayShimmer`: ensure `.shimmer` class applied, remove inline `rgba(255,255,255,...)` sweeps
- Banner: text tokens

**4d — Reel screen** (`ItineraryReelScreen`, `ReelIntroCard`, `ReelStopCard`, `ReelRecoCard`, `ReelTransitCard`, `ReelFinaleCard`)
- Reel is full-screen over photos — most text is white-over-image which is correct to stay hardcoded
- Apply token only to non-photo-overlay elements (bottom drawers, overlay UI panels)

---

### Task 5 — Audit + fix trips + saved module
**Files:** 8 files in `src/modules/trips/`

- `TripsScreen`, `SavedScreen`, `SavedPlacesTab`: section labels → `var(--color-text-3)`, body → `var(--color-text-1/2)`, surfaces → `var(--color-surface)`
- `SavedPlaceCard`, `SavedEventCard`, `SwapCard`: card bg → `var(--color-surface)`, text → tokens
- `ArrivalBanner`, `SmartUpdates`: banner bg → `var(--color-surface)`, text → tokens
- `TripCountdown`, `RecalibrationStack`, `UpdateCard`: same pattern

---

### Task 6 — Audit + fix profile module
**Files:** 5 files in `src/modules/profile/`

- `ProfileScreen`: header, section rows, icons → tokens throughout
- `NotificationsScreen`, `PrivacyScreen`, `SubscriptionDetailsScreen`: list row text → tokens, dividers → `var(--color-divider)`
- `UnitsSheet`: sheet bg → `var(--color-surface)`, text → tokens

---

### Task 7 — Audit + fix journey module
**Files:** 7 files in `src/modules/journey/`

- `JourneyScreen`, `JourneyCityCard`, `JourneyOriginCard`, `JourneyTransitCard`, `JourneyStrip`, `JourneyAdvisorThread`, `OriginInputSheet`
- Standard token replacement: surfaces, text, borders

---

### Task 8 — Audit + fix subscription + PWA modules
**Files:** `SubscriptionScreen.tsx`, `MiniPaywall.tsx`, `PackPurchaseConfirm.tsx`, `InstallPrompt.tsx`
- These have minimal UI surface — standard token replacement
- Paywall: CTA button accent `var(--color-primary-text)` for text, `var(--color-primary)` for icon/bg

---

### Task 9 — Audit onboarding + login
**Files:** 12 files in `src/modules/login/` and `src/modules/onboarding/`

Onboarding screens are intentionally dark (immersive full-screen experience). They should remain dark even in light mode — the theme toggle should not affect them. Wrap these screens' root elements in `data-theme="dark"` force:

```tsx
// OnboardingShell.tsx
<div data-theme="dark" className="fixed inset-0 ...">
```

This scopes the dark tokens just to onboarding without polluting the global theme. Do the same for `LoginScreen`, `WelcomeBackScreen`, `WalkthroughScreen`, and their animations.

For the Persona screen — check whether it already handles both themes. If yes, leave it. If no, apply standard token replacement.

---

### Task 10 — QA sweep: toggle both themes on every screen

For each screen listed below, set `document.documentElement.dataset.theme = 'light'` in devtools and verify:
- [ ] DestinationScreen (covered by explore plan)
- [ ] MapScreen + overlays
- [ ] RouteScreen / ItineraryDayView
- [ ] TripsScreen
- [ ] SavedScreen
- [ ] ProfileScreen
- [ ] PersonaScreen
- [ ] SubscriptionScreen

**Pass criteria:**
- All body text readable (no white text on cream/white)
- Borders/dividers visible but subtle
- Gold accent text uses `#7a5c18` (darker gold), not `#d4a853`
- Surfaces are cream / white, not dark grey
- Shimmer visible
- Onboarding / login remain dark regardless of theme toggle

---

## Ordering Notes

Tasks 1 (token system) must land first — all subsequent tasks depend on the tokens existing. Tasks 2–9 are otherwise independent and can be batched per module. Task 10 is final QA.

Do NOT batch across modules in a single commit — keep one commit per module so regressions are easy to isolate.

## Estimated File Count
~65 files touched. Most changes are mechanical find/replace (rgba → var token). A few files (reel, pin layers, onboarding) need judgment about what should and shouldn't be tokenised.
