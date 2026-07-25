# Explore Screen Redesign — Design Spec
*2026-05-16*

## Overview

Full rewrite of `DestinationScreen.tsx` and its satellite components. The goal is a single cohesive "home base" screen that feels personal and contextual rather than a generic search form. Design approved through visual mockup iteration (see brainstorm session 25052-1778938810).

---

## Screen Architecture

The screen has **one layout** that adapts content based on state — not multiple conditional layouts. Components render or stay empty based on what data is available.

```
DestinationScreen
├── ExploreHero          (hero image + Ken Burns + greeting + app icon)
├── ExploreSearchBar     (invariant search input + near_me button)
├── [MultiCityChips]     (only when 2+ cities selected)
├── CuratedCityCards     (horizontal scroll, always shown)
└── RecentVisits         (session pins, empty state when none)
```

---

## Components

### ExploreHero

Full-bleed 236px hero, always present. Ken Burns `scale(1 → 1.06)` over 20s.

**Image hierarchy (context-aware, no label):**

| Priority | Condition | Image |
|---|---|---|
| 1 | Active city in session (`state.city`) | That city's Unsplash photo, watermark text = city name |
| 2 | No active city, saved trips exist | Last saved trip's city photo |
| 3 | Has persona, no city history | Archetype editorial: flaneur=moody streets, gastronaut=food market, nightCreature=neon bar street |
| 4 | True first use | Generic travel editorial (Unsplash `photo-1476514525405-09b77a9d1f66`) |

**Gradient overlay:**
- Dark: `rgba(0,0,0,.52)→transparent→rgba(12,12,14,.55)→rgba(12,12,14,1)`
- Light: `rgba(0,0,0,.48)→transparent→rgba(250,248,244,.55)→rgba(250,248,244,1)`

**Greeting (overlaid on hero photo, always white text — safe because of dark overlay):**
- Label row (9px uppercase): "GOOD MORNING / AFTERNOON / EVENING / NIGHT"
  - 5am–12pm = morning, 12pm–5pm = afternoon, 5pm–9pm = evening, 9pm–5am = night
  - Computed at render from `new Date().getHours()`
