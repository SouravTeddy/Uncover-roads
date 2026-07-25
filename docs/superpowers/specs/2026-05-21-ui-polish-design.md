# UI Polish — Design Spec
**Date:** 2026-05-21  
**Scope:** Explore tab recent visits · PinCard loading + content · MultiCityHeader · Hard blocker for cities vs dates

---

## 1. Explore Tab — Recent Visits

### Problem
- Visiting the same city N times creates N entries (or broken groupings) in Recent Visits.
- Place thumbnails render broken `<img src="">` because `place.imageUrl` is `""` (empty string), which bypasses the `??` fallback to `getCityPhotoUrl`.

### Design

**Storage — `useLastSession.ts` → `useRecentSessions.ts`**
- New storage key: `uncover:recentSessions`
- Stores: `RecentSession[]` where each is `{ city: string, places: Place[], savedAt: string }`
- Max 3 entries. Rules on save:
  - Same city (case-insensitive) → replace that entry's places + update `savedAt`
  - New city → prepend; if length > 3, drop the oldest entry
- Expose: `sessions: RecentSession[]`, `saveSession(places, city)`, `clearSessions()`
- Old key `uncover:lastSession` is read once on first load for migration, then discarded

**`RecentVisits.tsx`**
- Iterates `sessions` array (up to 3 cities)
- Every session renders a gold uppercase city heading (`color: var(--color-primary-text)`, 10px, uppercase, 0.06em tracking) followed by its place rows — consistent regardless of session count
- Section title: always "Recent visits" (no city name inline)
- Existing `PlaceRow` component unchanged; existing overflow row ("+N more pins") unchanged

**`PlaceThumbnail` — image fix**
```
src = place.photo_ref
  ? getPlacePhotoUrl(place.photo_ref, 120)   // actual place photo, small
  : (place.imageUrl || getCityPhotoUrl(place._city ?? city))
```
`||` not `??` — catches empty string `""`.

---

## 2. PinCard — Hero Loading Animation

### Design
The hero area (190px) always shows the category gradient + icon as the base layer. A shimmer sweep animation plays across it while the image is loading. When the image arrives (fast via Google proxy, or slow via Wikipedia fallback), it fades in at opacity 0→1 over 0.5s.

**Implementation in `PinCard.tsx`**
- Add `imgLoading: boolean` state, set `true` when `imgSrc` is null and a fetch is in flight
- Hero renders: gradient bg + category icon (z-index 1) → sweep overlay (z-index 2, `pointer-events:none`) → image when ready (z-index 3, `animation: fadeIn 0.5s`) → bottom gradient fade (z-index 4)
- Sweep: `::after` pseudo-element on an absolutely-positioned overlay div, `width: 38%`, `background: linear-gradient(90deg, transparent, rgba(255,255,255,.13), transparent)`, `animation: sweep 2s ease-in-out infinite`
- Sweep stops when `imgSrc` is set (remove the sweep overlay from DOM)
- Light theme: sweep uses `rgba(44,36,32,.06)` instead of white

---

## 3. PinCard — Body Progressive Reveal

### Design
Content is revealed section by section as data arrives. No monolithic shimmer block for the whole body.

**Immediate (from `Place` object, no fetch):**
- Category chip
- Place title

**On `details` arrival (staggered, 50ms between each):**
1. Address (delay 0ms)
2. Meta chips — rating only (delay 50ms)
3. Analysis strip (delay 100ms)
4. Hours toggle (delay 150ms)
5. Description (delay 200ms)
6. CTA button (delay 250ms)

**While `details === null`:** render shimmer bars for each of the above sections so the card height feels natural and user knows content is loading:
- Address: 1 shimmer bar, 55% width, 11px tall
- Meta: 2 shimmer chips (52px, 38px wide), 22px tall, border-radius 99px
- Analysis: 1 shimmer block, full width, 62px tall, border-radius 10px
- Hours: 1 shimmer bar, 40% width, 13px tall
- Description: 3 shimmer lines (100%, 80%, 55%), 10px tall, 5px gap
- CTA: 1 shimmer block, full width, 42px tall, border-radius 12px

