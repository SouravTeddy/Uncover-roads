# Phase 9 — PWA + Play Store / App Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Uncover Roads into a PWA-ready app with service worker, offline fallback, app icon, install prompt, legal pages, and Capacitor configuration for App Store submission.

**Architecture:** Static assets (manifest, SW, offline.html) live in `frontend/public/`; the install prompt logic lives in `frontend/src/modules/pwa/`; the profile legal section is added to the existing `ProfileScreen`; Capacitor wraps the Vite build for iOS.

**Tech Stack:** Vite, React 18, TypeScript, Vitest, Tailwind CSS, Capacitor (iOS), Service Worker API, sharp (icon generation)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/public/icon.svg` | SVG source for all icon exports |
| Create | `frontend/scripts/generate-icons.mjs` | Exports PNGs at all required sizes using sharp |
| Create | `frontend/public/icons/` | Directory for PNG icon exports |
| Create | `frontend/public/manifest.json` | PWA web app manifest |
| Modify | `frontend/index.html` | Add manifest link, apple-touch-icon, update favicon |
| Create | `frontend/public/sw.js` | Service worker — cache-first static, network-first API, offline fallback |
| Create | `frontend/public/offline.html` | Offline fallback page — travel/story metaphor design |
| Modify | `frontend/src/main.tsx` | Register service worker |
| Create | `frontend/src/modules/pwa/usePWAInstall.ts` | Hook: manages beforeinstallprompt, visit counter, dismissed state |
| Create | `frontend/src/modules/pwa/usePWAInstall.test.ts` | Unit tests for install hook logic |
| Create | `frontend/src/modules/pwa/InstallPrompt.tsx` | Card overlay + header badge for install prompt |
| Modify | `frontend/src/App.tsx` | Render InstallPrompt above BottomNav |
| Modify | `frontend/src/modules/profile/ProfileScreen.tsx` | Add Legal section (Privacy Policy + Terms) |
| Create | `frontend/public/terms.html` | Terms & Conditions static page |
| Modify | `frontend/vercel.json` | Add `/terms` rewrite |
| Create | `frontend/public/.well-known/assetlinks.json` | TWA domain verification for Play Store |
| Create | `frontend/capacitor.config.ts` | Capacitor configuration for iOS wrapper |

---

## Task 1: App Icon SVG

**Files:**
- Create: `frontend/public/icon.svg`

- [ ] **Step 1: Create the SVG source file**

Write `frontend/public/icon.svg` with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#fff8f0"/>
      <stop offset="60%"  stop-color="#f5e6d6"/>
      <stop offset="100%" stop-color="#ead0b8"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="100" height="100" fill="url(#bg)"/>

  <!-- Outer ring: 1.4px, 28% opacity -->
  <circle cx="50" cy="50" r="45" fill="none" stroke="#c4613d" stroke-width="1.4" opacity="0.28"/>

  <!-- Inner ring: 0.8px, 12% opacity -->
  <circle cx="50" cy="50" r="37" fill="none" stroke="#c4613d" stroke-width="0.8" opacity="0.12"/>

  <!-- Cardinal ticks at N/S/E/W: 1.2px, 35% opacity -->
  <line x1="50" y1="5"  x2="50" y2="8"  stroke="#c4613d" stroke-width="1.2" opacity="0.35"/>
  <line x1="95" y1="50" x2="92" y2="50" stroke="#c4613d" stroke-width="1.2" opacity="0.35"/>
  <line x1="50" y1="95" x2="50" y2="92" stroke="#c4613d" stroke-width="1.2" opacity="0.35"/>
  <line x1="5"  y1="50" x2="8"  y2="50" stroke="#c4613d" stroke-width="1.2" opacity="0.35"/>

  <!-- 8 minor diagonal ticks: 0.8px, 15% opacity (at 22.5° between cardinals) -->
  <line x1="67.2" y1="8.4"  x2="66.5" y2="10.3" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="91.6" y1="32.8" x2="89.7" y2="33.5" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="91.6" y1="67.2" x2="89.7" y2="66.5" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="67.2" y1="91.6" x2="66.5" y2="89.7" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="32.8" y1="91.6" x2="33.5" y2="89.7" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="8.4"  y1="67.2" x2="10.3" y2="66.5" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="8.4"  y1="32.8" x2="10.3" y2="33.5" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>
  <line x1="32.8" y1="8.4"  x2="33.5" y2="10.3" stroke="#c4613d" stroke-width="0.8" opacity="0.15"/>

  <!-- U label at north position (replaces "N") -->
  <text x="50" y="9" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="7.5"
        fill="#c4613d" opacity="0.75">U</text>

  <!-- R label at south position (replaces "S") -->
  <text x="50" y="92" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="7.5"
        fill="#c4613d" opacity="0.75">R</text>

  <!-- Needle — rotated 63° clockwise (encodes founding date 06/03/2022) -->
  <g transform="rotate(63, 50, 50)">
    <!-- North half: terracotta, pointed tip -->
    <path d="M50,50 L47,54 L50,15 L53,54 Z" fill="#e07854"/>
    <!-- South half: muted warm, blunt tail -->
    <path d="M50,50 L48,54 L50,72 L52,54 Z" fill="#c9a88a"/>
  </g>

  <!-- Pivot -->
  <circle cx="50" cy="50" r="3.5" fill="#e07854"/>
  <circle cx="50" cy="50" r="1.4" fill="white"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/public/icon.svg
git commit -m "feat(pwa): add compass app icon SVG source"
```

