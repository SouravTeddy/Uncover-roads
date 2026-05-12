# Phase 1 Additions: Behavior Capture & Security Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend JWT auth, subscription enforcement, per-route rate limiting, PostHog + Supabase behavior capture, and a frontend `useTrack` hook.

**Architecture:** All security checks live in `main.py` as FastAPI dependencies. Behavior events route through `POST /api/events` — the backend writes to Supabase `user_events` and forwards to PostHog server-side. The frontend never contacts PostHog directly. Subscription status is checked live from Supabase on every protected request — no caching.

**Tech Stack:** FastAPI, Supabase Python client, posthog Python SDK, React, TypeScript.

**Depends on:** Phase 1 core complete (keys rotated, CORS locked, `.env` removed from git).

**Working directory:** `/Users/souravbiswas/uncover-roads`

**Baseline:** All existing tests passing. Run `cd frontend && npx vitest run` before starting.

---

## File Map

```
Modified:
  main.py                                          → add JWT dep, subscription dep, rate limiter, events endpoint
  requirements.txt                                 → add posthog, PyJWT

Created:
  frontend/src/hooks/useTrack.ts                   → fire-and-forget event tracker hook
  frontend/src/hooks/useTrack.test.ts              → tests

New Supabase migrations (run in Supabase SQL editor):
  migration: create user_subscriptions table
  migration: create user_events table (if not already created from master plan)
```

---

## Task 1: Supabase migrations

**Files:**
- Run in Supabase SQL editor (dashboard → SQL editor → New query)

- [ ] **Step 1: Run user_subscriptions migration**

```sql
-- User subscription status (source of truth for backend enforcement)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'free'
    CHECK (status IN ('free', 'pack', 'pro', 'unlimited')),
  pack_trips_remaining INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS — only service role can write
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "user reads own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Insert a free row on new user signup (trigger)
CREATE OR REPLACE FUNCTION create_free_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, status)
  VALUES (NEW.id, 'free')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_free_subscription();
```

- [ ] **Step 2: Run user_events migration**

```sql
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_events_user_type
  ON user_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS user_events_created
  ON user_events (created_at);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Only service role writes; users cannot read raw events
```

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor — confirm `user_subscriptions` and `user_events` appear.

- [ ] **Step 4: Commit migration notes**

```bash
mkdir -p /Users/souravbiswas/uncover-roads/supabase/migrations
cat > /Users/souravbiswas/uncover-roads/supabase/migrations/20260430_user_subscriptions.sql << 'EOF'
-- See full SQL in Supabase dashboard — applied 2026-04-30
-- Tables: user_subscriptions, user_events
EOF

git add supabase/
git commit -m "infra: add user_subscriptions and user_events migration notes"
```

---

## Task 2: Install PostHog and update requirements

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Add posthog to requirements.txt**

Open `/Users/souravbiswas/uncover-roads/requirements.txt` and add:
```
posthog>=3.0.0
```

- [ ] **Step 2: Install locally**

```bash
cd /Users/souravbiswas/uncover-roads
pip install posthog
```

Expected: `Successfully installed posthog-x.x.x`

- [ ] **Step 3: Add POSTHOG env vars to .env.example**

Open `/Users/souravbiswas/uncover-roads/.env.example` and add:
```
POSTHOG_API_KEY=phc_your_posthog_project_api_key
POSTHOG_HOST=https://app.posthog.com
```

- [ ] **Step 4: Commit**

```bash
git add requirements.txt .env.example
git commit -m "infra: add posthog dependency"
```

---

## Task 3: Add JWT auth dependency to main.py

**Files:**
- Modify: `main.py`

The backend currently has no user auth. This adds a FastAPI dependency that validates Supabase JWTs and returns the authenticated user. Protected endpoints declare `user = Depends(get_current_user)`.

- [ ] **Step 1: Add imports at the top of main.py**

After the existing imports block, add:

