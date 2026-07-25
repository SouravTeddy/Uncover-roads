# Transit Corridor Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded metro math in scenic walk cards with real Google Directions API transit data, cached per corridor in Supabase, so cities without a metro (e.g. Jaipur) never show a metro chip.

**Architecture:** Backend adds a `GET /transit-corridor` endpoint that calls the Google Directions API (transit mode), extracts structured transit facts, and caches the result in a new `transit_corridor_cache` Supabase table keyed by rounded lat/lon pair. The frontend adds an async enrichment pass after reel cards are built — scenic walk cards gain a `transitInfo` field that `ReelScenicCard` uses to render real transit type, duration, and stop names (or suppress the chip entirely when no transit exists).

**Tech Stack:** FastAPI (Python), Google Directions API, Supabase (Postgres), React + TypeScript, Vite

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `tests/test_transit_corridor.py` | Backend unit tests |
| Modify | `main.py` | New `/transit-corridor` endpoint + helper |
| Modify | `frontend/src/modules/route/reel/types.ts` | Add `TransitInfo` type + field on `ReelScenicCard` |
| Create | `frontend/src/modules/route/reel/transit-enrichment.ts` | Async enrichment: fetch transit info, patch scenic cards |
| Modify | `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` | Call enrichment after initial reel build |
| Modify | `frontend/src/modules/route/reel/ReelScenicCard.tsx` | Render real transit data / suppress metro when absent |
| Modify | `frontend/src/modules/route/reel/reel-builder.ts` | Remove hardcoded metro text from `why` copy |

---

## Task 1: Supabase migration — create `transit_corridor_cache` table

**Files:**
- No file to create — run SQL directly against Supabase via MCP

- [ ] **Step 1: Run migration SQL**

Execute this in Supabase (via MCP `apply_migration` or the SQL editor):

```sql
CREATE TABLE IF NOT EXISTS transit_corridor_cache (
  corridor_key     TEXT PRIMARY KEY,
  has_transit      BOOLEAN NOT NULL,
  transit_type     TEXT,
  duration_min     INTEGER,
  line_name        TEXT,
  departure_stop   TEXT,
  arrival_stop     TEXT,
  transfers        INTEGER,
  walk_to_stop_min INTEGER,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Verify table exists**

Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'transit_corridor_cache';`

Expected: 9 rows listing all columns above.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add transit_corridor_cache migration"
```

---

## Task 2: Backend — `/transit-corridor` endpoint with caching

**Files:**
- Modify: `main.py` (add helper `_fetch_transit_corridor` + endpoint)
- Create: `tests/test_transit_corridor.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_transit_corridor.py`:

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def _mock_directions_response(vehicle_type="SUBWAY", line_name="Blue Line",
                               dep_stop="MI Road", arr_stop="Civil Lines",
                               total_duration_sec=720, walk_sec=180):
    return {
        "status": "OK",
        "routes": [{
            "legs": [{
                "duration": {"value": total_duration_sec},
                "steps": [
                    {
                        "travel_mode": "WALKING",
                        "duration": {"value": walk_sec},
                    },
                    {
                        "travel_mode": "TRANSIT",
                        "duration": {"value": total_duration_sec - walk_sec},
                        "transit_details": {
                            "line": {
                                "vehicle": {"type": vehicle_type},
                                "short_name": line_name,
                                "name": line_name,
                            },
                            "departure_stop": {"name": dep_stop},
                            "arrival_stop": {"name": arr_stop},
                            "num_stops": 3,
                        },
                    },
                ],
            }]
        }]
    }


def test_transit_corridor_returns_transit_when_available(client, mocker):
    mocker.patch("main._supabase", None)  # skip cache read/write
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: _mock_directions_response()
        )
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_transit"] is True
    assert data["transit_type"] == "SUBWAY"
    assert data["line_name"] == "Blue Line"
    assert data["departure_stop"] == "MI Road"
    assert data["arrival_stop"] == "Civil Lines"
    assert data["transfers"] == 0
    assert data["duration_min"] == 12
    assert data["walk_to_stop_min"] == 3


def test_transit_corridor_returns_no_transit_when_google_returns_empty(client, mocker):
    mocker.patch("main._supabase", None)
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"status": "ZERO_RESULTS", "routes": []}
        )
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_transit"] is False
    assert data["transit_type"] is None


def test_transit_corridor_serves_from_cache(client, mocker):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "corridor_key": "26.9124_75.7873_26.92_75.8",
            "has_transit": True,
            "transit_type": "BUS",
            "duration_min": 15,
            "line_name": "Route 7",
            "departure_stop": "Stop A",
            "arrival_stop": "Stop B",
            "transfers": 0,
            "walk_to_stop_min": 5,
        }]
    )
    mocker.patch("main._supabase", mock_supabase)
    with patch("requests.get") as mock_get:
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
        mock_get.assert_not_called()  # Google not called when cache hits
    assert resp.status_code == 200
    assert resp.json()["transit_type"] == "BUS"


def test_transit_corridor_multiple_transit_steps_counts_transfers(client, mocker):
    mocker.patch("main._supabase", None)
    two_transit_response = {
        "status": "OK",
        "routes": [{
            "legs": [{
                "duration": {"value": 1800},
                "steps": [
                    {"travel_mode": "WALKING", "duration": {"value": 120}},
                    {"travel_mode": "TRANSIT", "duration": {"value": 600},
                     "transit_details": {"line": {"vehicle": {"type": "BUS"}, "short_name": "A", "name": "A"},
                                         "departure_stop": {"name": "S1"}, "arrival_stop": {"name": "S2"}}},
                    {"travel_mode": "WALKING", "duration": {"value": 180}},
                    {"travel_mode": "TRANSIT", "duration": {"value": 900},
                     "transit_details": {"line": {"vehicle": {"type": "SUBWAY"}, "short_name": "B", "name": "B"},
                                         "departure_stop": {"name": "S3"}, "arrival_stop": {"name": "S4"}}},
                ],
            }]
        }]
    }
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: two_transit_response)
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.json()["transfers"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads && pytest tests/test_transit_corridor.py -v
```

