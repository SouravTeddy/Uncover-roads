# Issue 5 — Persona Messages on All Places
**Date:** 2026-04-27
**Scope:** Persona-aware badges + lazy LLM insight on every place, across map and itinerary

---

## Problem

Every place on the map and in the itinerary currently shows a blank "Why this for you" section unless it came from Our Picks (which has an LLM-generated `reason`). The app has full persona data available but doesn't use it to communicate with the user about regular places.

Goal: show why a place matches (or conflicts with) the user's persona everywhere — visually first (badges), with a compact LLM sentence on demand. Consistent across map PinCard and itinerary stop cards.

---

## Design

### Two-tier model

| Tier | Where | Latency | Content |
|------|-------|---------|---------|
| Badges | Map PinCard + Itinerary stop | Zero (client-side) | 1–2 factual signal pills |
| Insight sentence | Map PinCard | ~1s (lazy LLM, cached) | 1 sentence, ≤20 words |
| Insight paragraph | Itinerary stop | ~1s (lazy LLM, cached) | 2–3 sentences + practical note |

Shimmer placeholder shown whenever async content is in-flight — never a blank gap.

---

## Section 1 — Persona Badges

Computed client-side from `persona` + `place`. Zero API calls. Pure function.

**Badge rules (evaluated in order, max 2 shown on map, all shown on itinerary):**

| Condition | Badge text | Style |
|-----------|-----------|-------|
| `place.category` in persona `venue_filters` | `✓ Matches your taste` | green |
| `place.price_level > profile.price_max` | `⚠ Above your budget` | amber |
| `place.price_level` defined and `<= profile.price_min` | `✓ Budget-friendly` | green |
| `profile.dietary` includes `halal_certified_only` + place has no halal tag | `⚠ Halal not confirmed` | amber |
| `profile.dietary` includes `vegan_boost` + place tags include vegan/vegetarian cuisine | `✓ Vegan-friendly` | green |
| `profile.social_flags` includes `family` or `kids` + category is `park` or `museum` | `✓ Family-friendly` | blue |
| `profile.pace` is `slow` + category is `museum` or `historic` | `✓ Good for slow exploration` | indigo |

**Implementation:** Pure function `computePersonaBadges(place: Place, persona: Persona, profile: PersonaProfile | null): PersonaBadge[]` in new file `frontend/src/modules/map/pincard-persona.ts`. `PersonaProfile` holds `price_min/max`, `dietary`, `social_flags`, `pace` — it is `state.personaProfile` in the store, separate from `state.persona`.

```typescript
interface PersonaBadge {
  text: string;
  color: string;    // text color
  bg: string;       // background rgba
  border: string;   // border rgba
}
```

Merges into the existing `intelPills` array in PinCard — same visual pill style, no new component.

---

## Section 2 — LLM Persona Insight

### Backend: `POST /persona-insight`

**Request:**
```json
{
  "place_title": "Koffie Noir",
  "place_category": "cafe",
  "city": "Amsterdam",
  "persona_archetype": "Slow Traveller",
  "persona_desc": "Prefers unhurried, local experiences...",
  "mode": "map",
  "tags": { "cuisine": "coffee", "opening_hours": "Mo-Su 08:00-18:00" },
  "price_level": 2,
  "dietary_flags": ["vegan_boost"]
}
```

**Prompts:**

*map mode* — system: "You are a travel assistant. In one sentence of 20 words or fewer, explain why this specific place suits this traveler. Be concrete, not generic."

*itinerary mode* — system: "You are a travel assistant. In 2-3 sentences, explain why this place suits this traveler. Include one practical tip (best time to visit, what to order, or a heads-up if relevant)."

**Response:**
```json
{ "insight": "A quiet neighbourhood cafe that suits your unhurried pace." }
```

**Error handling:** Return `{ "insight": null }` on any failure. Frontend treats `null` as "no sentence" — badges still show.