```python
from fastapi import Depends, Header
from typing import Optional
```

- [ ] **Step 2: Add get_current_user dependency**

After the `_supabase` initialisation block (around line 51), add:

```python
# ── Auth ─────────────────────────────────────────────────────────────────────

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Extract and validate Supabase JWT. Raises 401 if missing or invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_token")
    if not _supabase:
        raise HTTPException(status_code=503, detail="database_unavailable")
    token = authorization.split(" ")[1]
    try:
        response = _supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="invalid_token")
        return response.user
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
```

- [ ] **Step 3: Manual test — start the server**

```bash
cd /Users/souravbiswas/uncover-roads
uvicorn main:app --reload --port 8000
```

Expected: server starts without errors.

- [ ] **Step 4: Verify the dependency doesn't break existing endpoints**

```bash
curl http://localhost:8000/health 2>/dev/null || curl http://localhost:8000/
```

Existing unprotected endpoints should still respond normally. Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat(auth): add get_current_user JWT dependency"
```

---

## Task 4: Add subscription enforcement dependency

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add require_pro dependency after get_current_user**

```python
async def require_pro(user=Depends(get_current_user)):
    """Raises 403 if user does not have pro or unlimited subscription."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="database_unavailable")
    result = (
        _supabase.table("user_subscriptions")
        .select("status, expires_at")
        .eq("user_id", str(user.id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="subscription_required")
    sub = result.data
    if sub["status"] not in ("pro", "unlimited"):
        raise HTTPException(status_code=403, detail="subscription_required")
    if sub.get("expires_at") and sub["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=403, detail="subscription_expired")
    return user


async def require_auth_or_pack(user=Depends(get_current_user)):
    """Requires login + either pro/unlimited or remaining pack trips."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="database_unavailable")
    result = (
        _supabase.table("user_subscriptions")
        .select("status, pack_trips_remaining, expires_at")
        .eq("user_id", str(user.id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="subscription_required")
    sub = result.data
    if sub["status"] in ("pro", "unlimited"):
        if sub.get("expires_at") and sub["expires_at"] < datetime.now(timezone.utc).isoformat():
            raise HTTPException(status_code=403, detail="subscription_expired")
        return user
    if sub["status"] == "pack" and sub.get("pack_trips_remaining", 0) > 0:
        return user
    raise HTTPException(status_code=403, detail="subscription_required")
```

- [ ] **Step 2: Apply require_auth_or_pack to the itinerary generation endpoint**

Find the itinerary generation route in `main.py` (search for `def generate` or similar). Add the dependency:

```python
# Before (example — match the actual function signature):
@app.post("/api/generate")
async def generate_itinerary(request: Request):

# After:
@app.post("/api/generate")
async def generate_itinerary(request: Request, user=Depends(require_auth_or_pack)):
```

Apply `require_auth_or_pack` to any endpoint that generates itineraries or accesses premium features. Leave public endpoints (autocomplete, place details, health) unchanged.

- [ ] **Step 3: Commit**

```bash
git add main.py
git commit -m "feat(auth): add subscription enforcement dependencies"
```

---

## Task 5: Replace IP rate limiting with per-user per-route limiting

**Files:**
- Modify: `main.py`

The existing `_rate_limit` dict applies a single limit to all Google Places calls per IP. Replace with a per-user, per-route-group system.

- [ ] **Step 1: Add the new rate limiter after the existing _rate_limit block**

```python
# ── Per-user rate limiting ────────────────────────────────────────────────────

from collections import defaultdict

_user_rate_buckets: dict[str, list[float]] = defaultdict(list)

RATE_LIMITS: dict[str, tuple[int, int]] = {
    # route_group: (max_requests, window_seconds)
    "auth":      (10,  60),
    "search":    (30,  60),
    "itinerary": (20,  60),
    "events":    (100, 60),
    "default":   (60,  60),
}


def check_user_rate_limit(user_id: str, route_group: str) -> None:
    """Raises 429 if user exceeds the rate limit for this route group."""
    max_req, window = RATE_LIMITS.get(route_group, RATE_LIMITS["default"])
    key = f"{user_id}:{route_group}"
    now = _time()
    bucket = _user_rate_buckets[key]
    # Evict timestamps outside the window
    _user_rate_buckets[key] = [t for t in bucket if now - t < window]
    if len(_user_rate_buckets[key]) >= max_req:
        raise HTTPException(
            status_code=429,
            detail="rate_limit_exceeded",
            headers={"Retry-After": str(window)},
        )
    _user_rate_buckets[key].append(now)
```

- [ ] **Step 2: Apply rate limiting in protected endpoints**

In the itinerary generation endpoint and any other protected route, call rate check at the top:

```python
@app.post("/api/generate")
async def generate_itinerary(request: Request, user=Depends(require_auth_or_pack)):
    check_user_rate_limit(str(user.id), "itinerary")
    # ... rest of handler
```

- [ ] **Step 3: Commit**

```bash
git add main.py
git commit -m "feat(security): add per-user per-route rate limiting"
```

---

## Task 6: Add PostHog initialisation and POST /api/events endpoint

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add PostHog initialisation after the existing env var block**

```python
import posthog as _posthog

_POSTHOG_KEY  = os.getenv("POSTHOG_API_KEY", "")
_POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://app.posthog.com")

if _POSTHOG_KEY:
    _posthog.api_key = _POSTHOG_KEY
    _posthog.host    = _POSTHOG_HOST
    _posthog.on_error = lambda error, items: None  # fail silently


def _ph_capture(user_id: str, event: str, props: dict) -> None:
    """Fire-and-forget PostHog event. Never raises."""
    if not _POSTHOG_KEY:
        return
    try:
        _posthog.capture(distinct_id=user_id, event=event, properties=props)
    except Exception:
        pass
```

- [ ] **Step 2: Add the events endpoint**

```python
@app.post("/api/events", status_code=204)
async def track_event(request: Request, user=Depends(get_current_user)):
    """Receive behavioral events from frontend. Writes to Supabase + PostHog."""
    check_user_rate_limit(str(user.id), "events")
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=204)

    event_type = str(body.get("event_type", ""))[:64]
    session_id = str(body.get("session_id", ""))[:64]
    payload    = body.get("payload", {})

    if not event_type:
        return Response(status_code=204)

    # Write to Supabase (persona drift signals)
    if _supabase:
        try:
            _supabase.table("user_events").insert({
                "user_id":    str(user.id),
                "session_id": session_id,
                "event_type": event_type,
                "payload":    payload,
            }).execute()
        except Exception:
            pass

    # Forward to PostHog (product analytics)
    _ph_capture(str(user.id), event_type, payload)

    return Response(status_code=204)
```

- [ ] **Step 3: Start server and test the endpoint manually**

```bash
cd /Users/souravbiswas/uncover-roads
uvicorn main:app --reload --port 8000
```

In a second terminal (with a valid Supabase JWT in `$TOKEN`):

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"pin_saved","session_id":"test-123","payload":{"place_id":"abc"}}'
```

Expected: `204`

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat(events): add POST /api/events with PostHog + Supabase writes"
```

---

## Task 7: Add useTrack hook to frontend

**Files:**
- Create: `frontend/src/hooks/useTrack.ts`
- Create: `frontend/src/hooks/useTrack.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useTrack.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTrack } from './useTrack'

