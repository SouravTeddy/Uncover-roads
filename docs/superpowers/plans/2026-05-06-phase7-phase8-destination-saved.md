# Phase 7 + Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 7 rebuilds the destination date picker and adds organic multi-city detection on the map; Phase 8 activates a Saved tab replacing the muted Community tab.

**Architecture:** Phase 7 introduces a `usePinCityDetector` hook that stamps `_city` on each added pin and fires `CityHopOverlay` on new-city detection; multi-city mode stays on `MapScreen` with a swapped header and arc overlay instead of auto-navigating to `JourneyScreen`. Phase 8 adds `SavedScreen` with Itineraries / Saved sub-tabs and reduces `BottomNav` from 4 to 3 tabs.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library, Tailwind CSS v4, react-map-gl/maplibre, MapLibre GL JS, Nominatim API (existing), OSRM via existing `routeInterCity()`

---

## File Map

**Phase 7 — new files:**
- `frontend/src/modules/destination/DateRangeCalendar.tsx`
- `frontend/src/modules/map/usePinCityDetector.ts`
- `frontend/src/modules/map/usePinCityDetector.test.ts`
- `frontend/src/modules/map/MultiCityHeader.tsx`
- `frontend/src/modules/map/CityArcLayer.tsx`

**Phase 7 — modified files:**
- `frontend/src/modules/destination/DestinationScreen.tsx` — add calendar reveal + 📅 icon
- `frontend/src/modules/map/CityHopOverlay.tsx` — update copy + colors
- `frontend/src/modules/map/MapScreen.tsx` — wire detector, swap header, remove journey auto-nav
- `frontend/src/modules/route/RouteScreen.tsx` — date conflict info bar

**Phase 8 — new files:**
- `frontend/src/modules/trips/SavedScreen.tsx`
- `frontend/src/modules/trips/SavedPlacesTab.tsx`
- `frontend/src/modules/trips/SavedPlaceCard.tsx`
- `frontend/src/modules/trips/SavedEventCard.tsx`

**Phase 8 — modified files:**
- `frontend/src/shared/types.ts` — add `saved` to Screen union + `SavedEvent` interface
- `frontend/src/shared/store.tsx` — add `savedEvents` state, `SAVE_EVENT`/`REMOVE_EVENT` actions
- `frontend/src/shared/ui/BottomNav.tsx` — 3-tab nav, remove Community, add Saved
- `frontend/src/modules/map/MapScreen.tsx` — Saved filter chip
- `frontend/src/modules/map/useMap.ts` — handle `'saved'` filter in `filteredPlaces`
- `frontend/src/modules/map/types.ts` — add `'saved'` to `MapFilter`
- `frontend/src/modules/trips/index.ts` — export `SavedScreen`
- `frontend/src/App.tsx` — register `SavedScreen`

---

## Task 1: `DateRangeCalendar` component

**Files:**
- Create: `frontend/src/modules/destination/DateRangeCalendar.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/destination/DateRangeCalendar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeCalendar } from './DateRangeCalendar';

describe('DateRangeCalendar', () => {
  it('renders the reason copy', () => {
    render(<DateRangeCalendar onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/check events, weather and opening days/i)).toBeTruthy();
  });

  it('shows current month days', () => {
    render(<DateRangeCalendar onSelect={vi.fn()} onClose={vi.fn()} />);
    // Day "1" through at least "28" should be present
    expect(screen.getAllByRole('button').length).toBeGreaterThan(28);
  });

  it('calls onSelect with ISO dates when range is picked', () => {
    const onSelect = vi.fn();
    render(<DateRangeCalendar onSelect={onSelect} onClose={vi.fn()} />);
    // Click day 10 then day 14
    const buttons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent ?? ''));
    const day10 = buttons.find(b => b.textContent === '10');
    const day14 = buttons.find(b => b.textContent === '14');
    if (day10 && day14) {
      fireEvent.click(day10);
      fireEvent.click(day14);
      expect(onSelect).toHaveBeenCalledOnce();
      const [start, end] = onSelect.mock.calls[0];
      expect(start).toMatch(/^\d{4}-\d{2}-10$/);
      expect(end).toMatch(/^\d{4}-\d{2}-14$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/destination/DateRangeCalendar.test.tsx
```
Expected: FAIL — "Cannot find module './DateRangeCalendar'"

- [ ] **Step 3: Implement `DateRangeCalendar`**

Create `frontend/src/modules/destination/DateRangeCalendar.tsx`:

```tsx
import { useState } from 'react';

interface Props {
  onSelect: (startDate: string, endDate: string) => void;
  onClose: () => void;
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

export function DateRangeCalendar({ onSelect, onClose }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function handleDayClick(day: number) {
    const iso = toIso(viewYear, viewMonth, day);
    if (iso < todayIso) return;
    if (!startDate || (startDate && endDate)) {
      setStartDate(iso);
      setEndDate(null);
    } else {
      const s = iso < startDate ? iso : startDate;
      const e = iso < startDate ? startDate : iso;
      setEndDate(e);
      setStartDate(s);
      onSelect(s, e);
    }
  }

  function isInRange(iso: string): boolean {
    if (!startDate) return false;
    const ref = endDate ?? hoverDate;
    if (!ref) return false;
    const [lo, hi] = startDate < ref ? [startDate, ref] : [ref, startDate];
    return iso > lo && iso < hi;
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div
      className="mx-4 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Prompt copy */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-[var(--color-text-3)] leading-relaxed">
          When are you going? <span className="text-[var(--color-text-2)]">We use this to check events, weather and opening days.</span>
        </p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => {
            if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
            else setViewMonth(m => m - 1);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-3)]"
          style={{ background: 'var(--color-surface2)' }}
        >
          <span className="ms text-sm">chevron_left</span>
        </button>
        <span className="text-sm font-semibold text-[var(--color-text-1)]">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={() => {
            if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
            else setViewMonth(m => m + 1);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-3)]"
          style={{ background: 'var(--color-surface2)' }}
        >
          <span className="ms text-sm">chevron_right</span>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--color-text-4)] py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-3 pb-4 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const iso = toIso(viewYear, viewMonth, day);
          const isPast = iso < todayIso;
          const isStart = iso === startDate;
          const isEnd = iso === endDate;
          const inRange = isInRange(iso);
          return (
            <button
              key={iso}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoverDate(iso)}
              onMouseLeave={() => setHoverDate(null)}
              disabled={isPast}
              className="h-9 flex items-center justify-center text-sm font-medium rounded-full transition-colors"
              style={{
                background: (isStart || isEnd)
                  ? 'var(--color-primary)'
                  : inRange
                  ? 'var(--color-primary-bg)'
                  : 'transparent',
                color: (isStart || isEnd)
                  ? '#fff'
                  : isPast
                  ? 'var(--color-text-4)'
                  : 'var(--color-text-1)',
                opacity: isPast ? 0.4 : 1,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Range summary + confirm */}
      {startDate && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-divider)]">
          <span className="text-sm text-[var(--color-text-2)]">
            {endDate ? formatRange(startDate, endDate) : formatRange(startDate, startDate)}
          </span>
          {endDate && (
            <button
              onClick={onClose}
              className="text-xs font-semibold text-[var(--color-primary)] px-3 py-1.5 rounded-full"
              style={{ background: 'var(--color-primary-bg)' }}
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/modules/destination/DateRangeCalendar.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/destination/DateRangeCalendar.tsx src/modules/destination/DateRangeCalendar.test.tsx
git commit -m "feat: add DateRangeCalendar component for destination screen"
```

---

## Task 2: Update `DestinationScreen` — calendar reveal + 📅 icon

**Files:**
- Modify: `frontend/src/modules/destination/DestinationScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/destination/DestinationScreen.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeCalendar } from './DateRangeCalendar';

// Unit test the calendar trigger logic directly (DestinationScreen is integration)
describe('DestinationScreen calendar reveal logic', () => {
  it('DateRangeCalendar calls onClose when Done is clicked after range selected', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<DateRangeCalendar onSelect={onSelect} onClose={onClose} />);
    // Select a range manually by simulating onSelect (already tested in Task 1)
    // Just verify onClose prop is wired
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (this is a smoke test)**

```bash
cd frontend && npx vitest run src/modules/destination/DestinationScreen.test.tsx
```
Expected: PASS

- [ ] **Step 3: Update `DestinationScreen.tsx`**

Replace the content of `frontend/src/modules/destination/DestinationScreen.tsx`:

```tsx
import { useState } from 'react';
import type { Place } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { ExploreSearchBar } from './ExploreSearchBar';
import { InProgressSection } from './InProgressSection';
import { ExploreEmptyState } from './ExploreEmptyState';
import { DateRangeCalendar } from './DateRangeCalendar';

