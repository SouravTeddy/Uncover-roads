# Travel Date Range + Multi-Day Itinerary Design

**Date:** 2026-04-10

## Goal

Move travel date context from TripPlanningCard into the explore tab as a persistent date range input (start + end date). Use this range to build a multi-day itinerary in one shot, and warn users when their selected places overflow or underfit their trip duration.

## Scope

**In scope (Phase 1.5):**
- `TravelDateBar` component in MapScreen (above FilterBar)
- `DateRangeSheet` bottom sheet — two 7-day rolling pill strips (start + end)
- Overflow/shortage capacity indicator on the bar
- `travelStartDate` / `travelEndDate` in AppState (sessionStorage-persisted)
- Remove date strip from TripPlanningCard; show read-only trip summary badge
- Multi-day build: N parallel `aiItinerary` calls, one per day
- `SET_ITINERARY_DAYS` store action storing `Itinerary[]`
- Day dividers in existing itinerary view ("Day 2 — Apr 11")
- `trip-capacity-utils.ts` pure utility + tests

**Out of scope (Phase 2):**
- Swipeable day card view
- Place interchange between days
- Transport cards between cities
- Full calendar range picker (will replace the pill strips later)

---

## Architecture

### Data model

Two new fields added directly to `AppState` (not inside `TripContext` — these are explore-level context):

```typescript
travelStartDate: string | null   // ISO date e.g. "2026-04-10"
travelEndDate:   string | null   // ISO date e.g. "2026-04-14"
```

Persisted to sessionStorage alongside `selectedPlaces`.

`totalDays` is computed wherever needed:
```typescript
Math.ceil((new Date(travelEndDate) - new Date(travelStartDate)) / 86_400_000) + 1
```

The existing `tripContext.date: string` field is removed. When building:
- `tripContext.days` = `totalDays`
- Each parallel call uses `travel_date = travelStartDate + (dayNumber - 1) days`

Store actions added:
- `SET_TRAVEL_DATES` — sets `travelStartDate` + `travelEndDate`
- `SET_ITINERARY_DAYS` — stores `Itinerary[]` (replaces single `SET_ITINERARY`)

### File map

| File | Action | What changes |
|------|--------|-------------|
| `frontend/src/shared/store.tsx` | Modify | Add `travelStartDate`, `travelEndDate` to AppState; add `SET_TRAVEL_DATES`, `SET_ITINERARY_DAYS` actions; remove `date` from TripContext |
| `frontend/src/shared/types.ts` | Modify | Remove `date` from `TripContext` type; add `total_days` to `ItineraryRequest.trip_context` if missing |
| `frontend/src/modules/map/trip-capacity-utils.ts` | **Create** | Pure function `getTripCapacityStatus` + `CapacityStatus` type |
| `frontend/src/modules/map/trip-capacity-utils.test.ts` | **Create** | 6 tests covering all status cases |
| `frontend/src/modules/map/TravelDateBar.tsx` | **Create** | Persistent date range bar + `DateRangeSheet` bottom sheet |
| `frontend/src/modules/map/MapScreen.tsx` | Modify | Import + render `TravelDateBar` between search bar and FilterBar |
| `frontend/src/modules/map/useTripPlanInput.ts` | Modify | Remove `dates`/`selectedDate`/`setSelectedDate`; `handleBuild` reads store dates, fires N parallel calls |
| `frontend/src/modules/map/TripPlanningCard.tsx` | Modify | Remove date strip section; add trip summary badge in header; update CTA copy |
| `frontend/src/modules/route/ItineraryView.tsx` | Modify | Render `Itinerary[]` with day dividers ("Day 2 — Apr 11") |

---

## Component Design

### TravelDateBar

**Location:** MapScreen, between search bar area and FilterBar.

**Visual states:**

Unset:
```
[🗓  Set travel dates                                    →]
```
- Height: 40px, background: `rgba(255,255,255,.04)`, border: `rgba(255,255,255,.08)`, border-radius: 12px
- Icon: Material Symbols `calendar_month` 16px, `#8e9099` (TEXT3)
- Text: Inter 500, 13px, `#8e9099` (TEXT3)

