# Phase 1: Security Fixes & Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all security blockers, deploy backend to Railway, configure PWA shell, open auth beyond 1 user.

**Architecture:** No feature changes — pure infrastructure and security hardening. Frontend stays on Vercel, backend moves to Railway (Python FastAPI), Supabase stays as-is with rotated keys.

**Tech Stack:** Railway (backend), Vercel (frontend), Supabase, Vite PWA plugin, Workbox.

---

## Task 1: Remove exposed secrets from git history

**Files:**
- Modify: `.gitignore`
- Modify: `frontend/.gitignore`
- Delete from tracking: `.env`, `frontend/.env`

- [ ] **Step 1: Add env files to gitignore**

```bash
cd /Users/souravbiswas/uncover-roads

# Root .gitignore
cat >> .gitignore << 'EOF'
.env
.env.local
.env.*.local
*.env
EOF

# Frontend .gitignore
cat >> frontend/.gitignore << 'EOF'
.env
.env.local
.env.*.local
EOF
```

- [ ] **Step 2: Remove env files from git tracking (keep local files)**

```bash
git rm --cached .env 2>/dev/null || echo "not tracked"
git rm --cached frontend/.env 2>/dev/null || echo "not tracked"
```

- [ ] **Step 3: Create .env.example files documenting required vars**

Create `/Users/souravbiswas/uncover-roads/.env.example`:
```
# Backend environment variables — copy to .env and fill in values
# NEVER commit .env to git

ANTHROPIC_API_KEY=
GOOGLE_PLACES_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
YOUTUBE_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
PLACE_CACHE_TTL_DAYS=30
PORT=8000
```

Create `/Users/souravbiswas/uncover-roads/frontend/.env.example`:
```
# Frontend environment variables — copy to .env.local and fill in values
# NEVER commit .env.local to git

VITE_API_URL=https://your-railway-app.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_PLACES_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore frontend/.gitignore .env.example frontend/.env.example
git commit -m "security: remove env files from git tracking, add examples"
```

- [ ] **Step 5: Rotate exposed keys (manual — do in browser)**
  - Supabase: Dashboard → Settings → API → Regenerate anon key → update `frontend/.env.local`
  - Ticketmaster: Dashboard → revoke `QGbTU6yeatVgDF6po52Kikjn65DTlf97` → remove from `.env`
  - Google Places: Check if key was exposed — if so, restrict to your domains in Google Cloud Console

---

## Task 2: Fix CORS configuration

**Files:**
- Modify: `main.py` (lines ~20-30, CORS middleware)

- [ ] **Step 1: Write failing test for CORS**

Create `test_cors.py` in project root:
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_cors_rejects_unknown_origin():
    response = client.get(
        "/geocode",
        params={"q": "Tokyo"},
        headers={"Origin": "https://evil-site.com"}
    )
    assert "access-control-allow-origin" not in response.headers or \
           response.headers.get("access-control-allow-origin") != "https://evil-site.com"

def test_cors_accepts_production_origin():
    # Set ALLOWED_ORIGINS env var before this test
    import os
    os.environ["ALLOWED_ORIGINS"] = "https://uncover-roads.vercel.app"
    response = client.get(
        "/geocode",
        params={"q": "Tokyo"},
        headers={"Origin": "https://uncover-roads.vercel.app"}
    )
    assert response.headers.get("access-control-allow-origin") == "https://uncover-roads.vercel.app"
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /Users/souravbiswas/uncover-roads
python -m pytest test_cors.py -v
```
Expected: `test_cors_rejects_unknown_origin` FAIL (currently allows `*`)

- [ ] **Step 3: Fix CORS in main.py**

Find the CORS middleware section (around line 20-30). Replace:
```python
# BEFORE — find this block:
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    ...
)
```

```python
# AFTER:
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# In development with no env var, allow localhost only
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

- [ ] **Step 4: Run test — expect pass**

```bash
ALLOWED_ORIGINS="https://uncover-roads.vercel.app" python -m pytest test_cors.py -v
```
Expected: both tests PASS

- [ ] **Step 5: Commit**

```bash
git add main.py test_cors.py
git commit -m "security: lock CORS to explicit allowed origins, reject wildcard"
```

---

## Task 3: Fix React hooks violation in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx` (line ~87)

- [ ] **Step 1: Find the violation**