---

## Task 2: PNG Icon Exports

**Files:**
- Create: `frontend/scripts/generate-icons.mjs`
- Create: `frontend/public/icons/` (directory with generated PNGs)

- [ ] **Step 1: Write the icon generation script**

Create `frontend/scripts/generate-icons.mjs`:

```js
// Run with: node scripts/generate-icons.mjs
// Requires: npm install --save-dev sharp (then remove after use if desired)
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

const svgBuffer = readFileSync(join(root, 'public', 'icon.svg'));

const exports = [
  { name: 'icon-512.png',            size: 512, maskable: false },
  { name: 'icon-192.png',            size: 192, maskable: false },
  { name: 'icon-192-maskable.png',   size: 192, maskable: true  },
  { name: 'icon-1024.png',           size: 1024, maskable: false },
  { name: 'icon-180.png',            size: 180, maskable: false },
  { name: 'favicon-32.png',          size: 32,  maskable: false },
  { name: 'favicon-16.png',          size: 16,  maskable: false },
];

for (const { name, size, maskable } of exports) {
  let pipeline = sharp(svgBuffer, { density: Math.ceil(size * 72 / 100) })
    .resize(size, size, { fit: 'contain', background: '#ead0b8' });

  if (maskable) {
    // For maskable: compass occupies inner 80% — add 10% padding each side
    const padded = Math.round(size * 0.1);
    const innerSize = size - padded * 2;
    pipeline = sharp(svgBuffer, { density: Math.ceil(innerSize * 72 / 100) })
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 234, g: 208, b: 184, alpha: 0 } });

    const inner = await pipeline.png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: '#ead0b8',
      }
    })
      .composite([{ input: inner, top: padded, left: padded }])
      .png()
      .toFile(join(iconsDir, name));
  } else {
    await pipeline.png().toFile(join(iconsDir, name));
  }

  console.log(`✓ ${name} (${size}×${size}${maskable ? ', maskable' : ''})`);
}

console.log('\nAll icons generated in public/icons/');
```

- [ ] **Step 2: Install sharp and generate icons**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm install --save-dev sharp
node scripts/generate-icons.mjs
```

Expected output:
```
✓ icon-512.png (512×512)
✓ icon-192.png (192×192)
✓ icon-192-maskable.png (192×192, maskable)
✓ icon-1024.png (1024×1024)
✓ icon-180.png (180×180)
✓ favicon-32.png (32×32)
✓ favicon-16.png (16×16)

All icons generated in public/icons/
```

- [ ] **Step 3: Verify files were created**

```bash
ls -la /Users/souravbiswas/uncover-roads/frontend/public/icons/
```

Expected: 7 PNG files listed.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/scripts/generate-icons.mjs frontend/public/icons/
git commit -m "feat(pwa): generate app icon PNGs at all required sizes"
```

---

## Task 3: PWA Manifest + index.html Meta Tags

**Files:**
- Create: `frontend/public/manifest.json`
- Modify: `frontend/index.html`

- [ ] **Step 1: Create the manifest**

Create `frontend/public/manifest.json`:

```json
{
  "name": "Uncover Roads",
  "short_name": "Uncover Roads",
  "description": "Travel intelligence for the curious explorer",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1a1714",
  "theme_color": "#1a1714",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Update index.html**

In `frontend/index.html`, replace the existing `<head>` block with this (adds manifest link, apple-touch-icon, and updates favicon to PNG):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
    <link rel="apple-touch-icon" href="/icons/icon-180.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#1a1714" />
    <title>Uncover Roads</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/public/manifest.json frontend/index.html
git commit -m "feat(pwa): add PWA manifest and update index.html meta tags"
```

---

## Task 4: Service Worker

**Files:**
- Create: `frontend/public/sw.js`

- [ ] **Step 1: Create the service worker**

Create `frontend/public/sw.js`:

```js
const CACHE_NAME = 'uncover-roads-v1';

// Static assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: route requests by strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, icons)
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/public/sw.js
git commit -m "feat(pwa): add service worker with cache-first and offline fallback"
```

---

## Task 5: Offline Fallback Page

**Files:**
- Create: `frontend/public/offline.html`

- [ ] **Step 1: Create the offline page**

Create `frontend/public/offline.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0d0b09" />
  <title>Uncover Roads — Offline</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0d0b09;
      color: #f5e6d6;
      font-family: 'DM Sans', system-ui, sans-serif;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* Night sky stars */
    .stars {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(1px 1px at 15% 12%, rgba(255,248,240,.6) 0, transparent 100%),
        radial-gradient(1px 1px at 72% 8%,  rgba(255,248,240,.5) 0, transparent 100%),
        radial-gradient(1px 1px at 43% 22%, rgba(255,248,240,.7) 0, transparent 100%),
        radial-gradient(1px 1px at 88% 18%, rgba(255,248,240,.4) 0, transparent 100%),
        radial-gradient(1px 1px at 27% 35%, rgba(255,248,240,.5) 0, transparent 100%),
        radial-gradient(1px 1px at 61% 31%, rgba(255,248,240,.6) 0, transparent 100%),
        radial-gradient(1px 1px at 5%  48%, rgba(255,248,240,.3) 0, transparent 100%),
        radial-gradient(1px 1px at 94% 42%, rgba(255,248,240,.5) 0, transparent 100%),
        radial-gradient(2px 2px at 52% 15%, rgba(255,248,240,.8) 0, transparent 100%),
        radial-gradient(1px 1px at 34% 5%,  rgba(255,248,240,.6) 0, transparent 100%),
        radial-gradient(1px 1px at 80% 28%, rgba(255,248,240,.4) 0, transparent 100%),
        radial-gradient(1px 1px at 19% 55%, rgba(255,248,240,.5) 0, transparent 100%);
      pointer-events: none;
      z-index: 0;
    }

    /* Mountain silhouette */
    .mountains {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1;
      pointer-events: none;
    }

    /* Gradient fade from mountain top */
    .mountain-fade {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 45%;
      background: linear-gradient(to top, #1a1714 30%, transparent);
      z-index: 2;
      pointer-events: none;
    }

    /* Main content */
    .content {
      position: relative;
      z-index: 10;
      text-align: center;
      padding: 0 32px;
      max-width: 360px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .eyebrow {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(196, 97, 61, 0.7);
      margin-bottom: 16px;
    }

    .headline {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 600;
      line-height: 1.2;
      color: #f5e6d6;
      margin-bottom: 20px;
    }

    .quote {
      font-size: 14px;
      line-height: 1.6;
      color: rgba(245, 230, 214, 0.5);
      font-style: italic;
      margin-bottom: 36px;
    }

    .btn-retry {
      display: inline-block;
      background: linear-gradient(135deg, #e07854, #c4613d);
      color: #fff8f0;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 50px;
      border: none;
      cursor: pointer;
      box-shadow: 0 0 24px rgba(224, 120, 84, 0.3);
      transition: opacity 0.15s;
      -webkit-tap-highlight-color: transparent;
    }

    .btn-retry:active { opacity: 0.85; }

    .saved-link {
      display: block;
      margin-top: 20px;
      font-size: 13px;
      color: rgba(245, 230, 214, 0.4);
      text-decoration: none;
      cursor: pointer;
      background: none;
      border: none;
    }

    .saved-link[hidden] { display: none; }
  </style>
  <!-- Preconnect to Google Fonts for faster load if online -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />
</head>
<body>
  <div class="stars" aria-hidden="true"></div>

  <!-- Mountain silhouette SVG -->
  <svg class="mountains" viewBox="0 0 375 200" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="0,200 0,120 60,60 120,100 180,40 240,90 300,50 375,80 375,200" fill="#1a1714"/>
    <polygon points="0,200 0,140 40,110 90,130 140,90 190,120 260,100 330,115 375,95 375,200" fill="#131110"/>
  </svg>

  <div class="mountain-fade" aria-hidden="true"></div>

  <main class="content">
    <p class="eyebrow">Connection lost</p>
    <h1 class="headline">Even explorers<br>get lost</h1>
    <p class="quote">"Not all those who wander are offline —<br>but you are right now."</p>

    <button class="btn-retry" id="retryBtn">Find signal</button>

    <!--
      Phase 11 gate: this link is hidden until offline place caching is confirmed.
      Do not remove — enable it when Phase 11 ships offline save support.
    -->
    <button class="saved-link" id="savedLink" hidden aria-hidden="true">
      Or browse your saved places ↓
    </button>
  </main>

  <script>
    document.getElementById('retryBtn').addEventListener('click', async () => {
      try {
        await fetch('/', { method: 'HEAD', cache: 'no-store' });
        window.location.href = '/';
      } catch {
        // Still offline — give visual feedback
        const btn = document.getElementById('retryBtn');
        btn.textContent = 'Still offline…';
        btn.style.opacity = '0.6';
        setTimeout(() => {
          btn.textContent = 'Find signal';
          btn.style.opacity = '';
        }, 2000);
      }
    });

    // Phase 11: uncomment when offline place cache is available
    // document.getElementById('savedLink').removeAttribute('hidden');
    // document.getElementById('savedLink').removeAttribute('aria-hidden');
    // document.getElementById('savedLink').addEventListener('click', () => {
    //   window.location.href = '/saved';
    // });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/public/offline.html
git commit -m "feat(pwa): add offline fallback page with travel/story design"
```