Set:
```
[🗓  Apr 10 → Apr 14  ·  5 days              ⚠ 12 places]
```
- Icon: `calendar_month` 16px, `#3b82f6` (PRIMARY)
- Date text: Plus Jakarta Sans 700, 13px, `#f1f5f9` (TEXT1)
- Duration "· 5 days": Inter 600, 12px, `#93c5fd`
- Status indicator (right): Inter 600, 11px
  - ✓ "looks good" — `#4ade80`
  - ⚠ "may overflow" — `#fbbf24`
  - ◎ "add more?" — `#60a5fa`
  - (hidden when 0 places or dates unset)

Tapping anywhere opens `DateRangeSheet`.

### DateRangeSheet

Bottom sheet modal (same portal + backdrop pattern as TripPlanningCard).

Two sections stacked vertically:
1. **Start date** — label "Departure", 7-day rolling pill strip (identical style to old TripPlanningCard date strip: 52px wide, 18px day numbers, "TODAY" for first entry)
2. **End date** — label "Return", same pill strip

"Done" CTA (54px, gradient, PRIMARY) dispatches `SET_TRAVEL_DATES`.

End date pills disable any date before the selected start date. Default: start = today, end = today + 3 days.

---

## Capacity Logic

File: `frontend/src/modules/map/trip-capacity-utils.ts`

```typescript
export type CapacityStatus = 'unset' | 'ok' | 'overflow' | 'shortage'

export function getTripCapacityStatus(
  placeCount: number,
  totalDays: number,
): CapacityStatus {
  if (totalDays === 0 || placeCount === 0) return 'unset';
  if (placeCount < totalDays) return 'shortage';           // < 1 place/day
  if (placeCount > totalDays * 5) return 'overflow';       // > 5 places/day (fast pace cap)
  return 'ok';
}
```

When pace setting exists (Phase 3), the `5` multiplier becomes a parameter. The function signature stays identical.

Tests (`trip-capacity-utils.test.ts`):
- `unset` when `totalDays === 0`
- `unset` when `placeCount === 0`
- `shortage` when `placeCount < totalDays`
- `ok` when 1 place/day
- `ok` when 4 places/day (middle range)
- `overflow` when `placeCount > totalDays * 5`

---

## Multi-Day Build

In `useTripPlanInput.ts`, `handleBuild` becomes:

```typescript
async function handleBuild(pinDropResult) {
  const totalDays = computeTotalDays(travelStartDate, travelEndDate) ?? 1;
  const results = await Promise.all(
    Array.from({ length: totalDays }, (_, i) =>
      api.aiItinerary({
        ...baseRequest,
        days: totalDays,
        day_number: i + 1,
        trip_context: {
          ...baseTripContext,
          travel_date: addDays(travelStartDate ?? todayIso(), i),
          total_days: totalDays,
        },
        selected_places: allSelectedPlaces,
      })
    )
  );
  dispatch({ type: 'SET_ITINERARY_DAYS', payload: results });
  navigate('route');
}
```

If any day's call fails: show per-day error in the itinerary view with a "Retry Day N" button. Other days' results remain visible.

---

## TripPlanningCard Changes

**Remove:** Entire "Travel date" section (date strip, `selectedDate`, `setSelectedDate`).

**Add to header** (next to "N places selected" pill):
```
[📅 Apr 10 – Apr 14 · 5 days]
```
- Same pill style as places badge
- If no dates set: shows "📅 Set travel dates" in TEXT3 (informational only)

**CTA copy:**
- 0 or 1 day: "Build my itinerary"
- 2+ days: "Build my 5-day itinerary"

**Fallback:** If `travelStartDate` is null, `totalDays` defaults to 1. Build still works.

---

## Itinerary View Changes

`frontend/src/modules/route/ItineraryView.tsx` receives `itineraryDays: Itinerary[]` from store.

Renders sequentially:
```
── Day 1 · Apr 10 ──────────────────
[place cards]

── Day 2 · Apr 11 ──────────────────
[place cards]
```

Day divider: full-width rule with date label — Plus Jakarta Sans 700, 13px, TEXT2, centered. The swipeable day card layout replaces this in Phase 2.

Single-day consumers (existing code that reads `itinerary` from store): updated to read `itineraryDays[0]`.

---

## Error Handling

- Date range picker: end date before start date → disabled in the UI (end date pills before start date are greyed out and unselectable)
- Multi-day build: per-day failure shows retry, other days unaffected
- No dates set: graceful fallback to 1-day build throughout
