# Itinerary Screen Redesign — Design Spec
**Date:** 2026-04-25
**Status:** Approved for implementation

---

## Overview

Replace the current video-background itinerary reel (`RouteScreen` + `ItineraryCards`) with a two-mode map-centric experience:

- **Explore mode** — full-screen map canvas for self-building the itinerary
- **Itinerary mode** — 50/50 vertical split (top: map, bottom: swipeable place card) with full intelligence layer

The product shift: users build their own itinerary using LLM-generated reference pins as a discovery scaffold, rather than receiving a pre-built itinerary. Intelligence lives in the card, not as a generated list.

---

## Mode 1: Explore Mode

### Layout
Full-screen map. No bottom card. The map is the entire canvas.

### Reference Pins (Ghost Layer)
When a user selects a destination (e.g. Tokyo), the app fires an LLM prompt:
> *"Give me 8–10 places a [persona type] traveler should visit in [city] for a [N]-day trip."*

This generates a reference set of pins rendered as **muted ghost pins** (purple, 50% opacity, no animation). These are suggestions, not selections. The user can toggle this layer off entirely.

The reference prompt fires at destination selection — before the user adds anything — so pins are ready when the map opens.

### User-Added Pins
When the user adds a place, its pin becomes **active** (blue border, solid background). Four pin states in total:

| State | Visual | Meaning |
|-------|--------|---------|
| Added | Blue border + solid bg | In the itinerary |
| Similar (active) | Teal ripple pulse | Result of "Similar" CTA |
| Reference | Muted purple, 50% opacity | LLM suggestion, not added |
| Favourited | Any pin + ❤️ badge | Saved, not committed |

### Pin Tap → Place Card (25% bottom sheet)
Tapping any pin slides up a lightweight sheet (~25% screen height). Swipe down or tap map to dismiss.

**Card contents:**
- Hero image (Google Photos → Wikipedia fallback)
- Place name + area label (e.g. "Old Delhi")
- Rating + review count (Google Places)
- Travel-date context badge (see below)
- **"Why this for you"** — one sentence, persona-matched (from LLM reference set)
- Max 2 intel pills — only the most critical (e.g. closing time alert, entry requirement)
- **Local tip** — one curated insider line (from LLM)
- Google Maps link pill + Website pill (if available)
- **Primary CTA:** "Add to itinerary" (purple button, full width)
- **Secondary CTA:** "✦ Similar" (outlined button)
- **Heart icon** — top-right of hero image, 🤍 → ❤️ on tap (favourites)

**Travel-date context badge** (replaces "open now"):
- Compares travel date (`tripContext.date`) against Google Places `weekday_text`
- Shows: `"📅 Open · Sat 14 Jun · Closes 5:30 PM"` (green)
- Or: `"⚠️ Closed Fri · Your Day 2 is Friday"` (amber) with suggested fix
- Logic already exists in `pincard-utils.ts` — needs travel date passed as prop

**"Why this for you" + Local tip** come from the same LLM call that generates the reference pins — zero extra latency. For user-discovered places (not in reference set), a separate lightweight LLM call fires on pin tap.

### "Similar Places" CTA Flow
1. Card slides down (dismisses)
2. Map zooms to fit active pin + similar cluster
3. LLM query fires: *"Give me 4 places similar to [place] in [city] for a [persona] — same category, nearby."*
4. Existing map pins that match → immediately glow teal (ripple pulse animation)
5. New results → added as new ghost reference pins (load in after existing pins activate)
6. Dashed teal connector lines draw from active pin to each similar pin
7. Banner at top: *"Similar [category] nearby · Tap to explore · Swipe down to clear"*
8. Swipe down or tap elsewhere clears the similar state

### Favourites (Heart)
Heart icon on top-right of hero. Tap to toggle. Favourited pins show a small ❤️ badge on the map. Favourites are saved to state — separate from "added to itinerary." They persist across explore sessions.

