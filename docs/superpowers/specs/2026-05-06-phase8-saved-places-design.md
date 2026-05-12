# Phase 8 — Saved Places + Bottom Nav Update
**Date:** 2026-05-06
**Status:** Approved for implementation

---

## 1. Overview

Phase 8 activates the muted Community tab in the bottom nav, replacing it with a **Saved** tab (bookmark icon). The existing TripsScreen becomes the Itinerary sub-tab. A new Saved sub-tab shows hearted places and saved events, grouped by city, in a masonry layout.

---

## 2. Bottom Nav Update

### Before
| Position | Label | Screen | Status |
|---|---|---|---|
| 1 | Explore | destination/map | Active |
| 2 | Itinerary | trips/route | Active |
| 3 | Community | — | Muted |
| 4 | Profile | profile | Active |

### After
| Position | Label | Icon | Screen | Status |
|---|---|---|---|---|
| 1 | Explore | explore | destination/map | Active |
| 2 | Saved | bookmark | saved (new) | Active |
| 3 | Profile | person | profile | Active |

Community tab is removed. Three-tab nav. The Saved tab absorbs both past itineraries and saved places via sub-tabs.

### File to update
`frontend/src/shared/ui/BottomNav.tsx`

---

## 3. Saved Screen — two sub-tabs

### Header
Screen title: **"Saved"** (Playfair Display, 22px)

Sub-tabs below title:
- **Itineraries** — existing TripsScreen content moved here
- **Saved** — new saved places view (active by default if user has saved places, otherwise Itineraries)

---

## 4. Saved sub-tab — layout and behaviour

### City groups
Saved places are grouped by city. Each group has:
1. City header row: `🗼 Tokyo · 4 places · 1 event`
2. Masonry grid of place cards
3. Saved events (if any) in amber cards below the grid
4. "Open [city] on map" CTA button
5. Date nudge (if travel dates are missing or past)

### Masonry grid
- 2-column grid
- First place card in each city group is **tall** (spans 2 rows) — gives visual rhythm
- Remaining cards are compact (single row)
- Each card: category emoji placeholder + gradient background, place name, category label, ❤️ badge top-right
- No photo API required for MVP — emoji + gradient per category is sufficient

### Category gradient palette (per `--color-*` tokens)
| Category | Gradient |
|---|---|
| Historic / Museum | warm brown `#2d1f18 → #1a130e` |
| Park / Nature | warm green `#1a2018 → #111a0e` |
| Restaurant / Food | warm red `#201818 → #150f0f` |
| Beach / Tourism | warm blue-grey `#182028 → #0f1620` |
| Default | `--surface2 → --bg2` |

### Saved events
- User can save local events from the map (heart / long-press on event card)
- Events appear below place cards in each city group
- Styling: `--color-amber-bg` background, `--color-amber-bdr` border
- Format: `🎆 Sumida River Fireworks · Jul 26 · Annual · Asakusa` + amber "Event" badge

### "Open on map" CTA
- Appears at bottom of each city group
- Tap → loads map screen centred on that city, travel dates pre-filled
- If travel dates are in the past → show date nudge instead of navigating immediately

### Date nudge (past dates)
```
📅  When are you going to Tokyo?
    We'll check events, weather and opening days.
```
- Sky blue styling (`--color-sky-bg` / `--color-sky-bdr`)
- Tapping opens inline date picker for that city
- Same copy rule as Phase 7 — always explain why we need the date

---

## 5. Map integration — Saved filter chip

When user taps the ❤️ heart on any pin on the map:
- Pin is saved to `favouritedPins` state (already exists)
- A **"Saved"** filter chip appears in the map filter bar (stays until dismissed)
- Tapping "Saved" filter chip shows only hearted pins on the map
- Saved state merges into the Saved tab automatically (reactive — no manual sync needed)

The heart is the only entry point for saving places. No separate "add to saved" flow.

---

## 6. Itineraries sub-tab

Existing `TripsScreen` content moved here unchanged. No redesign in Phase 8 — just re-housed under the Saved tab.

---

## 7. State — what already exists

| State | Type | Already exists |
|---|---|---|
| `favouritedPins` | `FavouritedPin[]` | ✓ in store |
| `TOGGLE_FAVOURITE` | action | ✓ in store |
| `savedItineraries` | `SavedItinerary[]` | ✓ in store |
| Heart on pin card | UI | ✓ on map |

### FavouritedPin shape (existing)
```typescript
interface FavouritedPin {
  placeId: string
  title: string
  lat: number
  lon: number
  city: string
}
```

`city` field is used to group by city in the Saved tab. If `city` is missing on older saved pins, fall back to reverse geocoding or display under "Other."

---

## 8. Saved event type (new)

```typescript
interface SavedEvent {
  id: string
  title: string
  city: string
  date: string | null       // ISO date or null if annual/recurring
  isAnnual: boolean
  venue: string | null
  category: 'festival' | 'concert' | 'market' | 'sport' | 'exhibition' | 'other'
  savedAt: string           // ISO timestamp
}
```

Store action: `SAVE_EVENT` / `REMOVE_EVENT`
Persisted to `ur_ss_saved_events` in localStorage.

---

## 9. Components

| Component | Status | Notes |
|---|---|---|
| `BottomNav.tsx` | Update | Remove Community, add Saved tab (bookmark icon) |
| `SavedScreen.tsx` | New | Parent screen with Itineraries / Saved sub-tabs |
| `SavedPlacesTab.tsx` | New | City groups + masonry grid + events |
| `SavedPlaceCard.tsx` | New | Individual place card in masonry |
| `SavedEventCard.tsx` | New | Amber event card |
| `TripsScreen.tsx` | Keep | File stays in place, unchanged. `SavedScreen` renders it inside the Itineraries sub-tab. No file move. |
| `MapScreen.tsx` | Update | Add "Saved" filter chip when `favouritedPins.length > 0` |
| store.tsx | Update | Add `SavedEvent` type, `SAVE_EVENT` / `REMOVE_EVENT` actions |

---

## 10. Screen registration

Add `saved` to the `Screen` union type in `types.ts`.
Add `saved` to `BottomNav` nav items.
Register `SavedScreen` in `App.tsx` routing.
`saved` is NOT in `OB_SCREENS` set — bottom nav shows on this screen.
