# Trip Details + Hotel Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-city hotel details (placeId, coordinates, check-in time, arrival time) to TripDetails, restructure TripDetailsSheet into per-city blocks, and render a non-intrusive "leave by" hotel anchor row in reel stop cards.

**Architecture:** Extend `TripDetails` with per-city arrival + hotel fields (backward-compatible). A pure `hotel-anchor.ts` utility computes anchor rows from stored hotel coordinates using haversine distance. `buildReelCards` attaches `hotelAnchor` to each `ReelStopCard`. `ReelStopCard.tsx` renders it as a bottom row in the existing transit bar. The plan is immutable — anchor rows are advisory only.

**Tech Stack:** React 19, TypeScript, Zustand store, Google Places Autocomplete (already wired), haversine (implement inline, no new dep)

## Global Constraints

- All `TripDetails` changes must be backward-compatible: new fields are optional, existing `arrivalTime`/`departureTime` at trip level must keep working for reel-builder cascade logic
- Plan times are read-only — hotel anchor rows are advisory, never shift stop times
- All hotel fields optional — no field required to save trip details
- No new npm dependencies — haversine implemented as a 5-line inline function
- TypeScript strict — no `any`, no `@ts-ignore`
- Existing `HotelRow` autocomplete session logic stays intact

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/shared/types.ts` | Modify | Extend `TripDetails.hotels[]` with `placeId/lat/lon/checkInTime`; add `cityArrivals[]` |
| `frontend/src/modules/route/reel/hotel-anchor.ts` | **Create** | Pure utility: haversine, travel time estimate, `computeHotelAnchorRow()` |
| `frontend/src/modules/route/reel/hotel-anchor.test.ts` | **Create** | Unit tests for `computeHotelAnchorRow` |
| `frontend/src/modules/route/reel/types.ts` | Modify | Add `hotelAnchor` field to `ReelStopCard` |
| `frontend/src/modules/route/reel/reel-builder.ts` | Modify | Attach `hotelAnchor` to each stop card |
| `frontend/src/modules/route/reel/ReelStopCard.tsx` | Modify | Render hotel anchor row at bottom of transit bar |
| `frontend/src/modules/route/reel/TripDetailsSheet.tsx` | Modify | Fix hotel dropdown portal bug; add `checkInTime` capture; add `cityArrivals` inputs; per-city block UI |

---

## Task 1: Extend TripDetails type

**Files:**
- Modify: `frontend/src/shared/types.ts:268-274`

**Interfaces:**
- Produces: extended `TripDetails` used by all subsequent tasks

- [ ] **Step 1: Update the TripDetails interface**

In `frontend/src/shared/types.ts`, replace the `TripDetails` interface (currently at line 268):

```typescript
export interface TripDetails {
  arrivalDate: string | null;    // YYYY-MM-DD
  arrivalTime: string | null;    // HH:MM (24h) — city 1 arrival, still used by cascade
  departureDate: string | null;  // YYYY-MM-DD
  departureTime: string | null;  // HH:MM (24h) — last city departure, still used by departure pressure
  hotels: {
    city: string;
    name: string | null;
    placeId?: string | null;     // Google place_id — for anchor computation
    lat?: number | null;         // fetched at selection time
    lon?: number | null;
    checkInTime?: string | null; // HH:MM — splits arrival-day anchor
  }[];
  cityArrivals?: {               // per-city arrival/departure — optional, city 1 falls back to arrivalTime above
    city: string;
    arrivalTime: string | null;  // HH:MM
    arrivalVia: string | null;   // terminal/station name e.g. "Goa Airport (GOI)"
    departureTime: string | null;// HH:MM — when leaving this city
  }[];
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /tmp/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (existing code uses `hotels[].name` and `hotels[].city` only — new fields are optional so no breakage).

- [ ] **Step 3: Commit**

```bash
cd /tmp/Uncover-roads && git add frontend/src/shared/types.ts && git commit -m "feat: extend TripDetails with per-hotel coords/checkIn and cityArrivals"
```

---

## Task 2: Hotel anchor utility

**Files:**
- Create: `frontend/src/modules/route/reel/hotel-anchor.ts`
- Create: `frontend/src/modules/route/reel/hotel-anchor.test.ts`

**Interfaces:**
- Consumes: `EngineItineraryStop` (has `lat`, `lon`, `time`), extended `TripDetails`
- Produces: `HotelAnchorRow` interface + `computeHotelAnchorRow()` function used by Task 3

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/route/reel/hotel-anchor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { haversineKm, driveMinutes, computeHotelAnchorRow } from './hotel-anchor';
import type { HotelAnchorParams } from './hotel-anchor';

const HOTEL = { name: 'The Leela', lat: 15.174, lon: 73.948, checkInTime: null };
const STOP_NEAR = { time: '09:00', lat: 15.180, lon: 73.952 };  // ~0.8 km away
const STOP_FAR =  { time: '09:00', lat: 15.350, lon: 74.100 };  // ~25 km away

describe('haversineKm', () => {
  it('returns ~0.8 for nearby coords', () => {
    expect(haversineKm(15.174, 73.948, 15.180, 73.952)).toBeCloseTo(0.8, 0);
  });
  it('returns 0 for identical coords', () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });
});