Expected: `ERRORS` — `ImportError` or attribute errors since the endpoint doesn't exist yet.

- [ ] **Step 3: Add helper function and endpoint to `main.py`**

Find the end of the existing cache helper functions (around line 2440, after `find_place_id`). Add this block before the next `@app.get`:

```python
# ── Transit corridor cache ──────────────────────────────────────────────────

def _corridor_key(olat: float, olon: float, dlat: float, dlon: float) -> str:
    """Round to 4 decimal places (~11 m) and join as cache key."""
    return f"{round(olat,4)}_{round(olon,4)}_{round(dlat,4)}_{round(dlon,4)}"


def _fetch_transit_corridor(olat: float, olon: float, dlat: float, dlon: float) -> dict:
    """
    Look up transit options between two lat/lon points.
    Returns cached result from Supabase if available (TTL 30 days).
    Falls back to Google Directions API (transit mode).
    """
    key = _corridor_key(olat, olon, dlat, dlon)

    # 1. Cache read
    if _supabase:
        try:
            row = _supabase.table("transit_corridor_cache") \
                .select("*").eq("corridor_key", key).execute()
            if row.data:
                r = row.data[0]
                # Invalidate after 30 days
                fetched = datetime.fromisoformat(r["fetched_at"].replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - fetched).days < 30:
                    return {k: r[k] for k in (
                        "has_transit","transit_type","duration_min","line_name",
                        "departure_stop","arrival_stop","transfers","walk_to_stop_min"
                    )}
        except Exception as e:
            print(f"TRANSIT CACHE READ: {e}")

    # 2. Google Directions API
    result = {"has_transit": False, "transit_type": None, "duration_min": None,
              "line_name": None, "departure_stop": None, "arrival_stop": None,
              "transfers": None, "walk_to_stop_min": None}

    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        return result

    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={
                "origin": f"{olat},{olon}",
                "destination": f"{dlat},{dlon}",
                "mode": "transit",
                "key": api_key,
            },
            timeout=5,
        )
        data = resp.json()
        routes = data.get("routes", [])
        if not routes:
            # No transit — cache the negative result too
            _write_transit_cache(key, result)
            return result

        leg = routes[0]["legs"][0]
        steps = leg.get("steps", [])
        total_sec = leg.get("duration", {}).get("value", 0)

        transit_steps = [s for s in steps if s.get("travel_mode") == "TRANSIT"]
        walk_steps    = [s for s in steps if s.get("travel_mode") == "WALKING"]

        if not transit_steps:
            _write_transit_cache(key, result)
            return result

        first_transit = transit_steps[0]
        td = first_transit.get("transit_details", {})
        line = td.get("line", {})

        result = {
            "has_transit":      True,
            "transit_type":     line.get("vehicle", {}).get("type"),
            "duration_min":     max(1, round(total_sec / 60)),
            "line_name":        line.get("short_name") or line.get("name"),
            "departure_stop":   td.get("departure_stop", {}).get("name"),
            "arrival_stop":     td.get("arrival_stop", {}).get("name"),
            "transfers":        max(0, len(transit_steps) - 1),
            "walk_to_stop_min": max(1, round(sum(s.get("duration",{}).get("value",0) for s in walk_steps) / 60)) if walk_steps else 0,
        }
    except Exception as e:
        print(f"TRANSIT API: {e}")

    _write_transit_cache(key, result)
    return result


def _write_transit_cache(key: str, result: dict) -> None:
    if not _supabase:
        return
    try:
        _supabase.table("transit_corridor_cache").upsert({
            "corridor_key": key,
            **result,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"TRANSIT CACHE WRITE: {e}")


@app.get("/transit-corridor")
def transit_corridor(
    origin_lat: float = Query(...),
    origin_lon: float = Query(...),
    dest_lat:   float = Query(...),
    dest_lon:   float = Query(...),
):
    """
    Returns transit options between two coordinates.
    Cached in transit_corridor_cache for 30 days.
    Used by the frontend scenic walk cards to show real transit data.
    """
    return _fetch_transit_corridor(origin_lat, origin_lon, dest_lat, dest_lon)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads && pytest tests/test_transit_corridor.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Smoke test the running server**

```bash
curl "http://localhost:8000/transit-corridor?origin_lat=26.9124&origin_lon=75.7873&dest_lat=26.9200&dest_lon=75.8000"
```

Expected: JSON with `has_transit` field (true or false depending on Google response).

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_transit_corridor.py
git commit -m "feat: add /transit-corridor endpoint with Supabase caching"
```

