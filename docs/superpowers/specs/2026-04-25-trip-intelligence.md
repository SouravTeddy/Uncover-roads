# Trip Intelligence — Design Spec
**Date:** 2026-04-25
**Status:** Approved for implementation
**Depends on:** `TripsScreen.tsx` (exists), `SavedItinerary` type (needs extension)

---

## Overview

Three layers of intelligence added to saved trips:

1. **Countdown** — live timer on each trip card until travel date
2. **Smart Updates** — user-triggered pre-travel checks for events, hours changes, and weather
3. **Day-of Recalibration** — auto-prompted on travel date; shows swap cards for any last-minute adjustments

All three are surfaced inside `TripsScreen.tsx` / `TripCard`.

---

## 0. Data Model Changes

### `SavedItinerary` extension (types.ts)

Add three new fields:

```typescript
export interface SavedItinerary {
  id: string;
  city: string;
  date: string;              // existing — ISO date the trip was saved
  travelDate: string | null; // NEW — ISO date of actual travel (from tripContext.date)
  cityLat: number | null;    // NEW — for events/weather API calls
  cityLon: number | null;    // NEW — for events/weather API calls
  selectedPlaces: Place[];   // NEW — needed for hours re-check and recalibration
  itinerary: Itinerary;
  persona: Persona;
  // Intelligence state (not persisted to server — localStorage only)
  lastUpdateCheck: string | null;  // NEW — ISO datetime of last update check
  pendingSwapCards: SwapCard[];    // NEW — persisted swap cards until resolved
}
```

### New types

```typescript
export type UpdateCardKind = 'event' | 'hours_change' | 'weather';

export interface TripUpdateCard {
  id: string;
  kind: UpdateCardKind;
  tripId: string;
  title: string;          // e.g. "Tokyo Lantern Festival · Day 2 · 2km from Senso-ji"
  detail: string;         // e.g. "Running 7–10pm at Ueno Park · Free entry"
  affectedStop?: string;  // place name this update relates to
  actionLabel?: string;   // e.g. "Add to itinerary"
  severity: 'info' | 'warning';
}

export interface SwapCard {
  id: string;
  stopName: string;
  stopIdx: number;
  currentSummary: string;   // e.g. "2:00 PM · 2 hrs"
  currentNote?: string;
  suggestedSummary: string; // e.g. "Move to 11:00 AM"
  suggestedNote: string;    // reason from LLM
  resolved: boolean;
  choice: 'new' | 'original' | null;
}
```

---

## 1. Countdown Timer

### Where
Inside each `TripCard` in `TripsScreen.tsx`, below the meta row (date + stops count).

### Logic
- Only shown if `travelDate` is set and is in the future
- Same day as travel: show "Today · [city]" with a distinct colour (indigo/gold)
- In the past: hide countdown, show "Completed" badge
- Between now and travel: show "X days" (round down — if 1.5 days away, show "1 day")

### Visual
```
┌─────────────────────────────────┐
│ Tokyo                           │
│ Jun 14 · 8 stops                │
│ ──                              │
│ ⏱ 14 days until your trip      │  ← countdown row
└─────────────────────────────────┘
```

- Icon: `schedule` (Material Symbol)
- Color: indigo `#6366f1` when > 7 days, amber `#f59e0b` when ≤ 7 days, green `#22c55e` on travel day
- Text: "X days until your trip" / "Tomorrow" / "Today · Have you arrived?"
- No seconds or hours — day granularity only

---

## 2. Smart Updates

### Trigger
Small chip inside `TripCard`, shown only if `travelDate` is set and in the future.

```
[↻ Check for updates]
```

- After tap: chip shows spinner, then results appear as update cards above the itinerary stop list
- Cooldown: 4 hours after last check (stored in `lastUpdateCheck` on `SavedItinerary`)
- While in cooldown: chip shows "Checked X hours ago" (disabled, no tap)
- Cooldown stored in `lastUpdateCheck` — persisted to localStorage so it survives app restart

### What gets checked (3 parallel calls)