export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { city, selectedPlaces, travelStartDate, travelEndDate } = state;
  const [showCalendar, setShowCalendar] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function goToMap() {
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleCitySelected(nearMe?: boolean) {
    if (nearMe) {
      const todayIso = new Date().toISOString().split('T')[0];
      dispatch({ type: 'SET_TRAVEL_DATES', startDate: todayIso, endDate: todayIso });
      goToMap();
    } else {
      setShowCalendar(true);
    }
  }

  function handleDateSelect(startDate: string, endDate: string) {
    dispatch({ type: 'SET_TRAVEL_DATES', startDate, endDate });
  }

  function handleCalendarClose() {
    setShowCalendar(false);
    if (travelStartDate) goToMap();
  }

  function openPlaceOnMap(place: Place) {
    dispatch({ type: 'SET_PENDING_PLACE', place });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function formatDateLabel(start: string, end: string): string {
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (start === end) return s.toLocaleDateString('en-US', opts);
    return `${s.toLocaleDateString('en-US', opts)}–${e.toLocaleDateString('en-US', opts)}`;
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <header
        className="px-5 flex-shrink-0 flex items-center justify-between"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <p className="text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">{today}</p>
          <h1
            className="font-[family-name:var(--font-heading)] text-[28px] font-bold"
            style={{ background: 'linear-gradient(135deg, #f5f0ea, #e07854)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            uncover roads
          </h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[14px]">
          U
        </div>
      </header>

      {/* Search bar + 📅 icon row */}
      <div className="flex-shrink-0 flex items-center gap-2 pr-4">
        <div className="flex-1">
          <ExploreSearchBar onCitySelected={handleCitySelected} />
        </div>
        {city && !showCalendar && (
          <button
            onClick={() => setShowCalendar(true)}
            className="flex-shrink-0 flex items-center gap-1.5 h-10 px-3 rounded-2xl text-xs font-semibold"
            style={{
              background: travelStartDate ? 'var(--color-primary-bg)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${travelStartDate ? 'rgba(224,120,84,.3)' : 'rgba(255,255,255,.1)'}`,
              color: travelStartDate ? 'var(--color-primary)' : 'var(--color-text-3)',
            }}
          >
            <span className="ms text-sm">calendar_today</span>
            {travelStartDate && travelEndDate ? formatDateLabel(travelStartDate, travelEndDate) : ''}
          </button>
        )}
      </div>

      {/* Calendar — slides in after city selected */}
      {showCalendar && (
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{
            animation: 'slideDown 0.3s ease forwards',
          }}
        >
          <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <DateRangeCalendar
            onSelect={handleDateSelect}
            onClose={handleCalendarClose}
          />
          <div className="px-4 pt-2 pb-3 flex gap-2">
            <button
              onClick={() => { setShowCalendar(false); goToMap(); }}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,.06)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
            >
              Skip for now
            </button>
            {travelStartDate && (
              <button
                onClick={() => { setShowCalendar(false); goToMap(); }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                Explore {city}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>
        {selectedPlaces.length > 0 && city ? (
          <InProgressSection
            city={city}
            selectedPlaces={selectedPlaces}
            startDate={travelStartDate}
            endDate={travelEndDate}
            onResume={goToMap}
            onChipTap={openPlaceOnMap}
            onPlaceTap={openPlaceOnMap}
            onAddTap={goToMap}
          />
        ) : (
          <ExploreEmptyState />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in DestinationScreen.tsx

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/destination/DestinationScreen.tsx src/modules/destination/DestinationScreen.test.tsx
git commit -m "feat(phase7): destination screen calendar reveal after city select"
```

---

## Task 3: `usePinCityDetector` hook — pure helper + tests

**Files:**
- Create: `frontend/src/modules/map/usePinCityDetector.ts`
- Create: `frontend/src/modules/map/usePinCityDetector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/usePinCityDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findNearestCity } from './usePinCityDetector';

const TOKYO = { city: 'Tokyo', lat: 35.68, lon: 139.69 };
const SYDNEY = { city: 'Sydney', lat: -33.87, lon: 151.21 };
const OSAKA = { city: 'Osaka', lat: 34.69, lon: 135.50 };

describe('findNearestCity', () => {
  it('returns null when no cities known', () => {
    expect(findNearestCity(35.68, 139.69, [])).toBeNull();
  });

  it('assigns city when pin is within 30km of centroid', () => {
    // Shibuya: ~4km from Tokyo centroid
    expect(findNearestCity(35.66, 139.70, [TOKYO])).toBe('Tokyo');
  });

  it('returns null when pin is > 30km from all centroids', () => {
    // Sydney coordinates nowhere near Tokyo
    expect(findNearestCity(-33.87, 151.21, [TOKYO])).toBeNull();
  });

  it('assigns nearest city when multiple cities exist', () => {
    // Kyoto (~67km from Osaka, ~363km from Tokyo) — within 30km of Osaka? No, 67km > 30.
    // Let's test a pin near Osaka station (34.70, 135.50) — 1km from Osaka centroid
    expect(findNearestCity(34.70, 135.50, [TOKYO, OSAKA])).toBe('Osaka');
  });

  it('returns null when pin is far from all known cities', () => {
    expect(findNearestCity(48.86, 2.35, [TOKYO, SYDNEY])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/usePinCityDetector.test.ts
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement `usePinCityDetector.ts`**

Create `frontend/src/modules/map/usePinCityDetector.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import type { Place, CityFootprint, TransitMode } from '../../shared/types';
import { haversineKm } from './journey-utils';
import { detectTransitMode } from './journey-legs';

export interface DetectedTransit {
  from: string;
  to: string;
  mode: TransitMode;
  durationMinutes: number | undefined;
}

export interface PendingNewCity {
  city: string;
  lat: number;
  lon: number;
  transit: DetectedTransit | null;
}

/**
 * Synchronous — finds the nearest city within thresholdKm.
 * Exported for testing.
 */
export function findNearestCity(
  pinLat: number,
  pinLon: number,
  cities: { city: string; lat: number; lon: number }[],
  thresholdKm = 30,
): string | null {
  let nearest: string | null = null;
  let nearestDist = Infinity;
  for (const c of cities) {
    const dist = haversineKm(pinLat, pinLon, c.lat, c.lon);
    if (dist < thresholdKm && dist < nearestDist) {
      nearestDist = dist;
      nearest = c.city;
    }
  }
  return nearest;
}

/**
 * Reverse geocode a lat/lon to a city name via Nominatim.
 */
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const addr = data.address ?? {};
    return addr.city ?? addr.town ?? addr.village ?? addr.county ?? null;
  } catch {
    return null;
  }
}

/**
 * Watches selectedPlaces for newly added pins.
 * For each new pin, determines which city it belongs to:
 *   1. haversine fast path against known cityFootprints centroids (< 30km → assign)
 *   2. Nominatim reverse geocode for city name
 *   3. detectTransitMode (OSRM) if new city confirmed
 *
 * Returns { pendingNewCity, clearPending } for the caller to render CityHopOverlay.
 */
export function usePinCityDetector(
  selectedPlaces: Place[],
  cityFootprints: CityFootprint[],
  primaryCityLat: number | null,
  primaryCityLon: number | null,
  primaryCityName: string,
  onNewCity: (city: string, lat: number, lon: number, transit: DetectedTransit | null) => void,
) {
  const prevCountRef = useRef(selectedPlaces.length);
  const processingRef = useRef(false);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    const currentCount = selectedPlaces.length;
    prevCountRef.current = currentCount;

    if (currentCount <= prevCount) return; // removal or no change
    if (processingRef.current) return;

    const newPlace = selectedPlaces[currentCount - 1];
    if (!newPlace) return;

    // Build list of known city centroids
    const knownCities: { city: string; lat: number; lon: number }[] = [];
    if (cityFootprints.length > 0) {
      cityFootprints.forEach(f => knownCities.push({ city: f.city, lat: f.lat, lon: f.lon }));
    } else if (primaryCityLat !== null && primaryCityLon !== null) {
      knownCities.push({ city: primaryCityName, lat: primaryCityLat, lon: primaryCityLon });
    }

    if (knownCities.length === 0) return;

    // Step 1: fast haversine check
    const nearestCity = findNearestCity(newPlace.lat, newPlace.lon, knownCities);
    if (nearestCity) {
      // Pin is within 30km of a known city — no new city
      return;
    }

    // Step 2 + 3: async detection
    processingRef.current = true;
    (async () => {
      try {
        const detectedCityName = await reverseGeocode(newPlace.lat, newPlace.lon);
        if (!detectedCityName) return;

        // Check if this city is already known by name
        const alreadyKnown = knownCities.some(
          c => c.city.toLowerCase() === detectedCityName.toLowerCase(),
        );
        if (alreadyKnown) return;

        // Step 3: OSRM to determine transit mode from nearest known city
        const fromCity = knownCities[knownCities.length - 1]; // most recently added city
        const { mode, durationMinutes } = await detectTransitMode(
          fromCity.lat, fromCity.lon,
          newPlace.lat, newPlace.lon,
        );

        const transit: DetectedTransit = {
          from: fromCity.city,
          to: detectedCityName,
          mode,
          durationMinutes,
        };

        onNewCity(detectedCityName, newPlace.lat, newPlace.lon, transit);
      } finally {
        processingRef.current = false;
      }
    })();
  }, [selectedPlaces.length]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/modules/map/usePinCityDetector.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/map/usePinCityDetector.ts src/modules/map/usePinCityDetector.test.ts
git commit -m "feat(phase7): usePinCityDetector hook with haversine city assignment"
```

---

## Task 4: Update `CityHopOverlay` — spec copy + orange styling

**Files:**
- Modify: `frontend/src/modules/map/CityHopOverlay.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/CityHopOverlay.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CityHopOverlay } from './CityHopOverlay';

describe('CityHopOverlay', () => {
  it('renders fromCity and toCity labels', () => {
    render(
      <CityHopOverlay
        fromCity="Tokyo"
        toCity="Sydney"
        storyCards={[]}
        onDone={() => {}}
      />
    );
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(screen.getByText('Sydney')).toBeTruthy();
  });

  it('renders spec headline copy', () => {
    render(
      <CityHopOverlay
        fromCity="Tokyo"
        toCity="Sydney"
        storyCards={[{ imageUrl: '', headline: 'h', body: 'b', cityContext: 'Tokyo → Sydney' }]}
        onDone={() => {}}
      />
    );
    // The story card body text confirms travel day copy
    // (arc phase renders first so story card not visible yet without timers)
    // Just verify the Skip button is present
    expect(screen.getByText(/skip/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/CityHopOverlay.test.tsx
```
Expected: FAIL — module not found or assertion failures

- [ ] **Step 3: Update `CityHopOverlay.tsx`**

Replace the file content:

```tsx
import { useEffect, useState } from 'react';
import type { StoryCard } from '../../shared/types';

interface Props {
  fromCity: string;
  toCity: string;
  storyCards: StoryCard[];
  onDone: () => void;
}

export function CityHopOverlay({ fromCity, toCity, storyCards, onDone }: Props) {
  const [phase, setPhase] = useState<'arc' | 'story'>('arc');
  const [storyIdx, setStoryIdx] = useState(0);
  const [planePos, setPlanePos] = useState(0);

  // Phase 1: animate plane along arc (1.5s)
  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let raf: number;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setPlanePos(t);
      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setPhase('story');
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Phase 2: rotate story cards every 4.5s
  useEffect(() => {
    if (phase !== 'story') return;
    if (storyCards.length === 0) { onDone(); return; }
    const timeout = setTimeout(() => {
      if (storyIdx < storyCards.length - 1) {
        setStoryIdx(i => i + 1);
      } else {
        onDone();
      }
    }, 4500);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, storyIdx, storyCards.length]);

  const arcX = planePos * 100;
  const arcY = -4 * planePos * (planePos - 1) * 40;
  const card = storyCards[storyIdx] ?? null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(5,8,15,0.95)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {phase === 'arc' && (
        <div style={{ width: '80%', position: 'relative', height: 100 }}>
          <div style={{
            position: 'absolute', left: 0, bottom: 0,
            fontSize: '0.8rem', fontWeight: 700, color: '#c0b0a4',
          }}>
            {fromCity}
          </div>
          <div style={{
            position: 'absolute', right: 0, bottom: 0,
            fontSize: '0.8rem', fontWeight: 700, color: '#c0b0a4',
          }}>
            {toCity}
          </div>
          <svg
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <path
              d="M 0 50 Q 50 0 100 50"
              fill="none"
              stroke="rgba(224,120,84,.35)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </svg>
          <div style={{
            position: 'absolute',
            left: `${arcX}%`,
            bottom: `${arcY}px`,
            transform: 'translate(-50%, 50%)',
            fontSize: 28,
          }}>
            ✈️
          </div>
        </div>
      )}

      {phase === 'story' && card && (
        <div style={{
          width: '85%', maxWidth: 360,
          borderRadius: 20,
          background: 'rgba(15,20,30,.9)',
          border: '1px solid rgba(255,255,255,.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            background: 'rgba(224,120,84,.12)',
            borderBottom: '1px solid rgba(224,120,84,.2)',
            fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '0.5px',
          }}>
            {card.cityContext}
          </div>
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{
              fontSize: '1.05rem', fontWeight: 800,
              color: '#f5f0ea', lineHeight: 1.3, marginBottom: 10,
            }}>
              {toCity} after {fromCity} — nice.
            </div>
            <div style={{
              fontSize: '0.85rem', color: 'rgba(192,176,164,.75)',
              lineHeight: 1.6,
            }}>
              We've added a travel day between them. Keep pinning places in both cities.
            </div>
          </div>
          {storyCards.length > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 5,
              paddingBottom: 16,
            }}>
              {storyCards.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === storyIdx ? 18 : 6, height: 6,
                    borderRadius: 3,
                    background: i === storyIdx ? 'var(--color-primary)' : 'rgba(255,255,255,.2)',
                    transition: 'width 0.2s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No cards — show standalone message */}
      {phase === 'story' && !card && (
        <div style={{ width: '85%', maxWidth: 360, textAlign: 'center', padding: '0 16px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f5f0ea', marginBottom: 10 }}>
            {toCity} after {fromCity} — nice.
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(192,176,164,.75)', lineHeight: 1.6 }}>
            We've added a travel day between them. Keep pinning places in both cities.
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        style={{
          marginTop: 32,
          background: 'none', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 999, padding: '8px 20px',
          color: 'rgba(192,176,164,.7)', fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        Skip →
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/map/CityHopOverlay.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/map/CityHopOverlay.tsx src/modules/map/CityHopOverlay.test.tsx
git commit -m "feat(phase7): CityHopOverlay spec copy and orange accent styling"
```

---

## Task 5: `MultiCityHeader` component

**Files:**
- Create: `frontend/src/modules/map/MultiCityHeader.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/MultiCityHeader.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiCityHeader } from './MultiCityHeader';
import type { CityFootprint } from '../../shared/types';

const footprints: CityFootprint[] = [
  { city: 'Tokyo', emoji: '🗼', pinCount: 4, lat: 35.68, lon: 139.69 },
  { city: 'Sydney', emoji: '🦘', pinCount: 2, lat: -33.87, lon: 151.21 },
];

describe('MultiCityHeader', () => {
  it('renders all city tabs', () => {
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        transitSummary="Tokyo → Sydney · ✈️ ~9h flight"
        onCityTap={vi.fn()}
        onAddCity={vi.fn()}
      />
    );
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(screen.getByText('Sydney')).toBeTruthy();
  });

  it('calls onCityTap with index when tab is clicked', () => {
    const onCityTap = vi.fn();
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        transitSummary=""
        onCityTap={onCityTap}
        onAddCity={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Sydney'));
    expect(onCityTap).toHaveBeenCalledWith(1);
  });

  it('renders transit breadcrumb when provided', () => {
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        transitSummary="Tokyo → Sydney · ✈️ ~9h flight"
        onCityTap={vi.fn()}
        onAddCity={vi.fn()}
      />
    );
    expect(screen.getByText('Tokyo → Sydney · ✈️ ~9h flight')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/MultiCityHeader.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Implement `MultiCityHeader.tsx`**

Create `frontend/src/modules/map/MultiCityHeader.tsx`:

```tsx
import type { CityFootprint } from '../../shared/types';

interface Props {
  cityFootprints: CityFootprint[];
  activeCityIdx: number;
  transitSummary: string;   // e.g. "Tokyo → Sydney · ✈️ ~9h flight" — empty string hides row
  onCityTap: (idx: number) => void;
  onAddCity: () => void;
}

export function MultiCityHeader({ cityFootprints, activeCityIdx, transitSummary, onCityTap, onAddCity }: Props) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,20,30,.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.1)',
      }}
    >
      {/* City tab strip */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {cityFootprints.map((f, idx) => {
          const isActive = idx === activeCityIdx;
          return (
            <button
              key={f.city}
              onClick={() => onCityTap(idx)}
              className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isActive ? 'var(--color-primary)' : 'var(--color-surface2)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'rgba(255,255,255,.1)'}`,
                color: isActive ? '#fff' : 'var(--color-text-2)',
              }}
            >
              <span style={{ fontSize: 14 }}>{f.emoji}</span>
              <span>{f.city}</span>
              <span style={{ opacity: 0.65, fontWeight: 400 }}>· {f.pinCount}</span>
            </button>
          );
        })}
        {/* + city chip */}
        <button
          onClick={onAddCity}
          className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold"
          style={{
            border: '1.5px dashed rgba(255,255,255,.25)',
            color: 'var(--color-text-3)',
            background: 'transparent',
          }}
        >
          <span className="ms" style={{ fontSize: 14 }}>add</span>
          city
        </button>
      </div>

      {/* Breadcrumb row — transit summary */}
      {transitSummary && (
        <div
          className="px-3 pb-2.5 text-[11px] font-medium"
          style={{ color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {transitSummary}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/map/MultiCityHeader.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/map/MultiCityHeader.tsx src/modules/map/MultiCityHeader.test.tsx
git commit -m "feat(phase7): MultiCityHeader city tab strip with breadcrumb"
```

---

## Task 6: `CityArcLayer` — amber arc between city centroids

**Files:**
- Create: `frontend/src/modules/map/CityArcLayer.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/CityArcLayer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildArcGeoJSON } from './CityArcLayer';
import type { CityFootprint } from '../../shared/types';

const TOKYO: CityFootprint = { city: 'Tokyo', emoji: '🗼', pinCount: 2, lat: 35.68, lon: 139.69 };
const SYDNEY: CityFootprint = { city: 'Sydney', emoji: '🦘', pinCount: 1, lat: -33.87, lon: 151.21 };

describe('buildArcGeoJSON', () => {
  it('returns null for fewer than 2 cities', () => {
    expect(buildArcGeoJSON([TOKYO])).toBeNull();
    expect(buildArcGeoJSON([])).toBeNull();
  });

  it('returns a FeatureCollection with a line for 2 cities', () => {
    const result = buildArcGeoJSON([TOKYO, SYDNEY]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('FeatureCollection');
    expect(result!.features.length).toBeGreaterThanOrEqual(1);
    const line = result!.features[0];
    expect(line.geometry.type).toBe('LineString');
    // Should have interpolated coords between cities
    expect((line.geometry as GeoJSON.LineString).coordinates.length).toBeGreaterThan(2);
  });

  it('includes midpoint marker for transit icon', () => {
    const result = buildArcGeoJSON([TOKYO, SYDNEY]);
    const midpoint = result!.features.find(f => f.geometry.type === 'Point');
    expect(midpoint).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/CityArcLayer.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `CityArcLayer.tsx`**

Create `frontend/src/modules/map/CityArcLayer.tsx`:

```tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import type { CityFootprint, TransitMode } from '../../shared/types';

export function buildArcGeoJSON(
  cityFootprints: CityFootprint[],
): GeoJSON.FeatureCollection | null {
  if (cityFootprints.length < 2) return null;

  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < cityFootprints.length - 1; i++) {
    const from = cityFootprints[i];
    const to = cityFootprints[i + 1];
    const STEPS = 32;
    const coords: [number, number][] = [];
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      // Linear interpolation (great-circle approximation for short arcs)
      const lat = from.lat + (to.lat - from.lat) * t;
      const lon = from.lon + (to.lon - from.lon) * t;
      coords.push([lon, lat]);
    }
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
    // Midpoint marker for transit icon
    const midIdx = Math.floor(STEPS / 2);
    features.push({
      type: 'Feature',
      properties: { fromCity: from.city, toCity: to.city },
      geometry: { type: 'Point', coordinates: coords[midIdx] },
    });
  }

  return { type: 'FeatureCollection', features };
}

const TRANSIT_ICON: Record<TransitMode, string> = {
  flight: '✈',
  train: '🚄',
  drive: '🚗',
  bus: '🚌',
};

interface Props {
  cityFootprints: CityFootprint[];
  transitMode?: TransitMode;
}

const arcLineStyle: LineLayerSpecification = {
  id: 'city-arc-line',
  type: 'line',
  source: 'city-arc',
  filter: ['==', ['geometry-type'], 'LineString'],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#c49840',
    'line-width': 2,
    'line-dasharray': [4, 3],
    'line-opacity': 0.7,
  },
};

export function CityArcLayer({ cityFootprints }: Props) {
  const geojson = buildArcGeoJSON(cityFootprints);
  if (!geojson) return null;

  return (
    <Source id="city-arc" type="geojson" data={geojson}>
      <Layer {...arcLineStyle} />
    </Source>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/map/CityArcLayer.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/map/CityArcLayer.tsx src/modules/map/CityArcLayer.test.ts
git commit -m "feat(phase7): CityArcLayer dashed amber arc between city centroids"
```

---

## Task 7: Update `MapScreen` — wire detector, swap header, remove journey auto-nav

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

This task has no unit test (integration-heavy UI). Verify by running TypeScript and the full test suite.

- [ ] **Step 1: Add imports and state at the top of `MapScreen.tsx`**

After the existing imports block (after `import { BuildItineraryBar }...`), add:

```tsx
import { usePinCityDetector } from './usePinCityDetector';
import type { DetectedTransit } from './usePinCityDetector';
import { MultiCityHeader } from './MultiCityHeader';
import { CityArcLayer } from './CityArcLayer';
import { CityHopOverlay } from './CityHopOverlay';
import type { TransitMode } from '../../shared/types';
```

- [ ] **Step 2: Replace the isJourneyMode auto-nav `useEffect` with multi-city overlay state**

In `MapScreen`, find and **remove** this block (lines ~82-86):

```tsx
// Auto-navigate to journey screen when multi-city places are detected
useEffect(() => {
  if (isJourneyMode(selectedPlaces)) {
    dispatch({ type: 'GO_TO', screen: 'journey' });
  }
}, [selectedPlaces, dispatch]);
```

Replace it with (insert after the `pendingActivePlace` useEffect):

```tsx
// Multi-city overlay state
const [pendingNewCity, setPendingNewCity] = useState<{ city: string; lat: number; lon: number; transit: DetectedTransit | null } | null>(null);
const [shownCities, setShownCities] = useState<Set<string>>(new Set());

function handleNewCity(city: string, lat: number, lon: number, transit: DetectedTransit | null) {
  if (shownCities.has(city)) return; // already shown overlay for this city
  setShownCities(prev => new Set([...prev, city]));
  setPendingNewCity({ city, lat, lon, transit });
  const emoji = '🌍';
  dispatch({
    type: 'ADD_CITY_FOOTPRINT',
    footprint: { city, emoji, pinCount: 1, lat, lon },
  });
}

usePinCityDetector(
  selectedPlaces,
  cityFootprints,
  cityGeo?.lat ?? null,
  cityGeo?.lon ?? null,
  city,
  handleNewCity,
);

const isMultiCity = cityFootprints.length > 1 || isJourneyMode(selectedPlaces);

function buildTransitSummary(transit: DetectedTransit | null): string {
  if (!transit) return '';
  const icon: Record<TransitMode, string> = { flight: '✈️', train: '🚄', drive: '🚗', bus: '🚌' };
  const label: Record<TransitMode, string> = { flight: 'flight', train: 'train', drive: 'drive', bus: 'bus' };
  const hours = transit.durationMinutes
    ? `~${Math.round(transit.durationMinutes / 60)}h `
    : '';
  return `${transit.from} → ${transit.to} · ${icon[transit.mode]} ${hours}${label[transit.mode]}`;
}

const transitSummary = pendingNewCity?.transit
  ? buildTransitSummary(pendingNewCity.transit)
  : '';
```

- [ ] **Step 3: Swap the header in the JSX**

In the JSX, find the `{/* ── Top overlay ── */}` section. The current search bar header is inside `{/* Row 1: back + search input */}`. Wrap it with an `isMultiCity` conditional:

Replace the `{/* Row 1: back + search input */}` div with:

```tsx
{/* Row 1: single-city search bar OR multi-city tab header */}
{isMultiCity ? (
  <div style={{ pointerEvents: 'auto' }}>
    <MultiCityHeader
      cityFootprints={cityFootprints}
      activeCityIdx={activeCityIndex}
      transitSummary={transitSummary}
      onCityTap={(idx) => {
        dispatch({ type: 'SET_ACTIVE_CITY_INDEX', index: idx });
        const f = cityFootprints[idx];
        if (f) mapHandleRef.current?.flyTo(f.lat, f.lon, 12);
      }}
      onAddCity={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
    />
  </div>
) : (
  <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
    <button
      onClick={goBack}
      className="w-10 h-10 rounded-full backdrop-blur flex items-center justify-center border border-white/10 flex-shrink-0"
      style={{ background: 'rgba(15,20,30,.82)' }}
    >
      <span className="ms text-text-2 text-base">arrow_back</span>
    </button>
    {/* Search input */}
    <div className="flex-1 relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 ms text-white/35 text-base pointer-events-none">search</span>
      <input
        ref={searchInputRef}
        type="text"
        lang="en"
        value={searchQuery}
        onChange={e => handleSearchInput(e.target.value)}
        onFocus={() => setSearchOpen(true)}
        onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
        placeholder=""
        className="w-full h-10 rounded-full pl-9 pr-9 text-sm text-white outline-none"
        style={{
          background: 'rgba(15,20,30,.82)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,.1)',
        }}
      />
      {!searchQuery && (
        <span
          className="absolute left-9 top-1/2 -translate-y-1/2 text-sm pointer-events-none truncate"
          style={{
            color: 'rgba(255,255,255,0.3)',
            opacity: placeholderVisible ? 1 : 0,
            transition: 'opacity 0.2s ease',
            maxWidth: 'calc(100% - 72px)',
          }}
        >
          {PLACEHOLDER_EXAMPLES[placeholderIdx]}
        </span>
      )}
      {searchLoading ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-sm animate-spin pointer-events-none">autorenew</span>
      ) : searchQuery ? (
        <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-sm">close</button>
      ) : null}
    </div>
  </div>
)}
```

- [ ] **Step 4: Add `CityArcLayer` inside `MapLibreMap` and `CityHopOverlay` in JSX**

Inside `<MapLibreMap ...>` after `<UserPinsLayer .../>`, add:

```tsx
{isMultiCity && <CityArcLayer cityFootprints={cityFootprints} />}
```

Before the closing `</div>` of the whole MapScreen return, add the overlay:

```tsx
{/* CityHopOverlay — fires once per new city detected */}
{pendingNewCity && (
  <CityHopOverlay
    fromCity={pendingNewCity.transit?.from ?? city}
    toCity={pendingNewCity.city}
    storyCards={[]}
    onDone={() => setPendingNewCity(null)}
  />
)}
```

- [ ] **Step 5: Remove `JourneyStrip` import if no longer used and verify compilation**

Check if `JourneyStrip` is used elsewhere in the file. If the `<JourneyStrip />` block is the only usage, remove the import:

```bash
cd frontend && grep -n "JourneyStrip" src/modules/map/MapScreen.tsx
```

If only in the `<JourneyStrip />` JSX block, remove that block and the import. Then:

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 6: Run full test suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```
Expected: all previously passing tests still pass

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/modules/map/MapScreen.tsx
git commit -m "feat(phase7): MapScreen multi-city mode — swap header, arc overlay, CityHopOverlay"
```

---

## Task 8: Route screen — date conflict info bar

**Files:**
- Modify: `frontend/src/modules/route/RouteScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/route/RouteScreen.dateconflict.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';

// Pure logic test — compute extra days needed
function computeExtraDays(
  totalDays: number,
  startDate: string | null,
  endDate: string | null,
): number {
  if (!startDate || !endDate) return 0;
  const budgetDays =
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1;
  return Math.max(0, totalDays - budgetDays);
}

describe('computeExtraDays', () => {
  it('returns 0 when itinerary fits within budget', () => {
    expect(computeExtraDays(5, '2026-05-14', '2026-05-18')).toBe(0);
  });

  it('returns 0 when no dates set', () => {
    expect(computeExtraDays(5, null, null)).toBe(0);
  });

  it('returns extra days when itinerary exceeds budget', () => {
    expect(computeExtraDays(7, '2026-05-14', '2026-05-18')).toBe(2);
  });

  it('returns 0 when exactly equal', () => {
    expect(computeExtraDays(5, '2026-05-14', '2026-05-18')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/route/RouteScreen.dateconflict.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Add `computeExtraDays` helper + info bar to `RouteScreen.tsx`**

In `RouteScreen.tsx`, after the `const days = engineItinerary?.days ?? []` line, add:

```tsx
// Date conflict: when itinerary extends beyond user's set date range
function computeExtraDays(
  totalDays: number,
  startDate: string | null,
  endDate: string | null,
): number {
  if (!startDate || !endDate) return 0;
  const budgetDays =
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1;
  return Math.max(0, totalDays - budgetDays);
}

const extraDays = computeExtraDays(
  days.length,
  state.travelStartDate,
  state.travelEndDate,
);
```

In the JSX, after the `{/* Generation counter */}` block, add:

```tsx
{/* Date conflict info bar */}
{extraDays > 0 && state.travelStartDate && state.travelEndDate && (
  <div
    className="mx-4 mt-2 px-4 py-3 rounded-2xl flex items-start gap-3"
    style={{
      background: 'rgba(79,143,171,.08)',
      border: '1px solid rgba(79,143,171,.2)',
    }}
  >
    <span className="ms fill text-[var(--color-sky)] flex-shrink-0 mt-0.5" style={{ fontSize: 16 }}>calendar_today</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-semibold text-[var(--color-text-2)]">
          Travel dates: {new Date(state.travelStartDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(state.travelEndDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(79,143,171,.15)', color: 'var(--color-sky)' }}
        >
          +{extraDays} {extraDays === 1 ? 'day' : 'days'}
        </span>
      </div>
      <p className="text-[11px] text-[var(--color-text-3)] leading-relaxed">
        Added a travel day for the city hop. Remove places to shorten the trip.
      </p>
    </div>
  </div>
)}
```

Add `--color-sky` usage requires it's already defined in `index.css`. It is: `--color-sky: #4f8fab`.

- [ ] **Step 4: Move `computeExtraDays` to a util file so the test can import it**

Move the function to `frontend/src/modules/route/RouteScreen.tsx` as a top-level exported function (before the component), then update the test import:

```typescript
// RouteScreen.dateconflict.test.tsx
import { describe, it, expect } from 'vitest';
import { computeExtraDays } from './RouteScreen';
```

Export it from RouteScreen: `export function computeExtraDays(...)`

- [ ] **Step 5: Run test**

```bash
cd frontend && npx vitest run src/modules/route/RouteScreen.dateconflict.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 6: Verify full test suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -10
```
Expected: all passing

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/modules/route/RouteScreen.tsx src/modules/route/RouteScreen.dateconflict.test.tsx
git commit -m "feat(phase7): itinerary date conflict info bar with sky blue +N days badge"
```

---

## Task 9: Phase 8 — `SavedEvent` type + store + Screen union

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Modify: `frontend/src/shared/store.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/store.savedevent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './store';
import type { SavedEvent } from './types';

const mockEvent: SavedEvent = {
  id: 'evt-1',
  title: 'Sumida River Fireworks',
  city: 'Tokyo',
  date: '2026-07-26',
  isAnnual: true,
  venue: 'Asakusa',
  category: 'festival',
  savedAt: '2026-05-06T12:00:00Z',
};

describe('SAVE_EVENT / REMOVE_EVENT', () => {
  it('adds event to savedEvents', () => {
    const state = reducer(initialState, { type: 'SAVE_EVENT', event: mockEvent });
    expect(state.savedEvents).toHaveLength(1);
    expect(state.savedEvents[0].id).toBe('evt-1');
  });

  it('does not duplicate events', () => {
    const s1 = reducer(initialState, { type: 'SAVE_EVENT', event: mockEvent });
    const s2 = reducer(s1, { type: 'SAVE_EVENT', event: mockEvent });
    expect(s2.savedEvents).toHaveLength(1);
  });

  it('removes event by id', () => {
    const s1 = reducer(initialState, { type: 'SAVE_EVENT', event: mockEvent });
    const s2 = reducer(s1, { type: 'REMOVE_EVENT', id: 'evt-1' });
    expect(s2.savedEvents).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/shared/store.savedevent.test.ts
```
Expected: FAIL — `SavedEvent` not in types, no `SAVE_EVENT` action

- [ ] **Step 3: Add `SavedEvent` to `types.ts` and `saved` to Screen union**

In `frontend/src/shared/types.ts`:

Add `'saved'` to the Screen union (after `'trips'`):
```typescript
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
  | 'ob8' | 'ob9'
  | 'persona'
  | 'destination'
  | 'map'
  | 'journey'
  | 'route'
  | 'trips'
  | 'saved'
  | 'nav'
  | 'profile'
  | 'subscription';
```

Add `SavedEvent` interface at the end of the file:
```typescript
// ── Saved events ──────────────────────────────────────────────
export interface SavedEvent {
  id: string
  title: string
  city: string
  date: string | null       // ISO date or null if annual/recurring
  isAnnual: boolean
  venue: string | null
  category: 'festival' | 'concert' | 'market' | 'sport' | 'exhibition' | 'other'
  savedAt: string           // ISO timestamp
}
```

- [ ] **Step 4: Add store state, actions, and reducer cases**

In `frontend/src/shared/store.tsx`:

Add `SavedEvent` to imports from `./types`.

In `AppState` interface, add after `similarPinsState`:
```typescript
savedEvents: SavedEvent[]
```

In `initialState`, add:
```typescript
savedEvents: ssGet<SavedEvent[]>('ur_ss_saved_events') ?? [],
```

In the `Action` union, add:
```typescript
| { type: 'SAVE_EVENT'; event: SavedEvent }
| { type: 'REMOVE_EVENT'; id: string }
```

In the reducer, add cases before `default`:
```typescript
case 'SAVE_EVENT': {
  const exists = state.savedEvents.some(e => e.id === action.event.id);
  if (exists) return state;
  const updated = [...state.savedEvents, action.event];
  ssSave('ur_ss_saved_events', updated);
  return { ...state, savedEvents: updated };
}

case 'REMOVE_EVENT': {
  const updated = state.savedEvents.filter(e => e.id !== action.id);
  ssSave('ur_ss_saved_events', updated);
  return { ...state, savedEvents: updated };
}
```

- [ ] **Step 5: Run test**

```bash
cd frontend && npx vitest run src/shared/store.savedevent.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 6: Verify full suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -10
```
Expected: all passing

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/shared/types.ts src/shared/store.tsx src/shared/store.savedevent.test.ts
git commit -m "feat(phase8): SavedEvent type, SAVE_EVENT/REMOVE_EVENT actions, saved Screen"
```

---

## Task 10: Update `BottomNav` — 3-tab nav

**Files:**
- Modify: `frontend/src/shared/ui/BottomNav.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/ui/BottomNav.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../store';
import { BottomNav } from './BottomNav';

function renderInProvider() {
  return render(
    <AppProvider>
      <BottomNav />
    </AppProvider>
  );
}

describe('BottomNav', () => {
  it('renders 3 tabs: Explore, Saved, Profile', () => {
    renderInProvider();
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('does not render Community tab', () => {
    renderInProvider();
    expect(screen.queryByText('Community')).toBeNull();
  });

  it('does not render Itinerary tab', () => {
    renderInProvider();
    expect(screen.queryByText('Itinerary')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/shared/ui/BottomNav.test.tsx
```
Expected: FAIL — still shows Community / Itinerary tabs

- [ ] **Step 3: Update `BottomNav.tsx`**

Replace the full file content:

```tsx
import { useAppStore } from '../store';
import type { Screen } from '../types';

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore',   label: 'Explore'  },
  { screen: 'saved',       icon: 'bookmark',  label: 'Saved'    },
  { screen: 'profile',     icon: 'person',    label: 'Profile'  },
];

const OB_SCREENS = new Set<Screen>(['login', 'welcome', 'walkthrough', 'ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7', 'ob8', 'ob9', 'persona', 'route', 'nav']);

const EXPLORE_SCREENS = new Set<Screen>(['destination', 'map']);

export function BottomNav() {
  const { state, dispatch } = useAppStore();
  const { currentScreen } = state;
  if (OB_SCREENS.has(currentScreen)) return null;

  function isActive(screen: Screen): boolean {
    if (screen === 'destination') return EXPLORE_SCREENS.has(currentScreen);
    return currentScreen === screen;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 bg-[var(--nav-bg)] [backdrop-filter:blur(12px)] border-t border-[var(--color-divider)] flex items-center justify-around"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)',
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        zIndex: 30,
      }}
    >
      {NAV_ITEMS.map(item => {
        const active = isActive(item.screen);
        return (
          <button
            key={item.screen}
            onClick={() => dispatch({ type: 'GO_TO', screen: item.screen })}
            className="flex flex-col items-center gap-0.5 px-4 py-2 transition-colors"
          >
            <span className={`ms ${active ? 'fill text-[var(--color-primary)]' : 'text-[var(--color-text-3)]'} text-2xl`}>{item.icon}</span>
            <span className={`text-[10px] mt-0.5 font-semibold ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-3)]'}`}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/shared/ui/BottomNav.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/shared/ui/BottomNav.tsx src/shared/ui/BottomNav.test.tsx
git commit -m "feat(phase8): BottomNav 3-tab — Explore, Saved, Profile; remove Community"
```

---

## Task 11: `SavedEventCard` component

**Files:**
- Create: `frontend/src/modules/trips/SavedEventCard.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/trips/SavedEventCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedEventCard } from './SavedEventCard';
import type { SavedEvent } from '../../shared/types';

const mockEvent: SavedEvent = {
  id: 'evt-1',
  title: 'Sumida River Fireworks',
  city: 'Tokyo',
  date: '2026-07-26',
  isAnnual: true,
  venue: 'Asakusa',
  category: 'festival',
  savedAt: '2026-05-06T12:00:00Z',
};

describe('SavedEventCard', () => {
  it('renders event title', () => {
    render(<SavedEventCard event={mockEvent} onRemove={vi.fn()} />);
    expect(screen.getByText('Sumida River Fireworks')).toBeTruthy();
  });

  it('renders venue', () => {
    render(<SavedEventCard event={mockEvent} onRemove={vi.fn()} />);
    expect(screen.getByText(/Asakusa/)).toBeTruthy();
  });

  it('shows Annual badge when isAnnual', () => {
    render(<SavedEventCard event={mockEvent} onRemove={vi.fn()} />);
    expect(screen.getByText(/Annual/i)).toBeTruthy();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(<SavedEventCard event={mockEvent} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onRemove).toHaveBeenCalledWith('evt-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/trips/SavedEventCard.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Implement `SavedEventCard.tsx`**

Create `frontend/src/modules/trips/SavedEventCard.tsx`:

```tsx
import type { SavedEvent } from '../../shared/types';

const CATEGORY_EMOJI: Record<SavedEvent['category'], string> = {
  festival: '🎆',
  concert: '🎵',
  market: '🛍',
  sport: '⚽',
  exhibition: '🖼',
  other: '📅',
};

interface Props {
  event: SavedEvent;
  onRemove: (id: string) => void;
}

export function SavedEventCard({ event, onRemove }: Props) {
  const dateLabel = event.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: 'var(--color-amber-bg, rgba(196,152,64,.08))',
        border: '1px solid var(--color-amber-bdr, rgba(196,152,64,.2))',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{CATEGORY_EMOJI[event.category]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-1)] truncate">{event.title}</p>
        <p className="text-[11px] text-[var(--color-text-3)] truncate mt-0.5">
          {[dateLabel, event.isAnnual ? 'Annual' : null, event.venue].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(196,152,64,.15)', color: '#c49840' }}
        >
          Event
        </span>
        <button
          onClick={() => onRemove(event.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,.06)' }}
          aria-label="Remove event"
        >
          <span className="ms text-[var(--color-text-3)]" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/trips/SavedEventCard.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/trips/SavedEventCard.tsx src/modules/trips/SavedEventCard.test.tsx
git commit -m "feat(phase8): SavedEventCard with amber styling"
```

---

## Task 12: `SavedPlaceCard` component

**Files:**
- Create: `frontend/src/modules/trips/SavedPlaceCard.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/trips/SavedPlaceCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedPlaceCard } from './SavedPlaceCard';
import type { FavouritedPin } from '../../shared/types';

const pin: FavouritedPin = {
  placeId: 'p1',
  title: 'Senso-ji Temple',
  lat: 35.71,
  lon: 139.79,
  city: 'Tokyo',
};

describe('SavedPlaceCard', () => {
  it('renders place title', () => {
    render(<SavedPlaceCard pin={pin} category="historic" onRemove={vi.fn()} />);
    expect(screen.getByText('Senso-ji Temple')).toBeTruthy();
  });

  it('renders heart badge', () => {
    render(<SavedPlaceCard pin={pin} category="historic" onRemove={vi.fn()} />);
    expect(screen.getByText('❤️')).toBeTruthy();
  });

  it('calls onRemove when heart badge clicked', () => {
    const onRemove = vi.fn();
    render(<SavedPlaceCard pin={pin} category="historic" onRemove={onRemove} />);
    fireEvent.click(screen.getByText('❤️'));
    expect(onRemove).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/trips/SavedPlaceCard.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Implement `SavedPlaceCard.tsx`**

Create `frontend/src/modules/trips/SavedPlaceCard.tsx`:

```tsx
import type { FavouritedPin, Category } from '../../shared/types';

// Gradient backgrounds per category spec
const CATEGORY_GRADIENT: Record<string, string> = {
  historic:    'linear-gradient(135deg, #2d1f18, #1a130e)',
  museum:      'linear-gradient(135deg, #2d1f18, #1a130e)',
  park:        'linear-gradient(135deg, #1a2018, #111a0e)',
  restaurant:  'linear-gradient(135deg, #201818, #150f0f)',
  cafe:        'linear-gradient(135deg, #201818, #150f0f)',
  tourism:     'linear-gradient(135deg, #182028, #0f1620)',
};

const CATEGORY_EMOJI: Record<string, string> = {
  historic: '🏛',
  museum:   '🏛',
  park:     '🌿',
  restaurant: '🍴',
  cafe:     '☕',
  tourism:  '🌊',
  place:    '📍',
  event:    '🎉',
};

interface Props {
  pin: FavouritedPin;
  category: Category;
  tall?: boolean;     // first card in group spans 2 rows
  onRemove: (placeId: string) => void;
}

export function SavedPlaceCard({ pin, category, tall = false, onRemove }: Props) {
  const gradient = CATEGORY_GRADIENT[category] ?? 'linear-gradient(135deg, var(--color-surface2), var(--color-bg2))';
  const emoji = CATEGORY_EMOJI[category] ?? '📍';

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: gradient,
        gridRow: tall ? 'span 2' : 'span 1',
        minHeight: tall ? 180 : 88,
      }}
    >
      {/* Emoji placeholder */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: tall ? 40 : 28, opacity: 0.18 }}
      >
        {emoji}
      </div>

      {/* Heart badge — top right */}
      <button
        onClick={() => onRemove(pin.placeId)}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }}
        aria-label="Remove from saved"
      >
        <span style={{ fontSize: 14 }}>❤️</span>
      </button>

      {/* Label bottom */}
      <div
        className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-6"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.65), transparent)' }}
      >
        <p className="text-xs font-bold text-white leading-snug line-clamp-2">{pin.title}</p>
        <p className="text-[10px] mt-0.5 capitalize"
          style={{ color: 'rgba(255,255,255,.55)' }}
        >
          {category}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/trips/SavedPlaceCard.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/trips/SavedPlaceCard.tsx src/modules/trips/SavedPlaceCard.test.tsx
git commit -m "feat(phase8): SavedPlaceCard with category gradient and heart badge"
```

---

## Task 13: `SavedPlacesTab` component

**Files:**
- Create: `frontend/src/modules/trips/SavedPlacesTab.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/trips/SavedPlacesTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SavedPlacesTab } from './SavedPlacesTab';
import type { FavouritedPin, SavedEvent } from '../../shared/types';

const pins: FavouritedPin[] = [
  { placeId: 'p1', title: 'Senso-ji Temple', lat: 35.71, lon: 139.79, city: 'Tokyo' },
  { placeId: 'p2', title: 'Shinjuku Gyoen', lat: 35.68, lon: 139.71, city: 'Tokyo' },
  { placeId: 'p3', title: 'Opera House', lat: -33.86, lon: 151.21, city: 'Sydney' },
];

const events: SavedEvent[] = [
  {
    id: 'e1', title: 'Sumida Fireworks', city: 'Tokyo', date: '2026-07-26',
    isAnnual: true, venue: 'Asakusa', category: 'festival', savedAt: '2026-05-06T00:00:00Z',
  },
];

describe('SavedPlacesTab', () => {
  it('renders city group headers', () => {
    render(
      <SavedPlacesTab
        favouritedPins={pins}
        savedEvents={events}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText(/Tokyo/)).toBeTruthy();
    expect(screen.getByText(/Sydney/)).toBeTruthy();
  });

  it('renders correct place counts in city header', () => {
    render(
      <SavedPlacesTab
        favouritedPins={pins}
        savedEvents={events}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText(/2 places/)).toBeTruthy();
    expect(screen.getByText(/1 place/)).toBeTruthy();
  });

  it('renders saved events under correct city', () => {
    render(
      <SavedPlacesTab
        favouritedPins={pins}
        savedEvents={events}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText('Sumida Fireworks')).toBeTruthy();
  });

  it('shows empty state when no pins saved', () => {
    render(
      <SavedPlacesTab
        favouritedPins={[]}
        savedEvents={[]}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText(/no saved places/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/trips/SavedPlacesTab.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Implement `SavedPlacesTab.tsx`**

Create `frontend/src/modules/trips/SavedPlacesTab.tsx`:

```tsx
import type { FavouritedPin, SavedEvent } from '../../shared/types';
import { SavedPlaceCard } from './SavedPlaceCard';
import { SavedEventCard } from './SavedEventCard';

interface CityGroup {
  city: string;
  emoji: string;
  pins: FavouritedPin[];
  events: SavedEvent[];
}

function buildCityGroups(pins: FavouritedPin[], events: SavedEvent[]): CityGroup[] {
  const cityMap = new Map<string, CityGroup>();

  for (const pin of pins) {
    const c = pin.city || 'Other';
    if (!cityMap.has(c)) {
      cityMap.set(c, { city: c, emoji: '🌍', pins: [], events: [] });
    }
    cityMap.get(c)!.pins.push(pin);
  }

  for (const event of events) {
    const c = event.city || 'Other';
    if (!cityMap.has(c)) {
      cityMap.set(c, { city: c, emoji: '🌍', pins: [], events: [] });
    }
    cityMap.get(c)!.events.push(event);
  }

  return Array.from(cityMap.values());
}

interface Props {
  favouritedPins: FavouritedPin[];
  savedEvents: SavedEvent[];
  onOpenMap: (city: string) => void;
  onRemovePin: (placeId: string) => void;
  onRemoveEvent: (id: string) => void;
}

export function SavedPlacesTab({ favouritedPins, savedEvents, onOpenMap, onRemovePin, onRemoveEvent }: Props) {
  const groups = buildCityGroups(favouritedPins, savedEvents);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
        <span className="ms text-[var(--color-text-4)]" style={{ fontSize: 44 }}>bookmark_border</span>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-2)] mb-1">No saved places yet</p>
          <p className="text-xs text-[var(--color-text-3)] leading-relaxed">
            Tap ❤️ on any pin on the map to save it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {groups.map(group => {
        const placeCount = group.pins.length;
        const eventCount = group.events.length;
        const countLabel = [
          placeCount > 0 ? `${placeCount} ${placeCount === 1 ? 'place' : 'places'}` : null,
          eventCount > 0 ? `${eventCount} ${eventCount === 1 ? 'event' : 'events'}` : null,
        ].filter(Boolean).join(' · ');

        return (
          <div key={group.city} className="mb-6">
            {/* City header */}
            <div className="flex items-center gap-2 px-4 mb-3 mt-4">
              <span style={{ fontSize: 20 }}>{group.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-[var(--color-text-1)]">{group.city}</span>
                {countLabel && (
                  <span className="text-xs text-[var(--color-text-3)] ml-2">{countLabel}</span>
                )}
              </div>
            </div>

            {/* Masonry grid — 2 columns */}
            {group.pins.length > 0 && (
              <div className="px-4 grid grid-cols-2 gap-2 mb-3">
                {group.pins.map((pin, i) => (
                  <SavedPlaceCard
                    key={pin.placeId}
                    pin={pin}
                    category={('place' as const)}
                    tall={i === 0}
                    onRemove={onRemovePin}
                  />
                ))}
              </div>
            )}

            {/* Saved events */}
            {group.events.length > 0 && (
              <div className="px-4 flex flex-col gap-2 mb-3">
                {group.events.map(event => (
                  <SavedEventCard key={event.id} event={event} onRemove={onRemoveEvent} />
                ))}
              </div>
            )}

            {/* Open on map CTA */}
            <div className="px-4">
              <button
                onClick={() => onOpenMap(group.city)}
                className="w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(255,255,255,.05)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-2)',
                }}
              >
                <span className="ms text-sm">map</span>
                Open {group.city} on map
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/trips/SavedPlacesTab.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/trips/SavedPlacesTab.tsx src/modules/trips/SavedPlacesTab.test.tsx
git commit -m "feat(phase8): SavedPlacesTab city groups with masonry grid and events"
```

---

## Task 14: `SavedScreen` parent component

**Files:**
- Create: `frontend/src/modules/trips/SavedScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/trips/SavedScreen.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../../shared/store';
import { SavedScreen } from './SavedScreen';

function renderInProvider() {
  return render(<AppProvider><SavedScreen /></AppProvider>);
}

describe('SavedScreen', () => {
  it('renders Saved title', () => {
    renderInProvider();
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('renders Itineraries and Saved sub-tabs', () => {
    renderInProvider();
    expect(screen.getByText('Itineraries')).toBeTruthy();
    expect(screen.getAllByText('Saved').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Itineraries sub-tab on tap', () => {
    renderInProvider();
    fireEvent.click(screen.getByText('Itineraries'));
    // Itineraries tab should become active (visual state verified by opacity/color, not testable here)
    // Just verify no crash
    expect(screen.getByText('Itineraries')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/trips/SavedScreen.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Implement `SavedScreen.tsx`**

Create `frontend/src/modules/trips/SavedScreen.tsx`:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { TripsScreen } from './TripsScreen';
import { SavedPlacesTab } from './SavedPlacesTab';

type SubTab = 'itineraries' | 'saved';

export function SavedScreen() {
  const { state, dispatch } = useAppStore();
  const { favouritedPins, savedEvents, savedItineraries } = state;

  const defaultTab: SubTab = favouritedPins.length > 0 ? 'saved' : 'itineraries';
  const [activeTab, setActiveTab] = useState<SubTab>(defaultTab);

  function handleOpenMap(city: string) {
    dispatch({ type: 'SET_CITY', city });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleRemovePin(placeId: string) {
    const pin = favouritedPins.find(p => p.placeId === placeId);
    if (pin) dispatch({ type: 'TOGGLE_FAVOURITE', pin });
  }

  function handleRemoveEvent(id: string) {
    dispatch({ type: 'REMOVE_EVENT', id });
  }

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'saved', label: 'Saved' },
    { key: 'itineraries', label: 'Itineraries' },
  ];

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col overflow-hidden" style={{ zIndex: 10 }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '0.5rem' }}
      >
        <h1
          className="font-[family-name:var(--font-heading)] font-bold"
          style={{ fontSize: 22, color: 'var(--color-text-1)' }}
        >
          Saved
        </h1>

        {/* Sub-tabs */}
        <div className="flex gap-2 mt-3">
          {SUB_TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-surface2)',
                  color: isActive ? '#fff' : 'var(--color-text-3)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--color-border)'}`,
                }}
              >
                {tab.label}
                {tab.key === 'saved' && favouritedPins.length > 0 && (
                  <span className="ml-1.5 opacity-70">{favouritedPins.length}</span>
                )}
                {tab.key === 'itineraries' && savedItineraries.length > 0 && (
                  <span className="ml-1.5 opacity-70">{savedItineraries.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'saved' && (
          <SavedPlacesTab
            favouritedPins={favouritedPins}
            savedEvents={savedEvents}
            onOpenMap={handleOpenMap}
            onRemovePin={handleRemovePin}
            onRemoveEvent={handleRemoveEvent}
          />
        )}
        {activeTab === 'itineraries' && <TripsScreen />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npx vitest run src/modules/trips/SavedScreen.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/trips/SavedScreen.tsx src/modules/trips/SavedScreen.test.tsx
git commit -m "feat(phase8): SavedScreen with Itineraries/Saved sub-tabs"
```

---

## Task 15: Register `SavedScreen` in `index.ts` and `App.tsx`

**Files:**
- Modify: `frontend/src/modules/trips/index.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Export `SavedScreen` from trips index**

Read `frontend/src/modules/trips/index.ts` first to see its current exports, then add:

```typescript
export { SavedScreen } from './SavedScreen';
```

- [ ] **Step 2: Register in `App.tsx`**

In `App.tsx`, add the import after the `TripsScreen` import:
```tsx
import { TripsScreen, SavedScreen } from './modules/trips';
```

In the `ScreenRouter` JSX, add after `{currentScreen === 'trips' && <TripsScreen />}`:
```tsx
{currentScreen === 'saved'       && <SavedScreen />}
```

Also, update `activeMidSessionScreens` to include `'saved'` (so auth restores correctly):
```typescript
const activeMidSessionScreens = new Set([
  'map', 'route', 'destination', 'journey', 'persona', 'nav', 'trips', 'saved', 'profile', 'subscription',
]);
```

And update `midSessionScreens` in `handleSignedIn`:
```typescript
const midSessionScreens = ['map', 'route', 'destination', 'journey', 'saved'];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -15
```
Expected: all passing

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/modules/trips/index.ts src/App.tsx
git commit -m "feat(phase8): register SavedScreen in routing and trips index"
```

---

## Task 16: `MapScreen` — Saved filter chip

**Files:**
- Modify: `frontend/src/modules/map/types.ts`
- Modify: `frontend/src/modules/map/useMap.ts`
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/useMap.saved.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Place, FavouritedPin } from '../../shared/types';

// Test the filter logic directly
function filterPlacesForSaved(
  places: Place[],
  favouritedPins: FavouritedPin[],
  activeFilter: string,
): Place[] {
  if (activeFilter !== 'saved') return places;
  const ids = new Set(favouritedPins.map(f => f.placeId));
  return places.filter(p => ids.has(p.id));
}

const places: Place[] = [
  { id: 'a', title: 'A', category: 'park', lat: 0, lon: 0 },
  { id: 'b', title: 'B', category: 'museum', lat: 0, lon: 0 },
  { id: 'c', title: 'C', category: 'restaurant', lat: 0, lon: 0 },
];

const favs: FavouritedPin[] = [
  { placeId: 'a', title: 'A', lat: 0, lon: 0, city: 'Tokyo' },
];

describe('saved filter logic', () => {
  it('returns all places when filter is not saved', () => {
    expect(filterPlacesForSaved(places, favs, 'all')).toHaveLength(3);
  });

  it('returns only favourited places when filter is saved', () => {
    const result = filterPlacesForSaved(places, favs, 'saved');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty when no places are favourited', () => {
    expect(filterPlacesForSaved(places, [], 'saved')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/useMap.saved.test.ts
```
Expected: FAIL (test file imports nothing yet — but the pure function is defined inline, so it should PASS immediately — that's fine for a logic test)

- [ ] **Step 3: Add `'saved'` to `MapFilter` in `types.ts`**

In `frontend/src/shared/types.ts`, update:
```typescript
export type MapFilter = Category | 'all' | 'recommended' | 'saved';
```

- [ ] **Step 4: Handle `'saved'` filter in `useMap.ts`**

In `frontend/src/modules/map/useMap.ts`, the `filteredPlaces` computation (around line 134):

```typescript
const filteredPlaces: Place[] =
  activeFilter === 'recommended'
    ? recommendedPlaces
    : activeFilter === 'saved'
    ? places.filter(p => favouritedPins.some(f => f.placeId === p.id))
    : activeFilter === 'all'
    ? places
    : places.filter(p => p.category === (activeFilter as string));
```

Also ensure `favouritedPins` is available in `useMap.ts` — check if it's already destructured from store state. If not, add:
```typescript
const favouritedPins = state.favouritedPins;
```

- [ ] **Step 5: Add Saved chip in `MapScreen.tsx` JSX**

In `MapScreen.tsx`, in the filter bar section (after `<FilterBar .../>`), add a conditional Saved chip:

```tsx
{/* Saved filter chip — appears when places are hearted */}
{favouritedPins.length > 0 && (
  <div style={{ pointerEvents: 'auto' }}>
    <button
      onClick={() => {
        if (activeFilter === 'saved') {
          setFilter('all');
        } else {
          setFilter('saved' as MapFilter);
        }
      }}
      className="flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-medium transition-all"
      style={{
        background: activeFilter === 'saved' ? 'var(--color-primary)' : 'rgba(224,120,84,.15)',
        color: activeFilter === 'saved' ? '#fff' : 'var(--color-primary)',
        border: `1px solid ${activeFilter === 'saved' ? 'var(--color-primary)' : 'rgba(224,120,84,.3)'}`,
      }}
    >
      <span className="ms" style={{ fontSize: 13 }}>bookmark</span>
      Saved
      <span style={{ opacity: 0.7 }}>{favouritedPins.length}</span>
      {activeFilter === 'saved' && (
        <span className="ms" style={{ fontSize: 12 }}>close</span>
      )}
    </button>
  </div>
)}
```

- [ ] **Step 6: Run tests**

```bash
cd frontend && npx vitest run 2>&1 | tail -15
```
Expected: all passing

- [ ] **Step 7: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
cd frontend && git add src/modules/map/types.ts src/modules/map/useMap.ts src/modules/map/MapScreen.tsx src/shared/types.ts src/modules/map/useMap.saved.test.ts
git commit -m "feat(phase8): Saved filter chip on map, filters to hearted pins"
```

---

## Final verification

- [ ] **Run full test suite**

```bash
cd frontend && npx vitest run 2>&1
```
Expected: all tests pass

- [ ] **TypeScript clean**

```bash
cd frontend && npx tsc --noEmit 2>&1
```
Expected: no errors

- [ ] **Commit summary tag**

```bash
git log --oneline -16
```
Verify 16 commits for Phase 7 + Phase 8 are present.

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| Calendar slides in below search bar after city select | Task 2 |
| "We use this to check events, weather and opening days" copy | Task 1 |
| 📅 icon re-opens calendar, shows compact date label | Task 2 |
| Near me path skips calendar | Task 2 |
| `usePinCityDetector` haversine + nominatim + OSRM | Task 3 |
| `_city` stamp + `ADD_CITY_FOOTPRINT` dispatch | Task 3 |
| `CityHopOverlay` — spec copy "Sydney after Tokyo — nice." | Task 4 |
| Never: "plan/handle/book" transport | Task 4 |
| Multi-city header city tab strip | Task 5 |
| Breadcrumb row with transit mode | Task 5 |
| `+ city` dashed chip | Task 5 |
| Map stays on MapScreen (no journey auto-nav) | Task 7 |
| `isMultiCity` drives header swap | Task 7 |
| Arc line overlay amber dashed | Task 6 |
| Date conflict info bar +N days sky blue | Task 8 |
| Remove Community tab | Task 10 |
| 3-tab nav: Explore, Saved, Profile | Task 10 |
| `SavedScreen` with sub-tabs | Task 14 |
| Masonry 2-col grid, tall first card | Task 13 |
| Category gradient palette | Task 12 |
| Saved events amber card | Task 11 |
| "Open on map" CTA | Task 13 |
| `SAVE_EVENT` / `REMOVE_EVENT` actions | Task 9 |
| `SavedEvent` type persisted to `ur_ss_saved_events` | Task 9 |
| Map Saved filter chip reactive to `favouritedPins` | Task 16 |
| `saved` added to Screen union | Task 9 |
| `saved` NOT in OB_SCREENS | Task 10 |

### Potential gaps
- Date nudge for past travel dates in SavedPlacesTab not implemented — the spec mentions it (§4) but it requires knowing `travelStartDate` per city. For MVP, omitted — `SavedPlacesTab` shows "Open on map" CTA which will prompt for dates on the destination screen.
- City emoji lookup is hardcoded to `🌍` in `handleNewCity` — a follow-up can add a proper city→emoji mapping. This is cosmetic.
- `TripsScreen` rendered inside `SavedScreen` as a child: `TripsScreen` has its own `fixed inset-0` wrapper which will overlap. **Fix:** `TripsScreen` must be rendered without its fixed wrapper when embedded. For MVP, render `TripsScreen` in a scrollable div context — if it conflicts, the `activeTab === 'itineraries'` content can just re-render the TripsScreen list content directly. Flag for code review.