describe('driveMinutes', () => {
  it('estimates 2 min for 1 km', () => {
    expect(driveMinutes(1)).toBe(2);
  });
  it('estimates 30 min for 15 km', () => {
    expect(driveMinutes(15)).toBe(30);
  });
});

describe('computeHotelAnchorRow', () => {
  function params(overrides: Partial<HotelAnchorParams> = {}): HotelAnchorParams {
    return {
      stopTime: '09:00',
      stopLat: STOP_FAR.lat,
      stopLon: STOP_FAR.lon,
      isFirstOfDay: true,
      isLastOfDay: false,
      isLastDayInCity: false,
      travelGroup: 'solo',
      hotel: HOTEL,
      cityArrivalTime: null,
      cityArrivalVia: null,
      cityDepartureTime: null,
      ...overrides,
    };
  }

  it('returns null when hotel is null', () => {
    expect(computeHotelAnchorRow({ ...params(), hotel: null })).toBeNull();
  });

  it('returns null when hotel has no coordinates', () => {
    expect(computeHotelAnchorRow({ ...params(), hotel: { name: 'X', lat: null, lon: null, checkInTime: null } })).toBeNull();
  });

  it('returns null when stop has no coordinates', () => {
    expect(computeHotelAnchorRow({ ...params(), stopLat: null, stopLon: null })).toBeNull();
  });

  it('first stop: returns leave-by row with correct time', () => {
    // ~25 km → ~50 min → leave by 08:10
    const row = computeHotelAnchorRow(params());
    expect(row).not.toBeNull();
    expect(row!.isBlue).toBe(false);
    expect(row!.isWarning).toBe(true);  // >45 min
    expect(row!.text).toContain('Leave hotel by');
    expect(row!.text).toContain('8:10 AM');
  });

  it('first stop, near hotel: no warning when <45 min', () => {
    const row = computeHotelAnchorRow({ ...params(), stopLat: STOP_NEAR.lat, stopLon: STOP_NEAR.lon });
    expect(row!.isWarning).toBe(false);
  });

  it('last stop: returns back-to-hotel row', () => {
    const row = computeHotelAnchorRow({ ...params(), isFirstOfDay: false, isLastOfDay: true });
    expect(row!.text).toContain('Back to');
    expect(row!.text).toContain('The Leela');
  });

  it('arrival day pre-check-in: uses airport anchor in blue', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      cityArrivalTime: '10:00',
      cityArrivalVia: 'Goa Airport (GOI)',
      hotel: { ...HOTEL, checkInTime: '15:00' },
      // stop time 09:00 < checkIn 15:00 → airport anchor
    });
    expect(row!.isBlue).toBe(true);
    expect(row!.text).toContain('Leave airport');
    expect(row!.text).toContain('Goa Airport');
  });

  it('arrival day post-check-in: uses hotel anchor', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      stopTime: '16:00',
      cityArrivalTime: '10:00',
      cityArrivalVia: 'Goa Airport (GOI)',
      hotel: { ...HOTEL, checkInTime: '15:00' },
    });
    expect(row!.isBlue).toBe(false);
    expect(row!.text).toContain('Leave hotel by');
  });

  it('departure day last stop: shows airport close-out', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      isFirstOfDay: false,
      isLastOfDay: true,
      isLastDayInCity: true,
      cityDepartureTime: '07:00',
      cityArrivalVia: 'Goa Airport (GOI)',
    });
    expect(row!.text).toContain('Airport by');
    expect(row!.isWarning).toBe(true);
  });

  it('family last stop: shows wrap-up nudge', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      isFirstOfDay: false,
      isLastOfDay: true,
      travelGroup: 'family',
      stopLat: STOP_NEAR.lat,
      stopLon: STOP_NEAR.lon,
    });
    expect(row!.text).toContain('Leave by');
    expect(row!.text).toContain('back to hotel by 9 PM');
  });
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd /tmp/Uncover-roads/frontend && npx vitest run src/modules/route/reel/hotel-anchor.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module './hotel-anchor'`

- [ ] **Step 3: Implement hotel-anchor.ts**

Create `frontend/src/modules/route/reel/hotel-anchor.ts`:

```typescript
export interface HotelAnchorRow {
  text: string;
  isWarning: boolean; // amber treatment — >45 min or departure day
  isBlue: boolean;    // blue treatment — airport anchor
  icon: string;       // material icon name: 'hotel' | 'flight_takeoff' | 'nights_stay'
}

