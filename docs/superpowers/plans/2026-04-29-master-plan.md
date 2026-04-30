# Uncover Roads — Complete Rebuild Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the complete Uncover Roads app from broken state to a production-ready, Play Store-submittable travel intelligence app.

**Architecture:** React + TypeScript frontend (Vite), Python FastAPI backend (Railway), Supabase for persistence, MapLibre for maps, Claude API for LLM narration. The intelligence engine is a deterministic 5-layer math system — LLM only narrates decisions, never makes them.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, MapLibre GL, Supabase, FastAPI, Anthropic Claude API, Google Places API, YouTube Data API v3, Reddit API, Vitest, PWA/TWA for Play Store.

---

## Spec Documents (read before implementing)

All specs live in `docs/superpowers/specs/`:

| File | What it covers |
|---|---|
| `2026-04-29-map-ui-full-rebuild-design.md` | Complete UX flow, all screens, state changes, component list |
| `2026-04-29-city-intelligence-engine.md` | City data model, dynamic freshness system, data sources, signal processing |

**Read all specs before starting any phase.**

### April 30 additions (read for Phases 1, 2, 5)

The following design decisions were added on 2026-04-30 and supersede earlier Phase 2 and Phase 5 descriptions where they conflict:

1. **OB Visual Journey** — Phase 2 is a full redesign, not an expansion. New question sequence, layered illustration system, persona reveal with surprise + recognition mechanic. See architecture decisions below.
2. **Behavior Capture** — Added to Phase 1. PostHog (product analytics) + Supabase `user_events` (persona drift signals). See architecture decisions below.
3. **City Whitelist + Pre-seeding** — Added to Phase 5. Tourist city list sourced from GeoNames + Google Places filter (~1,200–1,500 cities), pre-seeded before launch. Search restricted to whitelist. See architecture decisions below.
4. **Security Hardening** — Added to Phase 1. Backend subscription middleware on all premium endpoints, JWT hardening, rate limiting. Frontend never controls access. See architecture decisions below.
5. **Phase 7 is pre-launch** — Destination screen + multi-city flow ships before launch, not post.

---

## Phase Overview

| Phase | Plan file | What it builds | Depends on |
|---|---|---|---|
| **Phase 1** | `2026-04-29-phase1-security-infra.md` | Security fixes, backend deployment, PWA shell, **behavior capture pipeline, subscription middleware, rate limiting** | Nothing |
| **Phase 2** | `2026-04-29-phase2-ob-persona.md` | **OB visual journey redesign** (new sequence, layered illustrations, persona reveal — surprise + recognition), engine weight vector | Phase 1 |
| **Phase 3** | `2026-04-29-phase3-types-state.md` | New TypeScript types, state actions, store expansion | Phase 1 |
| **Phase 4** | `2026-04-29-phase4-map-rebuild.md` | Full map screen rebuild (3 pin layers, pin card, Surprise Me) | Phase 3 |
| **Phase 5** | `2026-04-29-phase5-intelligence-engine.md` | Backend intelligence engine (5 layers), city data model, dynamic freshness | Phase 1 |
| **Phase 6** | `2026-04-29-phase6-itinerary-rebuild.md` | Itinerary screen rebuild, engine message banners, swipe-to-remove | Phases 4 & 5 |
| **Phase 7** | `2026-04-29-phase7-destination-multicity.md` | Destination screen, multi-city flow, city-hop animation | Phase 4 |
| **Phase 8** | `2026-04-29-phase8-saved-places.md` | Saved places screen, bottom nav update | Phase 4 |
| **Phase 9** | `2026-04-29-phase9-security-testing.md` | Security audit, penetration testing, Play Store submission | All phases |

---

## Critical: Do These First (Before Any Phase)

```bash
# 1. Revoke and remove exposed Ticketmaster key
# Remove from /Users/souravbiswas/uncover-roads/.env
# Revoke at https://developer.ticketmaster.com/

# 2. Rotate Supabase anon key (it was committed to git)
# Go to Supabase dashboard → Settings → API → Regenerate anon key

# 3. Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> /Users/souravbiswas/uncover-roads/frontend/.gitignore
git rm --cached .env 2>/dev/null || true
git rm --cached frontend/.env 2>/dev/null || true
git add .gitignore frontend/.gitignore
git commit -m "security: remove env files from tracking, rotate exposed keys"
```

---

## Architecture Decisions (locked)