**Skip condition:** If `place.reason` is already set (Our Picks), the frontend uses it directly and skips the endpoint call.

### Frontend: `usePersonaInsight` hook

Location: `frontend/src/modules/map/pincard-persona.ts` (same file as badge logic)

```typescript
function usePersonaInsight(
  place: Place,
  persona: Persona | null,
  mode: 'map' | 'itinerary',
  insightCache: React.MutableRefObject<Map<string, string>>
): { insight: string | null; loading: boolean }
```

- Cache key: `${place.id}:${mode}`
- If `place.reason` is set → return `{ insight: place.reason, loading: false }` immediately
- Otherwise fire `POST /persona-insight`, cache result, return while loading
- Cache lives on a `useRef` in the parent (PinCard owner / itinerary card owner) — survives re-renders, resets on navigation

---

## Section 3 — Shimmer Primitive

New shared component: `frontend/src/shared/Shimmer.tsx`

```typescript
export function ShimmerLine({ width?: string | number, height?: number }): JSX.Element
export function ShimmerBlock({ lines?: number }): JSX.Element  // lines default 2, last line 60% width
```

Style: `background: rgba(255,255,255,0.06)`, CSS `@keyframes shimmer` left-to-right sweep with `rgba(255,255,255,0.10)` highlight, `border-radius: 6px`. Matches dark-glass app aesthetic.

**Usage locations:**
- PinCard: `<ShimmerLine width={180} height={12} />` below badges while insight loading
- ItineraryPlaceCard: `<ShimmerBlock lines={2} />` while insight loading
- Any place images still loading (where currently blank)

---

## Section 4 — Integration

### PinCard (`frontend/src/modules/map/PinCard.tsx`)

Props change: add `insightCache: React.MutableRefObject<Map<string, string>>`.

Render order in the "Why this for you" section:
1. Persona badges row (instant, from `computePersonaBadges`)
2. `{loading ? <ShimmerLine /> : insight && <InsightText>}`
3. Signal badge (existing — only for Our Picks)

The `insightCache` ref is owned by `MapScreen` (passed down to PinCard). Same ref instance persists for the session.

### ItineraryPlaceCard (`frontend/src/modules/route/ItineraryPlaceCard.tsx`)

- Call `usePersonaInsight(matchedPlace, persona, 'itinerary', insightCache)`
- Replace the existing `refPin?.whyRec ?? matchedPlace?.reason` block with: badges → shimmer/insight
- `insightCache` ref owned by `ItineraryView` or `RouteScreen`

### API client (`frontend/src/shared/api.ts`)

Add:
```typescript
personaInsight: (params: { ... }) => post<{ insight: string | null }>('/persona-insight', params)
```

---

## Files Changed

| File | Change |
|------|--------|
| `main.py` | New `POST /persona-insight` endpoint |
| `frontend/src/shared/Shimmer.tsx` | New — `ShimmerLine`, `ShimmerBlock` |
| `frontend/src/shared/api.ts` | Add `personaInsight()` |
| `frontend/src/modules/map/pincard-persona.ts` | New — `computePersonaBadges`, `usePersonaInsight` |
| `frontend/src/modules/map/PinCard.tsx` | Use badges + shimmer + insight; accept `insightCache` prop |
| `frontend/src/modules/map/MapScreen.tsx` | Own `insightCacheRef`, pass to PinCard |
| `frontend/src/modules/route/ItineraryPlaceCard.tsx` | Add badges + shimmer + insight (itinerary mode) |
| `frontend/src/modules/route/ItineraryView.tsx` (or RouteScreen) | Own `insightCacheRef`, pass down |
| `frontend/src/modules/map/pincard-persona.test.ts` | New — badge logic + hook tests |

---

## Out of Scope
- Persisting insights across sessions (session cache only)
- Retroactively enriching cached map data with insights
- Rate limiting / cost controls on `/persona-insight` (operational concern)