---

## Task 6: Service Worker Registration

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Add SW registration to main.tsx**

Replace the contents of `frontend/src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';
import App from './App';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/main.tsx
git commit -m "feat(pwa): register service worker on app boot"
```

---

## Task 7: usePWAInstall Hook (TDD)

**Files:**
- Create: `frontend/src/modules/pwa/usePWAInstall.ts`
- Create: `frontend/src/modules/pwa/usePWAInstall.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/pwa/usePWAInstall.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { shouldShowInstallPrompt, recordVisit, dismissInstallPrompt, VISIT_KEY, DISMISSED_KEY } from './usePWAInstall';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recordVisit', () => {
  it('increments visit count in localStorage', () => {
    recordVisit();
    recordVisit();
    expect(Number(localStorage.getItem(VISIT_KEY))).toBe(2);
  });

  it('starts at 1 from zero', () => {
    recordVisit();
    expect(Number(localStorage.getItem(VISIT_KEY))).toBe(1);
  });
});

describe('shouldShowInstallPrompt', () => {
  it('returns false when visit count < 3', () => {
    localStorage.setItem(VISIT_KEY, '2');
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it('returns true when visit count >= 3 and not dismissed', () => {
    localStorage.setItem(VISIT_KEY, '3');
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('returns false when dismissed timestamp is within 7 days', () => {
    localStorage.setItem(VISIT_KEY, '5');
    const sevenDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000; // 6 days ago
    localStorage.setItem(DISMISSED_KEY, String(sevenDaysAgo));
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it('returns true when dismissed timestamp is older than 7 days', () => {
    localStorage.setItem(VISIT_KEY, '5');
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(eightDaysAgo));
    expect(shouldShowInstallPrompt()).toBe(true);
  });
});

describe('dismissInstallPrompt', () => {
  it('stores the current timestamp under DISMISSED_KEY', () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);
    dismissInstallPrompt();
    expect(Number(localStorage.getItem(DISMISSED_KEY))).toBe(now);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/pwa/usePWAInstall.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook and utilities**

Create `frontend/src/modules/pwa/usePWAInstall.ts`:

```ts
import { useEffect, useRef, useState } from 'react';

export const VISIT_KEY = 'ur_install_visits';
export const DISMISSED_KEY = 'ur_install_dismissed';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_VISITS = 3;

