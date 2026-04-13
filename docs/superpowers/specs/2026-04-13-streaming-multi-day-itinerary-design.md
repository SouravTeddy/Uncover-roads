# Streaming Multi-Day Itinerary Design

**Date:** 2026-04-13

## Goal

Replace N parallel `/ai-itinerary` calls with a single `/ai-itinerary-stream` endpoint that streams one day at a time as NDJSON. The frontend renders itinerary slots immediately with shimmer placeholders and replaces them with real content as each day arrives. All retries are automatic — the user only sees a CTA when the entire build is unrecoverable.

## Scope

**In scope:**
- `/ai-itinerary-stream` backend endpoint (NDJSON `StreamingResponse`)
- Multi-day prompt restructured for all-days-in-one-call
- `api.aiItineraryStream()` async generator on frontend
- `APPEND_ITINERARY_DAY` store action
- `DayShimmer` + `DayError` + `DayStops` sub-components in RouteScreen
- Auto-retry: stream drop → single-day fallback per remaining day (×2, backoff)
- Auto-retry: full build connection failure → retry whole stream (×2, backoff)
- `loading` drops after first day dispatched (not after all days)

**Out of scope:**
- Swipeable day cards (Phase 2)
- Place interchange between days
- Streaming progress within a single day (token-level)
- Manual retry button (replaced by auto-retry everywhere)

---

## Architecture

### Overview

```
User taps Build
  → useRoute.buildItinerary()
      → api.aiItineraryStream(request)          [async generator]
          → POST /ai-itinerary-stream            [FastAPI StreamingResponse]
              → Anthropic client.messages.stream()
              ← token stream
          ← NDJSON lines (one per day)
      ← yields Itinerary one day at a time
  → APPEND_ITINERARY_DAY per day
  → RouteScreen re-renders: shimmer → real content per slot
```

### New endpoint: `/ai-itinerary-stream`

- Accepts same request body as `/ai-itinerary` (no breaking change)
- `days` field at top level controls how many days the LLM generates
- Returns `StreamingResponse(generate(), media_type="application/x-ndjson")`
- Existing `/ai-itinerary` stays unchanged — used as single-day retry target

### Existing `/ai-itinerary`

Unchanged. Used only for per-day auto-retry when stream breaks.

---

## Data Model

### Store changes

`itineraryDays` type changes from `Itinerary[]` to `(Itinerary | null)[]`.
`null` = day that exhausted all retries. Serialises cleanly via `JSON.stringify`.

New action added to `Action` union:
```typescript
| { type: 'APPEND_ITINERARY_DAY'; day: Itinerary | null }
```

Reducer:
```typescript
case 'APPEND_ITINERARY_DAY':
  const updated = [...state.itineraryDays, action.day];
  ssSave('ur_ss_itin_days', updated);
  return { ...state, itineraryDays: updated };
```

`SET_ITINERARY_DAYS` kept for reset/compat path (used in `RESET_MAP` and to clear at build start).

### `useRoute` new return values

```typescript
totalDays: number      // computeTotalDays(travelStartDate, travelEndDate) || tripContext.days
streamingDays: boolean // itineraryDays.length < totalDays && !error
```

### `loading` semantics change

`setLoading(false)` fires after the **first day** is dispatched, not after all days complete.
`streamingDays` drives shimmer slots for the remaining pending days.

---

## Backend: `/ai-itinerary-stream`

### File: `main.py`

```python
@app.post("/ai-itinerary-stream")
def ai_itinerary_stream(body: dict):
    # Same setup as ai_itinerary:
    # - Extract fields (city, days, pace, persona, trip_ctx, etc.)
    # - Run NN sort on places
    # - Run conflict check
    # - Build conflict_str, trip_str, balance_note, location_note

    # Prompt is identical to ai_itinerary EXCEPT:
    # 1. Remove "day N of N" framing — now covers all days
    # 2. Add OUTPUT FORMAT block at end (see below)

    output_format = f"""
OUTPUT FORMAT — FOLLOW EXACTLY:
- Output {days} lines total — one line per day, no other text
- Each line is a single compact JSON object with NO internal newlines
- Line format: {{"day_number":N,"date":"YYYY-MM-DD","itinerary":[...],"summary":{{...}}}}
- "date" for day N = {start_date} + (N-1) days
- Do NOT wrap in an array. Do not add markdown, labels, or blank lines.
"""

    full_prompt = base_prompt + output_format

    def generate():
        buffer = ""
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                timeout=120,
                messages=[{"role": "user", "content": full_prompt}],
            ) as stream:
                for text in stream.text_stream:
                    buffer += text
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = re.sub(r'\s+', ' ', line).strip()
                        if not line:
                            continue
                        try:
                            parsed = json.loads(line)
                            yield json.dumps(parsed) + '\n'
                        except json.JSONDecodeError:
                            pass  # malformed line — frontend detects missing day, auto-retries
            # flush remaining buffer
            if buffer.strip():
                try:
                    parsed = json.loads(re.sub(r'\s+', ' ', buffer).strip())
                    yield json.dumps(parsed) + '\n'
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            print(f"STREAM ERROR: {e}")
            # StreamingResponse has already started — can't raise HTTPException
            # Frontend detects incomplete stream by day count

    return StreamingResponse(generate(), media_type="application/x-ndjson")
```

