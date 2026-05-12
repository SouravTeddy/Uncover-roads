# Enhanced PinCard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal PinCard with a cinematic detail card showing a Google Place hero photo, expandable hours, address with directions, cuisine tags, and phone/website tiles, with a shimmer skeleton while Google data loads.

**Architecture:** Backend adds a `/place-photo` proxy endpoint to keep the API key server-side. Frontend adds pure utility functions (`pincard-utils.ts`) for type tag filtering and hours parsing, then fully rewrites `PinCard.tsx` to use the spec layout. `usePlaceDetails.ts` and `MapScreen.tsx` are unchanged.

**Tech Stack:** FastAPI (Python), React 19, TypeScript, Vitest, Tailwind CSS v4

---

## File Map

| File | Action |
|---|---|
| `backend/main.py` | Add `GET /place-photo` endpoint |
| `frontend/vite.config.ts` | Add vitest config block |
| `frontend/package.json` | Add test scripts + vitest deps |
| `frontend/src/index.css` | Add `.shimmer` CSS class |
| `frontend/src/shared/api.ts` | Add `getPlacePhotoUrl()` |
| `frontend/src/modules/map/pincard-utils.ts` | New: filterTypes, getHoursLabel, parseOpenClose, getDirectionsUrl |
| `frontend/src/modules/map/pincard-utils.test.ts` | New: unit tests for utilities |
| `frontend/src/modules/map/PinCard.tsx` | Full redesign per spec |

> All paths are relative to `.worktrees/google-maplibre/`. Work on the `feature/google-maplibre` branch.

---

### Task 1: Backend `/place-photo` proxy endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Confirm `RedirectResponse` is importable**

Open `backend/main.py`. Check the fastapi import line at the top. Confirm it already includes `Request` and `HTTPException`. Add `RedirectResponse` to the import:

```python
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
```

(If `RedirectResponse` is already imported, skip this step.)

- [ ] **Step 2: Add the endpoint**

Find the last `@app.get` endpoint in `backend/main.py`. Add the following immediately after it, before any non-route code:

```python
@app.get("/place-photo")
def place_photo(photo_ref: str = Query(...), max_width: int = Query(800)):
    """Proxy Google Place Photos — keeps API key off the client."""
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not configured")
    url = (
        f"https://maps.googleapis.com/maps/api/place/photo"
        f"?photo_reference={photo_ref}&maxwidth={max_width}&key={key}"
    )
    return RedirectResponse(url=url, status_code=302)
```

- [ ] **Step 3: Run the server and verify the endpoint exists**

```bash
cd .worktrees/google-maplibre
uvicorn main:app --reload --port 8000
```

In a second terminal:

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/place-photo?photo_ref=dummy"
```

Expected: `302` (Google will reject the dummy ref, but our endpoint found the key and redirected) or `500` if `GOOGLE_PLACES_API_KEY` is not set in `.env`. Either is acceptable — the endpoint exists and handles both cases correctly.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add /place-photo proxy endpoint"
```

---

### Task 2: Vitest setup + frontend utilities

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/shared/api.ts`
- Create: `frontend/src/modules/map/pincard-utils.ts`
- Create: `frontend/src/modules/map/pincard-utils.test.ts`

- [ ] **Step 1: Install vitest**

```bash
cd .worktrees/google-maplibre/frontend
npm install -D vitest @vitest/ui jsdom
```

Expected: packages added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 2: Add vitest to vite.config.ts**

Open `frontend/vite.config.ts`. Replace its entire content with:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 3: Add test scripts to package.json**

Open `frontend/package.json`. Find the `"scripts"` section and add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

The scripts section should look like:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Add shimmer animation to index.css**

Open `frontend/src/index.css`. Append at the bottom:

```css
/* ── Shimmer skeleton animation ──────────────────── */
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.shimmer {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.04), transparent);
  animation: shimmer 1.5s infinite;
}
```

- [ ] **Step 5: Add `getPlacePhotoUrl` to api.ts**

Open `frontend/src/shared/api.ts`. Find the `BASE` constant declaration. Add this function anywhere in the file (after the imports and `BASE` declaration, before or after the existing exported functions):

```ts
/** Returns the URL of a Google Place photo via the backend proxy. */
export function getPlacePhotoUrl(photoRef: string, maxWidth = 800): string {
  return `${BASE}/place-photo?photo_ref=${encodeURIComponent(photoRef)}&max_width=${maxWidth}`;
}
```

- [ ] **Step 6: Write the failing tests**

Create `frontend/src/modules/map/pincard-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterTypes, getHoursLabel, parseOpenClose } from './pincard-utils';

