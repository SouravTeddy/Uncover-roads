# Map Screen — 7 Issues Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Map screen bugs and redesigns across FilterBar, BottomActionTray, PinCard, GuideBulb

---

## Issue 1 — Saved Banner (City-Scoped)

**Problem:** The Saved banner appears whenever `favouritedPins.length > 0` globally. If a user saved places in Tokyo yesterday and opens Sydney today, the banner appears in Sydney. Tapping it shows nothing because those pins aren't in the current city's `places` array.

**Fix:**
- Change the banner condition in `MapScreen.tsx` from `favouritedPins.length > 0` to `favouritedPins.filter(p => p.city === city).length > 0`
- The banner count also updates to show only current-city saves
- Past saves from other cities remain accessible in `SavedPlacesTab` (already grouped by city there — no changes needed)

---

## Issue 2 — Curated Tab Count Shows but No Pins Appear

**Problem:** `curatedCount` is computed and displayed before the layer data is ready, or `OurPicksPinsLayer` fails to render the loaded picks.

**Fix:**
- Audit the `ourPicks` fetch timing in `MapScreen.tsx` (lines 272–280). The fetch runs when `activeFilter === 'curated'` — confirm `curatedCount` is only computed after data resolves, not from stale state
- If `ourPicks` resolves to empty, `curatedCount` should be 0 — no count shown on the tab
- Add a `console.warn` guard to surface empty-data cases in dev

---

## Issue 3 — Category Counts Don't Update Dynamically

**Problem:** `allCount={places.length}` always shows the total city places count. When a user taps a category chip (e.g. Landmarks), the All tab count doesn't reflect the filtered subset. Counts also don't update as the map viewport changes.

**Fix:**
- When `activeCategories.length > 0`, `allCount` passed to `FilterBar` should equal the sum of filtered places, not `places.length`
- `categoryCounts` is already derived from `places` — it updates correctly when `places` changes via `SET_PLACES` / `MERGE_PLACES` dispatches (map move triggers these). No change needed there.
- When a category chip is active, the All tab label should read the count of places in that category, not total places

**Logic:**
```ts
const displayCount = activeCategories.length > 0
  ? filteredPlaces.length
  : places.length
```
Pass `displayCount` as `allCount` to `FilterBar`.

---

## Issue 4 — Guide Bulb Not Firing

**Problem:** The `area` condition in `useGuideMessages.ts` requires `selectedPlaces.length === 0 && city !== null && persona !== null && mapPlaces.length > 0`. The rising-edge detection (via `prevConditions` ref) means it only fires once per component mount. If the user arrives with persona set and map loaded, the condition starts `true` — never a rising edge, so no message fires.

**Fix:**
- Reset `prevConditions.current` when `city` changes so the `area` message re-fires on each new city
- Add a guard: if `persona` is null, do not silently skip — surface a visible no-op so it's debuggable
- Use a `useEffect` with `[city]` dependency to reset the `prevConditions` ref on city change

```ts
useEffect(() => {
  prevConditions.current = { area: false, event: false, 'build-ready': false, cluster: false }
}, [city])
```

---

## Issue 5 — BottomActionTray Overlaps PinCard

**Problem:** `BottomActionTray` is `position: fixed, zIndex: 60`. `PinCard` is `position: fixed, zIndex: 40`. When a PinCard opens the tray renders on top of it.

**Fix:**
- In `MapScreen.tsx`, render `BottomActionTray` only when `activePinId === null`
- The user can add to itinerary from within the PinCard itself — no functionality lost
- The tray reappears as soon as the card is dismissed
- Travel date pill is removed from `BottomActionTray` entirely (moved to top-right — see Issue 6)

**Implementation:** Wrap `<BottomActionTray>` in `{!activePinId && <BottomActionTray ... />}`

---

## Issue 6 — Travel Date + City Name Top-Right

**Problem:** The date pill at the bottom feels like a primary action button. It's static context, not an action. The map screen also has no city identity — there's no label showing what city you're exploring.

**Design:**
- Remove date pill from `BottomActionTray`
- Add a right-aligned column in the top overlay (right side, same `top` position as GuideBulb currently):

```
Sydney          ← Cormorant Garamond, gold gradient (#d4a853 → #b8893a)
May 20–27       ← DM Sans 10px, --color-text-3, tappable → opens date picker
[💡 bulb]       ← GuideBulb pushed below the date
```

**Tokens used:**
- City name: `font-family: var(--font-heading)`, `font-size: 18px`, gradient `#d4a853 → #b8893a`, `-webkit-background-clip: text`
- Date: `font-size: 10px`, `font-weight: 600`, `color: var(--color-text-3)`, `cursor: pointer` → calls existing `onDateTap`
- No pill, no border, no background — plain text, right-aligned

**City name behaviour:**
- Reads from `city` in store (already available)
- Updates live as user pans via existing `usePinCityDetector` — no new logic needed
- Dates are always present (user sets them before entering map) — no fallback state needed

**GuideBulb:** Moves to sit below the date label in the same right-side column. Gap of 6px between date and bulb.

---

## Issue 7 — Place Card Full Redesign

### Layout

```
[drag handle]
[hero: swipeable image gallery, 190px]  ← heart overlaid top-right
[card body: scrollable, max 80vh]
  category chip
  place name          ← Cormorant Garamond, gold gradient
  address
  meta chips          ← Open/Closed (sage), Rating (amber), Price (surface2)
  [Our Analysis aura strip]
  ──────────────────
  description (truncated, "See more →")
  hours row (expandable)
  [+ Add to itinerary button]
```