**`max_tokens` raised to 8000** to accommodate N days (single-day uses 3500).

**`start_date`** passed into the prompt = `trip_ctx.get("travel_date")` (already present in request body as day 1's date).

---

## Frontend: Stream Client

### File: `frontend/src/shared/api.ts`

New export — async generator:

```typescript
export async function* aiItineraryStream(
  body: ItineraryRequest,
): AsyncGenerator<Itinerary> {
  const res = await fetch(`${BASE}/ai-itinerary-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Stream ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) yield JSON.parse(trimmed) as Itinerary;
    }
  }
  // flush remaining buffer (last line without trailing newline)
  if (buffer.trim()) yield JSON.parse(buffer.trim()) as Itinerary;
}
```

---

## Frontend: useRoute Changes

### `buildItinerary` rewrite

```typescript
async function buildItinerary(overridePlaces?: Place[]) {
  if (!persona || !state.cityGeo) return;

  const totalDays = computeTotalDays(state.travelStartDate, state.travelEndDate);
  const days      = totalDays > 0 ? totalDays : (state.tripContext.days ?? 1);
  const startDate = state.travelStartDate ?? state.tripContext.date;
  const placesToUse = overridePlaces ?? state.selectedPlaces;

  dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
  dispatch({ type: 'SET_ITINERARY', itinerary: null });
  setError(null);
  setLoading(true);

  const streamRequest: ItineraryRequest = {
    city:              state.city,
    lat:               state.cityGeo.lat,
    lon:               state.cityGeo.lon,
    days,
    day_number:        1,
    pace:              persona.pace ?? 'any',
    persona:           persona.archetype,
    persona_archetype: persona.archetype_name,
    persona_context:   persona.insight ?? '',
    trip_context: {
      start_type:    state.tripContext.startType,
      arrival_time:  state.tripContext.arrivalTime,
      travel_date:   startDate,
      total_days:    days,
      flight_time:   state.tripContext.flightTime,
      is_long_haul:  state.tripContext.isLongHaul,
      location_lat:  state.tripContext.locationLat,
      location_lon:  state.tripContext.locationLon,
      location_name: state.tripContext.locationName,
    },
    selected_places: placesToUse.map(p => ({ id: p.id, title: p.title, lat: p.lat, lon: p.lon })),
  };

  let dispatched = 0;
  let streamAttempt = 0;

  // Auto-retry the whole stream on connection failure (up to 2 additional attempts)
  while (streamAttempt <= 2) {
    try {
      for await (const day of aiItineraryStream(streamRequest)) {
        dispatch({ type: 'APPEND_ITINERARY_DAY', day });
        if (dispatched === 0) {
          dispatch({ type: 'SET_ITINERARY', itinerary: day }); // backward compat
          setLoading(false);
        }
        dispatched++;
      }
      break; // stream completed cleanly
    } catch {
      if (dispatched === 0 && streamAttempt < 2) {
        // No days received yet — retry whole stream
        streamAttempt++;
        await new Promise(r => setTimeout(r, 500 * streamAttempt));
        continue;
      }
      // At least one day received, or all retries exhausted — fall through to per-day retry
      break;
    }
  }

  if (dispatched === 0) {
    // Complete failure after all stream retries
    setLoading(false);
    setError('Could not generate your itinerary. Please try again.');
    return;
  }

  // Auto-retry any missing days via single-day endpoint
  if (dispatched < days) {
    for (let d = dispatched + 1; d <= days; d++) {
      const result = await retryDay(d, days, startDate, streamRequest);
      dispatch({ type: 'APPEND_ITINERARY_DAY', day: result }); // null if exhausted
    }
  }

  dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) incrementGenerationCount(user.id).catch(console.warn);
  });
}