---

## Task 3: Frontend types — add `TransitInfo` to `ReelScenicCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts`

- [ ] **Step 1: Add `TransitInfo` interface and optional field**

In `frontend/src/modules/route/reel/types.ts`, add after the existing imports (before line 3):

```typescript
export interface TransitInfo {
  has_transit: boolean;
  transit_type: string | null;   // SUBWAY | BUS | TRAM | HEAVY_RAIL | COMMUTER_TRAIN | FERRY
  duration_min: number | null;
  line_name: string | null;
  departure_stop: string | null;
  arrival_stop: string | null;
  transfers: number | null;
  walk_to_stop_min: number | null;
}
```

Then add `transitInfo?: TransitInfo | null;` as the last field inside the `ReelScenicCard` interface (after `destPhotoUrl`):

```typescript
export interface ReelScenicCard {
  // ... existing fields unchanged ...
  photoUrl?: string | null;
  originPhotoUrl?: string | null;
  destPhotoUrl?: string | null;
  transitInfo?: TransitInfo | null;   // populated async after reel build
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/types.ts
git commit -m "feat: add TransitInfo type to ReelScenicCard"
```

---

## Task 4: Frontend — transit enrichment module

**Files:**
- Create: `frontend/src/modules/route/reel/transit-enrichment.ts`

- [ ] **Step 1: Create the enrichment module**

Create `frontend/src/modules/route/reel/transit-enrichment.ts`:

```typescript
import type { ReelCard, TransitInfo } from './types';

/**
 * Fetches real transit data for every scenic walk card in the reel
 * and returns an updated copy of the cards array.
 * All requests fire in parallel. Cards without lat/lon are skipped.
 * Never throws — failures leave transitInfo as null.
 */
export async function enrichScenicCardsWithTransit(
  cards: ReelCard[],
  apiBase: string,
): Promise<ReelCard[]> {
  // Collect indices of scenic walk cards that have coordinate data
  const targets: Array<{
    idx: number;
    originLat: number;
    originLon: number;
    destLat: number;
    destLon: number;
  }> = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.type !== 'scenic' || card.sceneType !== 'walk') continue;

    // scenic cards don't carry lat/lon directly — find the adjacent stop cards
    const prevStop = [...cards].slice(0, i).reverse().find(c => c.type === 'stop');
    const nextStop = cards.slice(i + 1).find(c => c.type === 'stop');
    if (!prevStop || prevStop.type !== 'stop') continue;
    if (!nextStop || nextStop.type !== 'stop') continue;

    const oLat = prevStop.stop.lat;
    const oLon = prevStop.stop.lon;
    const dLat = nextStop.stop.lat;
    const dLon = nextStop.stop.lon;
    if (!oLat || !oLon || !dLat || !dLon) continue;

    targets.push({ idx: i, originLat: oLat, originLon: oLon, destLat: dLat, destLon: dLon });
  }

  if (targets.length === 0) return cards;

  // Fire all requests in parallel
  const results = await Promise.allSettled(
    targets.map(t =>
      fetch(
        `${apiBase}/transit-corridor?origin_lat=${t.originLat}&origin_lon=${t.originLon}&dest_lat=${t.destLat}&dest_lon=${t.destLon}`,
      ).then(r => (r.ok ? (r.json() as Promise<TransitInfo>) : null)),
    ),
  );

  // Clone cards array and patch scenic cards
  const updated = [...cards];
  for (let i = 0; i < targets.length; i++) {
    const { idx } = targets[i];
    const result = results[i];
    const transitInfo: TransitInfo | null =
      result.status === 'fulfilled' ? result.value : null;
    updated[idx] = { ...updated[idx], transitInfo } as ReelCard;
  }
  return updated;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/transit-enrichment.ts
git commit -m "feat: add transit enrichment module for scenic walk cards"
```

---

## Task 5: Frontend — wire enrichment into `ItineraryReelScreen`

**Files:**
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`

- [ ] **Step 1: Import the enrichment function**

Add this import at the top of `ItineraryReelScreen.tsx` (after the existing imports, around line 22):

```typescript
import { enrichScenicCardsWithTransit } from './transit-enrichment';
```

- [ ] **Step 2: Fire enrichment after reel build**

In `ItineraryReelScreen.tsx`, find the block around line 207 that sets cards after build:

```typescript
      setCards(filtered);
```

Replace it with:

```typescript
      setCards(filtered);

      // Async transit enrichment — fires in background, updates scenic cards
      // when transit data arrives without blocking the reel from showing
      const apiBase = import.meta.env.VITE_API_URL ?? '';
      enrichScenicCardsWithTransit(filtered, apiBase).then(enriched => {
        if (!cancelled) setCards(enriched);
      }).catch(() => { /* transit enrichment is best-effort */ });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat: wire transit enrichment into reel screen"
```

---

## Task 6: Frontend — render real transit data in `ReelScenicCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelScenicCard.tsx`
- Modify: `frontend/src/modules/route/reel/reel-builder.ts`

### Part A — ReelScenicCard.tsx

- [ ] **Step 1: Replace the math-based transit block with real data rendering**

In `ReelScenicCard.tsx`, find `WalkCorridorCard` starting at line 215. Replace lines 224–226 (the math estimates):

```typescript
  // Estimated alternative transport times
  const metroMins = Math.max(2, Math.round(walkMins * 0.25));
  const rideMins = Math.max(3, Math.round(walkMins * 0.4));
```

With:

```typescript
  const ti = card.transitInfo;
  const hasRealTransit = ti?.has_transit === true;
  // Fallback ride estimate (rideshare always available)
  const rideMins = Math.max(3, Math.round(walkMins * 0.4));

  // Transit chip label — real data when available, suppressed when city has no transit
  const transitLabel = hasRealTransit
    ? _transitLabel(ti!.transit_type, ti!.line_name)
    : null;
  const transitMins = hasRealTransit ? ti!.duration_min : null;
  const transitSubLabel = hasRealTransit && ti!.departure_stop
    ? `board at ${ti!.departure_stop}`
    : hasRealTransit ? 'nearest stop' : null;
```

Add this helper function just above `WalkCorridorCard` (around line 213):

```typescript
function _transitLabel(type: string | null | undefined, lineName: string | null | undefined): string {
  const name = lineName ?? '';
  switch (type) {
    case 'SUBWAY': return name || 'metro';
    case 'BUS': return name ? `Bus ${name}` : 'bus';
    case 'TRAM': return name || 'tram';
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN': return name || 'train';
    case 'FERRY': return 'ferry';
    default: return name || 'transit';
  }
}
```

- [ ] **Step 2: Update the subtitle text (line 258)**

Replace:

```typescript
              : `${distValue} on foot · or metro in ~${metroMins} min`}