### Hero Image Gallery
- Height: 190px
- Multiple photos from `details.photo_refs` (Google Places). Swipe left/right to navigate.
- Dot indicators bottom-center. Active dot widens to 14px pill.
- Tap hero → fullscreen overlay (`position: fixed, inset: 0, zIndex: 200`, black bg). Tap outside to dismiss.
- If no photos: category icon centred on `catColor + '22'` gradient background (existing behaviour preserved).

### Heart Button
- `position: absolute, top: 11px, right: 11px` over hero
- Background: `rgba(0,0,0,0.48)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(255,255,255,0.18)`
- Same dark overlay in **both** light and dark themes — ensures visibility over any hero image
- Saved state: background shifts to `rgba(212,168,83,0.35)`, border `rgba(212,168,83,0.5)`
- Icon: `🤍` → `❤️` on save

### Place Name
- `font-family: var(--font-heading)` (Cormorant Garamond)
- `font-size: 24px, font-weight: 700`
- `background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))`, `-webkit-background-clip: text`

### Meta Chips
| Chip | Background | Border | Text |
|------|-----------|--------|------|
| Open | `--color-sage-bg` | `--color-sage-bdr` | `--color-sage` |
| Closed | `--color-amber-bg` | `--color-amber-bdr` | `--color-amber` |
| Rating | `--color-amber-bg` | `--color-amber-bdr` | `--color-amber` |
| Price | `--color-surface2` | `--color-border-m` | `--color-text-3` |

### Our Analysis — Aura Strip

Only shown when at least one insight is computable. Hidden entirely if none apply. Max 3 insights shown.

**Visual:**
- Container: `background: var(--color-primary-bg)`, `border: 1px solid rgba(212,168,83,.22)`, `border-radius: 12px`
- Left bar: `width: 3px`, `background: linear-gradient(to bottom, var(--color-primary), var(--color-primary-dk))`
- Glow: `rgba(212,168,83,.22)` blurred circle top-left
- Each insight: dot `background: var(--color-primary)` + plain text `color: var(--color-text-2)`, `font-size: 12px`

**Insight types (in priority order):**

| # | Type | Data source | Travel-date aware |
|---|------|------------|------------------|
| 1 | Trend velocity | `ourPicks` badge (`trending`/`hidden_gem`/`getting_busy`) | Yes — references travel month |
| 2 | Hours / open status | `details.weekday_text` + `travelStartDate/EndDate` | Yes — "Open on all your travel days" |
| 3 | Best visiting time heuristic | `place.category` + day-of-week from travel dates | Yes — "Gets busy on weekends — go early" |

**Text templates:**

*Trend velocity:*
- `trending` + dates → `"Popular in {month} — can get busy around your trip"`
- `trending` + no dates → `"Trending lately — mornings are quieter"` *(not applicable per spec — dates always set)*
- `hidden_gem` + dates → `"Hidden gem — fewer crowds during your trip"`
- `getting_busy` + dates → `"Getting popular — worth visiting early in your trip"`

*Hours:*
- All travel days open → `"Open on all your travel days"`
- Closed on a travel day → `"Closed on {day} — your day {n}"` (existing `dateAlert` logic, surfaced in aura strip instead of separate chip)

*Best time heuristic:*
- Landmark/Park + weekend travel → `"Gets busy on weekends — go early morning"`
- Restaurant + any travel → `"Peak lunch 12–2pm — consider booking ahead"`
- Café + weekday travel → `"Quieter on weekdays — your trip includes weekday mornings"`

### Scrollable Body
- `overflow-y: auto`, `max-height: 58vh`, `scrollbar-width: none`
- Only the content below the hero scrolls — hero stays fixed

### Animations (framer-motion)
Staggered section reveal using existing `containerVariants` / `sectionVariants` pattern from `PersonaScreen.tsx`:
- Container: `staggerChildren: 0.07, delayChildren: 0.04`
- Each section: `opacity: 0, y: 16` → `opacity: 1, y: 0`, `duration: 0.4, ease: [0.22,1,0.36,1]`
- Sections: meta row → aura strip → description → hours → CTA

### CTA Button
- `background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))`
- `color: #0f0d0c` (dark text on gold — same as Build Itinerary button)
- `box-shadow: var(--shadow-primary)`
- In-itinerary state: transparent bg, `border: 1px solid rgba(212,168,83,.35)`, `color: var(--color-primary)`

---

## Files Affected

| File | Change |
|------|--------|
| `MapScreen.tsx` | Issue 1: city-filter saved banner; Issue 3: displayCount; Issue 5: hide tray on activePinId; Issue 6: add right-col city/date/bulb |
| `BottomActionTray.tsx` | Issue 5+6: remove date pill prop and render |
| `PinCard.tsx` | Issue 7: full redesign — gallery, heart overlay, scrollable body, aura strip, framer-motion |
| `useGuideMessages.ts` | Issue 4: reset prevConditions on city change |
| `FilterBar.tsx` | Issue 3: accept and use `displayCount` instead of raw `allCount` |
| `GuideBulb.tsx` | Issue 6: remove from its current absolute-positioned div; rendered inside new right-col |
| `pincard-utils.ts` | Issue 7: add `computeAnalysisInsights(place, details, ourPickBadge, travelStart, travelEnd)` — returns `string[]` max 3 |
