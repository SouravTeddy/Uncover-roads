# Conversational Origin Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hotel/Airport/Pin chip UI in TripPlanningCard and OriginInputSheet with a conversational, 4-state origin card that accepts any place type, makes time fields optional, and handles "not decided yet" with destination-first itinerary narration.

**Architecture:** A new `useOriginInput` hook encapsulates all origin search logic (unified search, type inference, optional time). A new `OriginSearchCard` component renders the 4 states. `TripPlanningCard` embeds it inline; `OriginInputSheet` becomes a thin modal wrapper around it.

**Tech Stack:** React, TypeScript, Vitest, Google Places Autocomplete API (via existing backend proxy)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/shared/strings.ts` | **Create** | All user-facing copy constants |
| `frontend/src/shared/origin-utils.ts` | **Create** | `classifyOriginType()` shared utility (moved from OriginInputSheet) |
| `frontend/src/shared/origin-utils.test.ts` | **Create** | Tests for classifyOriginType |
| `frontend/src/modules/map/useOriginInput.ts` | **Create** | Hook: unified search, type inference, optional time, not-decided state |
| `frontend/src/modules/map/useOriginInput.test.ts` | **Create** | Tests for useOriginInput logic |
| `frontend/src/modules/map/OriginSearchCard.tsx` | **Create** | Conversational 4-state origin UI component |
| `frontend/src/modules/map/TripPlanningCard.tsx` | **Modify** | Remove chips; embed OriginSearchCard; remove "recommended start time" |
| `frontend/src/modules/map/useTripPlanInput.ts` | **Modify** | Remove StartChip; accept `origin: OriginPlace \| null` in handleBuild |
| `frontend/src/modules/journey/OriginInputSheet.tsx` | **Modify** | Thin modal wrapper: renders OriginSearchCard, dispatches SET_JOURNEY_ORIGIN on done |
| `frontend/src/modules/map/journey-legs.ts` | **Modify** | Replace magic number 780 with named constants; add POST_CHECKIN_REST_MINUTES |

---

## Task 1: Add check-in constants to journey-legs.ts

**Files:**
- Modify: `frontend/src/modules/map/journey-legs.ts:131-146`
- Test: `frontend/src/modules/map/journey-legs.test.ts`

- [ ] **Step 1: Write a failing test for the late check-in threshold constant**

In `frontend/src/modules/map/journey-legs.test.ts`, add after the existing `buildJourneyLegs` tests:

```typescript
import {
  calculateEstimatedDays,
  calculateTravelDays,
  calculateArrivalDates,
  detectTransitMode,
  buildJourneyLegs,
  LATE_CHECKIN_THRESHOLD_HOUR,
  POST_CHECKIN_REST_MINUTES,
} from './journey-legs';

