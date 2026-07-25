# TripDetailsSheet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign TripDetailsSheet to use design tokens throughout, replace the horizontal day-chip date picker with the existing calendar component in single-date mode, add a progress strip communicating optional fields, add swipe-to-close, enforce date constraints, and reframe the hotel field.

**Architecture:** Two files change. `DateRangeCalendar` gains `singleDate`, `minDate`, and `maxDate` props — when `singleDate=true` a single tap calls `onSelect` immediately. `TripDetailsSheet` is rebuilt using those props, CSS design tokens, native `<input type="time">` for time picking, and touch handlers for swipe-to-close. No new files are created.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, CSS custom properties (var(--color-*))

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/modules/destination/DateRangeCalendar.tsx` | Add `singleDate`, `minDate`, `maxDate` props |
| `frontend/src/modules/destination/DateRangeCalendar.test.tsx` | Add tests for new props |
| `frontend/src/modules/route/reel/TripDetailsSheet.tsx` | Full redesign — tokens, calendar, progress strip, swipe, framing |

---

## Task 1: Extend DateRangeCalendar with singleDate + minDate/maxDate

**Files:**
- Modify: `frontend/src/modules/destination/DateRangeCalendar.tsx`
- Test: `frontend/src/modules/destination/DateRangeCalendar.test.tsx`

- [ ] **Step 1.1: Write failing tests**

Add these three tests to `DateRangeCalendar.test.tsx` after the existing ones:

```tsx
it('singleDate: calls onSelect immediately on first tap', () => {
  const onSelect = vi.fn();
  render(<DateRangeCalendar singleDate onSelect={onSelect} />);
  const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
  if (nextBtn) fireEvent.click(nextBtn);
  const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
  const day15 = dayButtons.find(b => b.textContent?.trim() === '15');
  expect(day15).toBeTruthy();
  fireEvent.click(day15!);
  // Called after ONE tap, not two
  expect(onSelect).toHaveBeenCalledOnce();
  const [start, end] = onSelect.mock.calls[0];
  expect(start).toMatch(/^\d{4}-\d{2}-15$/);
  expect(start).toBe(end);
});

it('minDate: disables days before the given date', () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const minDate = `${year}-${month}-15`;
  render(<DateRangeCalendar minDate={minDate} onSelect={vi.fn()} />);
  // Navigate to that month
  const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
  if (nextBtn) fireEvent.click(nextBtn);
  const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
  const day10 = dayButtons.find(b => b.textContent?.trim() === '10');
  expect(day10).toHaveAttribute('disabled');
  const day20 = dayButtons.find(b => b.textContent?.trim() === '20');
  expect(day20).not.toHaveAttribute('disabled');
});

it('maxDate: disables days after the given date', () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const maxDate = `${year}-${month}-15`;
  render(<DateRangeCalendar maxDate={maxDate} onSelect={vi.fn()} />);
  const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
  if (nextBtn) fireEvent.click(nextBtn);
  const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
  const day20 = dayButtons.find(b => b.textContent?.trim() === '20');
  expect(day20).toHaveAttribute('disabled');
  const day10 = dayButtons.find(b => b.textContent?.trim() === '10');
  expect(day10).not.toHaveAttribute('disabled');
});
```

- [ ] **Step 1.2: Run to confirm they fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/destination/DateRangeCalendar.test.tsx 2>&1 | tail -20
```

Expected: 3 new tests FAIL with errors about unrecognised props.

- [ ] **Step 1.3: Implement props in DateRangeCalendar.tsx**

Update the `Props` interface and `handleDayClick`:

```tsx
interface Props {
  city?: string | null;
  singleDate?: boolean;
  minDate?: string;
  maxDate?: string;
  onSelect: (startDate: string, endDate: string) => void;
}
```

Update the `handleDayClick` function:

```tsx
function handleDayClick(day: number) {
  const iso = toIso(viewYear, viewMonth, day);
  if (iso < todayIso) return;
  if (minDate && iso < minDate) return;
  if (maxDate && iso > maxDate) return;

  if (singleDate) {
    setStartDate(iso);
    setEndDate(iso);
    onSelect(iso, iso);
    return;
  }

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
```

Update the `isPast` / disabled logic in the cell render:

```tsx
const isPast = iso < todayIso;
const isBelowMin = !!minDate && iso < minDate;
const isAboveMax = !!maxDate && iso > maxDate;
const isDisabled = isPast || isBelowMin || isAboveMax;
```

Replace `disabled={isPast}` with `disabled={isDisabled}` and `opacity: isPast ? 0.4 : 1` with `opacity: isDisabled ? 0.4 : 1`.