export interface HotelAnchorParams {
  stopTime: string | null;       // HH:MM — stop start time
  stopLat: number | null;
  stopLon: number | null;
  isFirstOfDay: boolean;
  isLastOfDay: boolean;
  isLastDayInCity: boolean;      // true when departure time is set for this city
  travelGroup: string;
  hotel: { name: string; lat: number | null; lon: number | null; checkInTime: string | null } | null;
  cityArrivalTime: string | null;  // HH:MM — when they arrived in this city
  cityArrivalVia: string | null;   // terminal name
  cityDepartureTime: string | null; // HH:MM — when they leave this city
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Urban driving: 30 km/h average → 2 min/km, minimum 3 min
export function driveMinutes(distKm: number): number {
  return Math.max(3, Math.round(distKm * 2));
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime12(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function computeHotelAnchorRow(p: HotelAnchorParams): HotelAnchorRow | null {
  if (!p.hotel || p.hotel.lat == null || p.hotel.lon == null) return null;
  if (p.stopLat == null || p.stopLon == null) return null;

  const distKm = haversineKm(p.hotel.lat, p.hotel.lon, p.stopLat, p.stopLon);
  const travelMin = driveMinutes(distKm);

  // Departure day: last stop's closing anchor is the departure terminal, not hotel return
  if (p.isLastOfDay && p.isLastDayInCity && p.cityDepartureTime) {
    const depMin = timeToMinutes(p.cityDepartureTime);
    const bufferMin = 90; // time needed at terminal before departure
    const leaveByMin = depMin - bufferMin - travelMin;
    const terminalName = p.cityArrivalVia ?? 'airport';
    return {
      text: `Airport by ${minutesToTime12(depMin - bufferMin)} · ${travelMin} min from here`,
      isWarning: true,
      isBlue: false,
      icon: 'flight_takeoff',
    };
  }

  // Arrival day anchor split: if stop time < check-in time → airport anchor
  const checkInMin = p.hotel.checkInTime ? timeToMinutes(p.hotel.checkInTime) : null;
  const stopMin = p.stopTime ? timeToMinutes(p.stopTime) : null;
  const isPreCheckIn = checkInMin != null && stopMin != null && stopMin < checkInMin;
  const hasArrivalInfo = !!p.cityArrivalTime && !!p.cityArrivalVia;

  if (p.isFirstOfDay && isPreCheckIn && hasArrivalInfo) {
    // Airport anchor
    const leaveByMin = stopMin! - travelMin;
    return {
      text: `Leave ${p.cityArrivalVia} by ${minutesToTime12(leaveByMin)} · ${travelMin} min`,
      isWarning: travelMin >= 45,
      isBlue: true,
      icon: 'flight_land',
    };
  }

  // Family last stop: time-based wrap-up nudge (target 9 PM hotel return)
  if (p.isLastOfDay && p.travelGroup === 'family') {
    const targetReturnMin = 21 * 60; // 9 PM
    const leaveByMin = targetReturnMin - travelMin;
    return {
      text: `Leave by ${minutesToTime12(leaveByMin)} · back to hotel by 9 PM`,
      isWarning: true,
      isBlue: false,
      icon: 'nights_stay',
    };
  }

  // Normal last stop: back to hotel distance
  if (p.isLastOfDay) {
    return {
      text: `Back to ${p.hotel.name} · ${travelMin} min`,
      isWarning: travelMin >= 45,
      isBlue: false,
      icon: 'hotel',
    };
  }

  // Normal first stop: leave-by time
  if (p.isFirstOfDay && stopMin != null) {
    const leaveByMin = stopMin - travelMin;
    return {
      text: `Leave hotel by ${minutesToTime12(leaveByMin)} · ${travelMin} min drive`,
      isWarning: travelMin >= 45,
      isBlue: false,
      icon: 'hotel',
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd /tmp/Uncover-roads/frontend && npx vitest run src/modules/route/reel/hotel-anchor.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/Uncover-roads && git add frontend/src/modules/route/reel/hotel-anchor.ts frontend/src/modules/route/reel/hotel-anchor.test.ts && git commit -m "feat: hotel anchor computation utility with haversine distance"
```

---

## Task 3: Thread hotelAnchor through reel types + builder

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts:83` (ReelStopCard)
- Modify: `frontend/src/modules/route/reel/reel-builder.ts`

**Interfaces:**
- Consumes: `HotelAnchorRow`, `computeHotelAnchorRow` from Task 2
- Produces: `ReelStopCard.hotelAnchor` used by Task 4

- [ ] **Step 1: Add hotelAnchor to ReelStopCard**

In `frontend/src/modules/route/reel/types.ts`, add to the `ReelStopCard` interface after `timingAdjustment`:

```typescript
  hotelAnchor?: {
    text: string;
    isWarning: boolean;
    isBlue: boolean;
    icon: string;
  } | null;
```

- [ ] **Step 2: Import and wire in reel-builder.ts**

At the top of `frontend/src/modules/route/reel/reel-builder.ts`, add the import:

```typescript
import { computeHotelAnchorRow } from './hotel-anchor';
```

Then inside `buildReelCards`, find the per-day loop where `globalStopNumber` is tracked (around line 836 where `stopNumber: globalStopNumber` is set). You need to know which stops are first/last in the day. The day's stops are in `day.stops` — find the first and last stop index to identify isFirstOfDay / isLastOfDay.

Locate the block that builds the `stopCard` object (`const stopCard: ReelStopCard = { type: 'stop', ...`). After building `stopCard`, add:

```typescript
// Hotel anchor row
const cityName = day.city || (itinerary.cities?.[dayIdx] ?? '');
const hotelEntry = tripDetails?.hotels?.find(h => h.city === cityName) ?? null;
const cityArrivalEntry = tripDetails?.cityArrivals?.find(c => c.city === cityName) ?? null;
const isLastDayInCity = dayIdx < itinerary.days.length - 1
  ? (itinerary.days[dayIdx + 1].city || itinerary.cities?.[dayIdx + 1]) !== cityName
  : true;
const dayStops = day.stops.filter(s => s.type !== 'transit');
const isFirstOfDay = stopIdx === dayStops.indexOf(stop);
const isLastOfDay = stopIdx === dayStops.lastIndexOf(stop);

const hotelAnchor = computeHotelAnchorRow({
  stopTime: stop.time ?? null,
  stopLat: stop.lat ?? null,
  stopLon: stop.lon ?? null,
  isFirstOfDay,
  isLastOfDay,
  isLastDayInCity,
  travelGroup,
  hotel: hotelEntry && hotelEntry.lat != null && hotelEntry.lon != null
    ? { name: hotelEntry.name ?? cityName, lat: hotelEntry.lat, lon: hotelEntry.lon, checkInTime: hotelEntry.checkInTime ?? null }
    : null,
  cityArrivalTime: cityArrivalEntry?.arrivalTime ?? (dayIdx === 0 ? (tripDetails?.arrivalTime ?? null) : null),
  cityArrivalVia: cityArrivalEntry?.arrivalVia ?? null,
  cityDepartureTime: cityArrivalEntry?.departureTime ?? (isLastDayInCity && dayIdx === itinerary.days.length - 1 ? (tripDetails?.departureTime ?? null) : null),
});
stopCard.hotelAnchor = hotelAnchor;
```

Note: `stopIdx` is the loop variable iterating over `day.stops`. You'll need to confirm the exact variable names in context — the reel-builder uses `stop` as the current stop and iterates with a for loop or map. Adapt accordingly.

- [ ] **Step 3: Verify build compiles**

```bash
cd /tmp/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /tmp/Uncover-roads && git add frontend/src/modules/route/reel/types.ts frontend/src/modules/route/reel/reel-builder.ts && git commit -m "feat: attach hotelAnchor to ReelStopCard via reel-builder"
```

---

## Task 4: Render hotel anchor row in ReelStopCard

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx`

**Interfaces:**
- Consumes: `card.hotelAnchor` from Task 3

- [ ] **Step 1: Add hotel anchor row after the nextLeg block**

In `frontend/src/modules/route/reel/ReelStopCard.tsx`, locate the `{/* Next-leg transit row */}` block (around line 622). After its closing `})()}`, add:

```tsx
{/* Hotel anchor row */}
{card.hotelAnchor && (() => {
  const anchor = card.hotelAnchor!;
  const bg = anchor.isBlue
    ? 'rgba(91,155,213,.09)'
    : anchor.isWarning
      ? 'rgba(232,160,48,.09)'
      : 'rgba(212,168,83,.08)';
  const border = anchor.isBlue
    ? 'rgba(91,155,213,.2)'
    : anchor.isWarning
      ? 'rgba(232,160,48,.2)'
      : 'rgba(212,168,83,.2)';
  const textColor = anchor.isBlue
    ? 'rgba(91,155,213,.85)'
    : anchor.isWarning
      ? 'rgba(232,160,48,.85)'
      : 'rgba(212,168,83,.85)';
  const iconColor = anchor.isBlue
    ? '#5b9bd5'
    : anchor.isWarning
      ? '#e8a030'
      : T.gold;
  return (
    <div style={{
      marginTop: 7, display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 11px', borderRadius: 8,
      background: bg, border: `1px solid ${border}`,
    }}>
      <span className="ms fill" style={{ fontSize: 13, color: iconColor, flexShrink: 0 }}>
        {anchor.icon}
      </span>
      <span style={{ fontSize: 11, color: textColor, flex: 1, lineHeight: 1.3 }}>
        {anchor.text}
      </span>
    </div>
  );
})()}
```

Note: `T.gold` is already defined in `ReelStopCard.tsx` as part of the theme object. Confirm the exact variable name by checking the existing theme references in the file (look for `T.gold` or `T.primary` near the top of the component).

- [ ] **Step 2: Verify build compiles**

```bash
cd /tmp/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Smoke test manually**

Open the reel for a saved trip that has hotel info. Verify:
- First stop of the day shows "Leave hotel by X" row in gold
- Last stop of the day shows "Back to [hotel] · X min" row
- Stops in the middle of the day show no hotel row
- If hotel has no lat/lon yet (old data), no row appears — no crash

- [ ] **Step 4: Commit**

```bash
cd /tmp/Uncover-roads && git add frontend/src/modules/route/reel/ReelStopCard.tsx && git commit -m "feat: render hotel anchor row in reel stop card transit bar"
```

---

## Task 5: Fix hotel dropdown bug in TripDetailsSheet + capture placeId/coords + checkInTime

**Files:**
- Modify: `frontend/src/modules/route/reel/TripDetailsSheet.tsx`

**Interfaces:**
- Produces: `TripDetails.hotels[].placeId`, `.lat`, `.lon`, `.checkInTime` populated on save

- [ ] **Step 1: Fix the dropdown clipping bug**

The suggestions dropdown in `HotelRow` is clipped by the sheet's `overflowY: auto` container. Fix by adding a `portalRef` and rendering suggestions via `createPortal` positioned to the input's bounding rect.

In `TripDetailsSheet.tsx`, update `HotelRow` to use a portal for suggestions:

```tsx
function HotelRow({ city, name, placeId, onChange }: {
  city: string;
  name: string | null;
  placeId?: string | null;
  onChange: (v: { name: string; placeId: string | null; lat: number | null; lon: number | null }) => void;
}) {
  // ... existing state ...
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);

  // Update onChange signature to return full object
  function handleSelect(result: AutocompleteResult) {
    const selected = result.main_text;
    setVal(selected);
    setSuggestions([]);
    setEditing(false);
    sessionRef.current = Math.random().toString(36).slice(2);
    // Fetch coords in background
    fetchPlaceDetails(result.place_id).then(details => {
      onChange({
        name: selected,
        placeId: result.place_id,
        lat: details?.lat ?? null,
        lon: details?.lon ?? null,
      });
    }).catch(() => {
      onChange({ name: selected, placeId: result.place_id, lat: null, lon: null });
    });
  }

  // When suggestions open, capture input rect for portal positioning
  useEffect(() => {
    if (suggestions.length > 0 && inputRef.current) {
      setInputRect(inputRef.current.getBoundingClientRect());
    }
  }, [suggestions.length]);

  // Render suggestions via portal so they escape the overflow container
  const suggestionsPortal = suggestions.length > 0 && inputRect ? createPortal(
    <div style={{
      position: 'fixed',
      top: inputRect.bottom,
      left: inputRect.left,
      width: inputRect.width,
      zIndex: 999,
      borderRadius: '0 0 13px 13px',
      border: '1px solid var(--color-amber-bdr)',
      borderTop: 'none',
      background: 'var(--color-surface2)',
      overflow: 'hidden',
    }}>
      {suggestions.map((s, i) => (
        <div
          key={s.place_id}
          onMouseDown={() => handleSelect(s)}
          onTouchStart={() => handleSelect(s)}
          style={{
            padding: '10px 13px',
            borderTop: i > 0 ? '1px solid var(--color-divider)' : 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>{s.main_text}</div>
          {s.secondary_text && (
            <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 1 }}>{s.secondary_text}</div>
          )}
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  // ... rest of render — remove inline suggestions div, add {suggestionsPortal} at end ...
}
```

Also import `fetchPlaceDetails` at the top of `TripDetailsSheet.tsx`:
```typescript
import { fetchPlaceDetails } from '../../../shared/api';
```

- [ ] **Step 2: Add checkInTime capture**

After the hotel name is filled (filled state of `HotelRow`), show a simple time input for check-in time. Add `checkInTime` to `HotelRow` props and state:

```tsx
function HotelRow({ city, name, placeId, checkInTime, onChange }: {
  city: string;
  name: string | null;
  placeId?: string | null;
  checkInTime?: string | null;
  onChange: (v: { name: string; placeId: string | null; lat: number | null; lon: number | null; checkInTime: string | null }) => void;
}) {
```

When `name` is set, render a small check-in time row beneath the hotel card:
```tsx
{name && !editing && (
  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
    <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-4)' }}>key</span>
    <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Check-in from</span>
    <div
      onClick={() => setShowCheckIn(v => !v)}
      style={{
        marginLeft: 'auto', fontSize: 12, color: checkInTime ? 'var(--color-text-2)' : 'var(--color-text-4)',
        fontStyle: checkInTime ? 'normal' : 'italic', cursor: 'pointer',
        padding: '3px 8px', borderRadius: 7,
        background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
      }}
    >
      {checkInTime ? displayTime12(checkInTime) : 'Add time'}
    </div>
  </div>
)}
{name && !editing && showCheckIn && (
  <TimeStepper value={checkInTime ?? '15:00'} onChange={t => {
    setShowCheckIn(false);
    onChange({ name: name!, placeId: placeId ?? null, lat: null, lon: null, checkInTime: t });
  }} />
)}
```

Add `const [showCheckIn, setShowCheckIn] = useState(false)` to `HotelRow` state.

- [ ] **Step 3: Update handleHotelChange in TripDetailsSheet**

The `hotels` state now holds the extended shape. Update the state type and `handleHotelChange`:

```typescript
const [hotels, setHotels] = useState<{
  city: string;
  name: string | null;
  placeId?: string | null;
  lat?: number | null;
  lon?: number | null;
  checkInTime?: string | null;
}[]>(() => {
  if (existingDetails?.hotels?.length) return existingDetails.hotels;
  return cities.map(c => ({ city: c, name: null }));
});

function handleHotelChange(city: string, v: { name: string; placeId: string | null; lat: number | null; lon: number | null; checkInTime?: string | null }) {
  setHotels(prev => prev.map(h =>
    h.city === city
      ? { ...h, name: v.name || null, placeId: v.placeId, lat: v.lat, lon: v.lon, checkInTime: v.checkInTime ?? h.checkInTime }
      : h
  ));
}
```

Update `handleSave` to pass the extended hotels:
```typescript
function handleSave() {
  onSave({ arrivalDate, arrivalTime, departureDate, departureTime, hotels, cityArrivals });
  onClose();
}
```

- [ ] **Step 4: Verify build + test dropdown fix on city 2**

```bash
cd /tmp/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Open the app, add a 2-city trip, open Trip Details. Type in the city 2 hotel field — confirm the dropdown now appears (portal fix). Select a hotel.

- [ ] **Step 5: Commit**

```bash
cd /tmp/Uncover-roads && git add frontend/src/modules/route/reel/TripDetailsSheet.tsx && git commit -m "fix: hotel dropdown portal fix for city 2+; capture placeId/coords/checkInTime"
```

---

## Task 6: TripDetailsSheet per-city arrival blocks

**Files:**
- Modify: `frontend/src/modules/route/reel/TripDetailsSheet.tsx`

**Interfaces:**
- Produces: `TripDetails.cityArrivals[]` populated on save, used by Task 3's reel-builder

- [ ] **Step 1: Add cityArrivals state**

In `TripDetailsSheet`, add state for per-city arrival/departure:

```typescript
const [cityArrivals, setCityArrivals] = useState<{
  city: string;
  arrivalTime: string | null;
  arrivalVia: string | null;
  departureTime: string | null;
}[]>(() => {
  if (existingDetails?.cityArrivals?.length) return existingDetails.cityArrivals;
  return cities.map(c => ({ city: c, arrivalTime: null, arrivalVia: null, departureTime: null }));
});

function handleCityArrivalChange(city: string, field: 'arrivalTime' | 'arrivalVia' | 'departureTime', value: string | null) {
  setCityArrivals(prev => prev.map(c => c.city === city ? { ...c, [field]: value } : c));
}
```

- [ ] **Step 2: Replace the hotel rows section with city blocks**

Replace the multi-city hotel rendering block (the `isMultiCity ? hotels.map(...)` section) with per-city blocks. Each block renders: arriving section, hotel section (with checkInTime), departure section. Use the existing `TimeStepper` for time inputs.

```tsx
{/* Per-city blocks */}
{cities.map((city, i) => {
  const hotelEntry = hotels.find(h => h.city === city);
  const arrivalEntry = cityArrivals.find(c => c.city === city);
  const prevCity = i > 0 ? cities[i - 1] : null;
  const isFirst = i === 0;

  return (
    <div key={city} style={{ marginBottom: 10 }}>
      {/* City header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        padding: '8px 12px', borderRadius: 10,
        background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-primary-bg)', border: '1px solid var(--color-amber-bdr)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--color-primary)',
        }}>{i + 1}</div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)' }}>{city}</span>
      </div>

      {/* Arriving section */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 13, overflow: 'hidden', marginBottom: 6,
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)' }}>
            {prevCity ? `Arriving from ${prevCity}` : 'Arrival'}{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </span>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Arrival time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-4)', width: 18 }}>schedule</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-3)', width: 80, flexShrink: 0 }}>Arriving at</span>
            <div
              onClick={() => {/* toggle time picker */}}
              style={{
                flex: 1, fontSize: 13,
                color: arrivalEntry?.arrivalTime ? 'var(--color-text-1)' : 'var(--color-text-4)',
                fontStyle: arrivalEntry?.arrivalTime ? 'normal' : 'italic',
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              }}
            >
              {arrivalEntry?.arrivalTime ? displayTime12(arrivalEntry.arrivalTime) : 'Add time'}
            </div>
          </div>
          {/* Via */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-4)', width: 18 }}>place</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-3)', width: 80, flexShrink: 0 }}>Via</span>
            <input
              value={arrivalEntry?.arrivalVia ?? ''}
              onChange={e => handleCityArrivalChange(city, 'arrivalVia', e.target.value || null)}
              placeholder="Airport / Station / —"
              style={{
                flex: 1, fontSize: 13, color: 'var(--color-text-1)',
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '6px 10px',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Hotel */}
      <HotelRow
        city={city}
        name={hotelEntry?.name ?? null}
        placeId={hotelEntry?.placeId ?? null}
        checkInTime={hotelEntry?.checkInTime ?? null}
        onChange={v => handleHotelChange(city, v)}
      />

      {/* Departure */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 13, overflow: 'hidden', marginTop: 6,
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)' }}>
            Departure <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </span>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-4)', width: 18 }}>schedule</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)', width: 80, flexShrink: 0 }}>Leaving by</span>
          <div
            style={{
              flex: 1, fontSize: 13,
              color: arrivalEntry?.departureTime ? 'var(--color-text-1)' : 'var(--color-text-4)',
              fontStyle: arrivalEntry?.departureTime ? 'normal' : 'italic',
              background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            }}
          >
            {arrivalEntry?.departureTime ? displayTime12(arrivalEntry.departureTime) : 'Add time'}
          </div>
        </div>
      </div>
    </div>
  );
})}
```

The arrival time and departure time tappable cells should each toggle a `TimeStepper` inline (use a local expanded state per city, keyed by city name). For brevity the full expansion logic follows the same pattern as the existing `DateTimeCard` — toggle a `expandedCityField: { city: string; field: 'arrival' | 'departure' } | null` state.

- [ ] **Step 3: Remove legacy global arrival/departure DateTimeCards for multi-city trips**

When `isMultiCity`, the top-level `DateTimeCard` for arrival and departure should be hidden — those times are now per-city. Keep them for single-city trips.

```tsx
{!isMultiCity && (
  <>
    <DateTimeCard label="Arrival" ... />
    <DateTimeCard label="Departure" ... />
  </>
)}
{isMultiCity && (
  /* per-city blocks above */
)}
```

- [ ] **Step 4: Verify build + manual test**

```bash
cd /tmp/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Open trip details on a 3-city plan. Confirm:
- Three city blocks visible, each with Arriving / Hotel / Departure sections
- All fields optional, "optional" label shown
- Hotel dropdown works for all cities (portal fix from Task 5)
- Check-in time appears after hotel is selected

