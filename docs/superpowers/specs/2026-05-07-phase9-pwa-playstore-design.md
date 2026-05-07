# Phase 9 — PWA + Play Store / App Store Submission
**Date:** 2026-05-07
**Status:** Approved for implementation

---

## 1. Overview

Phase 9 prepares Uncover Roads for submission to the Google Play Store and Apple App Store. The frontend is wrapped as a PWA (for Android/TWA) and a Capacitor native shell (for iOS). This phase covers all UI deliverables, store assets, privacy infrastructure, and the Play Store / App Store submission checklist.

**Stores targeted:** Google Play Store + Apple App Store
**Android wrapper:** TWA (Trusted Web Activity) via PWABuilder
**iOS wrapper:** Capacitor (native shell wrapping the web app)

---

## 2. Offline Fallback Page

### Design direction
Concept C — Story / Travel Metaphor.

### Layout
- Full-screen dark background (`#0d0b09`)
- Night sky: scattered star dots via CSS radial-gradients
- Mountain silhouette: SVG polygon at bottom 35%, fills with `#1a1714`
- Gradient fade from mountain to bottom: `linear-gradient(to top, #1a1714 30%, transparent)`
- Content centred over the scene, z-index above mountains

### Copy
```
[eyebrow]  Connection lost
[headline] Even explorers get lost
[quote]    "Not all those who wander are offline — but you are right now."
[button]   Find signal          ← retries network, links to home on success
[sublink]  Or browse your 12 saved places ↓   ← conditional (see note)
```

### Saved places caveat
The "browse your saved places" link is **conditional on Phase 11** — offline caching of saved places is unconfirmed. Implementation must check whether offline data is available before rendering this link. If offline data is unavailable, omit the sublink entirely.

### Technical
- Registered as service worker offline fallback: `offline.html`
- File location: `frontend/public/offline.html`
- Service worker intercepts failed navigation requests and serves this page

---

## 3. Android Install Prompt (PWA only — not iOS)

iOS users install via the App Store natively. No in-app install prompt on iOS.

### Design direction
Concept C — Contextual Card.

### Trigger conditions
- User has visited the app 3+ times (localStorage counter)
- `beforeinstallprompt` event has fired (browser deems app installable)
- User has not previously dismissed or accepted the prompt
- Do not show on first session

### Layout
```
[header badge]  "Install" pill in top-right of app header — appears when eligible
[card overlay]  Positioned above bottom nav, left/right margin 12px
  eyebrow:  "Your journey deserves a shortcut"
  title:    "Take Uncover Roads everywhere"
  body:     "Add to your home screen for instant access — even when you're offline."
  actions:  [Add to home screen]  [Later]
```

### Behaviour
- "Add to home screen" → triggers native `beforeinstallprompt.prompt()`
- "Later" → dismisses card, sets `localStorage.installPromptDismissed = true`, does not show again for 7 days
- "Install" badge in header disappears once installed or permanently dismissed

### Component
`frontend/src/modules/pwa/InstallPrompt.tsx`
Rendered inside `MapScreen` above the bottom nav — only on Android/Chrome.

---

## 4. App Icon

### Design direction
Warm ivory compass — Concept A with customisations.

### Spec
- **Background:** Radial gradient `#fff8f0` → `#f5e6d6` → `#ead0b8`
- **Outer ring:** `#c4613d`, 1.4px, 28% opacity
- **Inner ring:** `#c4613d`, 0.8px, 12% opacity
- **Cardinal ticks:** `#c4613d`, 1.2px, 35% opacity — at N/S/E/W positions
- **Minor ticks:** 8 diagonal ticks, 0.8px, 15% opacity
- **U label:** top (north position), Georgia serif, 7.5px, `#c4613d`, 75% opacity — replaces "N"
- **R label:** bottom (south position), Georgia serif, 7.5px, `#c4613d`, 75% opacity — replaces "S"
- **Needle:** rotated `63°` clockwise around centre — encodes founding date 06/03/2022
  - North half: `#e07854` (terracotta)
  - South half: `#c9a88a` (muted warm)
- **Pivot:** `#e07854` circle r=3.5, white centre r=1.4
- **No background UR watermark** — U and R appear only on the cardinal positions

### Easter egg
The needle points at bearing **063°** (N63°E). This encodes the founding date 06/03/2022. No label, no explanation — only the founder knows.

### Required export sizes
| Size | Use |
|---|---|
| 512×512 | Play Store listing |
| 192×192 | PWA manifest (maskable) |
| 192×192 | PWA manifest (standard) |
| 1024×1024 | App Store listing |
| 180×180 | iOS home screen (`apple-touch-icon`) |
| 32×32 | Favicon |
| 16×16 | Favicon small |

All exports: PNG, square, no transparency for store assets. SVG source stored at `frontend/public/icon.svg`.

### Maskable icon
For PWA maskable icon: add 10% safe zone padding around the compass (background fills the full square, compass centred in inner 80%).

---

## 5. Store Screenshots

