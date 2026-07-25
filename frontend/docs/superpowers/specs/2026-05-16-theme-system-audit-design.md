# App-wide Theme System Audit — Design Spec
*2026-05-16*

## Problem

The app has a working dark/light token system in `index.css` (`[data-theme=light]` overrides), but ~60 component files hardcode `rgba(255,255,255,...)` and `rgba(0,0,0,...)` values instead of using `var(--color-text-1)` etc. This means the light theme toggle barely changes anything in practice — components stay dark because they're reading hardcoded white text values, not tokens.

Additionally, the `--color-primary` token (`#d4a853`) has no light-mode override, so any component using it as text on cream fails contrast (~2.1:1).

---

## Token System Fixes (index.css)

### New token: `--color-primary-text`

Gold-as-text needs different values in dark vs light:

```css
/* dark (default) */
--color-primary-text: #d4a853;  /* 8.9:1 on #111111 */

/* [data-theme=light] */
--color-primary-text: #7a5c18;  /* 5.8:1 on #faf8f4 */
```

Use `var(--color-primary-text)` anywhere gold is rendered as *text* (nav active label, date pills, section accents). Keep `var(--color-primary)` for icons, borders, and glows where contrast isn't required.

### Dark background warmth (minor)

Shift dark bg tokens to have a slight warm undertone, matching the warm text palette:

```css
/* before */
--color-bg:       #111111;
--color-surface:  #1a1a1a;
--color-surface2: #222222;

/* after */
--color-bg:       #0f0d0c;   /* barely warm near-black */
--color-surface:  #1a1714;   /* warm dark surface */
--color-surface2: #221e1b;   /* elevated surface */
```

