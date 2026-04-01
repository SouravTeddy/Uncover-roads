# Map Initial Loading Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a center floating card with fade-cycling quirky messages that shows only during the map's first data load, then auto-dismisses.

**Architecture:** A new `MapLoadingOverlay` component manages its own message cycling via a `useEffect` interval and accepts a single `visible` prop. `MapScreen` adds an `initialLoading` boolean (starts `true`) and clears it in the `finally` block of the initial `handleSearchHere` call (the one triggered by `MapReadyTrigger` with an `overrideBbox`).

**Tech Stack:** React 18, TypeScript, Tailwind CSS (inline styles for specifics), Leaflet/react-leaflet (no changes needed)

---

### Task 1: Create `MapLoadingOverlay` component

**Files:**
- Create: `frontend/src/modules/map/MapLoadingOverlay.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// frontend/src/modules/map/MapLoadingOverlay.tsx
import { useEffect, useRef, useState } from 'react';

const MESSAGES = [
  'Sketching Roads...',
  'Cooking hotspots...',
  'Loading something...',
  'Finding hidden gems...',
  'Waking up the city...',
  'Sniffing out cafés...',
  'Mapping the vibes...',
  'Connecting the dots...',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MapLoadingOverlay({ visible }: { visible: boolean }) {
  const [msgOpacity, setMsgOpacity] = useState(1);
  const [msgText, setMsgText] = useState('');
  const messagesRef = useRef<string[]>([]);
  const idxRef = useRef(0);

  // Shuffle messages once on mount and set initial text
  useEffect(() => {
    messagesRef.current = shuffle(MESSAGES);
    setMsgText(messagesRef.current[0]);
  }, []);

  // Cycle messages while visible
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setMsgOpacity(0);
      setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % messagesRef.current.length;
        setMsgText(messagesRef.current[idxRef.current]);
        setMsgOpacity(1);
      }, 400);
    }, 1800);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 30, pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(15,20,30,0.93)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.11)',
          borderRadius: 22,
          padding: '24px 32px',
          textAlign: 'center',
          minWidth: 190,
          boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
        }}
      >
        {/* Spinner */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '3px solid rgba(59,130,246,0.18)',
            borderTopColor: '#3b82f6',
            margin: '0 auto 14px',
            animation: 'map-overlay-spin 1s linear infinite',
          }}
        />
        {/* Cycling message */}
        <p
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 4px',
            letterSpacing: '-0.2px',
            opacity: msgOpacity,
            transition: 'opacity 0.4s ease',
          }}
        >
          {msgText}
        </p>
        {/* Static sub-label */}
        <p
          style={{
            color: 'rgba(255,255,255,0.28)',
            fontSize: 11,
            margin: 0,
            fontWeight: 400,
          }}
        >
          hang tight
        </p>
      </div>

      <style>{`
        @keyframes map-overlay-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file exists and TypeScript is happy**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/MapLoadingOverlay.tsx
git commit -m "feat: add MapLoadingOverlay component with fade-cycling messages"
```

---

### Task 2: Integrate `MapLoadingOverlay` into `MapScreen`

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add the import at the top of `MapScreen.tsx`**

Find the existing map imports block (around line 13):
```tsx
import { SearchHereButton } from './SearchHereButton';
```

Add after it:
```tsx
import { MapLoadingOverlay } from './MapLoadingOverlay';
```

- [ ] **Step 2: Add `initialLoading` state**

In `MapScreen()`, find the existing state declarations (around line 308):
```tsx
const [showTripSheet, setShowTripSheet] = useState(false);
```

Add directly before it:
```tsx
const [initialLoading, setInitialLoading] = useState(true);
```

- [ ] **Step 3: Clear `initialLoading` in `handleSearchHere`**

Find the `handleSearchHere` callback's `finally` block (around line 365):
```tsx
finally { setSearchHereLoading(false); if (!overrideBbox) resetSearchHereRef.current(); }
```

Replace with:
```tsx
finally {
  setSearchHereLoading(false);
  if (!overrideBbox) resetSearchHereRef.current();
  else setInitialLoading(false);
}
```

- [ ] **Step 4: Render `<MapLoadingOverlay>` in the JSX**

Find this comment + block (around line 455):
```tsx
      {/* Search Here */}
      {showSearchHere && <SearchHereButton onSearch={handleSearchHere} loading={searchHereLoading} empty={searchHereEmpty} />}
```

Add the overlay immediately before it:
```tsx
      {/* Initial load overlay */}
      <MapLoadingOverlay visible={initialLoading} />

      {/* Search Here */}
      {showSearchHere && <SearchHereButton onSearch={handleSearchHere} loading={searchHereLoading} empty={searchHereEmpty} />}
```

- [ ] **Step 5: Verify TypeScript is still clean**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Smoke-test in the browser**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Open the app, navigate to the map screen. You should see:
- The frosted-glass card centered on the map on first load
- Messages cycling with a fade every ~1.8s
- Card disappears automatically once places data loads
- Moving the map afterward shows only the "Search Here" button, not the overlay

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/MapScreen.tsx
git commit -m "feat: show initial loading overlay on map first load"
```