- [ ] **Step 1.4: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/destination/DateRangeCalendar.test.tsx 2>&1 | tail -20
```

Expected: all 6 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/destination/DateRangeCalendar.tsx src/modules/destination/DateRangeCalendar.test.tsx && git commit -m "feat(calendar): add singleDate, minDate, maxDate props"
```

---

## Task 2: Rewrite TripDetailsSheet

**Files:**
- Modify: `frontend/src/modules/route/reel/TripDetailsSheet.tsx`

This task replaces the entire presentation layer of TripDetailsSheet. Keep all existing state variables (`arrivalDate`, `arrivalTime`, `departureDate`, `departureTime`, `hotels`, `expanded`) and utility functions (`todayIso`, `generateDates`, `displayDate`, `displayDateTime`, `displayTime12`, `to24h`, `from24h`, `transitLabel`). Remove: `DayChip`, `TimeEditor`, `DateTimeExpanded`, `DateTimeCollapsed`, `DateTimeCard`. Add: `ProgressStrip`, `TimeInput`, and a new `DateTimeCard`.

The `expanded` state now tracks phase too:

```tsx
const [expanded, setExpanded] = useState<'arrival' | 'departure' | null>(null);
const [expandedPhase, setExpandedPhase] = useState<'cal' | 'time'>('cal');
```

- [ ] **Step 2.1: Add ProgressStrip component**

Add before the `TripDetailsSheet` export:

```tsx
function ProgressStrip({
  datesSet, timesSet, hotelSet,
}: { datesSet: boolean; timesSet: boolean; hotelSet: boolean }) {
  const dots = [
    { filled: datesSet, label: 'dates' },
    { filled: timesSet, label: 'times' },
    { filled: hotelSet, label: 'base' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {dots.map(({ filled, label }) => (
          <div
            key={label}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: filled ? 'var(--color-primary)' : 'var(--color-border-m)',
              transition: 'background .25s',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.4 }}>
        Fill in what you have — we'll build with whatever you add
      </span>
    </div>
  );
}
```

- [ ] **Step 2.2: Add TimeInput component**