This is aesthetic, not accessibility. Contrast ratios remain the same (text tokens don't change).

### Shimmer — theme-aware

The shimmer animation uses a hardcoded `rgba(255,255,255,.06)` sweep. In light mode on white cards, this is invisible. Fix:

```css
/* dark: white shimmer sweep */
.shimmer::after {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent);
}

/* light: dark shimmer sweep */
[data-theme=light] .shimmer::after {
  background: linear-gradient(90deg, transparent, rgba(44,36,32,.05), transparent);
}
```

---

## Component Audit Approach

For each module, the task is:
1. Find hardcoded `rgba(255,255,255,...)` text colors → replace with `var(--color-text-N)`
2. Find hardcoded `rgba(255,255,255,...)` borders/dividers → replace with `var(--color-border)` / `var(--color-divider)`
3. Find hardcoded `rgba(0,0,0,...)` text/bg → replace with appropriate token
4. Find hardcoded `#d4a853` / `#b8893a` as text → replace with `var(--color-primary-text)`
5. Find hardcoded surface backgrounds (`#1a1a1a`, `#111111`) → replace with `var(--color-surface)` / `var(--color-bg)`

**Token reference:**

| Hardcoded (dark) | Token |
|---|---|
| `rgba(255,255,255,.85-.95)` | `var(--color-text-1)` |
| `rgba(255,255,255,.55-.7)` | `var(--color-text-2)` |
| `rgba(255,255,255,.35-.5)` | `var(--color-text-3)` |
| `rgba(255,255,255,.15-.28)` | `var(--color-text-4)` |
| `rgba(255,255,255,.06-.09)` | `var(--color-border)` |
| `rgba(255,255,255,.04-.06)` | `var(--color-divider)` |
| `rgba(255,255,255,.12-.18)` | `var(--color-border-m)` |
| `#d4a853` as text | `var(--color-primary-text)` |
| `rgba(212,168,83,.14)` as bg | `var(--color-primary-bg)` |
| `#1a1a1a`, `#111111` as bg | `var(--color-surface)` / `var(--color-bg)` |

---

## Module Scope

### Batch 1 — Shared UI + BottomNav (2 files)
- `shared/ui/BottomNav.tsx`
- `shared/Shimmer.tsx`

### Batch 2 — Map module (high traffic, 20 files)
Core map overlays, cards, and bars that users interact with on every session:
- `MapScreen.tsx`, `PinCard.tsx`, `FilterBar.tsx`, `SearchDropdown.tsx`
- `SearchResultCard.tsx`, `SearchResultRow.tsx`, `SearchResultsStrip.tsx`
- `TravelDateBar.tsx`, `BuildItineraryBar.tsx`, `MultiCityHeader.tsx`
- `ViewAllSheet.tsx`, `MapLoadingOverlay.tsx`, `MapStatusIndicator.tsx`
- `DiscoveryModeToggle.tsx`, `SearchNudge.tsx`, `SurpriseMeButton.tsx`
- `CityHopOverlay.tsx`, `OriginSearchCard.tsx`, `FootprintChips.tsx`
- Pin layers (`ExploreMapMarkers`, `NumberedPinsLayer`, etc.) — these render SVG/canvas, minimal token work

### Batch 3 — Route / Itinerary module (14 files)
- `RouteScreen.tsx`, `ItineraryDayView.tsx`, `ItineraryStopCard.tsx`
- `ItineraryPlaceCard.tsx`, `ItineraryMapCard.tsx`, `DayStops.tsx`
- `TravelDayCard.tsx`, `RecSheet.tsx`, `EngineMessageBanner.tsx`
- Reel: `ItineraryReelScreen.tsx`, `ReelIntroCard.tsx`, `ReelStopCard.tsx`, `ReelRecoCard.tsx`, `ReelFinaleCard.tsx`

### Batch 4 — Trips + Saved module (8 files)
- `TripsScreen.tsx`, `SavedScreen.tsx`, `SavedPlacesTab.tsx`
- `SavedPlaceCard.tsx`, `SavedEventCard.tsx`, `ArrivalBanner.tsx`
- `SwapCard.tsx`, `SmartUpdates.tsx`

### Batch 5 — Profile module (5 files)
- `ProfileScreen.tsx`, `NotificationsScreen.tsx`, `PrivacyScreen.tsx`
- `SubscriptionDetailsScreen.tsx`, `UnitsSheet.tsx`

### Batch 6 — Onboarding + Login (12 files)
- `LoginScreen.tsx`, `WelcomeBackScreen.tsx`, `WalkthroughScreen.tsx`
- `OnboardingShell.tsx`, `OB1Group.tsx` – `OB9BudgetProtect.tsx`
- Note: onboarding is typically dark-only by design choice — light mode may not apply here

### Batch 7 — Journey + Subscription + PWA (9 files)
- `JourneyScreen.tsx` and sub-cards
- `SubscriptionScreen.tsx`, `MiniPaywall.tsx`, `PackPurchaseConfirm.tsx`
- `InstallPrompt.tsx`

---

## Light Theme Additions Needed

Beyond token replacement, a small number of components will need explicit light overrides for things that can't be tokenised — e.g. map overlay blur backgrounds, glassmorphism effects, or photo-overlay contexts where white text is always correct.

Pattern for these:
```tsx
// Instead of hardcoded white-over-image text:
style={{ color: isOverPhoto ? '#fff' : 'var(--color-text-1)' }}
```

The `data-theme` attribute is set on `<html>` by `App.tsx`. Components can read it via `document.documentElement.dataset.theme` or a `useTheme()` hook if needed.

---

## Out of Scope

- Map tile colors (MapLibre style) — separate design decision
- Persona screen — recently redesigned, already uses token system
- Navigation/route overlays on map — they render on top of map tiles and must remain legible against variable photo backgrounds

---

## Success Criteria

- Toggle `data-theme=light` on any screen → text is readable, surfaces are warm cream, no bright gold text on cream
- No WCAG AA failures for interactive text elements at any font size ≥ 12px
- Shimmer visible in both themes
- No hardcoded `rgba(255,255,255,...)` outside of over-photo / glassmorphism contexts