```bash
cd frontend
npx eslint src/App.tsx --rule '{"react-hooks/rules-of-hooks": "error"}'
```
Note the line number of the conditional `useEffect`.

- [ ] **Step 2: Read the current App.tsx around the violation**

```bash
sed -n '80,100p' src/App.tsx
```

- [ ] **Step 3: Fix — move condition inside useEffect, not around it**

The pattern to fix:
```typescript
// BROKEN — useEffect called conditionally:
if (someCondition) {
  useEffect(() => { ... }, [])
}

// FIXED — condition inside useEffect:
useEffect(() => {
  if (!someCondition) return
  // ... rest of effect
}, [someCondition])
```

Apply this pattern to whatever the specific violation is at line 87.

- [ ] **Step 4: Verify fix**

```bash
npx eslint src/App.tsx
npx vitest run
```
Expected: 0 ESLint errors, 649 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "fix: resolve conditional useEffect violation in App.tsx"
```

---

## Task 4: Remove beta allowlist, open authentication

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/modules/login/LoginScreen.tsx`

- [ ] **Step 1: Find the allowlist**

```bash
grep -n "sourav\|allowlist\|beta\|whitelist" frontend/src/App.tsx frontend/src/modules/login/LoginScreen.tsx
```

- [ ] **Step 2: Write test for open auth**

Create `frontend/src/modules/login/LoginScreen.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginScreen } from './LoginScreen'

// Mock supabase
vi.mock('../../shared/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null })
    }
  }
}))

describe('LoginScreen', () => {
  it('shows Google sign-in button', () => {
    render(<LoginScreen />)
    expect(screen.getByText(/google/i)).toBeInTheDocument()
  })

  it('does not show beta access denied message for any email', () => {
    render(<LoginScreen />)
    expect(screen.queryByText(/beta/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/not on the list/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test — may fail if allowlist blocks render**

```bash
cd frontend && npx vitest run src/modules/login/LoginScreen.test.tsx
```

- [ ] **Step 4: Remove allowlist from LoginScreen.tsx and App.tsx**

In `LoginScreen.tsx`: delete any array of allowed emails and the check against it.
In `App.tsx`: delete any `if (!allowedEmails.includes(user.email))` guard.

Replace with: let Supabase handle auth. Any authenticated user gets access.

```typescript
// In App.tsx — replace allowlist check with:
// Supabase handles auth. If user is authenticated, they're in.
// No email allowlist needed for public launch.
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd frontend && npx vitest run
```
Expected: 649+ tests passing, no failures

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/modules/login/LoginScreen.tsx \
        frontend/src/modules/login/LoginScreen.test.tsx
git commit -m "feat: open authentication to all users, remove beta allowlist"
```

---

## Task 5: Deploy backend to Railway

**Files:**
- Create: `railway.toml`
- Create: `Procfile` (update)
- Modify: `requirements.txt` (verify it exists and is complete)

- [ ] **Step 1: Verify requirements.txt is complete**

```bash
cd /Users/souravbiswas/uncover-roads
cat requirements.txt
```

Ensure these are present:
```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
anthropic>=0.25.0
httpx>=0.27.0
supabase>=2.4.0
python-dotenv>=1.0.0
pydantic>=2.6.0
```

Add any missing packages: `pip freeze | grep <package> >> requirements.txt`

- [ ] **Step 2: Create railway.toml**

Create `/Users/souravbiswas/uncover-roads/railway.toml`:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

- [ ] **Step 3: Add health check endpoint to main.py**

Find the routes section in `main.py` and add:
```python
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "uncover-roads-api"}
```

- [ ] **Step 4: Test health check locally**

```bash
cd /Users/souravbiswas/uncover-roads
uvicorn main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"uncover-roads-api"}
kill %1
```

- [ ] **Step 5: Create Railway project (manual — in browser)**
  - Go to railway.app → New Project → Deploy from GitHub repo
  - Select `uncover-roads` repo
  - Set root directory to `/` (backend is in root)
  - Add all environment variables from `.env.example`
  - Note the Railway deployment URL (e.g. `https://uncover-roads-api.railway.app`)

- [ ] **Step 6: Update frontend API URL**

In `frontend/.env.local`:
```
VITE_API_URL=https://uncover-roads-api.railway.app
```

- [ ] **Step 7: Verify CORS allows Railway → Vercel**

In Railway environment variables, set:
```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5173
```

- [ ] **Step 8: Commit railway config**