### What's deleted
```
frontend/src/modules/route/ItineraryView.tsx          (1325 lines → delete)
frontend/src/modules/route/ItineraryCards.tsx          (1016 lines → delete)
frontend/src/modules/map/FavoritesLayer.tsx            (215 lines → delete)
frontend/src/modules/route/AmbientVideo.tsx            (→ delete)
frontend/src/modules/map/TravelDateBar.tsx             (586 lines → delete)
frontend/src/modules/map/TripPlanningCard.tsx          (→ delete)
```

### What's rebuilt from scratch
```
frontend/src/modules/map/MapScreen.tsx                 (rebuild — not modify)
frontend/src/modules/route/RouteScreen.tsx             (rebuild — not modify)
frontend/src/modules/persona/PersonaScreen.tsx         (rebuild)
frontend/src/modules/destination/DestinationScreen.tsx (significant update)
```

### What's unchanged
```
frontend/src/modules/login/                            (all auth screens)
frontend/src/modules/navigation/NavScreen.tsx
frontend/src/modules/subscription/SubscriptionScreen.tsx
frontend/src/modules/trips/TripsScreen.tsx             (minor updates only)
frontend/src/shared/api.ts                             (add new endpoints)
frontend/src/shared/supabase.ts
```

### Engine weight vector — all 10 dimensions
```typescript
// Order matters — used for cosine similarity calculation
// [walk, scenic, efficiency, food, culture, nightlife, budget, crowd, spontaneity, rest]
const ARCHETYPE_VECTORS = {
  wanderer:      [0.9, 0.95, 0.2, 0.6, 0.7, 0.4, 0.5, 0.8, 0.97, 0.6],
  historian:     [0.7, 0.6,  0.6, 0.4, 1.0, 0.2, 0.4, 0.7, 0.4,  0.5],
  epicurean:     [0.5, 0.4,  0.5, 1.0, 0.5, 0.6, 0.3, 0.4, 0.6,  0.4],
  pulse:         [0.3, 0.3,  0.8, 0.7, 0.3, 1.0, 0.5, 0.2, 0.5,  0.2],
  slowtraveller: [0.8, 0.8,  0.1, 0.7, 0.6, 0.3, 0.6, 0.9, 0.7,  0.9],
  voyager:       [0.4, 0.5,  0.9, 0.5, 0.6, 0.5, 0.7, 0.3, 0.4,  0.3],
  explorer:      [0.8, 0.7,  0.5, 0.5, 0.6, 0.4, 0.5, 0.5, 0.8,  0.5],
}
```

### Pin visual hierarchy
```
Famous pins     → gold (#f59e0b), star icon, 28px
User-added      → blue (#3b82f6), solid circle, 24px, blue ring
Reference ghost → purple (#8b5cf6), 18px, 50% opacity
Saved badge     → red ❤️ 10px overlaid top-right of any pin
Itinerary ring  → blue 2px border around pin circle
```

### Message format (every engine action)
```typescript
interface EngineMessage {
  type: 'swap'|'insert'|'resequence'|'weather'|'transit'|'advisory'|'event'
  what: string        // "Moved Senso-ji to 8am"
  why: string         // "It closes at 5pm, you'd arrive at 4:30"
  consequence: string // "You now reach Ueno with 3 hours to spare"
  dismissable: boolean
  undo_key?: string
}
```

### OB Visual Journey — question sequence (Phase 2 redesign)

The 9-step OB is restructured into 3 acts. Same questions, new order, new visual system.

**Act 1 — Who you are (identity, easy entry)**
1. Who's coming with you? *(group_type)*
2. What pulls you to travel? *(mood + culture_depth — emotional hook, full-bleed visuals)*

**Act 2 — How you move through the world (physical, values, mindset)**
3. What's your pace in a new city? *(pace + walk_affinity)*
4. What makes a day feel right? *(food_density + nightlife + culture_depth)*
5. How do you feel about crowds? *(crowd_aversion)*
6. Planning or winging it? *(spontaneity)*

**Act 3 — How you close a day (personal, intimate)**
7. How does your evening end? *(nightlife + rest_need)*
8. How do you think about money when you travel? *(budget_sensitivity)*
9. Anything we should know? *(dietary — fast, last)*

**Conditional:** Kid focus shown only if Q1 = `family`. Not a universal question.

