# Map Initial Loading Overlay

**Date:** 2026-04-01
**Status:** Approved

## Problem

When the map screen first loads, there's a ~1–2s gap while the map tiles render and the first places API call runs. Currently only a tiny corner spinner shows. Users have no feedback that anything is happening, making the screen feel stuck.

## Solution

A center floating card overlay — visible only during the initial map load — with a cycling spinner and quirky rotating messages. Disappears automatically once data loads. Does not appear on subsequent map moves (those use the existing "Search Here" CTA).

## Component: `MapLoadingOverlay`

A self-contained component at `src/modules/map/MapLoadingOverlay.tsx`.

**Responsibilities:**
- Renders an absolutely-positioned frosted-glass card centered over the map
- Manages its own message cycling internally (no external state needed)
- Accepts a single `visible: boolean` prop — parent controls when to show/hide

**Visual spec:**
- Card: `rgba(15,20,30, 0.93)` background, `blur(20px)` backdrop filter, `1px solid rgba(255,255,255, 0.11)` border, `border-radius: 22px`, `padding: 24px 32px`
- Spinner: 38px ring, `border-top-color: #3b82f6`, 1s linear spin animation
- Message text: 14px, `font-weight: 600`, white, fades out over 400ms then new message fades in
- Sub-label: "hang tight", 11px, `rgba(255,255,255, 0.28)`, static
- Z-index: 30 (above map tiles and pins, below existing UI overlays at z-index 35+)

**Message list** (shuffled on mount, cycled every 1800ms):
- Sketching Roads...
- Cooking hotspots...
- Loading something...
- Finding hidden gems...
- Waking up the city...
- Sniffing out cafés...
- Mapping the vibes...
- Connecting the dots...

**Animation:**
- Messages cycle every 1800ms
- On each cycle: fade opacity to 0 over 400ms, swap text, fade back to 1
- Message list is shuffled once on component mount (Fisher-Yates)
- Interval is cleared on unmount

## Integration in `MapScreen`

**New state:**
```ts
const [initialLoading, setInitialLoading] = useState(true);
```

**Where it clears:**
`handleSearchHere` is called once on initial load by `MapReadyTrigger`. Add `setInitialLoading(false)` in the `finally` block of that call — but only when it's the initial call (i.e. when `overrideBbox` is provided, since `MapReadyTrigger` always passes a bbox).

**Render:**
```tsx
<MapLoadingOverlay visible={initialLoading} />
```

Placed inside the `<div className="fixed inset-0">` wrapper, after the `<MapContainer>`.

## What doesn't change

- The existing corner spinner (`loading` state) remains for "Search Here" loads
- `useMap` and `useMapMove` are untouched
- No changes to `MapReadyTrigger` logic

## Files changed

| File | Change |
|------|--------|
| `src/modules/map/MapLoadingOverlay.tsx` | New component |
| `src/modules/map/MapScreen.tsx` | Add `initialLoading` state, render `<MapLoadingOverlay>` |
