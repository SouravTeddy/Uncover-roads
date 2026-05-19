# Guide Feature Design

**Date:** 2026-05-19
**Revised:** 2026-05-19
**Status:** Approved (v2)

---

## Overview

The Guide feature is a user-triggered discovery tool that helps travellers build their itinerary faster. It surfaces contextual, logic-based nudges — never AI, never proactive — based on what the user is currently doing on the map.

Two surfaces compose the feature:

1. **Bulb icon** — floating on the map, user-triggered, shows contextual guide messages as a stacked history panel
2. **"Our take" section** — native section inside every pin card, always visible when relevant data exists

Both use only client-side logic and Google Places data. **No LLM calls. No new API endpoints. No AI-generated text.**

---

## Bulb Icon

### Placement
Positioned top-right on the map, at the same level as the FilterBar chips but independently floated (absolutely positioned). It never overlaps the filter chips.

### States

| State | Visual |
|---|---|
| **Idle** (no unread messages) | Muted icon, `text-2` colour, no dot |
| **New message** | Dot bounces in, blinks for ~3s, then rests solid gold. Bulb icon warms to gold. Glow ring behind button. |
| **Subsequent new message** | Blink animation replays for ~3s, then rests solid again |
| **Resting unread** | Dot solid gold (no animation) — indicates unread messages without demanding attention |
| **Active** (panel open) | Bulb fills gold, dot hides, panel reveals all history |

### Dot animation detail

- **Entry + blink phase** (~3s): `scale(0) → scale(1.35) → scale(1)` bounceIn, then 3–4 blink pulses (`opacity 1 → 0.2 → 1`, 400ms each)
- **Resting phase**: solid dot, no animation, stays visible as long as there are unread messages
- **Re-trigger**: when a new message is appended to history, the blink phase replays regardless of whether the dot is already visible
- **Panel open**: dot hides entirely; all messages in history are marked read
- **Panel closed**: if unread messages remain, dot returns to resting solid state (no blink — blink only on new arrival)

### Interaction
- Tap bulb → panel reveals (spring: `cubic-bezier(.22,1,.36,1)`, origin top-right)
- Message cards stagger in with `translateY(12px) → 0` at 70ms intervals
- Tap close or tap bulb again → panel springs back out
- Opening the panel marks all messages as read (clears unread state)
- Map remains fully interactive while panel is open — no dimming, no mode switch

### Message history model

The panel is a **session-scoped notification inbox**, not a live single-message display.

- Each time a new message fires, it is **appended** to a history list (newest at top)
- Messages persist in history even after their triggering condition is no longer true (e.g. the area nudge stays visible after the user adds places)
- History resets when the user navigates away from the map screen
- Opening the panel marks all messages as read — dot hides on close
- No deduplication within a session: if the same trigger fires again after being resolved (e.g. user removes all places, re-triggering the area nudge), a new entry is appended

---

## Trigger Logic (client-side only)

The dot lights up and a message is appended to history when ANY of the following conditions become true. All logic is pure client-side — no AI, no API calls beyond what is already loaded.

### When the bulb fires

| # | Condition | Message kind | Copy |
|---|---|---|---|
| 1 | `selectedPlaces.length === 0 && city != null && persona != null` | `area` | Persona-aware area nudge (see below) |
| 2 | `activePlace?.category === 'event'` + matching `liveEvent` (same genre, within travel dates) | `event` | `"Another [genre] event nearby — [event title]"` |
| 3 | `selectedPlaces.length >= 2` + build readiness condition (see below) | `exploring` | Build readiness nudge (see below) |
| 4 | `selectedPlaces.length >= 2` + geographic cluster condition (see below) | `exploring` | Cluster signal (see below) |

**Conflicts are NOT a bulb trigger.** Hard blockers are owned entirely by the Build CTA amber badge and BlockerSheet. The bulb does not duplicate this.