```

With:

```typescript
              : transitLabel
                ? `${distValue} on foot · or ${transitLabel} in ~${transitMins} min`
                : `${distValue} on foot`}
```

- [ ] **Step 3: Update the stats bar (lines 296–318) — metro chip**

Replace the entire `{/* Low-walk: walk · metro · rideshare alternatives */}` block:

```tsx
            <>
              {/* Low-walk: walk · metro · rideshare alternatives */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1 }}>
                <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>directions_walk</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{timeValue} walk</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.28)' }}>on foot</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>subway</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{metroMins} min metro</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.28)' }}>nearest line</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>local_taxi</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>~{rideMins} min ride</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.28)' }}>rideshare</div>
                </div>
              </div>
            </>
```

With:

```tsx
            <>
              {/* Walk chip — always shown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: transitLabel ? 1 : 2 }}>
                <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>directions_walk</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{timeValue} walk</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.28)' }}>on foot</div>
                </div>
              </div>
              {/* Transit chip — only shown when city has real transit */}
              {transitLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                  <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>subway</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{transitMins} min {transitLabel}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.28)' }}>{transitSubLabel}</div>
                  </div>
                </div>
              )}
              {/* Rideshare chip — always shown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>local_taxi</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>~{rideMins} min ride</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.28)' }}>rideshare</div>
                </div>
              </div>
            </>
```

### Part B — reel-builder.ts

- [ ] **Step 4: Remove hardcoded metro mention from `why` copy**

In `reel-builder.ts` line 525, replace:

```typescript
        : `There's a ${distLabel} walking path between these two if you want it — quiet neighbourhood lane, ${walkMins} minutes. The metro works too; both get you there at the same time.`,
```

With:

```typescript
        : `There's a ${distLabel} walking path between these two if you want it — quiet neighbourhood lane, ${walkMins} minutes.`,
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/ReelScenicCard.tsx frontend/src/modules/route/reel/reel-builder.ts
git commit -m "feat: render real transit data in scenic walk cards, suppress metro chip for cities without transit"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Restart the backend (picks up new endpoint)**

```bash
kill $(lsof -ti:8000) && cd /Users/souravbiswas/uncover-roads && source .env && uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/uncover-backend.log 2>&1 &
sleep 2 && curl -s http://localhost:8000/ | python3 -m json.tool
```

Expected: `{"status": "ok", "service": "Uncover Roads API"}`

- [ ] **Step 2: Test the endpoint directly for Jaipur**

```bash
curl -s "http://localhost:8000/transit-corridor?origin_lat=26.9124&origin_lon=75.7873&dest_lat=26.9200&dest_lon=75.8000" | python3 -m json.tool
```

Expected: `"has_transit": false` (Jaipur has no metro), metro chip should not appear.

- [ ] **Step 3: Test the endpoint for Delhi (has metro)**

```bash
curl -s "http://localhost:8000/transit-corridor?origin_lat=28.6562&origin_lon=77.2410&dest_lat=28.6304&dest_lon=77.2177" | python3 -m json.tool
```

Expected: `"has_transit": true`, `"transit_type": "SUBWAY"` or `"BUS"`.

- [ ] **Step 4: Open the app and navigate to the Jaipur reel**

Open http://localhost:5173 → build a Jaipur itinerary → tap reel → check scenic walk cards. Metro chip must not appear. Rideshare chip must still appear.

- [ ] **Step 5: Verify caching — second request should not call Google**

```bash
# First call already cached the result. A second call should return instantly from Supabase.
time curl -s "http://localhost:8000/transit-corridor?origin_lat=26.9124&origin_lon=75.7873&dest_lat=26.9200&dest_lon=75.8000" > /dev/null
```

Expected: < 200ms (Supabase read, no Google API call).

- [ ] **Step 6: Run full backend test suite to check for regressions**

```bash
cd /Users/souravbiswas/uncover-roads && pytest tests/ -v 2>&1 | tail -20
```

Expected: all tests pass.