**Layered illustration system — 5 composited layers:**
```
Layer 1: Sky          — light quality, time of day
Layer 2: Environment  — urban/nature/coastal/desert
Layer 3: Foreground   — focal object (lantern, camera, wine glass, map)
Layer 4: Colour temp  — warm/cool/electric/muted
Layer 5: Atmosphere   — mist/glow/rain/dappled light
```
Each answer shifts one or more layers. Framer Motion cross-dissolve, 600ms, slight parallax. Background is a running composite of all answers so far — not a static image per question.

**Persona silhouette:** SVG, bottom-right corner. Bare outline at Q1. Gains detail with each answer (bag strap, camera, wine glass, map). Completes on reveal.

**Persona reveal — three beats:**
1. Atmosphere settles to final archetype composition (1.5s, no text)
2. Three trait lines appear — say what the user feels but hasn't said out loud (800ms each, staggered)
3. Archetype name fades in last, large, serif — confirmation after recognition

**Copy principle:** Surprise + recognition. *"You didn't know you were a Wanderer until now."* Not a feature list. A mirror.

---

### Behavior capture — two systems (Phase 1 addition)

**PostHog** (server-side SDK, cloud free tier up to 1M events/month):
- OB funnel drop-off per question
- Session depth, feature usage, conversion
- Frontend never talks to PostHog directly — all events route through backend

**Supabase `user_events`** (persona drift signals only):

| Event | Payload |
|---|---|
| `pin_viewed` | `{place_id, stage, category}` |
| `pin_saved` | `{place_id, stage, category}` |
| `pin_dismissed` | `{place_id, stage, category}` |
| `itinerary_stop_removed` | `{place_id, category, engine_suggested}` |
| `itinerary_stop_added` | `{place_id, category}` |
| `engine_message_dismissed` | `{message_type}` |
| `engine_message_acted` | `{message_type}` |
| `discovery_mode_changed` | `{from, to}` |
| `persona_retake_started` | `{}` |
| `city_searched` | `{city_id, tier}` |

**Backend endpoint:** `POST /api/events` — JWT required, writes to `user_events` + forwards to PostHog. Returns 204. Non-blocking.

**Frontend:** `useTrack()` hook — fire and forget. No error handling in UI.

**Persona drift (V1, post-launch):** Weekly batch job reads `user_events` per user, nudges weight vector ±0.2 from OB baseline max. Slow, bounded. User can reset to OB baseline at any time.

---

### City whitelist + pre-launch seeding (Phase 5 addition)

**City list source:**
1. GeoNames `cities15000` (~26,000 cities)
2. Filter by Wikidata tourism tag → ~4,000 candidates
3. Filter by Google Places API (≥ 10 `tourist_attraction` results) → ~1,200–1,500 cities
4. Result stored in `city_whitelist` table

**Pre-launch seeding:**
- Run on-demand seeding pipeline in batch against full whitelist (minus 80 Tier 1 cities)
- Rate: 20 cities/hour to respect Google Places quota
- Duration: ~55 hours — start 3 days before launch
- Any city not seeded in time stays as on-demand (first search triggers it, 10–15s)

**Search whitelist enforcement:**
- `/api/cities/search` validates against `city_whitelist` — unknown city → 404
- `/api/cities/autocomplete` returns only whitelisted cities — users never hit a wall mid-type
- No on-demand seeding for non-whitelisted cities

**Human review:** Supabase Studio reads `human_review_queue` directly at launch. No custom admin UI needed. `snoozed` status available to batch-defer low-priority flags. Expected volume: ~400 items/month.

---

### Security hardening (Phase 1 addition)

**Core principle:** Frontend never controls access. Backend does, on every request.

**Subscription middleware** — applied before every premium handler:
```python
async def require_pro(user: User = Depends(get_current_user)):
    sub = await supabase.table('subscriptions')
        .select('status, expires_at').eq('user_id', user.id).single().execute()
    if not sub.data or sub.data['status'] != 'active':
        raise HTTPException(403, 'subscription_required')
    if sub.data['expires_at'] < datetime.utcnow():
        raise HTTPException(403, 'subscription_expired')
```
Checked live on every call. No server-side caching of subscription status.

**JWT rules:**
- Access tokens: 1-hour expiry (confirm Supabase default is not extended)
- Refresh token rotation: every refresh issues new token, old one invalidated
- No subscription data in JWT claims — checked from DB, not token
- Use `auth.getUser()` server-side, not `auth.getSession()` (session can be stale)

**Rate limiting:**

| Endpoint group | Limit | Window |
|---|---|---|
| `/api/auth/*` | 10 requests | per minute per IP |
| `/api/cities/search` | 30 requests | per minute per user |
| `/api/itinerary/*` | 20 requests | per minute per user |
| `/api/events` | 100 requests | per minute per user |
| All others | 60 requests | per minute per user |