- [ ] **Step 5: Commit**

```bash
cd /tmp/Uncover-roads && git add frontend/src/modules/route/reel/TripDetailsSheet.tsx && git commit -m "feat: per-city arrival blocks in TripDetailsSheet"
```

---

## Self-Review

**Spec coverage check:**
- ✅ All fields optional — every input has `(optional)` label, no required validation
- ✅ Plan times read-only — `computeHotelAnchorRow` never mutates stop times
- ✅ Arrival day split — handled in `computeHotelAnchorRow` via `checkInTime` comparison
- ✅ Departure day anchor — handled in `computeHotelAnchorRow` when `isLastDayInCity && cityDepartureTime`
- ✅ No hotel = no row — function returns `null` when `hotel` is null
- ✅ Family wrap-up — `travelGroup === 'family'` branch in `computeHotelAnchorRow`
- ✅ City 2+ dropdown bug — portal fix in Task 5
- ✅ Transit card becomes display-only — no new input added to transit card (scope: no change needed, transit card already display-only; the per-city departure time lives in TripDetailsSheet now)
- ✅ Backward compat — `cityArrivals` is optional, existing `arrivalTime`/`departureTime` still used as fallback

**Type consistency:**
- `HotelAnchorRow` defined in `hotel-anchor.ts`, used inline in `types.ts` (ReelStopCard uses anonymous inline type matching the shape — keep in sync or import directly)
- `handleHotelChange` receives `{ name, placeId, lat, lon, checkInTime }` — all usages updated in Task 5
- `cityArrivals` added in Task 6, consumed in Task 3's reel-builder

**Placeholder scan:** No TBDs. All code blocks shown. Manual test steps have specific things to verify.