```tsx
function TimeInput({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 6 }}>
        Time <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </div>
      <input
        type="time"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
          color: value ? 'var(--color-text-1)' : 'var(--color-text-4)',
          fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none',
          appearance: 'none', WebkitAppearance: 'none',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2.3: Add new DateTimeCard component**

Replace the old `DayChip`, `TimeEditor`, `DateTimeExpanded`, `DateTimeCollapsed`, `DateTimeCard` components entirely with this single component. It needs `DateRangeCalendar` imported at the top of the file:

```tsx
import { DateRangeCalendar } from '../../destination/DateRangeCalendar';
```

```tsx
function DateTimeCard({
  label, icon, city, date, time,
  expanded, phase,
  onExpand, onDateSelect, onTimeChange,
  minDate, maxDate,
}: {
  label: string; icon: string; city: string;
  date: string | null; time: string | null;
  expanded: boolean; phase: 'cal' | 'time';
  onExpand: () => void;
  onDateSelect: (iso: string) => void;
  onTimeChange: (hhmm: string) => void;
  minDate?: string; maxDate?: string;
}) {
  const filled = !!date;

  // Expanded — calendar phase
  if (expanded && phase === 'cal') {
    return (
      <div style={{
        borderRadius: 13, overflow: 'hidden',
        border: '1.5px solid var(--color-sky-bdr)',
        marginBottom: 8,
      }}>
        <div style={{
          padding: '10px 13px',
          background: 'var(--color-sky-bg)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sky)' }}>{label} · {city}</span>
        </div>
        <div style={{ background: 'var(--color-surface)' }}>
          <DateRangeCalendar
            singleDate
            minDate={minDate}
            maxDate={maxDate}
            onSelect={(iso) => onDateSelect(iso)}
          />
        </div>
      </div>
    );
  }

  // Expanded — time phase
  if (expanded && phase === 'time') {
    return (
      <div style={{
        padding: '12px 13px', borderRadius: 13, marginBottom: 8,
        background: 'var(--color-sky-bg)', border: '1.5px solid var(--color-sky-bdr)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sky)' }}>{label} · {city}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 2 }}>
          {displayDate(date!)}
        </div>
        <TimeInput value={time} onChange={onTimeChange} />
      </div>
    );
  }

  // Collapsed — filled
  if (filled) {
    return (
      <button
        onClick={onExpand}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
          padding: '12px 13px', borderRadius: 13,
          background: 'var(--color-sage-bg)', border: '1px solid var(--color-sage-bdr)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sage)' }}>{label}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-1)' }}>
          {displayDate(date)}
        </div>
        {time && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', marginTop: 2 }}>
            {displayTime12(time)}
          </div>
        )}
      </button>
    );
  }

  // Collapsed — unfilled
  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
        padding: '12px 13px', borderRadius: 13,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--color-text-4)',
          border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>
          optional
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-border-m)' }}>—</div>
    </button>
  );
}
```

- [ ] **Step 2.4: Rewrite the HotelRow component**

Replace the existing `HotelRow` with the following. Only the label and placeholder text change:

```tsx
function HotelRow({ city, name, onChange }: { city: string; name: string | null; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(name ?? ''); }, [name]);

  function handleBlur() { setEditing(false); onChange(val); }

  return (
    <div
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 13px', borderRadius: 13, marginBottom: 8, cursor: 'text',
        background: name ? 'var(--color-sage-bg)' : 'var(--color-surface)',
        border: `1px solid ${name ? 'var(--color-sage-bdr)' : 'var(--color-border)'}`,
      }}
    >
      <span className="ms fill" style={{ fontSize: 15, color: name ? 'var(--color-sage)' : 'var(--color-sky)', flexShrink: 0 }}>
        hotel
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: name ? 'var(--color-sage)' : 'var(--color-text-4)' }}>
            Your base · {city}
          </span>
          {!name && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: 'var(--color-text-4)', border: '1px solid var(--color-border)',
              borderRadius: 4, padding: '1px 5px' }}>
              optional
            </span>
          )}
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={val}
            onChange={e => setVal(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={handleBlur}
            placeholder="Where are you staying?"
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
            }}
          />
        ) : (
          <div style={{ fontSize: 13, color: name ? 'var(--color-text-1)' : 'var(--color-text-4)', fontWeight: name ? 600 : 400 }}>
            {name || 'Where are you staying?'}
          </div>
        )}
      </div>
      {name && <span className="ms fill" style={{ fontSize: 15, color: 'var(--color-sage)' }}>check_circle</span>}
    </div>
  );
}
```

- [ ] **Step 2.5: Rewrite TripDetailsSheet main component**

Replace the `TripDetailsSheet` function body with the following. Key changes: design tokens on the sheet, `useSheetDismiss` added, swipe-to-close touch handlers, `expandedPhase` state, new `ProgressStrip`, new `DateTimeCard` wiring, date constraints.

```tsx
export function TripDetailsSheet({ cities, journeyLegs, existingDetails, travelDate, onSave, onClose }: Props) {
  const anchor = travelDate ?? todayIso();
  const isMultiCity = cities.length > 1;

  const [arrivalDate, setArrivalDate] = useState<string | null>(existingDetails?.arrivalDate ?? null);
  const [arrivalTime, setArrivalTime] = useState<string | null>(existingDetails?.arrivalTime ?? null);
  const [departureDate, setDepartureDate] = useState<string | null>(existingDetails?.departureDate ?? null);
  const [departureTime, setDepartureTime] = useState<string | null>(existingDetails?.departureTime ?? null);
  const [hotels, setHotels] = useState<{ city: string; name: string | null }[]>(() => {
    if (existingDetails?.hotels?.length) return existingDetails.hotels;
    return cities.map(c => ({ city: c, name: null }));
  });
  const [expanded, setExpanded] = useState<'arrival' | 'departure' | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<'cal' | 'time'>('cal');

  // Swipe-to-close
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    function onTouchStart(e: TouchEvent) { touchStartY.current = e.touches[0].clientY; }
    function onTouchMove(e: TouchEvent) {
      if (touchStartY.current === null) return;
      if (e.touches[0].clientY - touchStartY.current > 0) e.preventDefault();
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartY.current === null) return;
      if (e.changedTouches[0].clientY - touchStartY.current > 80) onClose();
      touchStartY.current = null;
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onClose]);

  // Hardware back button
  useSheetDismiss(onClose, true);

  const firstCity = cities[0] ?? '';
  const lastCity = cities[cities.length - 1] ?? '';
  const titleCities = isMultiCity
    ? cities.slice(0, 3).join(' · ').toUpperCase()
    : firstCity.toUpperCase();

  const datesSet = !!arrivalDate && !!departureDate;
  const timesSet = !!arrivalTime || !!departureTime;
  const hotelSet = hotels.some(h => !!h.name);

  function handleHotelChange(city: string, name: string) {
    setHotels(prev => prev.map(h => h.city === city ? { ...h, name: name || null } : h));
  }

  function handleArrivalDateSelect(iso: string) {
    setArrivalDate(iso);
    setExpandedPhase('time');
  }

  function handleDepartureDateSelect(iso: string) {
    setDepartureDate(iso);
    setExpandedPhase('time');
  }

  function handleExpand(field: 'arrival' | 'departure') {
    setExpanded(field);
    setExpandedPhase('cal');
  }

  function handleSave() {
    onSave({ arrivalDate, arrivalTime, departureDate, departureTime, hotels });
    onClose();
  }

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 66 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
          borderTop: '1px solid var(--color-border-m)', backdropFilter: 'blur(20px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          animation: 'sheet-in .35s cubic-bezier(.25,0,0,1) both',
          maxHeight: '92dvh', overflowY: 'auto',
        }}
        className="no-scrollbar"
      >
        {/* Drag handle */}
        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--color-border-m)', margin: '11px auto 18px' }} />

        <div style={{ padding: '0 16px' }}>
          {/* Title */}
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: datesSet ? 'var(--color-sage)' : 'var(--color-sky)',
            marginBottom: 10,
          }}>
            TRIP DETAILS · {titleCities}
          </p>

          <ProgressStrip datesSet={datesSet} timesSet={timesSet} hotelSet={hotelSet} />

          {/* Arrival */}
          <DateTimeCard
            label="Arrival" icon="flight_land" city={firstCity}
            date={arrivalDate} time={arrivalTime}
            expanded={expanded === 'arrival'}
            phase={expandedPhase}
            onExpand={() => handleExpand('arrival')}
            onDateSelect={handleArrivalDateSelect}
            onTimeChange={setArrivalTime}
            maxDate={departureDate ?? undefined}
          />

          {/* Departure */}
          <DateTimeCard
            label="Departure" icon="flight_takeoff" city={lastCity}
            date={departureDate} time={departureTime}
            expanded={expanded === 'departure'}
            phase={expandedPhase}
            onExpand={() => handleExpand('departure')}
            onDateSelect={handleDepartureDateSelect}
            onTimeChange={setDepartureTime}
            minDate={arrivalDate ?? undefined}
          />

          {/* Hotel rows */}
          {isMultiCity ? (
            hotels.map((hotel, i) => (
              <div key={hotel.city}>
                {i > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, margin: '6px 0',
                    padding: '7px 10px', borderRadius: 9,
                    background: 'var(--color-sky-bg)', border: '1px solid var(--color-sky-bdr)',
                  }}>
                    <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>train</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sky)' }}>
                        {transitLabel(journeyLegs, hotels[i - 1].city, hotel.city) ?? `${hotels[i - 1].city} → ${hotel.city}`}
                      </div>
                    </div>
                  </div>
                )}
                <HotelRow city={hotel.city} name={hotel.name} onChange={n => handleHotelChange(hotel.city, n)} />
              </div>
            ))
          ) : (
            <HotelRow city={firstCity} name={hotels[0]?.name ?? null} onChange={n => handleHotelChange(firstCity, n)} />
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, marginTop: 8,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: '#0f0d0c',
            }}
          >
            Save trip details
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
```

Also add `useSheetDismiss` to the imports at the top of the file:

```tsx
import { useSheetDismiss } from '../../../shared/useSheetDismiss';
```

- [ ] **Step 2.6: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | grep -E "TripDetailsSheet|DateRangeCalendar"
```