**Category-gap nudges are NOT a bulb trigger.** Telling users they've only added parks and should add cafes overestimates intent. Category balance belongs in the itinerary screen which has full day/time context.

### When the bulb does NOT fire (idle, no dot)

| Condition | Reason |
|---|---|
| No city selected | No context to generate any message |
| No persona set | Area message requires archetype; other messages still work |
| Exactly 1 place selected, no active event pin | Insufficient signal for any message |
| Places array not yet loaded | Avoid firing on stale/empty data |
| Panel is already open | Dot is hidden while panel is open |

---

## Message Copy (no AI — all derived from existing data)

### 1. Area nudge (0 places selected)

**Data used:** `places` array (already loaded map pins), `persona.venue_filters` (archetype's preferred categories), `persona.archetype_name`, `city`

**Logic:**
```
matchingPins = places.filter(p => persona.venue_filters.includes(p.category))
count = matchingPins.length
dominantCategory = most frequent category in matchingPins
```

**Copy template:**
> "[count] [dominantCategory label] spots are on this map — based on your interests, those are your best starting points in [city]"

**Examples:**
- Historian in Paris, 14 museum/historic pins → *"14 museums and historic sites are on this map — based on your interests, those are your best starting points in Paris"*
- Epicurean in Tokyo, 9 restaurant/café pins → *"9 food and café spots are mapped — based on your interests, those are your best starting points in Tokyo"*
- Wanderer in Lisbon, 11 park/café pins → *"11 open spaces and cafés are on this map — based on your interests, those are your best starting points in Lisbon"*

If `matchingPins.length === 0` (no pins match persona): fall back to total pin count with neutral copy:
> "There are [total] spots on this map — tap any pin to start exploring [city]"

**Category label map** (used in copy, not shown as raw category string):

| category | label |
|---|---|
| `museum` | museums |
| `historic` | historic sites |
| `restaurant` | restaurants |
| `cafe` | cafés |
| `park` | parks and open spaces |
| `tourism` | landmarks |
| `place` | local spots |
| `event` | events |

When multiple categories are dominant (within 20% of each other), combine: `"museums and historic sites"`, `"restaurants and cafés"`, etc. Max 2 categories combined.

---

### 2. Event nudge (viewing an event pin)

**Data used:** `activePlace.tags.genre`, `liveEvents`, `travelStartDate`, `travelEndDate`

**Logic:** identical to original spec — find a different event with matching genre whose date falls within travel range.

**Copy:**
- With genre: *"Another [genre] event nearby — [event title]"*
- Without genre: *"Another event like this nearby — [event title]"*

---

### 3. Exploring — build readiness nudge

**Data used:** `selectedPlaces.length`, `days` (trip duration), `personaProfile.stops_per_day`

**Condition:** `selectedPlaces.length >= Math.floor(days * personaProfile.stops_per_day * 0.8)`

**Copy:**
> "You've nearly filled [days] day[s] — ready to build your itinerary?"

This is the primary message that moves users toward the Build CTA. It fires once the selection is ~80% of a full itinerary for the trip length.

If `days === 0` or `personaProfile` is null, this sub-message does not fire.

---

### 4. Exploring — geographic cluster signal

**Data used:** `selectedPlaces` lat/lon values

**Condition:** bounding box of all selected places has diagonal < 800m AND `selectedPlaces.length >= 3`

**Bounding box diagonal:**
```
latDiff = max(lats) - min(lats)
lonDiff = max(lons) - min(lons)
diagonal ≈ sqrt((latDiff * 111000)² + (lonDiff * 111000 * cos(avgLat))²)  // metres
```

**Copy:**
> "Your picks are all close together — great for a focused day, or spread out to cover more of [city]"

This is a neutral observation, not a judgement. It fires at most once per session (not repeated if the user keeps adding nearby places).

---

## "Our Take" Section in Pin Card

### When it appears
Only when `computePersonaBadges()` returns at least one badge for the active persona and profile. If no badges apply, the section is hidden entirely — no empty state.

### Content
Renders the output of `computePersonaBadges(place, persona, profile, 'map')` as small chips (icon + label). Max 2 chips in map mode.

No LLM call. `usePersonaInsight` is not used here.

### Design
Minimal chip row inside the pin card, below the main place info. Label: **"Our take"** in `text-3`, chips use existing `sage`, `sky`, `amber`, `primary` colour tokens.

---

## Build CTA — Hard Blocker Handling

### Hard blocker badge (owned here, not by bulb)
When ≥ 1 hard blocker exists on selected places, an amber `!` badge appears on the Build CTA (top-right corner, `scale(0) → scale(1)` spring). The last dot in the stack turns amber.

Tapping the `!` badge or the Build button when blockers exist opens the Blocker Sheet.

### Blocker Sheet
Slides up from bottom (`translateY(100%) → 0`, `.48s` spring). Backdrop dims at `rgba(0,0,0,.35)`.

Contents:
- Header: warning icon + "Heads up before you build" + blocker count
- One row per hard blocker: place name + specific reason (e.g. "Closed on Wednesdays · your trip includes Wed May 28")
- Note line: "Soft suggestions like pacing and sequence are in your itinerary."
- Two CTAs: **"I'll fix it"** (ghost, closes sheet) and **"Build anyway →"** (gold, proceeds to build)

### Hard blocker definition (3 cases only)
1. `permanently_closed: true` on the Google Places record
2. Opening hours from Google Places do not cover the user's travel dates
3. Event pin whose `event_date` falls outside the travel date range

Soft blockers (pacing, sequence, weather, too many places per day) are NOT shown here. They belong in the itinerary screen.

---

## Domain Boundary: Map Guide vs Itinerary

| Concern | Owned by |
|---|---|
| Is this place open on my dates? | Map Guide — hard blocker (CTA badge + BlockerSheet) |
| Does this place match my persona? | Map Guide — "Our take" in PinCard |
| Another event like this nearby? | Map Guide — bulb event nudge |
| Where should I start based on my interests? | Map Guide — bulb area nudge |
| Am I close to a full itinerary? | Map Guide — bulb build readiness nudge |
| Are my picks geographically spread? | Map Guide — bulb cluster signal |
| Does my category mix make sense? | Itinerary screen — has full day/time context |
| Too many places for day 1? | Itinerary screen |
| Will it rain on that day? | Itinerary screen |
| Is the sequence efficient? | Itinerary screen |
| Pacing (too rushed)? | Itinerary screen |

---

## What this feature is NOT

- **Not AI** — zero LLM calls, zero generative text anywhere in this feature
- **Not proactive** — bulb never auto-opens, no toasts, no push nudges
- **Not prescriptive about categories** — never tells users what category of place to add next
- **Not a conflict surface** — conflict detection lives on the Build CTA only
- **Not a search** — no input, no free-text query
- **Not a mode** — map remains fully interactive at all times

---

## Files to change

| File | Change |
|---|---|
| `frontend/src/modules/map/MapScreen.tsx` | Pass `persona`, `personaProfile`, `places` to `useGuideMessages`; wire `GuideBulb` and `BlockerSheet` |
| `frontend/src/modules/map/GuideBulb.tsx` | Update dot animation (entry blink → resting solid); render message history stack in panel |
| `frontend/src/modules/map/useGuideMessages.ts` | Rewrite: returns `messages: GuideMessage[]` history + `hasUnread: boolean`; remove conflict trigger; add persona-aware area logic; add build readiness + cluster exploring logic |
| `frontend/src/modules/map/PinCard.tsx` | "Our take" section — no changes needed |
| `frontend/src/modules/map/BottomActionTray.tsx` | Hard blocker badge — no changes needed |
| `frontend/src/modules/map/BlockerSheet.tsx` | Hard blocker detail sheet — no changes needed |
| `frontend/src/modules/map/useHardBlockers.ts` | Hard blocker detection — no changes needed |
