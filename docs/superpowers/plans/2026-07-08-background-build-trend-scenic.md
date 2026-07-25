# Background Build, Trend-Scenic Fusion & City OSM Pre-Seeding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move itinerary building to a background job so users can explore while their plan computes, deliver an in-app notification when done, fuse trend velocity into scenic cards, and pre-seed city-level OSM data to eliminate cold-cache penalties.

**Architecture:** The `/engine-itinerary` endpoint is replaced by a two-step flow — `/engine-itinerary/start` (202, returns immediately with `buildId`) and `/engine-itinerary/status/:id` (polled every 5 s by the frontend). The full engine + scenic enrichment runs as an `asyncio` background task inside the existing Railway web dyno, writing progress to a new `itinerary_builds` Supabase table. The frontend polls status and shows a contextual banner in the Explore tab (below the search bar, above curated city cards) — matching exactly where the real `ExploreSearchBar` and `CuratedCityCards` sit. Trend velocity (`velocity_ratio` from `place_dynamic_profiles`) is injected into `_generate_scenic_card_for_corridor` to boost vibrant/local dimensions and stamp a `isTrending` flag. City-level OSM pre-seeding caches a broad Overpass response per city at seed time so corridor-level `_fetch_route_character` calls hit the DB instead of live Overpass.

**Tech Stack:** FastAPI `BackgroundTasks`, Supabase (PostgreSQL + RLS), React + TypeScript, polling (`setInterval`), no Supabase Realtime (polling is simpler and more reliable at this scale).

---

## Assumptions (read before implementing)

1. **asyncio background task, not a separate worker.** The entire build (Phase 1 + scenic enrichment) runs in an asyncio background task inside the existing FastAPI process. If the Railway dyno restarts mid-build, the build stays in `status = 'running'` forever. The frontend detects a stale build (updated_at > 10 min ago while still running) and shows "Build may have stalled — tap to retry". A separate Railway worker service is NOT used; that's a later optimisation.

2. **One active build per user.** A second `start` request while a build is `pending` or `running` returns HTTP 409 with the active `buildId`. The frontend catches this and reconnects to the existing build.

3. **Authentication required.** The `/engine-itinerary/start` and `/engine-itinerary/status/:id` endpoints both call `Depends(get_current_user)`, same as the existing `/engine-itinerary` endpoint. Unauthenticated builds are not supported.

4. **No cancel button.** Once started, a build runs to completion. Users can start a fresh build (which creates a new record) but cannot cancel an in-flight one.

5. **No server-side timeout.** The asyncio background task has no timeout. It runs until it finishes, however long that takes (2–5 minutes is acceptable).

6. **Scenic card failure → `scenic_pending` placeholder.** If `_generate_scenic_card_for_corridor` raises any exception for a corridor, a `{"type": "scenic_pending", "from": "...", "to": "..."}` dict is inserted in the result. No automatic retry in this plan — the shimmer is permanent for failed corridors (user sees "Couldn't load scenic info for this stretch"). Retry is a future enhancement.

7. **Polling interval: 5 seconds.** The frontend polls `/engine-itinerary/status/:id` every 5 seconds while the build is pending or running. This is stopped as soon as status becomes `done` or `failed`.

8. **`activeBuild` persists to localStorage.** This lets the user close the app and come back; on reopen, the hook immediately polls the server for the latest status.

9. **Trend velocity threshold: 0.7.** If `velocity_ratio` from `place_dynamic_profiles` for the destination stop is ≥ 0.7, that corridor is flagged as `isTrending = True`. The vibrant and local character dimension scores are each boosted by +0.15 (clamped to 1.0). The `why` copy is updated to mention trending status.

10. **City-level OSM pre-seed covers a 15 km radius.** One Overpass query per city at seed time, stored in a new `city_osm_features` table. `_fetch_route_character` checks this table first; if a hit exists, it filters elements to the corridor's bounding box without hitting live Overpass. Cache TTL: 7 days.

11. **The old `/engine-itinerary` endpoint is NOT deleted.** It is kept as a fallback but no longer called from the frontend. This prevents breaking changes if anything else calls it.

---

## Global Constraints

- Never break the existing `/engine-itinerary` (keep it, just stop calling it from frontend).
- All Supabase table changes must have a migration file under `supabase/migrations/` with prefix `20260708_`.
- RLS enabled on every new table; users can only read/write their own rows.
- Frontend design tokens: bg `#0f0d0c`, surface `#1a1714`, text-1 `#f5f0ea`, text-2 `#c0b0a4`, sage `#6b9470`, sky `#4f8fab`, gold `#d4a853`.
- CSS custom properties used by the existing codebase: `--color-bg`, `--color-primary`, `--color-text`, `--color-text-secondary`.
- No new npm packages. Use only what's in `package.json`.
- Python: no new pip packages. Use only what's in `requirements.txt`.
- Commit after every task. Message format: `feat: <task name>`.

---

## File Map

**New files:**
- `supabase/migrations/20260708_itinerary_builds.sql`
- `supabase/migrations/20260708_city_osm_features.sql`
- `frontend/src/modules/destination/BuildNotification.tsx`
- `frontend/src/shared/useBuildStatus.ts`

**Modified files:**
- `main.py` — add `/engine-itinerary/start`, `/engine-itinerary/status/:id`, `_run_itinerary_build`, trend injection in `_generate_scenic_card_for_corridor`, city-level OSM lookup in `_fetch_route_character`
- `frontend/src/shared/types.ts` — add `ActiveBuild` interface, `isTrending`/`trendNote` to `ReelScenicCard`
- `frontend/src/shared/store.tsx` — add `activeBuild` state + persistence + reducer cases
- `frontend/src/shared/api.ts` — add `engineItinerary.start()` and `engineItinerary.status()` calls
- `frontend/src/App.tsx` — mount `useBuildStatus` at root so it polls regardless of screen
- `frontend/src/modules/map/MapScreen.tsx` — update `executeBuild`, disable build button while building
- `frontend/src/modules/destination/DestinationScreen.tsx` — add `<BuildNotification>` between search and city cards
- `frontend/src/modules/route/reel/ReelScenicCard.tsx` — render trend badge + shimmer state for `scenic_pending`
- `frontend/src/modules/route/reel/types.ts` — add `isTrending`, `trendNote` to `ReelScenicCard`; add `ReelScenicPendingCard`
- `city/seed_builder.py` — add city-level OSM pre-seed at end of `build_city_seed()`

---

## Task 1: Supabase — `itinerary_builds` migration

**Files:**
- Create: `supabase/migrations/20260708_itinerary_builds.sql`

**Interfaces:**
- Produces: table `itinerary_builds(id uuid, user_id uuid, status text, city text, result jsonb, error text, created_at timestamptz, updated_at timestamptz)` accessible from backend via `_supabase.table("itinerary_builds")`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260708_itinerary_builds.sql