describe('check-in constants', () => {
  it('LATE_CHECKIN_THRESHOLD_HOUR is 18 (6 PM)', () => {
    expect(LATE_CHECKIN_THRESHOLD_HOUR).toBe(18);
  });

  it('POST_CHECKIN_REST_MINUTES is 45', () => {
    expect(POST_CHECKIN_REST_MINUTES).toBe(45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/journey-legs.test.ts
```

Expected: FAIL — `LATE_CHECKIN_THRESHOLD_HOUR` is not exported.

- [ ] **Step 3: Add named constants to journey-legs.ts**

At the top of `frontend/src/modules/map/journey-legs.ts`, after the imports, add:

```typescript
/**
 * Hour (24h) after which a hotel check-in is considered "late".
 * Used to decide whether the itinerary starts on day 1 or day 2.
 * Note: future scheduling logic will use full trip context (night-place placement,
 * day density) — this threshold is the baseline for the simple case.
 */
export const LATE_CHECKIN_THRESHOLD_HOUR = 18;

/**
 * Minutes of rest to allow after hotel check-in before the itinerary begins.
 * Accounts for settling in and freshening up.
 */
export const POST_CHECKIN_REST_MINUTES = 45;
```

Then replace the magic number in `buildJourneyLegs`:

```typescript
// Before (line ~135):
if (checkoutTotalMin < 780) {

// After:
const CHECKOUT_MORNING_CUTOFF_MIN = 13 * 60; // 1:00 PM — late checkout threshold
if (checkoutTotalMin < CHECKOUT_MORNING_CUTOFF_MIN) {
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/modules/map/journey-legs.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/journey-legs.ts frontend/src/modules/map/journey-legs.test.ts
git commit -m "refactor: replace magic check-in numbers with named constants in journey-legs"
```

---

## Task 2: Create strings.ts — copy constants

**Files:**
- Create: `frontend/src/shared/strings.ts`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/shared/strings.ts
// All user-facing copy for the origin card. Edit here to change tone/phrasing.

export const ORIGIN_STRINGS = {
  cardHeading:       "Where are you starting your trip from?",
  searchPlaceholder: "Hotel, airport, anywhere...",
  hotelFollowUp:     "When do you check in?",
  airportFollowUp:   "When do you land?",
  optionalNudge:     "You can always come back to fine-tune your plan.",
  notDecidedLabel:   "Haven't decided yet",
  notDecidedHeading: "No starting point? No problem.",
  notDecidedSub:     "We'll build your plan around the places — just get to the first stop on time.",
  itineraryNudge:    "Add where you're staying to see travel times",
  cta:               "Build my itinerary",
  ctaDays:           (n: number) => `Build my ${n}-day itinerary`,
} as const;

export const PLACE_TYPE_LABELS: Record<string, string> = {
  hotel:   'Hotel',
  airport: 'Airport',
  home:    'Home',
  custom:  'Place',
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors related to strings.ts.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/strings.ts
git commit -m "feat: add strings.ts for origin card copy constants"
```

---

## Task 3: Create origin-utils.ts — shared type classification

**Files:**
- Create: `frontend/src/shared/origin-utils.ts`
- Create: `frontend/src/shared/origin-utils.test.ts`

The `classifyOriginType` function currently lives in `OriginInputSheet.tsx` with an `'ask_home'` intermediate state. The new version drops `'ask_home'` — street addresses map to `'custom'`.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/shared/origin-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyOriginType } from './origin-utils';

describe('classifyOriginType', () => {
  it('classifies lodging as hotel', () => {
    expect(classifyOriginType(['lodging', 'establishment'])).toBe('hotel');
  });

  it('classifies airport type as airport', () => {
    expect(classifyOriginType(['airport', 'establishment'])).toBe('airport');
  });

  it('classifies street_address as custom', () => {
    expect(classifyOriginType(['street_address', 'geocode'])).toBe('custom');
  });

  it('classifies premise as custom', () => {
    expect(classifyOriginType(['premise'])).toBe('custom');
  });

  it('defaults to custom for unknown types', () => {
    expect(classifyOriginType(['point_of_interest'])).toBe('custom');
  });

  it('defaults to custom for empty array', () => {
    expect(classifyOriginType([])).toBe('custom');
  });

  it('lodging takes priority over street_address', () => {
    expect(classifyOriginType(['lodging', 'street_address'])).toBe('hotel');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/shared/origin-utils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create origin-utils.ts**

```typescript
// frontend/src/shared/origin-utils.ts
import type { OriginType } from './types';

/**
 * Maps a Google Places `types` array to our internal OriginType.
 * Priority: hotel > airport > custom (street addresses, premises, unknowns).
 * Unlike the legacy classifyOriginType, there is no 'ask_home' intermediate —
 * home detection has been removed from the origin flow.
 */
export function classifyOriginType(types: string[] = []): OriginType {
  if (types.includes('lodging')) return 'hotel';
  if (types.includes('airport')) return 'airport';
  return 'custom';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/shared/origin-utils.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/origin-utils.ts frontend/src/shared/origin-utils.test.ts
git commit -m "feat: add shared classifyOriginType utility, drop ask_home intermediate state"
```

---

## Task 4: Create useOriginInput hook

**Files:**
- Create: `frontend/src/modules/map/useOriginInput.ts`
- Create: `frontend/src/modules/map/useOriginInput.test.ts`

This hook owns all origin selection state: unified search (no type filter), dropdown results with type badges, optional time input, and the "not decided" path.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/map/useOriginInput.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOriginInput } from './useOriginInput';

vi.mock('../../shared/api', () => ({
  placesAutocomplete: vi.fn(),
  geocodePlace: vi.fn(),
  fetchPlaceDetails: vi.fn(),
}));

import { placesAutocomplete, geocodePlace, fetchPlaceDetails } from '../../shared/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useOriginInput', () => {
  it('starts in opening state', () => {
    const { result } = renderHook(() => useOriginInput());
    expect(result.current.step).toBe('opening');
  });

  it('chooseNotDecided sets step to not_decided', () => {
    const { result } = renderHook(() => useOriginInput());
    act(() => result.current.chooseNotDecided());
    expect(result.current.step).toBe('not_decided');
  });

  it('reset returns to opening state', () => {
    const { result } = renderHook(() => useOriginInput());
    act(() => result.current.chooseNotDecided());
    act(() => result.current.reset());
    expect(result.current.step).toBe('opening');
  });

  it('handleSearchInput with < 2 chars does not call API', async () => {
    const { result } = renderHook(() => useOriginInput());
    await act(async () => result.current.handleSearchInput('a'));
    expect(placesAutocomplete).not.toHaveBeenCalled();
  });

  it('selecting a hotel place moves to selected step with hotel time field', async () => {
    vi.mocked(placesAutocomplete).mockResolvedValue([
      { place_id: 'p1', main_text: 'Marriott', secondary_text: 'Bangalore, India' },
    ]);
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 12.9, lon: 77.5, name: 'Marriott Bangalore', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p1', types: ['lodging'], weekday_text: [] });

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p1', main_text: 'Marriott', secondary_text: 'Bangalore' });
    });

    expect(result.current.step).toBe('selected');
    expect(result.current.selectedOrigin?.originType).toBe('hotel');
    expect(result.current.timeFieldLabel).toBe('When do you check in?');
  });

  it('selecting an airport place moves to selected step with airport time field', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 13.1, lon: 77.7, name: 'Kempegowda Airport', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p2', types: ['airport'], weekday_text: [] });

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p2', main_text: 'Kempegowda Airport', secondary_text: 'Bangalore' });
    });

    expect(result.current.step).toBe('selected');
    expect(result.current.selectedOrigin?.originType).toBe('airport');
    expect(result.current.timeFieldLabel).toBe('When do you land?');
  });

  it('selecting a street address moves to selected step with no time field', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 12.8, lon: 77.6, name: '42 MG Road', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p3', types: ['street_address'], weekday_text: [] });

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p3', main_text: '42 MG Road', secondary_text: 'Bangalore' });
    });

    expect(result.current.step).toBe('selected');
    expect(result.current.selectedOrigin?.originType).toBe('custom');
    expect(result.current.timeFieldLabel).toBeNull();
  });

  it('buildOrigin with no time returns origin without time fields', () => {
    const { result } = renderHook(() => useOriginInput());
    // Simulate selected state
    act(() => result.current.chooseNotDecided());
    const origin = result.current.buildOrigin();
    expect(origin).toBeNull(); // not_decided returns null
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/modules/map/useOriginInput.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create useOriginInput.ts**

```typescript
// frontend/src/modules/map/useOriginInput.ts
import { useState, useCallback, useRef } from 'react';
import { placesAutocomplete, geocodePlace, fetchPlaceDetails } from '../../shared/api';
import { classifyOriginType } from '../../shared/origin-utils';
import { ORIGIN_STRINGS, PLACE_TYPE_LABELS } from '../../shared/strings';
import type { AutocompleteResult, OriginPlace } from '../../shared/types';

export type OriginStep = 'opening' | 'searching' | 'selected' | 'not_decided';

function newSessionId() { return Math.random().toString(36).slice(2); }

export interface OriginInputState {
  step: OriginStep;
  searchQuery: string;
  searchResults: AutocompleteResult[];
  searchLoading: boolean;
  selectedOrigin: OriginPlace | null;
  /** Label for the optional time field, or null if not applicable for this place type */
  timeFieldLabel: string | null;
  /** The user-entered optional time value (HH:MM) */
  timeValue: string;
  handleSearchInput: (query: string) => void;
  handleSelectResult: (result: AutocompleteResult) => Promise<void>;
  handleTimeChange: (time: string) => void;
  chooseNotDecided: () => void;
  /** Returns the final OriginPlace (with optional time applied), or null if not_decided */
  buildOrigin: () => OriginPlace | null;
  reset: () => void;
}

export function useOriginInput(): OriginInputState {
  const [step, setStep] = useState<OriginStep>('opening');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AutocompleteResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<OriginPlace | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const sessionRef = useRef(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    setStep('searching');
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // No type filter — accepts hotels, airports, streets, anything
        const results = await placesAutocomplete(query, sessionRef.current, '');
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSelectResult = useCallback(async (result: AutocompleteResult) => {
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const geo = await geocodePlace(result.place_id, sessionRef.current);
      sessionRef.current = newSessionId();
      if (!geo) return;

      const details = await fetchPlaceDetails(result.place_id);
      const types = details?.types ?? [];
      const originType = classifyOriginType(types);

      const origin: OriginPlace = {
        placeId: result.place_id,
        name: geo.name,
        address: result.secondary_text,
        lat: geo.lat,
        lon: geo.lon,
        originType,
      };

      setSelectedOrigin(origin);
      setSearchQuery(geo.name);
      setStep('selected');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleTimeChange = useCallback((time: string) => {
    setTimeValue(time);
  }, []);

  const chooseNotDecided = useCallback(() => {
    setStep('not_decided');
  }, []);

  const reset = useCallback(() => {
    setStep('opening');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedOrigin(null);
    setTimeValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    sessionRef.current = newSessionId();
  }, []);

  const timeFieldLabel: string | null = (() => {
    if (!selectedOrigin) return null;
    if (selectedOrigin.originType === 'hotel') return ORIGIN_STRINGS.hotelFollowUp;
    if (selectedOrigin.originType === 'airport') return ORIGIN_STRINGS.airportFollowUp;
    return null;
  })();

  const buildOrigin = useCallback((): OriginPlace | null => {
    if (step === 'not_decided') return null;
    if (!selectedOrigin) return null;
    if (!timeValue) return selectedOrigin;

    if (selectedOrigin.originType === 'hotel') {
      return { ...selectedOrigin, checkInTime: timeValue };
    }
    if (selectedOrigin.originType === 'airport') {
      return { ...selectedOrigin, departureTime: timeValue };
    }
    return selectedOrigin;
  }, [step, selectedOrigin, timeValue]);

  return {
    step,
    searchQuery,
    searchResults,
    searchLoading,
    selectedOrigin,
    timeFieldLabel,
    timeValue,
    handleSearchInput,
    handleSelectResult,
    handleTimeChange,
    chooseNotDecided,
    buildOrigin,
    reset,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/modules/map/useOriginInput.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/useOriginInput.ts frontend/src/modules/map/useOriginInput.test.ts
git commit -m "feat: add useOriginInput hook for conversational origin card"
```

---

## Task 5: Create OriginSearchCard component

**Files:**
- Create: `frontend/src/modules/map/OriginSearchCard.tsx`

This is a pure UI component. It receives `useOriginInput`'s state + handlers via props (passed from parent) or consumes the hook internally. Since both `TripPlanningCard` and `OriginInputSheet` need to own the origin result differently, the component takes an `onDone` callback.

- [ ] **Step 1: Create OriginSearchCard.tsx**

```typescript
// frontend/src/modules/map/OriginSearchCard.tsx
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOriginInput } from './useOriginInput';
import { ORIGIN_STRINGS, PLACE_TYPE_LABELS } from '../../shared/strings';
import type { OriginPlace } from '../../shared/types';

// ── Design tokens (match app theme) ─────────────────────────────
const SURFACE2 = '#1A1F2B';
const PRIMARY  = '#3b82f6';
const PRIMARY_BG = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

const TYPE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  hotel:   { bg: 'rgba(168,85,247,.15)',   color: '#a855f7' },
  airport: { bg: 'rgba(59,130,246,.15)',   color: '#3b82f6' },
  home:    { bg: 'rgba(34,197,94,.15)',    color: '#22c55e' },
  custom:  { bg: 'rgba(100,116,139,.2)',   color: '#94a3b8' },
};

interface Props {
  /** Called when origin is confirmed. null = "not decided" path. */
  onDone: (origin: OriginPlace | null) => void;
}

export function OriginSearchCard({ onDone }: Props) {
  const {
    step,
    searchQuery,
    searchResults,
    searchLoading,
    selectedOrigin,
    timeFieldLabel,
    timeValue,
    handleSearchInput,
    handleSelectResult,
    handleTimeChange,
    chooseNotDecided,
    buildOrigin,
  } = useOriginInput();

  const inputRef = useRef<HTMLDivElement>(null);

  function handleConfirm() {
    onDone(buildOrigin());
  }

  const badgeStyle = selectedOrigin
    ? (TYPE_BADGE_STYLES[selectedOrigin.originType] ?? TYPE_BADGE_STYLES.custom)
    : TYPE_BADGE_STYLES.custom;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Opening / Searching state ── */}
      {(step === 'opening' || step === 'searching') && (
        <>
          {/* Search input */}
          <div ref={inputRef} style={{ position: 'relative' }}>
            <div style={{
              background: SURFACE2,
              border: `1.5px solid ${step === 'searching' ? PRIMARY_BORDER : BORDER}`,
              borderRadius: 14, height: 52,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 14px',
              transition: 'border-color .15s',
            }}>
              <span className="ms" style={{ fontSize: 20, color: TEXT3, flexShrink: 0 }}>search</span>
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder={ORIGIN_STRINGS.searchPlaceholder}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 14, fontWeight: 600, color: TEXT1,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  caretColor: PRIMARY,
                }}
              />
              {searchLoading && (
                <span className="ms animate-spin" style={{ fontSize: 16, color: TEXT3, flexShrink: 0 }}>autorenew</span>
              )}
            </div>

            {/* Dropdown results */}
            {searchResults.length > 0 && (() => {
              const rect = inputRef.current?.getBoundingClientRect();
              if (!rect) return null;
              return createPortal(
                <div style={{
                  position: 'fixed',
                  top: rect.bottom + 4,
                  left: rect.left,
                  width: rect.width,
                  zIndex: 9999,
                  background: '#1E2535',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,.6)',
                }}>
                  {searchResults.map((r, i) => {
                    return (
                      <button
                        key={r.place_id}
                        onMouseDown={() => handleSelectResult(r)}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '12px 16px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: PRIMARY_BG,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="ms" style={{ fontSize: 16, color: PRIMARY }}>location_on</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                            {r.main_text}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
                            {r.secondary_text}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>,
                document.body,
              );
            })()}
          </div>

          {/* "Haven't decided yet" option */}
          <button
            onClick={chooseNotDecided}
            style={{
              height: 48, width: '100%',
              background: 'none',
              border: `1.5px dashed ${PRIMARY_BORDER}`,
              borderRadius: 14, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13, fontWeight: 600, color: '#93c5fd',
            }}
          >
            {ORIGIN_STRINGS.notDecidedLabel}
          </button>
        </>
      )}

      {/* ── Selected state ── */}
      {step === 'selected' && selectedOrigin && (
        <>
          {/* Confirmed place */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            background: PRIMARY_BG,
            border: `1px solid ${PRIMARY_BORDER}`,
            borderRadius: 14,
          }}>
            <span className="ms" style={{ fontSize: 18, color: '#4ade80', flexShrink: 0 }}>check_circle</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT1, flex: 1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              {selectedOrigin.name}
            </span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              background: badgeStyle.bg, color: badgeStyle.color,
            }}>
              {PLACE_TYPE_LABELS[selectedOrigin.originType] ?? 'Place'}
            </span>
          </div>

          {/* Optional time field */}
          {timeFieldLabel && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase', color: TEXT3, marginBottom: 8,
                fontFamily: 'Inter, sans-serif',
              }}>
                {timeFieldLabel} <span style={{ color: '#475569', fontWeight: 400 }}>— optional</span>
              </div>
              <input
                type="time"
                value={timeValue}
                onChange={e => handleTimeChange(e.target.value)}
                style={{
                  width: '100%', height: 52, background: SURFACE2,
                  border: `1.5px solid rgba(59,130,246,.35)`, borderRadius: 14,
                  fontSize: 24, fontWeight: 800, color: TEXT1,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  textAlign: 'center', outline: 'none', cursor: 'pointer',
                  colorScheme: 'dark',
                }}
              />
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 8, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                {ORIGIN_STRINGS.optionalNudge}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Not decided state ── */}
      {step === 'not_decided' && (
        <div style={{
          background: 'rgba(59,130,246,.06)',
          border: `1px solid ${PRIMARY_BORDER}`,
          borderRadius: 14,
          padding: '16px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif', marginBottom: 4 }}>
            {ORIGIN_STRINGS.notDecidedHeading}
          </div>
          <div style={{ fontSize: 12, color: TEXT3, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            {ORIGIN_STRINGS.notDecidedSub}
          </div>
        </div>
      )}

      {/* ── Confirm button (selected + not_decided) ── */}
      {(step === 'selected' || step === 'not_decided') && (
        <button
          onClick={handleConfirm}
          style={{
            width: '100%', height: 48,
            background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`,
            border: 'none', borderRadius: 14, cursor: 'pointer',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 14, fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 20px rgba(59,130,246,.3)',
          }}
        >
          Confirm starting point
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/OriginSearchCard.tsx
git commit -m "feat: add OriginSearchCard component with 4-state conversational flow"
```

---

## Task 6: Update TripPlanningCard — remove chips, embed OriginSearchCard

**Files:**
- Modify: `frontend/src/modules/map/TripPlanningCard.tsx`
- Modify: `frontend/src/modules/map/useTripPlanInput.ts`

The card gets rid of chips, the old location search section, and the "Recommended start time" panel. The origin section is replaced by `OriginSearchCard`. The `handleBuild` signature changes to accept `origin: OriginPlace | null`.

- [ ] **Step 1: Update useTripPlanInput.ts**

Replace the entire file with:

```typescript
// frontend/src/modules/map/useTripPlanInput.ts
import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../shared/store';
import type { OriginPlace } from '../../shared/types';
import { computeTotalDays } from './trip-capacity-utils';

export function useTripPlanInput() {
  const { state, dispatch } = useAppStore();
  const { selectedPlaces, travelStartDate, travelEndDate } = state;

  const canBuild = selectedPlaces.length >= 1;

  const handleBuild = useCallback((origin: OriginPlace | null) => {
    const totalDays = computeTotalDays(travelStartDate, travelEndDate);
    const days      = totalDays > 0 ? totalDays : 1;
    const startDate = travelStartDate ?? new Date().toISOString().split('T')[0];

    dispatch({ type: 'SET_ITINERARY',      itinerary: null });
    dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date:        startDate,
        startType:   origin ? origin.originType : 'custom',
        arrivalTime: null,
        days,
        dayNumber:   1,
        locationLat:  origin?.lat  ?? null,
        locationLon:  origin?.lon  ?? null,
        locationName: origin?.name ?? null,
        flightTime:  origin?.departureTime ?? null,
        isLongHaul:  origin?.isLongHaul ?? false,
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }, [dispatch, travelStartDate, travelEndDate]);

  return { canBuild, handleBuild };
}
```

- [ ] **Step 2: Update TripPlanningCard.tsx**

Replace the body section (lines 194–403 — from `{/* ── Body ──*/}` to the end of the body div) with the OriginSearchCard embed. The full updated file:

```typescript
// frontend/src/modules/map/TripPlanningCard.tsx
import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { useTripPlanInput } from './useTripPlanInput';
import { OriginSearchCard } from './OriginSearchCard';
import { ORIGIN_STRINGS } from '../../shared/strings';
import { computeTotalDays } from './trip-capacity-utils';
import type { OriginPlace } from '../../shared/types';

interface Props {
  onClose: () => void;
}

// ── Design tokens ─────────────────────────────────────────────
const SURFACE  = '#141921';
const PRIMARY  = '#3b82f6';
const PRIMARY_BG = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

export function TripPlanningCard({ onClose }: Props) {
  const { state } = useAppStore();
  const city        = state.city;
  const placesCount = state.selectedPlaces.length;
  const { travelStartDate, travelEndDate } = state;
  const totalDays = computeTotalDays(travelStartDate, travelEndDate);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const { canBuild, handleBuild } = useTripPlanInput();

  function formatDateShort(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function handleOriginDone(origin: OriginPlace | null) {
    handleBuild(origin);
    onClose();
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />

      {/* Modal sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 16, right: 16,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          zIndex: 51,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          position: 'relative',
          padding: '22px 20px 18px',
          background: `linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)`,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: PRIMARY, marginBottom: 6,
            fontFamily: 'Inter, sans-serif',
          }}>
            Plan your day
          </div>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 22, fontWeight: 800, color: TEXT1, lineHeight: 1.1,
          }}>
            {city || 'Your City'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {travelStartDate && travelEndDate ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 24, padding: '0 10px',
                background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
                borderRadius: 999,
              }}>
                <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>calendar_month</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                  {formatDateShort(travelStartDate)} – {formatDateShort(travelEndDate)} · {totalDays} day{totalDays !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 24, padding: '0 10px',
                background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`,
                borderRadius: 999,
              }}>
                <span className="ms" style={{ fontSize: 12, color: TEXT3 }}>calendar_month</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: TEXT3, fontFamily: 'Inter, sans-serif' }}>
                  Set dates in explore
                </span>
              </div>
            )}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 24, padding: '0 10px',
              background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
              borderRadius: 999,
            }}>
              <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>place</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                {placesCount} place{placesCount !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
            textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
            fontFamily: 'Inter, sans-serif',
          }}>
            {ORIGIN_STRINGS.cardHeading}
          </div>
          <OriginSearchCard onDone={handleOriginDone} />
        </div>

        {/* ── Spacer for safe area ── */}
        <div style={{ height: 20 }} />
      </div>
    </>,
    document.body,
  );
}
```

Note: The `OriginSearchCard` now owns the CTA ("Confirm starting point") for the selected/not_decided states. The card itself no longer needs a separate CTA button — `handleOriginDone` is called from within `OriginSearchCard.onDone`.

- [ ] **Step 3: Remove pin drop props from all call sites**

Search for `TripPlanningCard` usages:

```bash
cd frontend && grep -r "TripPlanningCard" src --include="*.tsx" -l
```

For each file found, remove `onRequestPinDrop`, `pinDropResult`, `pinPlaceName`, `onClearPin` props — these no longer exist on the component. The pin drop feature is replaced by the unified search bar (users can type an address or drop a pin via the map, but pin-drop-from-card is removed per the new design).

- [ ] **Step 4: Verify compilation**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/TripPlanningCard.tsx frontend/src/modules/map/useTripPlanInput.ts
git commit -m "feat: replace chip origin UI with OriginSearchCard in TripPlanningCard"
```

---

## Task 7: Replace OriginInputSheet with OriginSearchCard wrapper

**Files:**
- Modify: `frontend/src/modules/journey/OriginInputSheet.tsx`

The multi-step sheet is replaced by a thin modal shell that renders `OriginSearchCard` and dispatches to the store on completion.

- [ ] **Step 1: Rewrite OriginInputSheet.tsx**

```typescript
// frontend/src/modules/journey/OriginInputSheet.tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { OriginSearchCard } from '../map/OriginSearchCard';
import { ORIGIN_STRINGS } from '../../shared/strings';
import type { OriginPlace } from '../../shared/types';

const PRIMARY = '#3b82f6';
const TEXT1   = '#f1f5f9';
const TEXT3   = '#8e9099';
const BORDER  = 'rgba(255,255,255,.08)';
const SURFACE = '#141921';

interface Props {
  onDone: (origin: OriginPlace | null) => void;
  onClose: () => void;
}

export function OriginInputSheet({ onDone, onClose }: Props) {
  const { dispatch } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleDone(origin: OriginPlace | null) {
    if (origin) {
      dispatch({ type: 'SET_JOURNEY_ORIGIN', place: origin });
    }
    onDone(origin);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 65,
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0, transition: 'opacity .3s',
        }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: 16, right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          zIndex: 66, background: SURFACE,
          border: `1px solid ${BORDER}`, borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid ${BORDER}`, position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16, width: 32, height: 32,
              borderRadius: '50%', background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
            color: PRIMARY, marginBottom: 6, fontFamily: 'Inter, sans-serif',
          }}>
            Starting point
          </div>
          <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 20, fontWeight: 800, color: TEXT1 }}>
            {ORIGIN_STRINGS.cardHeading}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 24px' }}>
          <OriginSearchCard onDone={handleDone} />
        </div>
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Run all tests**