### Required captures — both stores
5 screenshots per store. Dimensions:
- **Google Play:** 1080×1920px (portrait)
- **App Store:** 1290×2796px (6.9" display, portrait)

No device frame, no text overlay — raw app screenshots only.

### Required screens
| # | Screen | What to show |
|---|---|---|
| 1 | Map | Gold pins on Tokyo map, pin card open for Senso-ji |
| 2 | Persona reveal | Wanderer archetype revealed, trait lines visible |
| 3 | Itinerary | Day 1 Tokyo, engine message visible, 4+ stops |
| 4 | Multi-city | Arc overlay showing Tokyo → Seoul → Bangkok |
| 5 | Saved places | Two city groups (Tokyo + Rome), masonry grid visible |

### Capture requirements
- App must be in dark mode
- Use realistic seed data (not placeholder text)
- No debug overlays, no development banners
- Capture on physical device or simulator at correct resolution

---

## 6. Privacy Policy

### File
`frontend/public/privacy.html` — created 2026-05-07.

### Live URL
`uncoverroads.com/privacy` (via Vercel rewrite in `frontend/vercel.json`)

### Contents (already written — do not regenerate)
- Data collection disclosure (persona signals, location, device ID)
- AI processing section (Claude API narration)
- Third-party services table: Supabase, PostHog, Anthropic, Google Places API, YouTube Data API, Reddit API, Vercel, Railway, MapLibre GL
- GDPR user rights (access, rectify, erase, portability, object, restrict, withdraw)
- Data deletion via email: hello@uncoverroads.com, subject "Data Deletion Request", 30-day SLA
- Children's privacy (under 13)
- Effective date: 2026-05-07

### Store submission URLs
- **Play Store:** paste `uncoverroads.com/privacy` into App content → Privacy policy
- **App Store:** paste `uncoverroads.com/privacy` into App Information → Privacy Policy URL

---

## 7. Privacy Section in Profile Screen

A small footer section at the bottom of `ProfileScreen`, below all existing content.

### Layout
```
────────────────────────────
Legal
  Privacy Policy  →
  Terms & Conditions  →
────────────────────────────
```

- Section header: "Legal", 11px uppercase, `#5a4e47`
- Two rows: "Privacy Policy" and "Terms & Conditions"
- Each row: standard settings-style row with `→` chevron
- Tap action: opens URL in in-app browser (`Capacitor Browser` plugin on iOS, `window.open` on Android)
- URLs: `uncoverroads.com/privacy` and `uncoverroads.com/terms`
- Terms page: `frontend/public/terms.html` — to be created (content already written, same hosting pattern as privacy.html)

---

## 8. PWA Manifest

File: `frontend/public/manifest.json`

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
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Link in `frontend/index.html`:
```html
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
<meta name="theme-color" content="#1a1714">
```

---

## 9. Service Worker

File: `frontend/public/sw.js`

### Strategy
- Cache-first for static assets (JS, CSS, fonts, icons)
- Network-first for API calls (`/api/*`)
- Offline fallback: serve `offline.html` for failed navigation requests

### Registration
In `frontend/src/main.tsx`:
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

### Lighthouse PWA target
Score ≥ 90 before Play Store submission.

---

## 10. TWA Configuration (Android)

### assetlinks.json
File: `frontend/public/.well-known/assetlinks.json`
Required for TWA — links the Play Store app to the web domain.

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.uncoverroads.app",
    "sha256_cert_fingerprints": ["<YOUR_SIGNING_KEY_FINGERPRINT>"]
  }
}]
```

The SHA256 fingerprint is obtained from your Play Store signing key after first upload.

---

## 11. Capacitor Configuration (iOS)

### Setup
```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/browser
npx cap init "Uncover Roads" "com.uncoverroads.app" --web-dir dist
npx cap add ios
```

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.uncoverroads.app',
  appName: 'Uncover Roads',
  webDir: 'dist',
  server: { androidScheme: 'https' }
}
export default config
```

### Build flow
```bash
npm run build
npx cap sync ios
npx cap open ios   # opens Xcode
```

Archive and upload from Xcode to App Store Connect.

---

## 12. Play Store Submission Checklist

- [ ] PWA manifest.json complete and valid
- [ ] Service worker registered, offline.html served correctly
- [ ] Lighthouse PWA score ≥ 90
- [ ] App icon exported at all required sizes
- [ ] 5 screenshots captured at 1080×1920
- [ ] `assetlinks.json` hosted at `/.well-known/assetlinks.json`
- [ ] Privacy policy live at `uncoverroads.com/privacy`
- [ ] Terms live at `uncoverroads.com/terms`
- [ ] HTTPS enforced (Vercel provides this automatically)
- [ ] CORS locked to production domain in Railway backend
- [ ] No API keys in client-side code
- [ ] TWA built via PWABuilder or Bubblewrap
- [ ] App signed with Play Store key
- [ ] Content rating questionnaire completed in Play Console
- [ ] Data Safety form completed (declare: location, personal info, app activity)

## 13. App Store Submission Checklist

- [ ] Capacitor project initialised and building
- [ ] App icon exported at 1024×1024 (no transparency, no rounded corners — Apple applies mask)
- [ ] 5 screenshots captured at 1290×2796 (6.9" display)
- [ ] Privacy policy live at `uncoverroads.com/privacy`
- [ ] Terms live at `uncoverroads.com/terms`
- [ ] Privacy nutrition labels completed in App Store Connect (location, identifiers, usage data)
- [ ] App signed with Distribution certificate + provisioning profile
- [ ] Bundle ID registered: `com.uncoverroads.app`
- [ ] Age rating: 4+ (no objectionable content)
- [ ] TestFlight build uploaded and tested before submission

---

## 14. Profile Screen — Privacy Section

Added to Phase 9 scope. A "Legal" section at the bottom of `ProfileScreen` with links to Privacy Policy and Terms & Conditions, opening in in-app browser.

File to update: `frontend/src/modules/profile/ProfileScreen.tsx`

---

## Out of Scope (Phase 11)

- Offline caching of saved places (impacts offline page "browse saved places" CTA)
- Full offline mode feature set

The offline page's saved places link must be conditionally hidden until Phase 11 confirms what is cached offline.