- Name (Cormorant Garamond 700, 22px): first name from auth `displayName`, split on first space
- App icon tile (top-right): `34×34px`, frosted glass (`rgba(255,255,255,.15)` in both themes since it's over the photo), gold `explore` icon

**Watermark:** City name or "EXPLORE" in Cormorant Garamond 86px, `rgba(255,255,255,.04)`, centered over photo, pointer-events none.

---

### ExploreSearchBar

Single, invariant in all states. Never changes placeholder, never changes layout.

```
[search icon] [Search for a city...]  [near_me button]
```

- Height: 50px, border-radius: 999px
- Dark: `background:#18181c`, `border:1px solid rgba(255,255,255,.09)`
- Light: `background:#fff`, `border:1px solid rgba(44,36,32,.18)`, `box-shadow:0 2px 12px rgba(44,36,32,.06)`
- Search icon + placeholder: dark=`rgba(255,255,255,.28)`, light=`#9c8a7e`
- `near_me` button: 38×38px pill, gold tint bg+border, gold fill icon
- Tapping anywhere in the bar opens city search input (existing `CitySearch` logic)
- `near_me` button: resolves current location via Geolocation API, skips calendar, goes directly to map with today's date

**City selection flow:** search → `CitySearch` autocomplete → city selected → calendar opens (`DateRangeCalendar`) → date selected → map

---

### MultiCityChips

Only rendered when `state.cities.length >= 2`. Hidden (not empty-spaced) when single city or no city.

```
[Paris ×]  [+1 city ▾]
```

- Compact pill row below search bar, `padding:4px 20px`
- Primary city pill: city name + `×` dismiss
- Overflow pill: `+N city` showing count of additional cities, tapping expands a sheet

---

### CuratedCityCards

Horizontal scroll, persona-matched city suggestions. Always shown (not empty-stated when no persona — falls back to editorial picks).

- Section label: "Curated for you" (uppercase, 9px)
- When `state.travelStartDate` is set, show date pill next to label: `📅 Jun 12–16`
- Cards: 136×178px (with date pill) / 136×188px (without), border-radius 18px, photo + gradient overlay + city name + country + tag pill
- Tapping a card:
  - If travel dates are set → go directly to map with that city + dates
  - If no dates → open calendar first, then map
- City list: from persona's `venue_filters` / `itinerary_bias` to pick cities editorially; fallback to a static curated list (Lisbon, Kyoto, Istanbul, Marrakech, Porto, etc.)

---

### RecentVisits

Shows unsaved `selectedPlaces` from the last session, persisted in `localStorage` under key `uncover:lastSession`.

**Data shape:**
```ts
interface LastSession {
  places: Place[];
  city: string;
  savedAt: string; // ISO
}
```

Written to localStorage when user navigates away from map. Read on DestinationScreen mount. Cleared after 30 days.

**Rendering:**
- Section label: "Recent visits" or "Recent visits · [City]" (if single city) or "Recent visits · [N cities]"
- Show first 3–4 places as thumbnail rows (40×40px rounded image, place name, category · neighbourhood, chevron)
- If `places.length > 4`: show "+N more" overflow row with stacked 24px thumbnails
- Tapping any row or the overflow row → dispatch `GO_TO: 'map'` with those places pre-selected
- Multi-city grouping: group rows by `place._city`, gold subheading per city group
- Empty state: dashed border box with `pin_drop` icon + "Pins from your last session appear here"

---

## Light Theme Token Mapping

*These are the tokens to use — not hardcoded rgba values.*

| Role | Dark | Light |
|---|---|---|
| Hero text (over photo) | `#fff` | `#fff` (photo has dark overlay) |
| Primary body text | `var(--color-text-1)` | `var(--color-text-1)` = `#2c2420` |
| Secondary text (subtitle) | `var(--color-text-2)` | `var(--color-text-2)` = `#6b5e57` |
| Label caps / section headers | `var(--color-text-3)` | `#8a7870` (see token gap below) |
| Decorative / empty state | `var(--color-text-4)` | `#9c8a7e` |
| Chevrons | `rgba(255,255,255,.18)` | `#c4b8b0` |
| Gold icon | `#d4a853` | `#b8893a` |
| Gold text (nav active, date pill) | `#d4a853` | `#7a5c18` (see token gap below) |
| Row divider | `rgba(255,255,255,.05)` | `rgba(44,36,32,.08)` |

*Token gaps to fix in the theme plan (see separate spec):*
- Add `--color-primary-text` = `#d4a853` (dark) / `#7a5c18` (light) — gold-as-text token
- `--color-text-3` in light should shift to `#8a7870` (currently `#7e7068` = 4.5:1 — borderline; section caps need at least 3:1 uppercase)

---

## Files Affected

**Delete (no longer needed after rewrite):**
- `InProgressSection.tsx`
- `ExploreEmptyState.tsx`
- `DraftBanner.tsx`
- `PlaceChips.tsx`
- `PlacePhotoScroll.tsx`
- `CityHeroCard.tsx`

**Rewrite:**
- `DestinationScreen.tsx` — compose new components, wire state
- `ExploreSearchBar.tsx` — simplified to single invariant bar

**Create:**
- `ExploreHero.tsx` — hero image + Ken Burns + greeting
- `CuratedCityCards.tsx` — horizontal persona cards
- `RecentVisits.tsx` — session pins list
- `useLastSession.ts` — localStorage read/write hook

**Unchanged (keep existing logic):**
- `CitySearch.tsx` — autocomplete, used as before
- `DateRangeCalendar.tsx` — calendar modal, used as before
- `useCitySearch.ts` / `useGoogleCitySearch.ts`
- `types.ts`

---

## What This Is Not

- No city chips / badges below search bar
- No "In progress" hero card
- No "Add another city" in search bar
- No second search input in any state
- No profile avatar — app icon only