// Mock supabase
vi.mock('../shared/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}))

describe('useTrack', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    )
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('calls POST /api/events with correct shape', async () => {
    const { result } = renderHook(() => useTrack())
    await act(async () => {
      result.current.track('pin_saved', { place_id: 'abc' })
      // allow microtasks to flush
      await new Promise(r => setTimeout(r, 10))
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8000/api/events')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body.event_type).toBe('pin_saved')
    expect(body.payload).toEqual({ place_id: 'abc' })
    expect(typeof body.session_id).toBe('string')
  })

  it('does not throw when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useTrack())
    await expect(
      act(async () => {
        result.current.track('pin_saved', {})
        await new Promise(r => setTimeout(r, 10))
      })
    ).resolves.not.toThrow()
  })

  it('does nothing when no session', async () => {
    const { supabase } = await import('../shared/supabase')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })
    const { result } = renderHook(() => useTrack())
    await act(async () => {
      result.current.track('pin_saved', {})
      await new Promise(r => setTimeout(r, 10))
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/hooks/useTrack.test.ts
```

Expected: `FAIL` — `useTrack` not found.

- [ ] **Step 3: Create the hook**

Create `frontend/src/hooks/useTrack.ts`:

```typescript
import { useCallback } from 'react'
import { supabase } from '../shared/supabase'

// Stable session ID for this browser session — survives re-renders
const SESSION_ID = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

export function useTrack() {
  const track = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (!token) return

        fetch(`${import.meta.env.VITE_API_URL}/api/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event_type: eventType,
            session_id: SESSION_ID,
            payload,
          }),
        }).catch(() => {}) // fire and forget — never block the UI
      })
    },
    []
  )

  return { track }
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/hooks/useTrack.test.ts
```

Expected: `PASS` — 3 tests passing.

- [ ] **Step 5: Run full test suite — verify no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all existing tests still passing + 3 new.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useTrack.ts frontend/src/hooks/useTrack.test.ts
git commit -m "feat(tracking): add useTrack hook — fire-and-forget event pipeline"
```

---

## Task 8: Wire track calls to key interaction points

**Files:**
- Modify: whichever map/itinerary/persona components handle pin saves, dismissals, itinerary edits, persona retake. Exact files depend on Phase 4 map rebuild — add these calls as part of that phase using the hook below.

This task is a **checklist** to ensure every signal gets instrumented. Add `useTrack` and call `track(...)` at each point:

- [ ] **Pin viewed** — when pin card opens
  ```typescript
  track('pin_viewed', { place_id: pin.id, stage: pin.stage, category: pin.category })
  ```

- [ ] **Pin saved** — when heart button tapped
  ```typescript
  track('pin_saved', { place_id: pin.id, stage: pin.stage, category: pin.category })
  ```

- [ ] **Pin dismissed** — when user explicitly closes/skips a pin card
  ```typescript
  track('pin_dismissed', { place_id: pin.id, stage: pin.stage, category: pin.category })
  ```

- [ ] **Itinerary stop removed** — when user swipes out a stop
  ```typescript
  track('itinerary_stop_removed', {
    place_id: stop.place_id,
    category: stop.category,
    engine_suggested: stop.engine_suggested,
  })
  ```

- [ ] **Itinerary stop added** — when user taps "Add to itinerary"
  ```typescript
  track('itinerary_stop_added', { place_id: stop.place_id, category: stop.category })
  ```

- [ ] **Engine message dismissed** — when user taps X on a banner
  ```typescript
  track('engine_message_dismissed', { message_type: message.type })
  ```

- [ ] **Engine message acted on** — when user taps the action CTA on a banner
  ```typescript
  track('engine_message_acted', { message_type: message.type })
  ```

- [ ] **Discovery mode changed** — when toggle switches between deep/mainstream
  ```typescript
  track('discovery_mode_changed', { from: prev, to: next })
  ```

- [ ] **Persona retake started** — when retake button tapped on PersonaScreen
  ```typescript
  track('persona_retake_started', {})
  ```

- [ ] **City searched** — when user submits a city search
  ```typescript
  track('city_searched', { city_id: city.id, tier: city.tier })
  ```

- [ ] **Final commit after all wired up**

```bash
git add -p  # stage only the tracking call additions
git commit -m "feat(tracking): wire behavioral event calls across app"
```