**Frontend rule:** `isPro` in app state is for UI visibility only (show/hide upgrade prompt). Never used to gate API calls or skip requests. If removing a frontend check would give access to something, that check is in the wrong place.

---

## Supabase Tables Required

Run these migrations before starting Phase 4+:

```sql
-- Place dynamic profiles (City Intelligence Sync writes here weekly)
CREATE TABLE IF NOT EXISTS place_dynamic_profiles (
  place_id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('unknown','hidden_gem','rising','mainstream','oversaturated','declining')),
  freshness_score FLOAT DEFAULT 0,
  crowd_index_current FLOAT DEFAULT 0.5,
  crowd_trend TEXT DEFAULT 'stable',
  signals JSONB DEFAULT '{}',
  stage_history JSONB DEFAULT '[]',
  engine_flags JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Human review queue (City Intelligence Sync creates items here)
CREATE TABLE IF NOT EXISTS human_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  city_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  signals_snapshot JSONB,
  suggested_action TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','snoozed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Country profiles (195 rows, mostly static)
CREATE TABLE IF NOT EXISTS country_profiles (
  code TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- City data (all tiers)
CREATE TABLE IF NOT EXISTS city_data (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT,
  tier INTEGER NOT NULL DEFAULT 3,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- City Intelligence Sync job log
CREATE TABLE IF NOT EXISTS sync_job_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  city_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  items_processed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'
);

-- Behavior capture — persona drift signals (Phase 1 addition)
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_events_user_type ON user_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS user_events_created ON user_events (created_at);

-- City search whitelist (Phase 5 addition)
CREATE TABLE IF NOT EXISTS city_whitelist (
  city_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 2,
  coordinates POINT NOT NULL,
  seeded BOOLEAN DEFAULT FALSE,
  seeded_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS city_whitelist_name ON city_whitelist (name);
CREATE INDEX IF NOT EXISTS city_whitelist_seeded ON city_whitelist (seeded);
```

---

## Environment Variables Reference

### Frontend (`frontend/.env.local` — never commit)
```
VITE_API_URL=https://your-railway-app.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-rotated-anon-key
VITE_GOOGLE_PLACES_KEY=your-google-places-key
```

### Backend (Railway environment variables — never in code)
```
ANTHROPIC_API_KEY=
GOOGLE_PLACES_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
YOUTUBE_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
POSTHOG_API_KEY=
POSTHOG_HOST=https://app.posthog.com
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
PLACE_CACHE_TTL_DAYS=30
```

---

## Testing Strategy

Every phase follows TDD:
1. Write failing test
2. Verify it fails
3. Write minimal implementation
4. Verify it passes
5. Commit

**Test files location:** Mirror source structure under `frontend/src/`
- Source: `frontend/src/modules/map/PinCard.tsx`
- Test: `frontend/src/modules/map/PinCard.test.tsx`

**Run tests:**
```bash
cd frontend && npx vitest run              # all tests
cd frontend && npx vitest run --reporter=verbose  # verbose
cd frontend && npx vitest watch            # watch mode during development
```

**Current baseline:** 649 tests, all passing. Every phase must keep this green.

---

## Definition of Done (per phase)

- [ ] All tests passing (`npx vitest run` shows 0 failures)
- [ ] No TypeScript errors (`npx tsc --noEmit` clean)
- [ ] No ESLint errors (`npx eslint src/` clean)
- [ ] `npm run build` completes without errors
- [ ] Feature works end-to-end in browser
- [ ] Phase plan tasks all checked off
- [ ] Changes committed to git with descriptive messages

---

## Play Store Submission Checklist (Phase 9)

- [ ] PWA manifest.json with correct icons (512x512, 192x192, maskable)
- [ ] Service worker registered, offline fallback page works
- [ ] HTTPS enforced (Vercel provides this)
- [ ] Lighthouse PWA score ≥ 90
- [ ] TWA (Trusted Web Activity) configured in Android project
- [ ] `assetlinks.json` hosted at `/.well-known/assetlinks.json`
- [ ] All security blockers resolved (see Phase 1)
- [ ] CORS locked to production domain
- [ ] No API keys in client-side code
- [ ] Privacy policy URL (required by Play Store)
- [ ] App screenshots (1080x1920, minimum 2)
- [ ] App icon 512x512 PNG
- [ ] Content rating questionnaire completed