const WEEKDAYS = [
  'Monday: 9:00 AM – 11:00 PM',
  'Tuesday: 9:00 AM – 11:00 PM',
  'Wednesday: 9:00 AM – 11:00 PM',
  'Thursday: 9:00 AM – 11:00 PM',
  'Friday: 9:00 AM – 12:00 AM',
  'Saturday: 10:00 AM – 12:00 AM',
  'Sunday: 11:00 AM – 10:00 PM',
];

describe('filterTypes', () => {
  it('removes noise types', () => {
    expect(filterTypes(['restaurant', 'food', 'establishment'])).toEqual(['Restaurant']);
  });

  it('title-cases underscore-separated types', () => {
    expect(filterTypes(['japanese_restaurant'])).toEqual(['Japanese Restaurant']);
  });

  it('limits output to 3 tags', () => {
    expect(filterTypes(['a', 'b', 'c', 'd'])).toHaveLength(3);
  });

  it('returns empty array when all types are noise', () => {
    expect(filterTypes(['point_of_interest', 'establishment', 'food'])).toEqual([]);
  });
});

describe('getHoursLabel', () => {
  it('returns Monday line for JS day 1 (Monday)', () => {
    expect(getHoursLabel(WEEKDAYS, 1)).toBe('Monday: 9:00 AM – 11:00 PM');
  });

  it('returns Sunday line for JS day 0 (Sunday)', () => {
    expect(getHoursLabel(WEEKDAYS, 0)).toBe('Sunday: 11:00 AM – 10:00 PM');
  });

  it('returns Saturday line for JS day 6 (Saturday)', () => {
    expect(getHoursLabel(WEEKDAYS, 6)).toBe('Saturday: 10:00 AM – 12:00 AM');
  });

  it('returns null for empty array', () => {
    expect(getHoursLabel([], 1)).toBeNull();
  });
});

describe('parseOpenClose', () => {
  it('shows closing time when open', () => {
    const result = parseOpenClose('Monday: 9:00 AM – 11:00 PM', true);
    expect(result).toBe('Open now · Closes 11:00 PM');
  });

  it('shows opening time when closed', () => {
    const result = parseOpenClose('Monday: 9:00 AM – 11:00 PM', false);
    expect(result).toBe('Closed · Opens 9:00 AM');
  });

  it('returns original line if unparseable', () => {
    expect(parseOpenClose('Monday: Closed', true)).toBe('Monday: Closed');
  });
});
```

- [ ] **Step 7: Run tests — verify they fail**

```bash
cd .worktrees/google-maplibre/frontend
npm test
```

Expected: FAIL — `pincard-utils` module not found.

- [ ] **Step 8: Create `pincard-utils.ts`**

Create `frontend/src/modules/map/pincard-utils.ts`:

```ts
const NOISE_TYPES = new Set([
  'point_of_interest', 'establishment', 'food', 'store', 'premise',
  'subpremise', 'geocode', 'street_address', 'route', 'locality', 'political',
]);

/** Filter Google types[], remove noise, title-case, max 3. */
export function filterTypes(types: string[]): string[] {
  return types
    .filter(t => !NOISE_TYPES.has(t))
    .slice(0, 3)
    .map(t =>
      t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    );
}