```bash
git add railway.toml main.py
git commit -m "infra: add Railway deployment config and health check endpoint"
```

---

## Task 6: PWA configuration for Play Store submission

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/src/sw.ts` (service worker)
- Modify: `frontend/index.html`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/public/.well-known/assetlinks.json`

- [ ] **Step 1: Install Vite PWA plugin**

```bash
cd frontend
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Create web app manifest**

Create `frontend/public/manifest.json`:
```json
{
  "name": "Uncover Roads",
  "short_name": "Uncover Roads",
  "description": "Persona-matched travel itineraries powered by city intelligence",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["travel", "lifestyle"],
  "screenshots": [
    {
      "src": "/screenshots/map-screen.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

- [ ] **Step 3: Create icon files**

```bash
mkdir -p frontend/public/icons frontend/public/screenshots
# You need to create 3 PNG files:
# frontend/public/icons/icon-192.png (192x192)
# frontend/public/icons/icon-512.png (512x512)
# frontend/public/icons/icon-512-maskable.png (512x512, safe zone in center 80%)
# Use your app logo. For now create placeholder:
echo "PLACEHOLDER — replace with real icon" > frontend/public/icons/REPLACE_WITH_REAL_ICONS.txt
```

- [ ] **Step 4: Configure Vite PWA plugin**

Update `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'screenshots/*.png'],
      manifest: false, // we have our own manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/health/]
      }
    })
  ],
  // ... rest of existing config
})
```

- [ ] **Step 5: Add manifest link to index.html**

In `frontend/index.html`, add inside `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] **Step 6: Create Digital Asset Links file (for TWA Play Store)**

Create `frontend/public/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.uncoverroads.app",
    "sha256_cert_fingerprints": [
      "REPLACE_WITH_YOUR_KEYSTORE_SHA256_FINGERPRINT"
    ]
  }
}]
```

Note: SHA256 fingerprint comes from your Android signing keystore. Generate with:
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

- [ ] **Step 7: Verify PWA build**

```bash
cd frontend
npm run build
# Check dist/ contains:
ls dist/
# Should see: index.html, manifest.json, sw.js, workbox-*.js, icons/
```

- [ ] **Step 8: Test PWA locally**

```bash
cd frontend
npm run preview
# Open http://localhost:4173 in Chrome
# DevTools → Application → Manifest → verify all fields
# DevTools → Application → Service Workers → verify registered
# Lighthouse → PWA audit → target score ≥ 90
```

- [ ] **Step 9: Commit**

```bash
git add frontend/public/manifest.json frontend/vite.config.ts \
        frontend/index.html frontend/public/.well-known/
git commit -m "feat: add PWA manifest, service worker, and asset links for Play Store"
```

---

## Task 7: Create documentation README

**Files:**
- Create: `README.md`
- Create: `frontend/README.md`

- [ ] **Step 1: Create root README**

Create `/Users/souravbiswas/uncover-roads/README.md`:
```markdown
# Uncover Roads

Persona-matched travel intelligence app. React frontend + Python FastAPI backend.

## Quick Start

### Backend
```bash
cp .env.example .env        # fill in your API keys
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
cp .env.example .env.local  # fill in your keys
npm install
npm run dev                  # http://localhost:5173
```

## Environment Variables

See `.env.example` (backend) and `frontend/.env.example` (frontend).

## Deployment

- **Frontend:** Vercel (automatic on push to main)
- **Backend:** Railway (automatic on push to main)

## Specs & Plans

- `docs/superpowers/specs/` — design specifications
- `docs/superpowers/plans/` — implementation plans
- Start with `docs/superpowers/plans/2026-04-29-master-plan.md`

## Tests

```bash
cd frontend && npx vitest run
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md frontend/README.md
git commit -m "docs: add README with setup and deployment instructions"
```

---

## Phase 1 Complete — Verification

- [ ] Run full test suite: `cd frontend && npx vitest run` → 649+ passing, 0 failing
- [ ] Run build: `cd frontend && npm run build` → no errors
- [ ] TypeScript check: `cd frontend && npx tsc --noEmit` → no errors
- [ ] Lighthouse PWA audit → score ≥ 90
- [ ] Backend health check: `curl https://your-railway-app.railway.app/health` → `{"status":"ok"}`
- [ ] Verify no secrets in git: `git log --all --full-history -- "*.env"` → should show removal commit
- [ ] CORS test: frontend on Vercel can call backend on Railway successfully
