# Enhanced Pin Card Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## Goal

Replace the current minimal PinCard with a rich detail view that shows a Google Place photo, full place details (rating, hours, address, phone, website), and a clear loading skeleton while data fetches.

---

## Layout — Option B (Immersive)

Full-width hero image with place name and rating overlaid at the bottom via gradient. All place details below the image. No persona insight text.

---

## Visual Structure

### Hero Image Section
- Full-width image from Google Place Photos (`photo_ref` → `/place-photo` backend endpoint)
- Dark gradient overlay from bottom (transparent top → 92% black at bottom)
- **Top-left badge:** category label (Restaurant / Cafe / Park etc.) — pill with blur backdrop
- **Top-right:** close (✕) button — same pill style
- **Bottom-left overlay:** place name (large, bold, white) + rating row below it
- Rating row: `★ 4.7  1,240 reviews  ● Open  $$$`

### Details Section (below image)

1. **Cuisine / type tags** — horizontal scrollable pills from Google `types[]` array, cleaned up (remove generic types like `point_of_interest`, `establishment`)
2. **Hours row** — clock icon + "Open now · Closes 11 pm" (or "Closed · Opens 9 am"). Tapping expands to full Mon–Sun schedule from `weekday_text[]`
3. **Address row** — pin icon + formatted address. "Get directions ↗" link opens `maps.apple.com/?q=<lat>,<lon>` on iOS, `maps.google.com/maps?q=<lat>,<lon>` on others
4. **Contact row** — phone and website side by side in two equal-width tappable tiles

### Action Bar
- **"Add to trip"** — full-width primary button (indigo)
- **"↗" open** — square secondary button, opens place in Google Maps / website

---

## Loading State

While Google details fetch (~1s), show a skeleton:
- Hero area: grey rectangle with shimmer animation
- Two skeleton lines where name/rating will be
- Skeleton pills for type tags
- Three skeleton rows for hours / address / contact
- Disabled action buttons (greyed out)

The existing OSM data (`place.title`, `place.category`) renders immediately — only the Google-enriched section (image, rating, hours, address, phone, website) skeletons.

---

## Data Sources

| Field | Source | Availability |
|---|---|---|
| Hero image | Google Place Photo API via `/place-photo?photo_ref=&max_width=800` | After Google fetch |
| Name | `place.title` (OSM) | Immediate |
| Category badge | `place.category` (OSM) | Immediate |
| Rating + count | `details.rating`, `details.rating_count` | After Google fetch |
| Open/closed | `details.open_now` | After Google fetch |
| Price level | `details.price_level` (0–4 → free/$/$$/$$$/$$$$) | After Google fetch |
| Type tags | `details.types[]` (filtered) | After Google fetch |
| Hours | `details.weekday_text[]` | After Google fetch |
| Address | `details.address` | After Google fetch |
| Phone | `details.phone` | After Google fetch |
| Website | `details.website` | After Google fetch |

---

## Backend Change Required

Add `/place-photo` endpoint to proxy Google Place Photos (API key must not be exposed to frontend):

```
GET /place-photo?photo_ref=<ref>&max_width=800
```

Returns a redirect to the Google-signed photo URL. Frontend uses this as `<img src>`.

Cost: $0.007 per photo request. Cached by browser (no repeat cost for same session).

---

## Type Tag Filtering

Google `types[]` often includes noise. Filter out these generic types before displaying:
```
point_of_interest, establishment, food, store, premise, subpremise,
geocode, street_address, route, locality, political
```

Display max 3 tags. Title-case each word.

---

## Directions Link

```ts
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const mapsUrl = isMac
  ? `maps://maps.apple.com/?q=${lat},${lon}`
  : `https://maps.google.com/maps?q=${lat},${lon}`;
```

---

## Files to Change

| File | Change |
|---|---|
| `frontend/src/modules/map/PinCard.tsx` | Full redesign per spec |
| `frontend/src/modules/map/usePlaceDetails.ts` | Add photo URL fetching |
| `frontend/src/shared/api.ts` | Add `getPlacePhotoUrl(photoRef)` |
| `backend/main.py` | Add `GET /place-photo` endpoint |

---

## What Does NOT Change

- `usePlaceDetails.ts` fetch logic (already works)
- `MapScreen.tsx` wiring (already passes `details` + `detailsLoading` to PinCard)
- Supabase cache (already caches `photo_ref` alongside other details)
- No persona-related content anywhere in this card