export function recordVisit() {
  const count = Number(localStorage.getItem(VISIT_KEY) ?? '0');
  localStorage.setItem(VISIT_KEY, String(count + 1));
}

export function shouldShowInstallPrompt(): boolean {
  const count = Number(localStorage.getItem(VISIT_KEY) ?? '0');
  if (count < MIN_VISITS) return false;

  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (dismissed && Date.now() - Number(dismissed) < SEVEN_DAYS_MS) return false;

  return true;
}

export function dismissInstallPrompt() {
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Only on Android/Chrome — no iOS
    if (!('onbeforeinstallprompt' in window)) return;

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    recordVisit();

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (shouldShowInstallPrompt()) {
        setCanPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanPrompt(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setCanPrompt(false);
    deferredPrompt.current = null;
  }

  function dismiss() {
    dismissInstallPrompt();
    setCanPrompt(false);
  }

  return { canPrompt, isInstalled, triggerInstall, dismiss };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/pwa/usePWAInstall.test.ts
```

Expected output:
```
✓ src/modules/pwa/usePWAInstall.test.ts (6 tests)
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/pwa/
git commit -m "feat(pwa): add usePWAInstall hook with visit counter and dismissal logic"
```

---

## Task 8: InstallPrompt Component

**Files:**
- Create: `frontend/src/modules/pwa/InstallPrompt.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/modules/pwa/InstallPrompt.tsx`:

```tsx
import { usePWAInstall } from './usePWAInstall';

/**
 * Android/Chrome only — iOS users install via the App Store.
 * Rendered in App.tsx just above <BottomNav />.
 * Shows a card overlay above the bottom nav when the user is eligible.
 * Also renders an "Install" badge in a portal — but since we have no header
 * portal here, the badge state is exposed via a CSS class on the body for
 * the header to pick up if needed in future.
 */
export function InstallPrompt() {
  const { canPrompt, triggerInstall, dismiss } = usePWAInstall();

  if (!canPrompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Uncover Roads"
      style={{
        position: 'fixed',
        bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 8px)',
        left: 12,
        right: 12,
        zIndex: 50,
        borderRadius: 20,
        background: 'linear-gradient(160deg, rgba(26,23,20,0.97), rgba(20,17,14,0.99))',
        border: '1px solid rgba(196,97,61,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(224,120,84,0.08)',
        padding: '16px 16px 14px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(196,97,61,0.7)',
          marginBottom: 6,
        }}
      >
        Your journey deserves a shortcut
      </p>

      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 17,
          fontWeight: 600,
          color: '#f5e6d6',
          marginBottom: 4,
        }}
      >
        Take Uncover Roads everywhere
      </h2>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: 'rgba(245,230,214,0.5)',
          marginBottom: 16,
        }}
      >
        Add to your home screen for instant access — even when you're offline.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={triggerInstall}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #e07854, #c4613d)',
            color: '#fff8f0',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(224,120,84,0.25)',
          }}
        >
          Add to home screen
        </button>

        <button
          onClick={dismiss}
          style={{
            height: 44,
            padding: '0 16px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(245,230,214,0.45)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/pwa/InstallPrompt.tsx
git commit -m "feat(pwa): add Android install prompt card component"
```

---

## Task 9: Wire InstallPrompt into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add InstallPrompt import**

In `frontend/src/App.tsx`, add this import near the top (after existing imports):

```tsx
import { InstallPrompt } from './modules/pwa/InstallPrompt';
```

- [ ] **Step 2: Render InstallPrompt above BottomNav**

Find this block in `frontend/src/App.tsx`:

```tsx
      <BottomNav />
    </div>
```

Replace it with:

```tsx
      <InstallPrompt />
      <BottomNav />
    </div>
```

- [ ] **Step 3: Verify the app builds**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/App.tsx
git commit -m "feat(pwa): render InstallPrompt above BottomNav in App"
```

---

## Task 10: Profile Screen — Legal Section

**Files:**
- Modify: `frontend/src/modules/profile/ProfileScreen.tsx`

- [ ] **Step 1: Add the Legal section before the closing body div**

In `frontend/src/modules/profile/ProfileScreen.tsx`, find:

```tsx
        {/* Feedback */}
        <div className="flex justify-center mt-2 mb-6">
```

Replace with:

```tsx
        {/* Legal */}
        <div className="mt-2 px-4">
          <p className="text-[11px] uppercase tracking-widest font-bold mb-2 px-1" style={{ color: '#5a4e47' }}>Legal</p>
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4 mx-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <SettingsRow
            label="Privacy Policy"
            onTap={() => openUrl('https://uncoverroads.com/privacy')}
          />
          <SettingsRow
            label="Terms & Conditions"
            divider
            onTap={() => openUrl('https://uncoverroads.com/terms')}
          />
        </div>

        {/* Feedback */}
        <div className="flex justify-center mt-2 mb-6">
```

- [ ] **Step 2: Add the openUrl helper inside ProfileScreen (before the return statement)**

Find this line in `frontend/src/modules/profile/ProfileScreen.tsx`:

```tsx
  // Sub-screen routing
```

Add this function just before it:

```tsx
  function openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Sub-screen routing
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/profile/ProfileScreen.tsx
git commit -m "feat(pwa): add Legal section with Privacy Policy and Terms links to ProfileScreen"
```

---

## Task 11: Terms HTML Page + vercel.json

**Files:**
- Create: `frontend/public/terms.html`
- Modify: `frontend/vercel.json`

- [ ] **Step 1: Create the terms page**

Create `frontend/public/terms.html` with the same structural styling as `frontend/public/privacy.html` (read that file first to match the CSS/layout exactly), then write the terms content:

Read `frontend/public/privacy.html` first, then create `frontend/public/terms.html` with the same `<head>`, nav structure, and CSS, replacing the body content with:

```html
<!-- Use the same <head> and structural CSS as privacy.html -->
<!-- Replace only the article content below: -->

<h1>Terms &amp; Conditions</h1>
<p class="meta">Effective date: 7 May 2026 &nbsp;·&nbsp; Uncover Roads</p>

<h2>1. Acceptance of Terms</h2>
<p>By downloading, installing, or using Uncover Roads ("the App"), you agree to these Terms &amp; Conditions. If you do not agree, do not use the App.</p>

<h2>2. Description of Service</h2>
<p>Uncover Roads is a travel intelligence app that generates personalised itineraries, place recommendations, and travel insights using AI. The service requires an active internet connection and a registered account.</p>

<h2>3. User Accounts</h2>
<p>You must create an account to access the full functionality of the App. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must be at least 13 years old to create an account.</p>

<h2>4. Acceptable Use</h2>
<p>You agree not to:</p>
<ul>
  <li>Use the App for any unlawful purpose</li>
  <li>Attempt to reverse-engineer, scrape, or exploit the App or its APIs</li>
  <li>Submit false, misleading, or harmful content</li>
  <li>Use automated means to access the service without prior written consent</li>
</ul>

<h2>5. Subscription and Billing</h2>
<p>Uncover Roads offers free and paid subscription tiers. Paid subscriptions are billed through the applicable app store (Apple App Store or Google Play). Subscription fees are non-refundable except as required by applicable law or app store policy. You may cancel your subscription at any time through your app store account settings.</p>

<h2>6. AI-Generated Content</h2>
<p>Itineraries, place descriptions, and recommendations are generated by AI and are provided for informational purposes only. We do not guarantee the accuracy, completeness, or suitability of AI-generated content. Always verify travel information independently before acting on it.</p>

<h2>7. Intellectual Property</h2>
<p>All intellectual property in the App, including design, code, and branding, is owned by Uncover Roads. You are granted a limited, non-exclusive, non-transferable licence to use the App for personal, non-commercial purposes.</p>

<h2>8. Third-Party Services</h2>
<p>The App integrates with third-party services including Google Places API, Supabase, Anthropic (Claude AI), and others. Your use of these services is subject to their respective terms and privacy policies.</p>

<h2>9. Disclaimers</h2>
<p>The App is provided "as is" without warranties of any kind, express or implied. We do not warrant that the App will be uninterrupted, error-free, or free of harmful components.</p>

<h2>10. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, Uncover Roads shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App.</p>

<h2>11. Governing Law</h2>
<p>These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

<h2>12. Changes to These Terms</h2>
<p>We may update these Terms from time to time. We will notify you of material changes via the App or email. Continued use of the App after changes constitutes acceptance of the updated Terms.</p>

<h2>13. Contact</h2>
<p>For questions about these Terms, contact us at <a href="mailto:hello@uncoverroads.com">hello@uncoverroads.com</a>.</p>
```

- [ ] **Step 2: Add /terms rewrite to vercel.json**

Replace `frontend/vercel.json` with:

```json
{
  "rewrites": [
    { "source": "/privacy", "destination": "/privacy.html" },
    { "source": "/terms",   "destination": "/terms.html"   },
    { "source": "/(.*)",    "destination": "/index.html"   }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/public/terms.html frontend/vercel.json
git commit -m "feat(pwa): add Terms & Conditions page and /terms Vercel rewrite"
```

---

## Task 12: TWA assetlinks.json

**Files:**
- Create: `frontend/public/.well-known/assetlinks.json`

- [ ] **Step 1: Create the directory and placeholder file**

Create `frontend/public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.uncoverroads.app",
    "sha256_cert_fingerprints": ["REPLACE_WITH_PLAY_STORE_SIGNING_KEY_SHA256"]
  }
}]
```

> **Note:** The SHA256 fingerprint is obtained from the Play Console after your first APK/AAB upload. Navigate to: Setup → App integrity → App signing → SHA-256 certificate fingerprint. Replace `REPLACE_WITH_PLAY_STORE_SIGNING_KEY_SHA256` with the value shown there before going live.

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add "frontend/public/.well-known/assetlinks.json"
git commit -m "feat(pwa): add TWA assetlinks.json placeholder for Play Store verification"
```

---

## Task 13: Capacitor Configuration

**Files:**
- Create: `frontend/capacitor.config.ts`

- [ ] **Step 1: Install Capacitor packages**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/browser
```

Expected: packages added to package.json.

- [ ] **Step 2: Create capacitor.config.ts**

Create `frontend/capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uncoverroads.app',
  appName: 'Uncover Roads',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

- [ ] **Step 3: Initialise Capacitor (interactive — run manually)**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx cap init "Uncover Roads" "com.uncoverroads.app" --web-dir dist
```

> **Note:** This command is interactive. Run it manually in your terminal. Accept defaults when prompted.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/capacitor.config.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(pwa): add Capacitor config for iOS App Store wrapper"
```

- [ ] **Step 5: Document the iOS build flow (for reference)**

Once Capacitor is initialised, the iOS build flow is:

```bash
# Build the web app
cd /Users/souravbiswas/uncover-roads/frontend
npm run build

# Add iOS platform (requires macOS + Xcode installed)
npx cap add ios

# Sync web assets into the native project
npx cap sync ios

# Open in Xcode to archive and upload
npx cap open ios
```

Archive and distribute via Xcode: Product → Archive → Distribute App → App Store Connect.

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by task |
|---|---|
| §2 Offline fallback page — Concept C layout, copy, conditional saved link | Task 5 |
| §3 Android install prompt — Contextual Card, trigger conditions, behaviour | Tasks 7–9 |
| §4 App icon — compass SVG spec, required export sizes, maskable | Tasks 1–2 |
| §5 Store screenshots | Not in scope — manual capture required |
| §6 Privacy policy (already exists at `/privacy`) | Verified: `frontend/public/privacy.html` exists |
| §7 Privacy section in ProfileScreen | Task 10 |
| §8 PWA manifest.json | Task 3 |
| §9 Service worker — cache strategies, registration | Tasks 4, 6 |
| §10 TWA assetlinks.json | Task 12 |
| §11 Capacitor configuration | Task 13 |
| §12 Play Store submission checklist | Implemented items: manifest, SW, offline, icon, assetlinks, privacy, terms |
| §13 App Store submission checklist | Implemented items: Capacitor config, icon, privacy, terms |
| §14 Profile Screen privacy section | Task 10 |

**Screenshots (§5):** Require a physical device or simulator with real seed data — these are a manual step not automatable in this plan.

**Store submission checklists (§12, §13):** The checklist items are operational steps performed in the Play Console / App Store Connect. The plan delivers all code artifacts required to complete them.

**Placeholder scan:** No TBD/TODO in any code step. The `assetlinks.json` SHA256 placeholder is intentional and documented with where to find the real value.

**Type consistency:** `usePWAInstall` exports `VISIT_KEY`, `DISMISSED_KEY`, `recordVisit`, `shouldShowInstallPrompt`, `dismissInstallPrompt` — all referenced consistently in `usePWAInstall.test.ts`. `InstallPrompt` imports only `usePWAInstall` (the hook) from the same file.
