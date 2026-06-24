# Trip Details Redesign + Hotel Anchor in Reel

**Date:** 2026-06-24
**Prototypes:** `frontend/public/proto-trip-details.html`, `proto-hotel-in-reel.html`, `proto-hotel-reel-conflicts.html`

---

## 1. Scope

Two related features designed together because they share the same data:

1. **Trip Details form restructure** — per-city blocks replacing the current single-trip arrival/departure fields
2. **Hotel anchor in reel cards** — a non-intrusive "leave by" nudge row in the transit bar, computed from hotel location and stop times

---

## 2. Trip Details Form — City Block Structure

### What changes

Current `TripDetails` has one `arrivalTime` + one `departureTime` for the whole trip, and `hotels: { city, name }[]` with no location or check-in time. The new structure adds per-city timing and hotel detail.

### New data shape

```typescript
interface CityDetails {
  arrivalTime: string | null;       // HH:MM — when they arrive in this city
  arrivalVia: string | null;        // airport/station name or null
  hotelName: string | null;         // existing
  hotelPlaceId: string | null;      // new — for distance computation
  checkInTime: string | null;       // new — HH:MM
  departureTime: string | null;     // new — HH:MM, when they leave this city
}

interface TripDetails {
  cities: { city: string; details: CityDetails }[];
  // arrivalDate / departureDate retained at trip level for calendar
  arrivalDate: string | null;
  departureDate: string | null;
}
```

### UI structure

Each city gets an identical block with three collapsible sections:
- **Arriving** — arrival time + arrival terminal (airport/station name, or blank)
- **Where you're staying** — hotel search (existing `HotelRow` component) + check-in time
- **Departure** — departure time (when leaving for next city / home)

Every field is optional. No field is required to proceed. Empty fields show italic placeholder text. The "optional" tag appears next to each section label.

For city 2+, the section label reads "Arriving from [prev city]" instead of just "Arriving."

The transit card in the reel becomes **display-only** — it reads from `CityDetails.departureTime` of the origin city. It no longer collects input.

### Dropdown bug (city 2+)

The hotel search dropdown currently only works for city index 0. Fix: the `HotelRow` component's search/autocomplete is scoped incorrectly — ensure each row instance has an independent input ref and popover state.

---

## 3. Hotel Anchor in Reel Cards

### Core principle

**The plan is never changed.** Stop times are read-only. The hotel row is a heads-up only — it tells the user when to leave, not when the stop is.

### When the hotel row appears

| Position | Condition | Content |
|---|---|---|
| First stop of the day | Hotel location known | "Leave hotel by **HH:MM** · X min drive" |
| Last stop of the day | Hotel location known | "Back to **[Hotel]** · X min" |
| Any stop | No hotel entered | Row absent entirely |

The hotel row is always the **bottom row** of the transit bar — below weather. It never displaces the from/to rows.

### Computation

- **Leave-by time** = stop start time − travel time from hotel to stop
- **Back time** = stop end time + travel time from stop to hotel (or just distance if no end time)
- Travel times use the same distance/duration source as the existing transit bar rows

### Arrival day — anchor split

Controlled by `checkInTime`:

| Condition | Anchor |
|---|---|
| `checkInTime` not set | Airport/station all day |
| Stop time < `checkInTime` | Airport/station anchor |
| Stop time ≥ `checkInTime` | Hotel anchor |

When airport is the anchor, the row reads "Leave airport by **HH:MM** · X min" in blue, not gold.

### Departure day — closing anchor override

On the last day in a city (determined by `departureTime` being set):

- The **last stop's** closing hotel row is replaced by a departure anchor: "Airport by **HH:MM** · X min from here"
- Computed as: `departureTime − 90 min buffer − travel from last stop to terminal`
- Shown in amber if the resulting leave-time is within 2 hours of the stop

### Family wrap-up

When travel group is `'family'` and it's the last stop of the day:

- Row reads: "Leave by **HH:MM** · back to hotel by 9 PM"
- Target hotel arrival = 21:00 (hardcoded family default)
- Leave-by = 21:00 − travel time from last stop to hotel
- Plan time is unchanged

If departure day + family: combine both — "Leave by **HH:MM** · airport by **HH:MM**"

### No hotel — clean fallback

If `hotelPlaceId` is null, the hotel row is entirely absent. No placeholder, no "add hotel" prompt inside the reel.

---

## 4. What does NOT change

- Stop times in the itinerary — strictly read-only
- The transit card's visual design — hotel row slots into the existing bar
- The reel card layout — no new UI chrome, just a new bottom row in the existing transit bar

---

## 5. Out of scope

- Suggesting alternative stops closer to the hotel (separate feature)
- Reordering stops based on hotel proximity
- Showing hotel on the map pin layer
- Parking/transport mode recommendations near hotel