**1. New events**
- Call: `api.events(city, travelDate, travelDate + days, cityLat, cityLon)`
- Existing `/events` endpoint (Ticketmaster + Yelp) — already returns `Place[]` with `category: 'event'`
- Filter to events within 5km of any saved stop
- Diff against previously seen event IDs (stored per trip in localStorage): show only new ones
- Produces: `TripUpdateCard` with `kind: 'event'`

**2. Hours changes**
- For each stop in `selectedPlaces` that has a `place_id`: re-query Google Places `weekday_text`
- Compare against what was stored at itinerary-build time (store in `SavedItinerary.selectedPlaces[].weekday_text_snapshot`)
- If any divergence: surface as `kind: 'hours_change'` with severity `'warning'`

**3. Weather**
- Call: existing weather endpoint (or OpenMeteo) for `cityLat/cityLon` on `travelDate`
- If forecast contains rain/storm/extreme heat on any travel day: produce `kind: 'weather'` card with `severity: 'warning'`
- If forecast is fine: no card (don't show "weather looks good" — only show problems)

### Update card display

Update cards appear as a horizontal scroll strip **above** the stop list, inside the expanded `TripCard`.

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ 🎉 New event                  │  │ ⚠️ Hours changed              │
│ Tokyo Lantern Festival        │  │ teamLab Planets               │
│ Day 2 · Near Senso-ji         │  │ Now closes 4pm on Mon         │
│ [Add to itinerary]            │  │ Your Day 3 is Monday          │
│ [Dismiss]                     │  │ [Noted]                       │
└──────────────────────────────┘  └──────────────────────────────┘
```

- Each card: rounded, ~160px wide, full scrollable row
- Event card: indigo border, `🎉` emoji
- Hours change: amber border, `⚠️`
- Weather: slate-blue border, `🌧`
- "Add to itinerary" on event cards adds the event as a `Place` to `selectedPlaces`
- "Noted" / "Dismiss" removes the card from the strip
- Dismissed cards are not re-shown unless a new check finds something genuinely new

### "No updates" state
If all 3 checks return clean: show inline text "Everything looks good · Checked just now" for 3 seconds, then hide.

---

## 3. Day-of Recalibration

### Trigger
On the first app open on travel date (when `today === travelDate`):
- Show a top banner on `TripsScreen` (or on the relevant `TripCard` if multiple trips):

```
┌──────────────────────────────────────┐
│ ✈️ You're heading to Tokyo today     │
│ Want a last-minute check?            │
│ [Yes, check now]   [Not yet]         │
└──────────────────────────────────────┘
```

- "Not yet" dismisses the banner for 4 hours, then re-prompts
- "Yes, check now" triggers the recalibration call
- Banner shown only once per day per trip (tracked in localStorage)
- If user has already confirmed arrival and resolved all swap cards, banner does not reappear

### Recalibration call

**Backend:** New `POST /recalibrate` endpoint

**Inputs:**
```json
{
  "stops": [...],           // current ItineraryStop[]
  "selected_places": [...], // Place[] with place_ids
  "current_time": "09:15",  // local time at destination
  "persona": "wanderer",
  "pace": "relaxed",
  "city": "Tokyo",
  "lat": 35.68,
  "lon": 139.69,
  "travel_date": "2026-06-14"
}
```

The endpoint:
1. Re-queries Google Places hours for each stop (today's actual hours)
2. Fetches current weather
3. Calls LLM with all context: *"Given the current time, today's hours, and weather, which stops need timing adjustments? Return only stops that benefit from a change. For each, provide: stop index, current summary, suggested summary, reason."*
4. Returns a list of `SwapCard` objects (empty list = no changes needed)

### Swap card display

Recalibration results replace the banner with a swap card stack. Cards appear as a **vertical list** above the itinerary stops.

**Card anatomy — resting state (showing current plan):**
```
┌─────────────────────────────────┐
│ 🔄  Stop 3                       │
│ teamLab Planets                  │
│ ─────────────────────────────── │
│ CURRENT                          │
│ 2:00 PM · 2 hrs                  │
│                                  │
│         tap to see suggestion ▼  │
└─────────────────────────────────┘
```

**Card anatomy — flipped state (showing suggestion):**
```
┌─────────────────────────────────┐
│ ✦  Suggested                     │
│ teamLab Planets                  │
│ ─────────────────────────────── │
│ Move to 11:00 AM                 │
│ Closes 4pm today. Less crowded  │
│ before noon, matches your pace. │
│                                  │
│ [Use this]      [Keep original]  │
└─────────────────────────────────┘
```

- **Flip animation:** CSS 3D Y-axis card flip, 400ms ease
- Tapping the resting card flips to suggestion side
- Tapping outside or background of flipped card flips back
- "Use this" → applies the suggestion to the stop, marks card `resolved: true`, `choice: 'new'`
- "Keep original" → marks card `resolved: true`, `choice: 'original'`, no change to itinerary

### Persistence and resolution gate

- `SwapCard[]` stored in `SavedItinerary.pendingSwapCards` in localStorage
- On app open on travel date: if `pendingSwapCards` contains unresolved cards, they re-render above the stops — the user cannot dismiss the TripCard without resolving all swap cards
- "Cannot dismiss" means: the expand/collapse affordance of `TripCard` is locked open if unresolved swap cards exist. A small reminder shows at the bottom: "Resolve X suggestions to continue"
- After all cards resolved (any choice): a "Done ✓" button appears at the bottom of the swap card stack → clears the stack, unlocks the card
- Once resolved, swap cards are gone permanently for that trip (not re-shown)

### No changes needed
If recalibration returns 0 swap cards: show brief inline message "Your itinerary looks good for today ✓" then dismiss the banner automatically after 3 seconds.

---

## 4. Interaction Summary

| State | What user sees in TripCard |
|---|---|
| No travel date | No countdown, no update CTA |
| Future trip, >7 days | Blue countdown + "Check for updates" chip |
| Future trip, ≤7 days | Amber countdown + "Check for updates" chip |
| Travel day, not yet prompted | Green "Today" banner + arrival prompt |
| Travel day, "Not yet" tapped | Banner dismissed (reappears after 4 hours) |
| Travel day, "Yes" tapped | Recalibration runs → swap cards appear |
| Swap cards present | Cards locked open above stops, must resolve |
| All resolved | "Done ✓" button, then normal trip view |
| Past trip | "Completed" badge, no countdown, no updates |

---

## 5. Files Affected

**Modified:**
- `src/shared/types.ts` — extend `SavedItinerary`; add `TripUpdateCard`, `SwapCard`, `UpdateCardKind`
- `src/shared/store.tsx` — SAVE_ITINERARY action passes `travelDate`, `cityLat/Lon`, `selectedPlaces`; add `UPDATE_SAVED_ITINERARY` action for patching individual saved trip (swap card resolution, lastUpdateCheck)
- `src/modules/trips/TripsScreen.tsx` — integrate `TripCountdown`, `SmartUpdates`, `RecalibrationOverlay` into `TripCard`
- `main.py` — add `POST /recalibrate` endpoint

**New:**
- `src/modules/trips/TripCountdown.tsx` — countdown row component
- `src/modules/trips/SmartUpdates.tsx` — update CTA chip + update card strip
- `src/modules/trips/UpdateCard.tsx` — individual event/hours/weather card
- `src/modules/trips/ArrivalBanner.tsx` — day-of arrival prompt banner
- `src/modules/trips/SwapCard.tsx` — flip card component (CSS 3D)
- `src/modules/trips/RecalibrationStack.tsx` — orchestrates swap card list + Done button

**Unchanged:**
- `src/shared/api.ts` — `api.events()` already exists; only `api.recalibrate()` needs to be added
- `src/modules/map/MapScreen.tsx`
- All map and route modules

---

## 6. API additions (api.ts)

```typescript
api.recalibrate(params: {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  currentTime: string;       // "HH:MM"
  persona: string;
  pace: string;
  city: string;
  lat: number;
  lon: number;
  travelDate: string;        // YYYY-MM-DD
}) => Promise<{ swapCards: SwapCard[] }>
```

`api.events()` already exists — no change needed.

---

## 7. Out of Scope

- Push notifications (all prompts are in-app only)
- Background fetch / server-side daily checks (on-open check only for now)
- Multi-city trip recalibration (single city for now)
- Sharing updated itinerary after recalibration