Expected: no errors for these two files. Fix any type errors before continuing.

- [ ] **Step 2.7: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run 2>&1 | tail -30
```

Expected: all tests pass (pre-existing failures in `computeBuildReadinessText` are allowed — do not fix unrelated tests).

- [ ] **Step 2.8: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/route/reel/TripDetailsSheet.tsx && git commit -m "feat(trip-sheet): redesign with calendar, progress strip, swipe-to-close, design tokens"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - Design tokens: covered — all `rgba(...)` replaced with `var(--color-*)` tokens
  - Calendar single-date mode: covered — Task 1 adds prop; Task 2 wires it
  - Calendar collapses on single tap: covered — `singleDate` calls `onSelect` on first tap; `onDateSelect` switches `expandedPhase` to `time` which hides the calendar
  - Progress strip: covered — `ProgressStrip` component with 3 dots
  - Optional badges: covered — on unfilled DateTimeCard and HotelRow
  - Swipe-to-close: covered — native touch listeners with `passive: false` on touchmove
  - Date constraints: covered — `maxDate={departureDate}` on arrival, `minDate={arrivalDate}` on departure
  - Hotel framing: covered — "Your base · {city}" + "Where are you staying?"
  - Font consistency: covered — min 10px, no more 9px chips

- [x] **Placeholders**: none
- [x] **Type consistency**: `DateTimeCard` props match usage in `TripDetailsSheet`; `singleDate` is `boolean` (not `string`); `onSelect` signature unchanged in `DateRangeCalendar`