**Section animation:** `sectionReveal` keyframe — `translateY(12px) opacity(0)` → `translateY(0) opacity(1)`, duration 360ms, `cubic-bezier(.22,1,.36,1)`.

**Section order (final):**
1. Category chip
2. Title
3. Address
4. Meta chips (rating only — no open/close chip, no price level)
5. Analysis strip
6. Hours toggle + collapsible list
7. Description
8. CTA

---

## 4. PinCard — Analysis Strip

### Design

**Remove:** `"Our Analysis"` title label entirely.

**Remove:** `price_level` chip — `$$$$` is Google's general expense indicator, not entry fee data. Only show if actual ticket/entry fee becomes available in future.

**Remove:** open/close from meta chips row. Handled in analysis strip instead.

**Remove:** generic `"Open on all your travel days"` insight. Replace with travel-specific phrasing (see below).

**Insight colour states:**
| State | Colour | When |
|---|---|---|
| Green | `#6b9470` / `rgba(107,148,112,...)` | Open / no conflict / positive |
| Gold (brand) | `var(--color-primary)` | Tips, trends, best-time hints |
| Warm red | `#c26464` / `rgba(194,100,100,...)` | Closed on travel day / conflict |

**Insight pattern:** `[what] · [why] → [consequence]` + optional `[↗ link]`

**Open/close insight (always first, replaces chip):**
- Travel dates set + open all days: `"Open every day [start]–[end] · no schedule conflicts"` — green
- Travel dates set + closed on a day: `"Closed [DayName] · [date] falls in your trip → plan another day"` — warm red, `↗ link` if `details.website` exists
- No travel dates: `"Open now"` (green) or `"Closed now"` (warm red) based on `open_now`

**Other insights (existing logic in `computeAnalysisInsights`, just reworded):**
- `trending`: `"Trending in [Month] · popular during your dates → consider booking ahead"` + `↗` if website
- `hidden_gem`: `"Hidden gem · fewer crowds during your trip → any time of day works"`
- `getting_busy`: `"Getting popular fast · crowds growing → visit early in your trip"`
- tourism/park + weekend: `"Busiest on weekends · your trip includes [Sat/Sun] → arrive before 10am"`
- restaurant: `"Peak lunch 12–2pm · your trip overlaps weekdays → book a table ahead"` + `↗` if website
- cafe + weekdays: `"Quieter on weekday mornings · your trip aligns well → no need to rush"`

**External link rule:**
- Show `↗` (opens `details.website` → fallback `details.googleMapsUrl` in new tab) when:
  - Consequence contains an actionable verb: "book", "reserve", "check", "confirm"
  - AND `details.website` or `details.googleMapsUrl` is available
- Link renders inline after consequence text: small gold underlined label + `↗` icon (11px)

**`computeAnalysisInsights` return type change:**
```ts
interface AnalysisInsight {
  text: string        // full "[what] · [why] → [consequence]" string
  state: 'gold' | 'green' | 'red'
  linkLabel?: string  // e.g. "book", "reserve", "check hours" — only set when actionable
}
```

---

## 5. MultiCityHeader Redesign

### Changes to `MultiCityHeader.tsx`
1. **Remove** the `+ city` chip (cities come only from explore tab or automatic map detection)
2. **Remove** the `transitSummary` row entirely (transit detail belongs in itinerary, not map header)
3. **Remove** `transitSummary` prop from the component interface
4. **Add** a date line below the chip row:
   - Content: `"[startFormatted] – [endFormatted] · [N] days"` (e.g. `"Jun 18 – Jun 25 · 7 days"`)
   - Style: `font-size: 10px`, `color: var(--color-text-3)`, `font-weight: 500`, `margin-top: 5px`, `padding: 0 1px`
   - Tappable: `onClick` → `onDateTap` prop (new) — navigates to destination to change dates
   - Receives: `travelStartDate`, `travelEndDate` as props (already in store)