```bash
cd frontend && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/journey/OriginInputSheet.tsx
git commit -m "refactor: replace OriginInputSheet multi-step flow with OriginSearchCard"
```

---

## Task 8: Add itinerary nudge for no-origin mode

**Files:**
- Modify: whichever component renders the itinerary/route screen day headers

This adds the soft nudge *"Add where you're staying to see travel times"* when the journey has no origin leg.

- [ ] **Step 1: Find the route/itinerary screen component**

```bash
cd frontend && grep -r "GO_TO.*route\|screen.*route" src --include="*.tsx" -l
```

Then:

```bash
cd frontend && grep -r "journey\[0\]\|origin.*leg\|legs.*origin" src --include="*.tsx" -l
```

Identify which component renders the day-by-day itinerary and read it.

- [ ] **Step 2: Add a helper to detect no-origin mode**

In the identified component, add a derived value:

```typescript
// Detect whether the trip has no origin (user chose "not decided")
const hasOrigin = state.journey.length > 0 && state.journey[0].type === 'origin';
```

- [ ] **Step 3: Render the nudge when no origin**

In the appropriate location (above the day list or in the header area), add:

```typescript
{!hasOrigin && (
  <button
    onClick={/* open the origin card / trip planning card */}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px',
      background: 'rgba(59,130,246,.08)',
      border: '1px solid rgba(59,130,246,.2)',
      borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
      marginBottom: 12,
    }}
  >
    <span className="ms" style={{ fontSize: 16, color: '#3b82f6', flexShrink: 0 }}>add_location</span>
    <span style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
      {ORIGIN_STRINGS.itineraryNudge}
    </span>
  </button>
)}
```

- [ ] **Step 4: Verify compilation and run all tests**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected: No errors, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -p  # stage only the itinerary screen changes
git commit -m "feat: add 'add starting point' nudge on itinerary when no origin"
```

---

## Self-Review Checklist

After all tasks:

- [ ] Chips removed from `TripPlanningCard` — replaced by `OriginSearchCard`
- [ ] "Recommended start time" panel removed from `TripPlanningCard`
- [ ] `OriginInputSheet` multi-step flow replaced — renders `OriginSearchCard`
- [ ] `classifyOriginType` unified in `origin-utils.ts`, no longer duplicated
- [ ] `StartChip` type removed from `useTripPlanInput`
- [ ] `LATE_CHECKIN_THRESHOLD_HOUR` and `POST_CHECKIN_REST_MINUTES` exported from `journey-legs.ts`
- [ ] All copy sourced from `strings.ts`
- [ ] `ask_home` intermediate step removed
- [ ] "Not decided" correctly dispatches with no origin leg
- [ ] Itinerary nudge renders when no origin in journey state