async function retryDay(
  dayNumber: number,
  totalDays: number,
  startDate: string,
  base: ItineraryRequest,
): Promise<Itinerary | null> {
  const travelDate = addDaysToIso(startDate, dayNumber - 1);
  const body: ItineraryRequest = {
    ...base,
    day_number: dayNumber,
    trip_context: { ...base.trip_context, travel_date: travelDate, total_days: totalDays },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    try {
      const result = await api.aiItinerary(body);
      if (result && !(result as any).error) return result;
    } catch { /* continue */ }
  }
  return null;
}
```

---

## Frontend: RouteScreen Changes

### Slot rendering (multi-day view)

```tsx
if (totalDays > 1 || itineraryDays.length > 1) {
  return (
    <>
      <AmbientVideo ... />
      <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 25, ... }}>
        <MultiDayHeader city={city} totalDays={totalDays} onBack={goBack} />
        {Array.from({ length: totalDays }, (_, i) => {
          const day = itineraryDays[i];
          const dayDate = addDaysToIso(startIso, i);
          return (
            <div key={i} style={{ padding: '0 16px' }}>
              <DayDivider dayNumber={i + 1} date={dayDate} />
              {day === undefined ? <DayShimmer /> :
               day === null     ? <DayError dayNumber={i + 1} /> :
                                  <DayStops stops={day.itinerary} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
```

### `DayShimmer`

Three skeleton cards with a breathing opacity animation. Each card matches the real `DayStops` card dimensions so layout doesn't jump on content arrival.

```typescript
// Pulse animation: opacity oscillates 0.35 → 0.65 at 1.4s, staggered per card
// Card: background rgba(255,255,255,.06), borderRadius 16, height ~76px
// Inner bars: title 60% width, tip 40% width, time pill 24px × 48px
// animationDelay: 0s / 0.2s / 0.4s per card
```

### `DayError`

```tsx
<div style={{ textAlign: 'center', padding: '20px 0', color: '#8e9099',
              fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
  Could not load this day
</div>
```

No retry button. Terminal state after auto-retry exhaustion.

---

## Error Handling Summary

| Scenario | Auto or User |
|---|---|
| Stream never connects | Auto-retry ×2 → only then shows error screen with Retry CTA |
| Stream drops after ≥1 day dispatched | Auto-retry remaining days silently |
| Malformed JSON line (parse fails) | Backend swallows; frontend detects missing day index, auto-retries |
| Single-day retry exhausts (2 attempts) | `DayError` card — silent, no user action |
| 1-day trip complete failure | Same as stream never connects → error screen after ×2 retries |

**User sees a Retry CTA only when `itineraryDays` is completely empty after all automatic attempts.**

---

## File Map

| File | Action | What changes |
|---|---|---|
| `main.py` | Modify | Add `/ai-itinerary-stream` endpoint with `StreamingResponse` + NDJSON prompt |
| `frontend/src/shared/store.tsx` | Modify | `itineraryDays` → `(Itinerary \| null)[]`; add `APPEND_ITINERARY_DAY` action |
| `frontend/src/shared/api.ts` | Modify | Add `aiItineraryStream()` async generator (named export, not on `api` object) |
| `frontend/src/modules/route/useRoute.ts` | Modify | `import { aiItineraryStream } from '../../shared/api'`; replace `buildItinerary` with streaming version; add `retryDay`; expose `totalDays`, `streamingDays` |
| `frontend/src/modules/route/RouteScreen.tsx` | Modify | Multi-day view uses slot-based rendering with `DayShimmer` / `DayError` / `DayStops` |
| `frontend/src/modules/route/DayShimmer.tsx` | **Create** | Shimmer skeleton — 3 animated placeholder cards |
| `frontend/src/modules/route/DayStops.tsx` | **Create** | Extracted from existing inline stop card JSX in RouteScreen multi-day block; props: `{ stops: ItineraryStop[] }` |

---

## Tests

Vitest (frontend):

1. `aiItineraryStream`: mock NDJSON `"line1\nline2\n"` → yields 2 parsed objects
2. `aiItineraryStream`: incomplete last line without `\n` → still yielded after stream ends
3. `APPEND_ITINERARY_DAY` reducer: appends to array; handles `null`; updates sessionStorage
4. `RouteScreen` slot rendering: `totalDays=3`, `itineraryDays=[day1]` → 1 real card + 2 shimmer slots; `itineraryDays=[day1, null, day3]` → 1 card + 1 error + 1 card
5. `retryDay`: mock `api.aiItinerary` fails twice → returns `null`; succeeds on second attempt → returns result