/**
 * Return the weekday_text line for a given JS day-of-week (0 = Sunday).
 * Google's weekday_text array starts at Monday (index 0).
 */
export function getHoursLabel(weekdayText: string[], jsDay: number): string | null {
  const googleDay = jsDay === 0 ? 6 : jsDay - 1;
  return weekdayText[googleDay] ?? null;
}

/**
 * From a weekday_text line like "Monday: 9:00 AM – 11:00 PM",
 * extract a human label: "Open now · Closes 11:00 PM" or "Closed · Opens 9:00 AM".
 * Returns the original line if the pattern doesn't match.
 */
export function parseOpenClose(line: string, openNow: boolean): string {
  const match = line.match(/:\s*(\d+:\d+\s*(?:AM|PM))\s*[–\-]\s*(\d+:\d+\s*(?:AM|PM))/i);
  if (!match) return line;
  const [, open, close] = match;
  return openNow
    ? `Open now · Closes ${close}`
    : `Closed · Opens ${open}`;
}

/** Apple Maps on iOS/macOS, Google Maps otherwise. */
export function getDirectionsUrl(lat: number, lon: number): string {
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  return isApple
    ? `maps://maps.apple.com/?q=${lat},${lon}`
    : `https://maps.google.com/maps?q=${lat},${lon}`;
}
```

- [ ] **Step 9: Run tests — verify they pass**

```bash
cd .worktrees/google-maplibre/frontend
npm test
```

Expected:

```
✓ filterTypes > removes noise types
✓ filterTypes > title-cases underscore-separated types
✓ filterTypes > limits output to 3 tags
✓ filterTypes > returns empty array when all types are noise
✓ getHoursLabel > returns Monday line for JS day 1 (Monday)
✓ getHoursLabel > returns Sunday line for JS day 0 (Sunday)
✓ getHoursLabel > returns Saturday line for JS day 6 (Saturday)
✓ getHoursLabel > returns null for empty array
✓ parseOpenClose > shows closing time when open
✓ parseOpenClose > shows opening time when closed
✓ parseOpenClose > returns original line if unparseable
11 tests passed
```

- [ ] **Step 10: TypeScript check**

```bash
cd .worktrees/google-maplibre/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/vite.config.ts frontend/package.json frontend/package-lock.json \
        frontend/src/index.css frontend/src/shared/api.ts \
        frontend/src/modules/map/pincard-utils.ts \
        frontend/src/modules/map/pincard-utils.test.ts
git commit -m "feat(frontend): add vitest, shimmer CSS, getPlacePhotoUrl, pincard-utils"
```

---

### Task 3: Full PinCard redesign

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

- [ ] **Step 1: Replace `PinCard.tsx` entirely**

Replace the entire contents of `frontend/src/modules/map/PinCard.tsx` with:

```tsx
import { useState } from 'react';
import type { Place, PlaceDetails } from '../../shared/types';
import { CATEGORY_LABELS } from './types';
import { getPlacePhotoUrl } from '../../shared/api';
import { filterTypes, getHoursLabel, parseOpenClose, getDirectionsUrl } from './pincard-utils';

interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  onAdd: () => void;
  onClose: () => void;
  details?: PlaceDetails | null;
  detailsLoading?: boolean;
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export function PinCard({ place, city, isSelected, onAdd, onClose, details, detailsLoading }: Props) {
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place';
  const [hoursExpanded, setHoursExpanded] = useState(false);

  const photoUrl = details?.photo_ref ? getPlacePhotoUrl(details.photo_ref) : null;
  const typeTags = details?.types ? filterTypes(details.types) : [];

  const todayJsDay = new Date().getDay();
  const rawHoursLine = details?.weekday_text?.length
    ? getHoursLabel(details.weekday_text, todayJsDay)
    : null;
  const hoursLabel =
    rawHoursLine !== null && details?.open_now !== undefined
      ? parseOpenClose(rawHoursLine, details.open_now)
      : rawHoursLine;

  const directionsUrl = getDirectionsUrl(
    details?.lat ?? place.lat,
    details?.lon ?? place.lon,
  );

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '0 auto',
        background: '#111',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
        border: '1px solid rgba(255,255,255,.08)',
      }}
    >
      {/* ── Hero image ─────────────────────────────────── */}
      <div style={{ height: 150, position: 'relative' }}>
        {detailsLoading ? (
          /* Shimmer skeleton */
          <div style={{ position: 'absolute', inset: 0, background: '#1a1a1a', overflow: 'hidden' }}>
            <div className="shimmer" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
              <div style={{ height: 18, width: '60%', background: '#2a2a2a', borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 11, width: '40%', background: '#222', borderRadius: 4 }} />
            </div>
          </div>
        ) : (
          <>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={place.title}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(140deg, rgba(59,130,246,.2), rgba(99,102,241,.1))',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.05) 55%)',
              }}
            />
          </>
        )}

        {/* Category badge — top left */}
        <div
          style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 20, padding: '3px 9px',
            fontSize: 8, fontWeight: 600, color: '#d1d5db',
            textTransform: 'uppercase', letterSpacing: 1,
          }}
        >
          {categoryLabel}
        </div>

        {/* Close button — top right */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999', fontSize: 14, cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* Name + meta — bottom left (skip when skeletonizing) */}
        {!detailsLoading && (
          <div style={{ position: 'absolute', bottom: 10, left: 12, right: 44 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              {place.title}
            </div>
            {(details?.rating || details?.open_now !== undefined || details?.price_level) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {details!.rating !== undefined && (
                  <>
                    <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                      ★ {details!.rating}
                    </span>
                    {details!.rating_count !== undefined && (
                      <span style={{ fontSize: 10, color: '#999' }}>
                        {details!.rating_count.toLocaleString()} reviews
                      </span>
                    )}
                  </>
                )}
                {details!.open_now !== undefined && (
                  <span
                    style={{
                      fontSize: 10,
                      color: details!.open_now ? '#22c55e' : '#ef4444',
                      fontWeight: 600,
                    }}
                  >
                    ● {details!.open_now ? 'Open' : 'Closed'}
                  </span>
                )}
                {details!.price_level !== undefined && details!.price_level > 0 && (
                  <span style={{ fontSize: 10, color: '#999' }}>
                    {PRICE[details!.price_level]}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Details body ───────────────────────────────── */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Type tags */}
        {detailsLoading ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ height: 22, width: 110, background: '#1f1f1f', borderRadius: 20 }} />
            <div style={{ height: 22, width: 60, background: '#1f1f1f', borderRadius: 20 }} />
          </div>
        ) : typeTags.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {typeTags.map(tag => (
              <span
                key={tag}
                style={{
                  background: '#1f1f1f', border: '1px solid #333',
                  borderRadius: 20, padding: '3px 9px', fontSize: 9, color: '#aaa',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Hours row */}
        {detailsLoading ? (
          <div style={{ height: 12, width: '80%', background: '#1a1a1a', borderRadius: 4 }} />
        ) : hoursLabel ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 12, marginTop: 1 }}>🕐</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 10, fontWeight: 600,
                    color: details?.open_now ? '#22c55e' : '#ef4444',
                  }}
                >
                  {hoursLabel}
                </span>
                {details?.weekday_text && details.weekday_text.length > 0 && (
                  <button
                    onClick={() => setHoursExpanded(e => !e)}
                    style={{
                      fontSize: 9, color: '#6366f1',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    {hoursExpanded ? 'Hide ▴' : 'See hours ▾'}
                  </button>
                )}
              </div>
              {hoursExpanded && details?.weekday_text && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {details.weekday_text.map((line, i) => {
                    const isToday = i === (todayJsDay === 0 ? 6 : todayJsDay - 1);
                    const colonIdx = line.indexOf(':');
                    const day = colonIdx > -1 ? line.slice(0, colonIdx) : line;
                    const hours = colonIdx > -1 ? line.slice(colonIdx + 2) : '';
                    return (
                      <div
                        key={i}
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}
                      >
                        <span style={{ color: isToday ? '#22c55e' : '#666', fontWeight: isToday ? 600 : 400 }}>
                          {day}
                        </span>
                        <span style={{ color: '#aaa', fontWeight: isToday ? 600 : 400 }}>
                          {hours}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Address row */}
        {detailsLoading ? (
          <div style={{ height: 12, width: '65%', background: '#1a1a1a', borderRadius: 4 }} />
        ) : details?.address ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 12, marginTop: 1 }}>📍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{details.address}</div>
              <a
                href={directionsUrl}
                style={{
                  fontSize: 9, color: '#6366f1', marginTop: 3,
                  display: 'block', textDecoration: 'none',
                }}
              >
                Get directions ↗
              </a>
            </div>
          </div>
        ) : null}

        {/* Phone + website tiles */}
        {detailsLoading ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height: 36, background: '#1f1f1f', borderRadius: 10 }} />
            <div style={{ flex: 1, height: 36, background: '#1f1f1f', borderRadius: 10 }} />
          </div>
        ) : (details?.phone || details?.website) ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {details!.phone && (
              <a
                href={`tel:${details!.phone}`}
                style={{
                  flex: 1, background: '#1a1a1a', borderRadius: 10, padding: 8,
                  display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                  overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 12, flexShrink: 0 }}>📞</span>
                <span style={{ fontSize: 9, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {details!.phone}
                </span>
              </a>
            )}
            {details!.website && (
              <a
                href={details!.website}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1, background: '#1a1a1a', borderRadius: 10, padding: 8,
                  display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                  overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 12, flexShrink: 0 }}>🌐</span>
                <span style={{ fontSize: 9, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(() => { try { return new URL(details!.website!).hostname; } catch { return details!.website; } })()}
                </span>
              </a>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Action bar ─────────────────────────────────── */}
      <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
        <button
          onClick={onAdd}
          style={{
            flex: 1,
            background: isSelected ? 'rgba(99,102,241,.15)' : '#6366f1',
            border: isSelected ? '1px solid rgba(99,102,241,.4)' : 'none',
            borderRadius: 12, padding: 10,
            fontSize: 11, fontWeight: 700,
            color: isSelected ? '#a5b4fc' : '#fff',
            cursor: 'pointer',
          }}
        >
          {isSelected ? '✓ Added' : 'Add to trip'}
        </button>
        <button
          onClick={() => {
            const url = `https://www.google.com/search?q=${encodeURIComponent(`${place.title} ${city}`)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          style={{
            width: 40, background: '#1f1f1f', border: 'none',
            borderRadius: 12, fontSize: 13, cursor: 'pointer', color: '#fff',
          }}
        >
          ↗
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd .worktrees/google-maplibre/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 11 tests pass (utility tests unchanged).

- [ ] **Step 4: Visual check**

Start the dev server:
```bash
npm run dev
```

Open the app, navigate to map, tap a pin. Verify:
1. While details load (~1s): hero area shows grey shimmer, two skeleton lines for name/rating, skeleton pills for tags, skeleton rows for hours/address/contact
2. After load: full-width hero photo appears with gradient overlay, place name + rating row at bottom of image, category badge top-left, close button top-right
3. Cuisine tags appear as pills below image
4. Hours row shows "Open now · Closes X PM" in green (or closed in red), "See hours ▾" tappable
5. Address row with "Get directions ↗" link
6. Phone and website side-by-side tiles
7. "Add to trip" button full-width, "↗" square button

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/PinCard.tsx
git commit -m "feat(frontend): enhanced PinCard — hero image, hours, address, skeleton"
```