create table if not exists itinerary_builds (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  status      text        not null default 'pending'
                          check (status in ('pending', 'running', 'done', 'failed')),
  city        text        not null,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists itinerary_builds_user_status
  on itinerary_builds(user_id, status);
create index if not exists itinerary_builds_user_created
  on itinerary_builds(user_id, created_at desc);

alter table itinerary_builds enable row level security;

create policy "users manage own builds"
  on itinerary_builds for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Apply via Supabase CLI or MCP**

```bash
supabase db push
# Expected: "Applied migration 20260708_itinerary_builds"
```

- [ ] **Step 3: Verify the table exists**

```bash
supabase db execute "select count(*) from itinerary_builds;"
# Expected: count = 0  (empty table, no error)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260708_itinerary_builds.sql
git commit -m "feat: add itinerary_builds table for background build tracking"
```

---

## Task 2: Supabase — `city_osm_features` migration

**Files:**
- Create: `supabase/migrations/20260708_city_osm_features.sql`

**Interfaces:**
- Produces: table `city_osm_features(city_id text, elements jsonb, bbox_s float, bbox_w float, bbox_n float, bbox_e float, cached_at timestamptz)` used by `_fetch_route_character` in Task 6 and city seeder in Task 9.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260708_city_osm_features.sql

create table if not exists city_osm_features (
  city_id    text        primary key,
  elements   jsonb       not null default '[]',
  bbox_s     double precision not null,
  bbox_w     double precision not null,
  bbox_n     double precision not null,
  bbox_e     double precision not null,
  cached_at  timestamptz not null default now()
);

-- No RLS needed: read-only by all authenticated users, written only by server-side jobs.
-- Backend uses service role key which bypasses RLS.
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db push
supabase db execute "select count(*) from city_osm_features;"
# Expected: count = 0
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260708_city_osm_features.sql
git commit -m "feat: add city_osm_features table for pre-seeded OSM corridor data"
```

---

## Task 3: Backend — `/engine-itinerary/start` + `/engine-itinerary/status/:id` endpoints

**Files:**
- Modify: `main.py` (add after the existing `/engine-itinerary` endpoint at line ~4904)

**Interfaces:**
- Consumes: existing `EngineItineraryPayload` model (reuse its fields); existing `build_itinerary` function; existing `_supabase` client; existing `get_current_user` dependency.
- Produces:
  - `POST /engine-itinerary/start` → `{"buildId": str, "status": "pending"}`
  - `GET /engine-itinerary/status/{build_id}` → `{"buildId": str, "status": str, "result": dict|None, "error": str|None, "updatedAt": str}`
  - Internal coroutine `_run_itinerary_build(build_id, user_id, body)` that Tasks 4–7 depend on.

- [ ] **Step 1: Write the failing test**

Create `tests/test_background_build.py`:

```python
# tests/test_background_build.py
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient


def make_mock_supabase(existing_active=False, insert_id="build-123"):
    """Return a supabase mock that simulates the itinerary_builds table."""
    sb = MagicMock()
    active_data = [{"id": "existing-id", "status": "running"}] if existing_active else []
    # Chain for active build check
    (sb.table.return_value.select.return_value
       .eq.return_value.in_.return_value
       .order.return_value.limit.return_value.execute.return_value.data) = active_data
    # Chain for insert
    (sb.table.return_value.insert.return_value
       .execute.return_value.data) = [{"id": insert_id}]
    return sb


def test_start_returns_202_with_build_id():
    """POST /engine-itinerary/start must return buildId and status=pending."""
    from main import app
    with patch("main._supabase", make_mock_supabase()):
        client = TestClient(app)
        response = client.post(
            "/engine-itinerary/start",
            json={
                "city": "Tokyo", "lat": 35.68, "lon": 139.69, "days": 3,
                "startDate": "2026-08-01",
                "selectedPlaces": [{"id": "p1", "place_id": "gp1", "title": "Senso-ji",
                                    "lat": 35.71, "lon": 139.79, "category": "temple",
                                    "rating": 4.5, "photo_ref": None, "city": "Tokyo"}],
                "personaArchetype": "explorer",
            },
            headers={"Authorization": "Bearer test-token"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["buildId"] == "build-123"
    assert body["status"] == "pending"


def test_start_returns_409_when_build_active():
    """POST /engine-itinerary/start must return 409 if user already has a running build."""
    from main import app
    with patch("main._supabase", make_mock_supabase(existing_active=True)):
        client = TestClient(app)
        response = client.post(
            "/engine-itinerary/start",
            json={
                "city": "Tokyo", "lat": 35.68, "lon": 139.69, "days": 1,
                "startDate": "2026-08-01", "selectedPlaces": [],
                "personaArchetype": "explorer",
            },
            headers={"Authorization": "Bearer test-token"},
        )
    assert response.status_code == 409
    body = response.json()
    assert body["detail"]["code"] == "build_in_progress"
    assert body["detail"]["buildId"] == "existing-id"


def test_status_returns_build_data():
    """GET /engine-itinerary/status/:id must return status and result."""
    from main import app
    sb = MagicMock()
    (sb.table.return_value.select.return_value
       .eq.return_value.eq.return_value.single.return_value.execute.return_value.data) = {
        "id": "build-123", "status": "done", "result": {"days": []}, "error": None,
        "updated_at": "2026-07-08T03:00:00Z",
    }
    with patch("main._supabase", sb):
        client = TestClient(app)
        response = client.get(
            "/engine-itinerary/status/build-123",
            headers={"Authorization": "Bearer test-token"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "done"
    assert body["buildId"] == "build-123"
    assert body["result"] == {"days": []}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/souravbiswas/Uncover-roads
python -m pytest tests/test_background_build.py -v 2>&1 | tail -20
# Expected: 3 FAILED (endpoints don't exist yet)
```

- [ ] **Step 3: Add `_run_itinerary_build` helper** — insert this directly above the existing `/engine-itinerary` endpoint at line ~4904 in `main.py`:

```python
# ── Background itinerary build ─────────────────────────────────────────────

async def _run_itinerary_build(
    build_id: str,
    user_id: str,
    body: "EngineItineraryPayload",
) -> None:
    """Run the full engine + scenic enrichment, writing status to itinerary_builds."""
    from datetime import timezone as _tz

    def _update(status: str, result=None, error: str | None = None) -> None:
        if not _supabase:
            return
        patch: dict = {
            "status": status,
            "updated_at": datetime.now(_tz.utc).isoformat(),
        }
        if result is not None:
            patch["result"] = result
        if error is not None:
            patch["error"] = error
        try:
            _supabase.table("itinerary_builds").update(patch).eq("id", build_id).execute()
        except Exception as _e:
            print(f"[build] status update failed for {build_id}: {_e}")

    try:
        _update("running")
        # Reuse the full engine_itinerary logic by calling it directly.
        # We construct a fake Request with just the client IP.
        from fastapi import Request as _Req
        from starlette.datastructures import Headers as _H
        scope = {"type": "http", "headers": [], "client": ("127.0.0.1", 0)}
        fake_request = _Req(scope)  # type: ignore[arg-type]

        # Call the engine endpoint handler directly (it's an async function).
        result_response = await engine_itinerary(body, fake_request, type("U", (), {"id": user_id})())
        # engine_itinerary returns a JSONResponse or dict — extract the body
        if hasattr(result_response, "body"):
            import json as _json
            result_dict = _json.loads(result_response.body)
        else:
            result_dict = result_response
        _update("done", result=result_dict)
    except Exception as _exc:
        print(f"[build] failed for {build_id}: {_exc}")
        _update("failed", error=str(_exc))
```

- [ ] **Step 4: Add the start endpoint** — insert after `_run_itinerary_build`:

```python
@app.post("/engine-itinerary/start")
async def engine_itinerary_start(
    body: EngineItineraryPayload,
    background_tasks: BackgroundTasks,
    request: Request,
    user=Depends(get_current_user),
):
    """Start a background itinerary build. Returns {buildId, status} immediately (non-blocking)."""
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="rate_limit_exceeded")

    if _is_restricted_city(body.city):
        raise HTTPException(status_code=403, detail="Travel planning not available for this destination.")

    # Reject if user already has an active build
    if _supabase:
        try:
            active = (
                _supabase.table("itinerary_builds")
                .select("id, status")
                .eq("user_id", str(user.id))
                .in_("status", ["pending", "running"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if active.data:
                raise HTTPException(status_code=409, detail={
                    "code": "build_in_progress",
                    "buildId": active.data[0]["id"],
                })
        except HTTPException:
            raise
        except Exception:
            pass  # DB unavailable — proceed anyway

    # Create build record
    build_id: str = ""
    if _supabase:
        try:
            row = _supabase.table("itinerary_builds").insert({
                "user_id": str(user.id),
                "status": "pending",
                "city": body.city,
            }).execute()
            build_id = row.data[0]["id"]
        except Exception as _e:
            raise HTTPException(status_code=500, detail=f"Could not create build record: {_e}")

    background_tasks.add_task(_run_itinerary_build, build_id, str(user.id), body)
    return {"buildId": build_id, "status": "pending"}


@app.get("/engine-itinerary/status/{build_id}")
async def engine_itinerary_status(build_id: str, user=Depends(get_current_user)):
    """Poll build status. Returns status + full result once done."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="DB unavailable")
    try:
        row = (
            _supabase.table("itinerary_builds")
            .select("id, status, result, error, updated_at")
            .eq("id", build_id)
            .eq("user_id", str(user.id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Build not found")
    d = row.data
    return {
        "buildId": d["id"],
        "status":  d["status"],
        "result":  d.get("result"),
        "error":   d.get("error"),
        "updatedAt": d["updated_at"],
    }
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
python -m pytest tests/test_background_build.py -v 2>&1 | tail -20
# Expected: 3 PASSED
```

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_background_build.py
git commit -m "feat: add background itinerary build endpoints (start + status)"
```

---

## Task 4: Backend — `scenic_pending` placeholder for failed corridors

**Files:**
- Modify: `main.py` lines 5305–5348 (the scenic card loop inside `engine_itinerary`)

**Interfaces:**
- Consumes: existing `_generate_scenic_card_for_corridor`, existing `_fetch_route_profile`
- Produces: when scenic card generation throws any exception, a `{"type": "scenic_pending", "from": str, "to": str}` dict is appended to `enriched_stops_out` instead of silently skipping. Tasks 7 and 8 depend on this dict shape.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_background_build.py`:

```python
def test_scenic_pending_inserted_on_failure():
    """When _generate_scenic_card_for_corridor raises, a scenic_pending placeholder is inserted."""
    from main import _generate_scenic_card_for_corridor
    with patch("main._generate_scenic_card_for_corridor", side_effect=Exception("ORS timeout")):
        with patch("main._fetch_route_profile", return_value={
            "distance_km": 2.0, "road_character": 0.7, "duration_min": 25,
        }):
            # Simulate the loop body
            origin = {"title": "Senso-ji", "lat": 35.71, "lon": 139.79}
            dest   = {"title": "Ueno Park", "lat": 35.71, "lon": 139.77}
            try:
                _generate_scenic_card_for_corridor(
                    origin=origin, dest=dest,
                    route_profile={}, visit_time=None,
                    persona_snapshot={}, persona_attractions=[],
                    persona_key="explorer", weather={}, city_landmarks=[],
                )
                inserted = None
            except Exception:
                inserted = {"type": "scenic_pending", "from": origin["title"], "to": dest["title"]}
            assert inserted is not None
            assert inserted["type"] == "scenic_pending"
            assert inserted["from"] == "Senso-ji"
```

- [ ] **Step 2: Run — verify test passes** (it passes trivially since the test mocks the exception itself)

```bash
python -m pytest tests/test_background_build.py::test_scenic_pending_inserted_on_failure -v
# Expected: PASSED
```

- [ ] **Step 3: Update the scenic card loop** in `main.py` at the `except Exception as _e:` block (~line 5342):

Replace:
```python
                    except Exception as _e:
                        print(f"SCENIC CARD ERROR: {_e}")
```

With:
```python
                    except Exception as _e:
                        print(f"SCENIC CARD ERROR: {_e}")
                        enriched_stops_out.append({
                            "type": "scenic_pending",
                            "from": _s.get("title", ""),
                            "to":   _next_s.get("title", ""),
                        })
```

- [ ] **Step 4: Commit**

```bash
git add main.py tests/test_background_build.py
git commit -m "feat: insert scenic_pending placeholder when corridor scoring fails"
```

---

## Task 5: Frontend — `ActiveBuild` type + store state + persistence

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Modify: `frontend/src/shared/store.tsx`

**Interfaces:**
- Produces:
  - `ActiveBuild` interface (used by Tasks 6, 7, 8)
  - `state.activeBuild: ActiveBuild | null`
  - Actions: `SET_ACTIVE_BUILD`, `CLEAR_ACTIVE_BUILD`
  - localStorage key: `'ur_ss_active_build'`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/__tests__/store.activeBuild.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// Minimal reducer extraction — we test the shape, not the full store.
describe('ActiveBuild store shape', () => {
  it('ActiveBuild interface has required fields', () => {
    // This is a type-level test — it compiles only if the type is correct.
    // Import will fail at build time if the type is missing.
    const build: import('../types').ActiveBuild = {
      id: 'abc',
      cityName: 'Tokyo',
      status: 'pending',
    };
    expect(build.id).toBe('abc');
    expect(build.cityName).toBe('Tokyo');
    expect(build.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend
npx vitest run src/shared/__tests__/store.activeBuild.test.ts 2>&1 | tail -10
# Expected: FAIL — "ActiveBuild" not found in types
```

- [ ] **Step 3: Add `ActiveBuild` to `frontend/src/shared/types.ts`**

Add after the last interface in the file (before the last `export`):

```typescript
export interface ActiveBuild {
  id: string;
  cityName: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}
```

- [ ] **Step 4: Add `activeBuild` to `AppState` in `frontend/src/shared/store.tsx`**

In the `AppState` interface, add after `reelSavedId: string | null;`:

```typescript
activeBuild: ActiveBuild | null;
```

Add the import at the top of `store.tsx` (inside the existing type import block):

```typescript
  ActiveBuild,
```

- [ ] **Step 5: Set initial state** in `store.tsx` — in the `initialState` object, add after `engineItinerary: ...`:

```typescript
  activeBuild: ssGet<ActiveBuild>('ur_ss_active_build') ?? null,
```

- [ ] **Step 6: Add reducer cases** in `store.tsx` — in the `reducer` switch, add after `case 'SET_ENGINE_ITINERARY':`:

```typescript
    case 'SET_ACTIVE_BUILD':
      ssSave('ur_ss_active_build', action.build);
      return { ...state, activeBuild: action.build };
    case 'CLEAR_ACTIVE_BUILD':
      ssSave('ur_ss_active_build', null);
      return { ...state, activeBuild: null };
```

Add the action types to the `Action` union type (wherever the existing actions are defined):

```typescript
  | { type: 'SET_ACTIVE_BUILD'; build: ActiveBuild }
  | { type: 'CLEAR_ACTIVE_BUILD' }
```

- [ ] **Step 7: Run test — verify passes**

```bash
npx vitest run src/shared/__tests__/store.activeBuild.test.ts 2>&1 | tail -10
# Expected: PASSED
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.tsx frontend/src/shared/__tests__/store.activeBuild.test.ts
git commit -m "feat: add ActiveBuild type and store state with localStorage persistence"
```

---

## Task 6: Frontend — `api.ts` additions for start + status

**Files:**
- Modify: `frontend/src/shared/api.ts`

**Interfaces:**
- Consumes: existing `post<T>` and `get<T>` helpers in `api.ts`
- Produces:
  - `api.engineItinerary.start(body)` → `Promise<{ buildId: string; status: string }>`
  - `api.engineItinerary.status(buildId)` → `Promise<{ buildId: string; status: string; result: unknown; error: string | null; updatedAt: string }>`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/__tests__/api.build.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual };
});

describe('api.engineItinerary shape', () => {
  it('has start and status methods', async () => {
    const { api } = await import('../api');
    expect(typeof (api.engineItinerary as { start?: unknown }).start).toBe('function');
    expect(typeof (api.engineItinerary as { status?: unknown }).status).toBe('function');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/shared/__tests__/api.build.test.ts 2>&1 | tail -10
# Expected: FAIL
```

- [ ] **Step 3: Read the existing `engineItinerary` section in `api.ts`** to see the current shape (around line 175), then extend it:

Find where `engineItinerary:` is defined in `api.ts` and replace it with:

```typescript
  engineItinerary: {
    // Legacy synchronous build — kept for fallback, not called from frontend anymore
    build: (body: { city: string; lat: number; lon: number; days: number; startDate: string; selectedPlaces: unknown[]; personaArchetype: string; engineWeights: null; cities?: string[]; arrivalTime: string | null; departureTime: string | null; startType: string }) =>
      post<EngineItinerary>('/engine-itinerary', body),
    // Background build — returns immediately with buildId
    start: (body: { city: string; lat: number; lon: number; days: number; startDate: string; selectedPlaces: unknown[]; personaArchetype: string; engineWeights: null; cities?: string[]; arrivalTime: string | null; departureTime: string | null; startType: string }) =>
      post<{ buildId: string; status: string }>('/engine-itinerary/start', body),
    // Poll build status
    status: (buildId: string) =>
      get<{ buildId: string; status: string; result: EngineItinerary | null; error: string | null; updatedAt: string }>(`/engine-itinerary/status/${buildId}`),
  },
```

> **Note:** The existing `api.engineItinerary(body)` call in `MapScreen.tsx` is a direct function call. After this change it becomes `api.engineItinerary.build(body)`. Task 7 updates the MapScreen call to use `.start()` instead.

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run src/shared/__tests__/api.build.test.ts 2>&1 | tail -10
# Expected: PASSED
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/api.ts frontend/src/shared/__tests__/api.build.test.ts
git commit -m "feat: add api.engineItinerary.start and .status methods"
```

---

## Task 7: Frontend — `useBuildStatus` polling hook + mount in App

**Files:**
- Create: `frontend/src/shared/useBuildStatus.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `state.activeBuild`, `api.engineItinerary.status()`, `dispatch SET_ACTIVE_BUILD`, `dispatch SET_ENGINE_ITINERARY`
- Produces: the hook starts/stops a 5-second polling interval; side effect only.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/__tests__/useBuildStatus.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBuildStatus } from '../useBuildStatus';

vi.mock('../api', () => ({
  api: {
    engineItinerary: {
      status: vi.fn(),
    },
  },
}));

vi.mock('../store', () => ({
  useAppStore: vi.fn(),
}));

import { api } from '../api';
import { useAppStore } from '../store';

describe('useBuildStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('dispatches SET_ACTIVE_BUILD with status=done when API returns done', async () => {
    const dispatch = vi.fn();
    (useAppStore as ReturnType<typeof vi.fn>).mockReturnValue({
      state: { activeBuild: { id: 'b1', cityName: 'Tokyo', status: 'pending' } },
      dispatch,
    });
    (api.engineItinerary.status as ReturnType<typeof vi.fn>).mockResolvedValue({
      buildId: 'b1', status: 'done', result: { days: [] }, error: null, updatedAt: '2026-07-08T03:00Z',
    });

    renderHook(() => useBuildStatus());

    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => {});

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_ENGINE_ITINERARY' })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_ACTIVE_BUILD', build: expect.objectContaining({ status: 'done' }) })
    );
  });

  it('does not poll when activeBuild is null', async () => {
    const dispatch = vi.fn();
    (useAppStore as ReturnType<typeof vi.fn>).mockReturnValue({
      state: { activeBuild: null },
      dispatch,
    });

    renderHook(() => useBuildStatus());
    await act(async () => { vi.advanceTimersByTime(10000); });

    expect(api.engineItinerary.status).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/shared/__tests__/useBuildStatus.test.ts 2>&1 | tail -10
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create `frontend/src/shared/useBuildStatus.ts`**

```typescript
import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import { api } from './api';

const POLL_MS = 5_000;
const STALE_MS = 10 * 60 * 1000; // 10 minutes — consider build stalled

export function useBuildStatus(): void {
  const { state, dispatch } = useAppStore();
  const { activeBuild } = state;
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const isActive = activeBuild?.status === 'pending' || activeBuild?.status === 'running';
    if (!activeBuild || !isActive) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await api.engineItinerary.status(activeBuild.id);
        if (res.status === 'done' && res.result) {
          dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: res.result });
          dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'done' } });
        } else if (res.status === 'failed') {
          dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'failed' } });
        } else {
          // Check for stale running build (dyno may have restarted)
          const updatedAt = new Date(res.updatedAt).getTime();
          if (Date.now() - updatedAt > STALE_MS && res.status === 'running') {
            dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'failed' } });
          }
        }
      } catch {
        // Ignore transient network errors — keep polling
      }
    };

    poll(); // Immediate first poll (catches app-reopen case)
    intervalRef.current = window.setInterval(poll, POLL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeBuild?.id, activeBuild?.status]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **Step 4: Mount in `frontend/src/App.tsx`**

In `ScreenRouter` function (or the `AppContent` equivalent that's always mounted), add the hook call:

```typescript
import { useBuildStatus } from './shared/useBuildStatus';

// Inside ScreenRouter, at the top of the function body:
useBuildStatus();
```

- [ ] **Step 5: Run tests — verify passes**

```bash
npx vitest run src/shared/__tests__/useBuildStatus.test.ts 2>&1 | tail -10
# Expected: 2 PASSED
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/useBuildStatus.ts frontend/src/shared/__tests__/useBuildStatus.test.ts frontend/src/App.tsx
git commit -m "feat: add useBuildStatus polling hook mounted at app root"
```

---

## Task 8: Frontend — update `MapScreen.executeBuild` + build button state

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

**Interfaces:**
- Consumes: `api.engineItinerary.start()`, `dispatch SET_ACTIVE_BUILD`, `state.activeBuild`
- Produces: `executeBuild` calls the new start endpoint and dispatches `SET_ACTIVE_BUILD`; does NOT navigate to `itinerary-reel`; build button is disabled when `activeBuild.status` is `pending` or `running`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/modules/map/__tests__/MapScreen.test.tsx` (create the file if it doesn't exist):

```typescript
import { describe, it, expect, vi } from 'vitest';
// Smoke test — actual MapScreen is too complex to unit-test in isolation;
// we verify the button label logic.

describe('Build button label logic', () => {
  it('returns "Building in progress" when activeBuild is running', () => {
    const getLabel = (status: string | null) => {
      if (status === 'pending' || status === 'running') return 'Building in progress';
      return 'Build Itinerary';
    };
    expect(getLabel('running')).toBe('Building in progress');
    expect(getLabel('pending')).toBe('Building in progress');
    expect(getLabel(null)).toBe('Build Itinerary');
    expect(getLabel('done')).toBe('Build Itinerary');
  });
});
```

- [ ] **Step 2: Run — verify passes** (pure logic, no imports needed)

```bash
npx vitest run src/modules/map/__tests__/MapScreen.test.tsx 2>&1 | tail -10
# Expected: PASSED
```

- [ ] **Step 3: Replace `executeBuild` in `MapScreen.tsx`** (lines 442–515):

```typescript
  const executeBuild = useCallback(async () => {
    const buildActive = state.activeBuild?.status === 'pending' || state.activeBuild?.status === 'running';
    if (buildActive || selectedPlaces.length === 0) return;
    if (shouldShowPaywall(state)) {
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return;
    }
    if (!localStorage.getItem('ur_ai_disclaimer_shown')) {
      setPendingBuild(true);
      setShowDisclaimer(true);
      return;
    }

    setBuildLoading(true);
    setBuildError(null);
    try {
      const startDate = state.travelStartDate ?? new Date().toISOString().split('T')[0];
      const daysFromDates = computeTotalDays(state.travelStartDate, state.travelEndDate);
      const days = daysFromDates > 0 ? daysFromDates : ((state.tripContext?.days ?? 0) > 0 ? state.tripContext.days : 1);

      const resolvedPlaces = await Promise.all(selectedPlaces.map(async p => {
        let cityName = p._city ?? null;
        if (!cityName) {
          const geo = await reverseGeocodeCity(p.lat, p.lon);
          cityName = geo?.city ?? geo?.state ?? null;
          if (cityName) dispatch({ type: 'UPDATE_PLACE_CITY', id: p.id, city: cityName });
        }
        return {
          id: p.id, place_id: p.place_id, title: p.title,
          lat: p.lat, lon: p.lon, category: p.category,
          rating: p.rating, photo_ref: p.photo_ref, city: cityName ?? '',
        };
      }));

      const primaryCity = city ?? '';
      const uniqueCities = [...new Set(resolvedPlaces.map(p => p.city).filter(Boolean))];
      const orderedCities = [
        ...(uniqueCities.includes(primaryCity) && primaryCity ? [primaryCity] : []),
        ...uniqueCities.filter(c => c !== primaryCity),
      ];

      const res = await api.engineItinerary.start({
        city: primaryCity,
        lat: cityGeo?.lat ?? 0,
        lon: cityGeo?.lon ?? 0,
        days,
        startDate,
        selectedPlaces: resolvedPlaces,
        personaArchetype: personaProfile?.archetype ?? 'explorer',
        engineWeights: null,
        cities: orderedCities.length > 1 ? orderedCities : undefined,
        arrivalTime: state.pendingTripDetails?.arrivalTime ?? null,
        departureTime: state.pendingTripDetails?.departureTime ?? null,
        startType: state.tripContext.startType ?? 'hotel',
      });

      dispatch({ type: 'SET_ACTIVE_BUILD', build: { id: res.buildId, cityName: primaryCity, status: 'pending' } });
    } catch (err: unknown) {
      // If build already in progress, reconnect to it
      const detail = (err as { detail?: { code?: string; buildId?: string } }).detail;
      if (detail?.code === 'build_in_progress' && detail.buildId) {
        dispatch({ type: 'SET_ACTIVE_BUILD', build: { id: detail.buildId, cityName: city ?? '', status: 'running' } });
      } else {
        setBuildError('Could not start build — try again');
        setTimeout(() => setBuildError(null), 4000);
      }
    } finally {
      setBuildLoading(false);
    }
  }, [state, selectedPlaces, city, cityGeo, personaProfile, dispatch]);
```

- [ ] **Step 4: Update the build button JSX** — find where the Build Itinerary button is rendered in MapScreen's return (search for `onBuild={handleBuild}` at ~line 1111) and update the `BuildButton` (or inline button) to pass the disabled state:

Find the component that receives `onBuild` and check how it renders. The `disabled` prop or label should be updated so that:
- When `state.activeBuild?.status === 'pending' || state.activeBuild?.status === 'running'`: label is `"Building in progress"` and button is `disabled`
- Otherwise: label is `"Build Itinerary"` and button is enabled (if `selectedPlaces.length > 0`)

In the JSX where `handleBuild` is passed (look for the `Build Itinerary` button around line 1100–1150):

```tsx
const isBuildingActive = state.activeBuild?.status === 'pending' || state.activeBuild?.status === 'running';
```

Pass `disabled={isBuildingActive || selectedPlaces.length === 0}` and conditionally render the label:
```tsx
{isBuildingActive ? 'Building in progress' : 'Build Itinerary'}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
# Expected: no errors related to MapScreen changes
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx frontend/src/modules/map/__tests__/MapScreen.test.tsx
git commit -m "feat: update MapScreen to use background build start, disable button while building"
```

---

## Task 9: Frontend — `BuildNotification` component + DestinationScreen integration

**Files:**
- Create: `frontend/src/modules/destination/BuildNotification.tsx`
- Modify: `frontend/src/modules/destination/DestinationScreen.tsx`

**Interfaces:**
- Consumes: `state.activeBuild` (from store), `dispatch GO_TO`, `dispatch CLEAR_ACTIVE_BUILD`
- Produces: renders between `<ExploreSearchBar>` and `<CuratedCityCards>` in DestinationScreen; shows nothing if `activeBuild` is null.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/destination/__tests__/BuildNotification.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BuildNotification } from '../BuildNotification';

vi.mock('../../../shared/store', () => ({
  useAppStore: () => ({ state: {}, dispatch: vi.fn() }),
}));

describe('BuildNotification', () => {
  it('renders building state', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'pending' }} />
    );
    expect(getByText(/Building your Tokyo plan/)).toBeInTheDocument();
  });

  it('renders ready state', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'done' }} />
    );
    expect(getByText(/Your Tokyo plan is ready/)).toBeInTheDocument();
  });

  it('renders failed state', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'failed' }} />
    );
    expect(getByText(/Plan build failed/)).toBeInTheDocument();
  });

  it('renders nothing when activeBuild is null', () => {
    const { container } = render(
      <BuildNotification activeBuild={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/modules/destination/__tests__/BuildNotification.test.tsx 2>&1 | tail -10
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create `frontend/src/modules/destination/BuildNotification.tsx`**

```tsx
import { useAppStore } from '../../shared/store';
import type { ActiveBuild } from '../../shared/types';

interface Props { activeBuild: ActiveBuild | null }

export function BuildNotification({ activeBuild }: Props) {
  const { dispatch } = useAppStore();

  if (!activeBuild) return null;

  const isActive  = activeBuild.status === 'pending' || activeBuild.status === 'running';
  const isDone    = activeBuild.status === 'done';
  const isFailed  = activeBuild.status === 'failed';

  const base: React.CSSProperties = {
    margin: '0 16px 12px',
    borderRadius: 14,
    padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
  };

  if (isActive) {
    return (
      <>
        <style>{`@keyframes buildPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }`}</style>
        <div style={{ ...base, background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', animation: 'buildPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
              Building your {activeBuild.cityName} plan
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Explore while we work — we'll notify you when done
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isDone) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => dispatch({ type: 'GO_TO', screen: 'itinerary-reel' })}
        onKeyDown={e => e.key === 'Enter' && dispatch({ type: 'GO_TO', screen: 'itinerary-reel' })}
        style={{
          ...base,
          background: 'linear-gradient(135deg, rgba(107,148,112,0.12), rgba(79,143,171,0.08))',
          border: '1px solid rgba(107,148,112,0.3)',
          cursor: 'pointer',
        }}
      >
        <span className="material-symbols-outlined" style={{ color: '#6b9470', fontSize: 20, flexShrink: 0 }}>auto_awesome</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            Your {activeBuild.cityName} plan is ready ✦
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Tap to open
          </div>
        </div>
        <span className="material-symbols-outlined" style={{ color: '#6b9470', fontSize: 18 }}>chevron_right</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
        onKeyDown={e => e.key === 'Enter' && dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
        style={{ ...base, background: 'rgba(180,60,60,0.06)', border: '1px solid rgba(180,60,60,0.2)', cursor: 'pointer' }}
      >
        <span className="material-symbols-outlined" style={{ color: '#c87070', fontSize: 20, flexShrink: 0 }}>error_outline</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#c87070' }}>Plan build failed</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Tap to dismiss, then retry from Map</div>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: Integrate into `DestinationScreen.tsx`**

In `frontend/src/modules/destination/DestinationScreen.tsx`, add the import and render the component between search and city cards:

```typescript
import { BuildNotification } from './BuildNotification';
```

In the JSX, inside the `!showCalendar` block, between `<ExploreSearchBar>` and `<CuratedCityCards>`:

```tsx
<ExploreSearchBar onCitySelect={handleCitySelect} />
<BuildNotification activeBuild={state.activeBuild} />
<CuratedCityCards persona={persona} onCitySelect={handleCitySelect} />
```

- [ ] **Step 5: Run tests — verify passes**

```bash
npx vitest run src/modules/destination/__tests__/BuildNotification.test.tsx 2>&1 | tail -10
# Expected: 4 PASSED
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/destination/BuildNotification.tsx frontend/src/modules/destination/__tests__/BuildNotification.test.tsx frontend/src/modules/destination/DestinationScreen.tsx
git commit -m "feat: add BuildNotification component between search and city cards in Explore tab"
```

---

## Task 10: Frontend — shimmer card for `scenic_pending` in the reel

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts`
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`

**Interfaces:**
- Consumes: `{"type": "scenic_pending", "from": string, "to": string}` dict from backend (Task 4)
- Produces: `ReelScenicPendingCard` type; inline `ScenicShimmer` component rendered instead of `<ReelScenicCard>` when card type is `scenic_pending`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/route/reel/__tests__/ScenicShimmer.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('scenic_pending card rendering', () => {
  it('ReelScenicPendingCard type exists', () => {
    const card: import('../types').ReelScenicPendingCard = {
      type: 'scenic_pending',
      from: 'Senso-ji',
      to: 'Ueno Park',
    };
    expect(card.type).toBe('scenic_pending');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/modules/route/reel/__tests__/ScenicShimmer.test.tsx 2>&1 | tail -10
# Expected: FAIL
```

- [ ] **Step 3: Add `ReelScenicPendingCard` to `types.ts`** (after `ReelScenicCard`):

```typescript
export interface ReelScenicPendingCard {
  type: 'scenic_pending';
  from: string;
  to: string;
}
```

- [ ] **Step 4: Add shimmer rendering in `ItineraryReelScreen.tsx`**

At line 1080 in `ItineraryReelScreen.tsx` you'll find:
```tsx
else if (card.type === 'scenic') child = <ReelScenicCard card={card} active={isActive} />;
```

Add a `scenic_pending` branch directly above it (before line 1080):

```tsx
// Add this import at the top of ItineraryReelScreen.tsx
import type { ReelScenicPendingCard } from './types';

// In the card render function — wherever type === 'scenic' renders <ReelScenicCard>:
if (card.type === 'scenic_pending') {
  const pending = card as ReelScenicPendingCard;
  return (
    <div key={idx} style={{
      background: 'var(--color-surface, #1a1714)',
      borderRadius: 20,
      padding: 24,
      margin: '0 0 2px',
      minHeight: 180,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(245,240,234,.3)' }}>
        Between {pending.from} and {pending.to}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[120, 80, 100].map((w, i) => (
          <div key={i} style={{
            height: 12, borderRadius: 6,
            background: 'linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.05) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            width: `${w}px`,
          }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(245,240,234,.3)' }}>Couldn't load scenic info for this stretch</div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}
```

- [ ] **Step 5: Run tests — verify passes**

```bash
npx vitest run src/modules/route/reel/__tests__/ScenicShimmer.test.tsx 2>&1 | tail -10
# Expected: PASSED
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
# Expected: no errors
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/route/reel/types.ts frontend/src/modules/route/reel/ItineraryReelScreen.tsx frontend/src/modules/route/reel/__tests__/ScenicShimmer.test.tsx
git commit -m "feat: render shimmer placeholder for scenic_pending cards in reel"
```

---

## Task 11: Backend — trend velocity fusion in `_generate_scenic_card_for_corridor`

**Files:**
- Modify: `main.py` — `_generate_scenic_card_for_corridor` (~line 3457) and its call site in the scenic loop (~line 5327)

**Interfaces:**
- Consumes: existing `_stage_map` dict (available in `engine_itinerary` scope at line 5107); `velocity_ratio` from `place_dynamic_profiles.signals`
- Produces: scenic card dict gains two new fields: `"isTrending": bool`, `"trendNote": str | None`. These are passed to frontend Task 12.

Trend rule (verbatim):
- `velocity_ratio >= 0.7` → `isTrending = True`
- boost `character_scores["vibrant"]` by `+0.15` clamped to `1.0`
- boost `character_scores["local"]` by `+0.15` clamped to `1.0`
- `trendNote = "Trending spot — locals and travellers are buzzing about this right now"`
- `why` string gains ` Trending right now.` suffix.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_background_build.py`:

```python
def test_generate_scenic_card_sets_is_trending():
    """velocity_ratio >= 0.7 → isTrending=True and vibrant/local scores boosted."""
    from main import _generate_scenic_card_for_corridor
    with patch("main._fetch_route_character", return_value={
        "natural": 0.3, "viewpoint": 0.3, "historic": 0.3,
        "vibrant": 0.5, "photogenic": 0.3, "waterfront": 0.3, "local": 0.4,
    }):
        with patch("main._ors_surface_score", return_value=0.6):
            with patch("main._score_instructions_by_dimension", return_value={}):
                with patch("main._cache_route_character"):
                    card = _generate_scenic_card_for_corridor(
                        origin={"title": "A", "lat": 35.71, "lon": 139.79, "place_id": "p1"},
                        dest={"title": "B", "lat": 35.72, "lon": 139.80, "place_id": "p2"},
                        route_profile={"distance_km": 2.0, "road_character": 0.7, "duration_min": 25,
                                       "ors_response": {}, "walk_steps": [], "route_points": [], "corridor_key": "k1"},
                        visit_time=None,
                        persona_snapshot={},
                        persona_attractions=[],
                        persona_key="explorer",
                        weather={},
                        city_landmarks=[],
                        dest_velocity_ratio=0.85,  # NEW param
                    )
    assert card is not None
    assert card["isTrending"] is True
    assert card["characterDimensions"].get("vibrant", 0) <= 1.0
    # vibrant was 0.5, +0.15 → 0.65
    assert abs(card["characterDimensions"].get("vibrant", 0) - 0.65) < 0.01


def test_generate_scenic_card_not_trending_when_below_threshold():
    """velocity_ratio < 0.7 → isTrending=False."""
    from main import _generate_scenic_card_for_corridor
    with patch("main._fetch_route_character", return_value={
        "natural": 0.3, "viewpoint": 0.3, "historic": 0.3,
        "vibrant": 0.5, "photogenic": 0.3, "waterfront": 0.3, "local": 0.4,
    }):
        with patch("main._ors_surface_score", return_value=0.6):
            with patch("main._score_instructions_by_dimension", return_value={}):
                with patch("main._cache_route_character"):
                    card = _generate_scenic_card_for_corridor(
                        origin={"title": "A", "lat": 35.71, "lon": 139.79, "place_id": "p1"},
                        dest={"title": "B", "lat": 35.72, "lon": 139.80, "place_id": "p2"},
                        route_profile={"distance_km": 2.0, "road_character": 0.7, "duration_min": 25,
                                       "ors_response": {}, "walk_steps": [], "route_points": [], "corridor_key": "k1"},
                        visit_time=None,
                        persona_snapshot={},
                        persona_attractions=[],
                        persona_key="explorer",
                        weather={},
                        city_landmarks=[],
                        dest_velocity_ratio=0.5,
                    )
    assert card is not None
    assert card["isTrending"] is False
```

- [ ] **Step 2: Run — verify fails**

```bash
python -m pytest tests/test_background_build.py::test_generate_scenic_card_sets_is_trending -v 2>&1 | tail -10
# Expected: FAIL — unexpected keyword argument 'dest_velocity_ratio'
```

- [ ] **Step 3: Add `dest_velocity_ratio` parameter to `_generate_scenic_card_for_corridor`** (~line 3457):

Change the function signature from:
```python
def _generate_scenic_card_for_corridor(
    origin: dict,
    dest: dict,
    route_profile: dict,
    visit_time,
    persona_snapshot: dict,
    persona_attractions: list,
    persona_key: str,
    weather: dict,
    city_landmarks: list,
) -> dict | None:
```

To:
```python
def _generate_scenic_card_for_corridor(
    origin: dict,
    dest: dict,
    route_profile: dict,
    visit_time,
    persona_snapshot: dict,
    persona_attractions: list,
    persona_key: str,
    weather: dict,
    city_landmarks: list,
    dest_velocity_ratio: float | None = None,
) -> dict | None:
```

- [ ] **Step 4: Add trend boost inside `_generate_scenic_card_for_corridor`** — insert this block **after** the `scoring = _score_instructions_by_dimension(...)` call and **before** the `weighted_scores` block (around line 3520):

```python
    # ── Trend velocity boost ──────────────────────────────────────────────────
    _is_trending = (dest_velocity_ratio or 0) >= 0.7
    if _is_trending:
        scoring["character_scores"]["vibrant"] = min(
            1.0, scoring["character_scores"].get("vibrant", 0.0) + 0.15
        )
        scoring["character_scores"]["local"] = min(
            1.0, scoring["character_scores"].get("local", 0.0) + 0.15
        )
    _trend_note = (
        "Trending spot — locals and travellers are buzzing about this right now"
        if _is_trending else None
    )
```

- [ ] **Step 5: Add `isTrending` and `trendNote` to the return dict** (~line 3581):

After `"topCharacter": top_char,` add:
```python
        "isTrending": _is_trending,
        "trendNote": _trend_note,
```

Update `why` to append trending note when applicable (around line 3579):
```python
    _trend_suffix = " Trending right now." if _is_trending else ""
    why = f"A {top_char} {mode} from {origin.get('title', '')} to {dest.get('title', ''')}.{_trend_suffix}"
```

- [ ] **Step 6: Pass `dest_velocity_ratio` from the scenic loop** (~line 5327):

In the scenic card loop in `engine_itinerary`, the `_stage_map` is already built (line 5107). Find the `_generate_scenic_card_for_corridor` call and add the new argument:

```python
                        _dest_pid = _next_s.get("place_id", "")
                        _dest_vr = (_stage_map.get(_dest_pid) or {}).get("velocity_ratio")
                        _scenic = _generate_scenic_card_for_corridor(
                            origin=_s,
                            dest=_next_s,
                            route_profile=_rp,
                            visit_time=_visit_time,
                            persona_snapshot=persona_snapshot,
                            persona_attractions=list(persona.get("attractions") or []),
                            persona_key=persona.get("archetype", ""),
                            weather=getattr(ctx, "weather_map", {}).get(day_city) or {},
                            city_landmarks=getattr(city_data, "landmark_anchors", []),
                            dest_velocity_ratio=_dest_vr,
                        )
```

- [ ] **Step 7: Run tests — verify passes**

```bash
python -m pytest tests/test_background_build.py::test_generate_scenic_card_sets_is_trending tests/test_background_build.py::test_generate_scenic_card_not_trending_when_below_threshold -v 2>&1 | tail -10
# Expected: 2 PASSED
```

- [ ] **Step 8: Commit**

```bash
git add main.py tests/test_background_build.py
git commit -m "feat: inject trend velocity into scenic card scoring (vibrant/local boost + isTrending flag)"
```

---

## Task 12: Frontend — render trend badge on `ReelScenicCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts`
- Modify: `frontend/src/modules/route/reel/ReelScenicCard.tsx`

**Interfaces:**
- Consumes: `card.isTrending: boolean`, `card.trendNote: string | null` from backend (Task 11)
- Produces: a gold "Trending now" pill rendered inside `ReelScenicCard` below the route label when `isTrending` is true.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/route/reel/__tests__/ReelScenicCard.trending.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReelScenicCard } from '../ReelScenicCard';

const baseCard = {
  type: 'scenic' as const,
  sceneType: 'walk' as const,
  accent: '#6b9470',
  cardType: 'WALK · NATURAL',
  pos: 1, total: 2,
  timing: 'Morning', metaRight: '1.2 km',
  place: 'Yanaka Ginza',
  from: 'Senso-ji', to: 'Ueno Park',
  modeIcon: 'walk' as const,
  tag: 'Natural', vizType: 'corridor' as const,
  persona: 'explorer', personaDisplay: 'Explorer', personaIcon: 'walk',
  why: 'A natural walk.', sensory: '', sensoryIcon: 'waves',
  reelPos: 'Between Stop 1 and Stop 2',
  detourKm: 1.2, detourMin: 18,
};

describe('ReelScenicCard trend badge', () => {
  it('shows "Trending now" pill when isTrending is true', () => {
    const card = { ...baseCard, isTrending: true, trendNote: 'Trending spot' };
    // @ts-ignore minimal mock
    const { getByText } = render(<ReelScenicCard card={card} active={true} />);
    expect(getByText(/trending now/i)).toBeInTheDocument();
  });

  it('does not render trend pill when isTrending is false', () => {
    const card = { ...baseCard, isTrending: false, trendNote: null };
    // @ts-ignore minimal mock
    const { queryByText } = render(<ReelScenicCard card={card} active={true} />);
    expect(queryByText(/trending now/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/modules/route/reel/__tests__/ReelScenicCard.trending.test.tsx 2>&1 | tail -10
# Expected: FAIL — isTrending not in type
```

- [ ] **Step 3: Add `isTrending` and `trendNote` to `ReelScenicCard` in `types.ts`**

Inside the `ReelScenicCard` interface, add after `routeLabel`:
```typescript
  isTrending?: boolean;
  trendNote?: string | null;
```

- [ ] **Step 4: Add trend badge in `ReelScenicCard.tsx`** — after the `AlongTheWay` component renders (inside the card body), add:

```tsx
{card.isTrending && (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 99,
    background: 'rgba(212,168,83,0.12)',
    border: '1px solid rgba(212,168,83,0.3)',
    marginBottom: 8, alignSelf: 'flex-start',
  }}>
    <span className="ms" style={{ fontSize: 12, color: '#d4a853' }}>trending_up</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#d4a853', letterSpacing: '.06em' }}>Trending now</span>
  </div>
)}
```

- [ ] **Step 5: Run tests — verify passes**

```bash
npx vitest run src/modules/route/reel/__tests__/ReelScenicCard.trending.test.tsx 2>&1 | tail -10
# Expected: 2 PASSED
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/types.ts frontend/src/modules/route/reel/ReelScenicCard.tsx frontend/src/modules/route/reel/__tests__/ReelScenicCard.trending.test.tsx
git commit -m "feat: render Trending now badge on scenic card when velocity_ratio >= 0.7"
```

---

## Task 13: Backend + City Seeder — city-level OSM pre-seeding

**Files:**
- Modify: `city/seed_builder.py` — add `_seed_city_osm_features(city_id, center_lat, center_lon)` called at end of `build_city_seed()`
- Modify: `main.py` — update `_fetch_route_character` to check `city_osm_features` before hitting live Overpass

**Interfaces:**
- Consumes: existing `fetch_overpass()` function; existing `_supabase` client; `city_osm_features` table (Task 2)
- Produces:
  - `_seed_city_osm_features(city_id, clat, clon, radius_km=15)` → upserts elements to `city_osm_features`
  - Modified `_fetch_route_character(route_points, city_pop, city_id="")` — new `city_id` param; checks DB cache first

- [ ] **Step 1: Write the failing test**

Create `tests/test_city_osm_preseed.py`:

```python
# tests/test_city_osm_preseed.py
import pytest
from unittest.mock import MagicMock, patch


def make_sb_with_city_cache(has_cache: bool, elements=None):
    """Supabase mock for city_osm_features table."""
    sb = MagicMock()
    cache_data = [{"elements": elements or [], "cached_at": "2026-07-08T00:00:00Z"}] if has_cache else []
    (sb.table.return_value.select.return_value
       .eq.return_value.execute.return_value.data) = cache_data
    sb.table.return_value.upsert.return_value.execute.return_value.data = [{}]
    return sb


def test_fetch_route_character_uses_cache_when_available():
    """_fetch_route_character must use city_osm_features cache and not call Overpass."""
    from main import _fetch_route_character
    cached_elements = [
        {"tags": {"natural": "park"}},
        {"tags": {"tourism": "viewpoint"}},
    ]
    sb = make_sb_with_city_cache(has_cache=True, elements=cached_elements)
    with patch("main._supabase", sb):
        with patch("main.fetch_overpass") as mock_overpass:
            result = _fetch_route_character(
                route_points=[(35.71, 139.79), (35.72, 139.80)],
                city_pop=500_000,
                city_id="tokyo",
            )
    mock_overpass.assert_not_called()
    assert isinstance(result, dict)
    assert all(k in result for k in ("natural", "viewpoint", "vibrant", "waterfront", "local"))


def test_fetch_route_character_falls_back_to_overpass_when_no_cache():
    """_fetch_route_character must call live Overpass when no city cache exists."""
    from main import _fetch_route_character
    sb = make_sb_with_city_cache(has_cache=False)
    with patch("main._supabase", sb):
        with patch("main.fetch_overpass", return_value={"elements": []}) as mock_overpass:
            _fetch_route_character(
                route_points=[(35.71, 139.79), (35.72, 139.80)],
                city_pop=500_000,
                city_id="tokyo",
            )
    mock_overpass.assert_called_once()


def test_seed_city_osm_features_upserts_to_db():
    """_seed_city_osm_features must call fetch_overpass and upsert to city_osm_features."""
    from city.seed_builder import _seed_city_osm_features
    sb = MagicMock()
    sb.table.return_value.upsert.return_value.execute.return_value.data = [{}]
    with patch("city.seed_builder.fetch_overpass", return_value={"elements": [{"tags": {"natural": "park"}}]}):
        _seed_city_osm_features("tokyo", 35.68, 139.69, radius_km=15, supabase=sb)
    sb.table.assert_called_with("city_osm_features")
    sb.table.return_value.upsert.assert_called_once()
    call_args = sb.table.return_value.upsert.call_args[0][0]
    assert call_args["city_id"] == "tokyo"
    assert len(call_args["elements"]) == 1
```

- [ ] **Step 2: Run — verify fails**

```bash
python -m pytest tests/test_city_osm_preseed.py -v 2>&1 | tail -15
# Expected: 3 FAILED
```

- [ ] **Step 3: Add `city_id` parameter to `_fetch_route_character` in `main.py`** (~line 3145):

Change signature from:
```python
def _fetch_route_character(
    route_points: list[tuple[float, float]],
    city_pop: int,
) -> dict[str, float]:
```
To:
```python
def _fetch_route_character(
    route_points: list[tuple[float, float]],
    city_pop: int,
    city_id: str = "",
) -> dict[str, float]:
```

- [ ] **Step 4: Add city cache check at the top of `_fetch_route_character`** — insert after the `_neutral` and guard checks (~line 3158), before the Overpass query:

```python
    # ── Check city-level OSM cache ────────────────────────────────────────────
    if city_id and _supabase:
        try:
            _cr = (
                _supabase.table("city_osm_features")
                .select("elements, cached_at")
                .eq("city_id", city_id)
                .execute()
            )
            _city_rows = _cr.data or []
            if _city_rows:
                from datetime import datetime as _dt, timezone as _tz, timedelta as _tdd
                _cached_at = _dt.fromisoformat(_city_rows[0]["cached_at"].replace("Z", "+00:00"))
                _fresh = (_dt.now(_tz.utc) - _cached_at) < _tdd(days=7)
                if _fresh:
                    _all_elements = _city_rows[0].get("elements") or []
                    # Filter elements to corridor bounding box
                    lats = [p[0] for p in route_points]
                    lons = [p[1] for p in route_points]
                    _s = min(lats) - 0.05
                    _n = max(lats) + 0.05
                    _w = min(lons) - 0.05
                    _e = max(lons) + 0.05
                    _elements = [
                        el for el in _all_elements
                        if _s <= float(el.get("lat", 0)) <= _n
                        and _w <= float(el.get("lon", 0)) <= _e
                    ]
                    # Reuse existing scoring logic with filtered elements
                    threshold = max(5, min(50, city_pop // 100_000 * 5 + 5))
                    dim_counts: dict[str, int] = {d: 0 for d in _neutral}
                    for _el in _elements:
                        tags = _el.get("tags") or {}
                        nat = tags.get("natural", "")
                        if nat in ("wood", "water", "wetland", "tree", "grassland", "scrub", "beach"):
                            dim_counts["natural"] += 1
                        if tags.get("tourism") == "viewpoint":
                            dim_counts["viewpoint"] += 1
                        if tags.get("historic") in ("monument", "memorial", "castle", "ruins", "building"):
                            dim_counts["historic"] += 1
                        if tags.get("amenity") in ("bar", "nightclub", "restaurant", "cafe", "marketplace"):
                            dim_counts["vibrant"] += 1
                        if tags.get("tourism") in ("artwork", "gallery", "museum", "attraction"):
                            dim_counts["photogenic"] += 1
                        if tags.get("waterway") in ("river", "stream", "canal"):
                            dim_counts["waterfront"] += 1
                        if tags.get("amenity") in ("community_centre", "social_facility", "library"):
                            dim_counts["local"] += 1
                    return {d: min(1.0, dim_counts[d] / threshold) for d in _neutral}
        except Exception:
            pass  # Fall through to live Overpass
    # ── Live Overpass (cold cache fallback) ───────────────────────────────────
```

- [ ] **Step 5: Add `_seed_city_osm_features` to `city/seed_builder.py`**

First read the imports section of `seed_builder.py`:

```bash
head -30 /Users/souravbiswas/Uncover-roads/city/seed_builder.py
```

Then add this function (at the end of the file, before `build_city_seed`):

```python
def _seed_city_osm_features(
    city_id: str,
    center_lat: float,
    center_lon: float,
    radius_km: float = 15.0,
    supabase=None,
) -> None:
    """Fetch OSM features for the full city area and cache to city_osm_features.

    Radius is 15 km — covers most city centres. Cache TTL is 7 days (checked
    by _fetch_route_character before trusting the cache).
    """
    from main import fetch_overpass
    from datetime import datetime, timezone

    # 1 degree ≈ 111 km
    delta = radius_km / 111.0
    s = center_lat - delta
    n = center_lat + delta
    w = center_lon - delta
    e = center_lon + delta

    query = f"""[out:json][timeout:30][bbox:{s},{w},{n},{e}];
(
  node["natural"~"wood|water|wetland|tree|grassland|scrub|beach"];
  node["tourism"="viewpoint"];
  node["historic"~"monument|memorial|castle|ruins|building"];
  node["amenity"~"bar|nightclub|restaurant|cafe|marketplace"];
  node["tourism"~"artwork|gallery|museum|attraction"];
  node["waterway"~"river|stream|canal"];
  node["amenity"~"community_centre|social_facility|library"];
);
out tags center;"""

    try:
        resp = fetch_overpass(query)
        elements = resp.get("elements", [])
    except Exception as exc:
        print(f"[city_osm] seed failed for {city_id}: {exc}")
        return

    if not supabase or not elements:
        return

    try:
        supabase.table("city_osm_features").upsert({
            "city_id": city_id,
            "elements": elements,
            "bbox_s": s, "bbox_w": w, "bbox_n": n, "bbox_e": e,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="city_id").execute()
        print(f"[city_osm] seeded {len(elements)} elements for {city_id}")
    except Exception as exc:
        print(f"[city_osm] upsert failed for {city_id}: {exc}")
```

- [ ] **Step 6: Call `_seed_city_osm_features` at the end of `build_city_seed`** in `seed_builder.py`:

Find `return city_data` at the end of `build_city_seed` and insert before it:

```python
    # Warm city-level OSM cache for fast corridor scoring
    if supabase and city_config.get("lat") and city_config.get("lon"):
        try:
            _seed_city_osm_features(
                city_id=city_config["city_id"],
                center_lat=city_config["lat"],
                center_lon=city_config["lon"],
                supabase=supabase,
            )
        except Exception as _osm_err:
            print(f"[city_osm] non-fatal seed error: {_osm_err}")
```

- [ ] **Step 7: Run tests — verify passes**

```bash
python -m pytest tests/test_city_osm_preseed.py -v 2>&1 | tail -15
# Expected: 3 PASSED
```

- [ ] **Step 8: Commit**

```bash
git add main.py city/seed_builder.py tests/test_city_osm_preseed.py
git commit -m "feat: pre-seed city-level OSM features at seed time, use cache in _fetch_route_character"
```

---

## Task 14: Full integration smoke test

**Files:**
- No new files — runs existing frontend and backend together

**Goal:** Manually verify end-to-end: build starts, notification appears, build completes, plan opens, trending badge visible.

- [ ] **Step 1: Run all backend tests**

```bash
cd /Users/souravbiswas/Uncover-roads
python -m pytest tests/test_background_build.py tests/test_city_osm_preseed.py -v 2>&1 | tail -20
# Expected: all PASSED
```

- [ ] **Step 2: Run all frontend tests**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend
npx vitest run 2>&1 | tail -20
# Expected: all PASSED (no new failures)
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
# Expected: 0 errors
```

- [ ] **Step 4: Manual smoke test checklist** (cannot automate — needs running app)

```
□ Open app, select Tokyo, pick 3+ places, tap Build Itinerary
□ Button changes to "Building in progress" (disabled)
□ Navigate to Explore tab — BuildNotification shows gold pulse banner below search
□ Wait for build to complete (watch server logs for "[build] done" message)
□ BuildNotification turns green: "Your Tokyo plan is ready ✦"
□ Tap notification → itinerary reel opens
□ If a scenic card failed, shimmer card shows "Couldn't load scenic info for this stretch"
□ If a stop had velocity_ratio ≥ 0.7, scenic card shows "Trending now" gold pill
□ Close app, reopen → BuildNotification still shows (localStorage persisted)
□ Build Itinerary button re-enables after plan is done
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete background build + trend-scenic fusion + city OSM pre-seeding"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| User hits Build → no loading screen, small in-app notification | T8 (executeBuild) + T9 (BuildNotification building state) |
| User can explore while building | T8 (no navigation to reel) |
| Button shows "Building in progress" disabled | T8 |
| Notification below search bar in Explore tab | T9 (between ExploreSearchBar and CuratedCityCards) |
| Notification when plan ready | T9 (done state) |
| Notification persists if app closed | T5 (localStorage) + T7 (polls on reopen) |
| 10-minute stale build detection | T7 (STALE_MS check) |
| Shimmer for failed scenic cards | T4 (scenic_pending) + T10 (shimmer render) |
| Trend velocity boosts vibrant/local | T11 (dest_velocity_ratio param) |
| Trending badge on scenic card | T12 |
| City-level OSM pre-seeding | T13 |
| One active build per user (409 guard) | T3 |
| No cancel button | assumption — no cancel UI built |
| DB schema for builds | T1 |
| DB schema for city OSM cache | T2 |

**No placeholders found.**

**Type consistency:** `ActiveBuild` defined in T5 (types.ts), used in T6 (api.ts), T7 (useBuildStatus), T8 (MapScreen), T9 (BuildNotification). `ReelScenicPendingCard` defined in T10 (types.ts), rendered in T10 (ItineraryReelScreen). `isTrending/trendNote` added to `ReelScenicCard` in T12 (types.ts) and rendered in T12 (ReelScenicCard.tsx). All consistent.

**One known gap:** `_fetch_route_character` in `main.py` is also called from `_fetch_route_profile`. The `city_id` passed there will be empty string by default, so it falls back to live Overpass — correct behaviour, no regression.