### Changes to `MapScreen.tsx`
- In the right-column (city name + date span): wrap in `{!isMultiCity && (...)}` guard
  - Multi-city: city chips already identify the active city; right-column conflicts with them
  - Single-city: unchanged — city name + date top-right
- Remove `transitSummary` calculation (`buildTransitSummary`) and its pass-through to `MultiCityHeader`
- Wire `onDateTap` → `dispatch({ type: 'GO_TO', screen: 'destination' })`

### Light theme
- Glass card background: `rgba(250,248,244,.92)`
- Inactive chip: `background: var(--color-surface2)`, `color: var(--color-text-2)`, `border: 1px solid var(--color-border)`
- All other tokens: already CSS-variable-based, no change needed

---

## 6. Hard Blocker — Cities vs Travel Days

### New utility: `computeMultiCityFeasibility`

**File:** `frontend/src/modules/map/useHardBlockers.ts` (add alongside existing `computeHardBlockers`)

**Inputs:**
- `selectedPlaces: Place[]`
- `cityFootprints: CityFootprint[]` (has `lat`, `lon`, `transitMode` per city)
- `travelStartDate: string | null`
- `travelEndDate: string | null`
- `stopsPerDay: number` (from `personaProfile?.stops_per_day ?? 3`)

**Logic:**
```
availableDays = computeTotalDays(travelStartDate, travelEndDate)
if availableDays === 0 → return null  // no dates set, skip check

For each city (grouped from selectedPlaces by _city):
  cityDays += calculateEstimatedDays(cityPinCount, stopsPerDay)   // min 1

For each adjacent pair in cityFootprints (i → i+1):
  km = haversineKm(footprint[i].lat/lon, footprint[i+1].lat/lon)
  mode = footprint[i+1].transitMode ?? 'flight'

  durationMin estimate:
    drive:  km / 80 × 60
    train:  km / 150 × 60
    flight: (km / 900 + 3) × 60    // 3h airport overhead

  transitDays += durationMin > 180 ? 1 : 0   // >3h loses the day

totalNeeded = cityDays + transitDays
if totalNeeded > availableDays → return { totalNeeded, availableDays, cityCount }
else → return null
```

**Integration in `BlockerSheet`:**
- When `computeMultiCityFeasibility` returns a result, inject a synthetic `HardBlocker`:
  ```ts
  {
    placeId: '__trip__',
    placeTitle: 'Your travel plan',
    reason: `Your plan may need ~${totalNeeded} days — you've set ${availableDays}. Full breakdown in your itinerary.`
  }
  ```
- This renders using the existing blocker row design (no new UI needed)
- "Build anyway" button builds normally → user lands in itinerary where detail is visible
- The `__trip__` sentinel can be used by `BlockerSheet` to render a calendar icon (🗓) instead of the red `block` icon if desired — but existing design works fine as-is

**Where called:**
- `useHardBlockers` hook: add `computeMultiCityFeasibility` result as an additional item at the front of the `blockers` array (trip-level concern shown first)

---

## Summary of files changed

| File | Change |
|---|---|
| `useLastSession.ts` → `useRecentSessions.ts` | Multi-session storage (up to 3 cities), migration from old key |
| `RecentVisits.tsx` | `PlaceThumbnail` image fix; iterate `sessions` array; gold city heading |
| `PinCard.tsx` | Hero sweep animation; progressive reveal; section reorder; remove price chip; remove open/close chip |
| `pincard-utils.ts` | `AnalysisInsight` type; reworded insight strings; open/close as first insight; warm red state; link metadata |
| `MultiCityHeader.tsx` | Remove `+city` chip; remove transit row; add date line + `onDateTap`; remove `transitSummary` prop |
| `MapScreen.tsx` | Guard right-column city name/date in multi-city; remove `buildTransitSummary`; wire `onDateTap` |
| `useHardBlockers.ts` | Add `computeMultiCityFeasibility`; inject `__trip__` synthetic blocker |
| `trip-capacity-utils.ts` | No change (reused) |
| `journey-legs.ts` | No change (reused: `calculateEstimatedDays`) |
| `journey-utils.ts` | No change (reused: `haversineKm`) |