### City Footprint Chips
When the user has explored multiple cities, footprint chips appear at the top of the map:
- Format: `🗼 Tokyo · 4 pins` → `🏯 Kyoto`
- Tapping a chip pans the map back to that city's pin cluster — no screen change
- Shows "places explored" count, not "itinerary stops" (user hasn't planned yet)

---

## Mode 2: Itinerary Mode

Accessed via the "Itinerary" button. Separate screen from explore mode.

### Layout
50/50 vertical split:
- **Top 50%:** Map view
- **Bottom 50%:** Swipeable place card

### Interaction — Bidirectional Sync
- Swipe bottom card left/right → map animates to next/prev pin, route highlights
- Tap a pin on the map → card jumps to that stop
- Both directions always work

### Map Top Half
- Active pin glows (blue, large)
- All other route pins visible (numbered, smaller)
- Route line connects all stops in sequence (blue, with glow layer)
- **Detour:** Amber dashed line + amber pin (not red — amber = opt-in opportunity, not danger)
- **"⛶ Full map" button** top-right → expands map to full screen showing complete route
- Travel-direction labels at bottom edge: `← 12 min walk` / `8 min drive →`

### Map Pins (Itinerary Mode)
Category emoji icon pins with a soft glow route layer. Example: 🏛️ museum, 🍜 food, 🌿 park. Numbered badge overlaid for stop sequence. Active stop pin is larger with a stronger glow.

### Place Card Bottom Half
Swipe dots at top (pagination indicator).

**Card contents (always visible):**
- Stop number + time (e.g. "Stop 2 of 6 · 10:30am")
- Place name (large, bold)
- Area + duration + price level
- **"Why this for you"** block — persona match reason, sequence logic, budget signal
- **Max 2 intel pills** — travel-date open/close alert, entry requirement
- **Detour banner** (amber) — if a detour is suggested near this stop: name, extra time, why it's worth it, one-tap "Add →"
- **Local tip** — one curated insider line
- Google Maps link + Website link
- Action chips: Directions, Book (if applicable)

**Weather background animation:** The card background animates based on live weather at the place's location on the travel date (e.g. rain streaks, sunny shimmer, cloudy drift). Each stop can have a different weather background.

### Sequencing Reveal
When the user transitions from explore → itinerary, the sequencing animation plays:
1. Route line draws itself across the map connecting pins in order
2. Pins renumber in sequence
3. If any pin was reordered: it visually slides to its new position on the map
4. A brief note appears: *"Moved Senso-ji earlier — closes at 5pm and matches your morning cultural preference."*
This makes the LLM's sequencing logic visible and trustworthy, not a black box.

---

## Multi-City Experience

### Trigger
Multi-city transition fires when the user **taps a pin in a different city** (geographic jump detected). A confirmation micro-moment appears — a bottom snap: *"Exploring Kyoto?"* — with dismiss option. Prevents accidental city switches while exploring.

### City-Hop Animation
1. Map zooms out showing both cities
2. A dashed arc line draws from City A to City B
3. A small ✈️ icon flies along the arc
4. Map zooms into City B
5. City B reference pins load in during or after the animation

### Story Cards During Load
The animation window serves as the loading state. A story popup appears over the faded map background:
- Heavy travel imagery + micro-animation
- **Context-aware content:** e.g. Tokyo → Kyoto: *"Kyoto has 1,600 temples. Most visitors only see 3."*
- Persona-filtered: food persona → food story; first-timer → orientation story
- Stories rotate every 4–5 seconds
- If data loads mid-story, animation finishes current card before transitioning (not abrupt)
- Story content generated as part of the same LLM call as City B reference pins — no extra latency

### Context-Chain LLM Prompt
Each city's reference prompt passes forward context from previous cities:
```
City 2 prompt: "What should a [persona] traveler do in [City 2] arriving from [City 1]
after spending [N] days there doing [City 1 user picks]? [N]-day trip."
```
This means a Tokyo heavy-temple user gets different Kyoto recommendations than someone arriving cold. The intelligence compounds across cities.

### City Footprint in Multi-City
- Footprint chip persists: `🗼 Tokyo · 4 pins → 🏯 Kyoto`
- Footprint shows user's map actions in previous city, not a planned itinerary
- Full itinerary view (both cities) only accessible via the Itinerary button

---

## What's Removed

| Removed | Reason |
|---------|--------|
| Video ambient background | Replaced by weather animation on card |
| "Open now" badge | Meaningless for future travel dates |
| Google editorial summary on pin card | Generic copy; replaced by persona-matched "Why this for you" |
| Type chips on pin card | No decision value at add-or-not stage |
| Wikipedia link | Sends user out of app; Google Maps link retained |
| Directions CTA on pin card | Explore mode is not navigation; replaced by "Similar" |
| Fit percentage bars | Replaced by qualitative "Why this for you" text |

---

## Data Sources

| Signal | Source |
|--------|--------|
| Place name, rating, hours, photo | Google Places (existing) |
| "Why this for you" | LLM, generated with reference pin set |
| Local tip | LLM, generated with reference pin set |
| Reference pins | LLM, persona-filtered on destination select |
| Similar places | LLM, fired on "Similar" CTA tap |
| Story card content | LLM, included in city-hop reference call |
| Travel-date open/closed | Google Places `weekday_text` + `tripContext.date` |
| Weather background | Existing `WeatherData` + `WeatherCanvas` |

---

## Files Affected

**Modified:**
- `src/modules/route/RouteScreen.tsx` — replace with new mode router
- `src/modules/map/PinCard.tsx` — enhanced card with intelligence layer
- `src/modules/map/pincard-utils.ts` — add travel-date comparison logic

**New:**
- `src/modules/route/ItineraryMapCard.tsx` — itinerary mode split-screen component
- `src/modules/route/ItineraryPlaceCard.tsx` — bottom card in itinerary mode
- `src/modules/map/SimilarPins.tsx` — similar places state + animation
- `src/modules/map/CityHopOverlay.tsx` — multi-city transition animation + story cards
- `src/modules/map/FootprintChips.tsx` — city footprint chip bar

**Unchanged:**
- `src/modules/map/MapLibreMap.tsx` — map rendering unchanged
- `src/modules/route/useRoute.ts` — hook unchanged

**Type additions needed in `src/shared/types.ts`:**
- `ReferencePin` — place name, lat/lon, category, why-rec text, local tip
- `CityFootprint` — city name, emoji, pin count, lat/lon center
- `StoryCard` — image URL, headline, body text, city context
- `FavouritedPin` — place id, title, lat/lon, city
- `PinState` — `'added' | 'reference' | 'similar' | 'favourited'`
