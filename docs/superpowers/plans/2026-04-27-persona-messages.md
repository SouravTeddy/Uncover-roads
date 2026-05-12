# Persona Messages on All Places — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show persona-matched badges and a lazy LLM insight sentence on every place card — consistently across the map PinCard and itinerary stop card — with shimmer loading states so nothing is ever blank.

**Architecture:** Client-side badge rules run synchronously from `computePersonaBadges(place, persona, profile)`. A `usePersonaInsight` hook fires `POST /persona-insight` on first open, caches the result in a session `Map` ref, and returns `{ insight, loading }`. A shared `<ShimmerLine>` / `<ShimmerBlock>` component fills the gap while any async content is in-flight.

**Tech Stack:** React 18, TypeScript, Vitest, FastAPI (Python), Anthropic `claude-haiku-4-5` model.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/shared/Shimmer.tsx` | Create | `ShimmerLine` + `ShimmerBlock` shimmer primitives |
| `frontend/src/shared/api.ts` | Modify | Add `personaInsight()` call |
| `frontend/src/modules/map/pincard-persona.ts` | Create | `computePersonaBadges` pure function + `usePersonaInsight` hook |
| `frontend/src/modules/map/pincard-persona.test.ts` | Create | Tests for badge logic + hook |
| `frontend/src/modules/map/PinCard.tsx` | Modify | Use badges + shimmer + insight; accept `insightCache` + `personaProfile` props |
| `frontend/src/modules/map/MapScreen.tsx` | Modify | Own `insightCacheRef`, pass `persona`/`personaProfile` to PinCard |
| `frontend/src/modules/route/ItineraryPlaceCard.tsx` | Modify | Add badges + shimmer + insight (itinerary mode); accept new props |
| `main.py` | Modify | New `POST /persona-insight` endpoint |

---

## Task 1: Shimmer primitive

**Files:**
- Create: `frontend/src/shared/Shimmer.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/shared/Shimmer.tsx
import React from 'react';

const shimmerKeyframes = `
@keyframes shimmer-sweep {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
`;

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('shimmer-kf')) return;
  const style = document.createElement('style');
  style.id = 'shimmer-kf';
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
}

const baseStyle: React.CSSProperties = {
  borderRadius: 6,
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%)',
  backgroundSize: '800px 100%',
  animation: 'shimmer-sweep 1.4s infinite linear',
};

export function ShimmerLine({
  width = '100%',
  height = 13,
}: {
  width?: string | number;
  height?: number;
}): React.ReactElement {
  injectKeyframes();
  return (
    <div style={{ ...baseStyle, width, height, flexShrink: 0 }} />
  );
}

export function ShimmerBlock({ lines = 2 }: { lines?: number }): React.ReactElement {
  injectKeyframes();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerLine key={i} width={i === lines - 1 ? '60%' : '100%'} height={13} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/shared/Shimmer.tsx
git commit -m "feat: add ShimmerLine and ShimmerBlock loading primitives"
```

---

## Task 2: `computePersonaBadges` — write failing tests first

**Files:**
- Create: `frontend/src/modules/map/pincard-persona.ts`
- Create: `frontend/src/modules/map/pincard-persona.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/modules/map/pincard-persona.test.ts
import { describe, it, expect } from 'vitest';
import { computePersonaBadges } from './pincard-persona';
import type { Place, Persona, PersonaProfile } from '../../shared/types';

const basePlace: Place = {
  id: 'p1', title: 'Test Place', category: 'cafe', lat: 0, lon: 0,
};
const basePersona: Persona = {
  archetype: 'slow_traveller', archetype_name: 'Slow Traveller',
  archetype_desc: 'Prefers quiet unhurried exploration.',
  ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null,
  archetypeData: { name: 'Slow Traveller', desc: '', venue_filters: ['cafe'], itinerary_bias: [] },
  venue_filters: ['cafe'], itinerary_bias: [],
};
const baseProfile: PersonaProfile = {
  stops_per_day: 4, time_per_stop: 60,
  venue_weights: {}, price_min: 1, price_max: 3,
  flexibility: 0.5, day_open: 'coffee', day_buffer_min: 30,
  evening_type: 'dinner_wind', evening_end_time: '22:00',
  social_flags: [], dietary: [], resolved_conflicts: [], auto_blend: false,
};

describe('computePersonaBadges', () => {
  it('returns "Matches your taste" when place category is in venue_filters', () => {
    const badges = computePersonaBadges(basePlace, basePersona, baseProfile);
    expect(badges.some(b => b.text.includes('Matches your taste'))).toBe(true);
  });

  it('returns "Above your budget" when price_level exceeds price_max', () => {
    const place = { ...basePlace, price_level: 4 };
    const badges = computePersonaBadges(place, basePersona, baseProfile);
    expect(badges.some(b => b.text.includes('Above your budget'))).toBe(true);
  });

  it('returns "Budget-friendly" when price_level is at or below price_min', () => {
    const place = { ...basePlace, price_level: 1 };
    const badges = computePersonaBadges(place, basePersona, baseProfile);
    expect(badges.some(b => b.text.includes('Budget-friendly'))).toBe(true);
  });

  it('does not return both budget-friendly and above-budget for the same place', () => {
    const place = { ...basePlace, price_level: 2 };
    const badges = computePersonaBadges(place, basePersona, baseProfile);
    const hasBudget = badges.some(b => b.text.includes('Budget-friendly'));
    const hasOver   = badges.some(b => b.text.includes('Above your budget'));
    expect(hasBudget && hasOver).toBe(false);
  });

  it('returns "Halal not confirmed" for halal_certified_only dietary flag', () => {
    const profile = { ...baseProfile, dietary: ['halal_certified_only' as const] };
    const place   = { ...basePlace, category: 'restaurant' as const, tags: {} };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('Halal not confirmed'))).toBe(true);
  });

  it('returns "Vegan-friendly" when vegan_boost + vegan cuisine tag', () => {
    const profile = { ...baseProfile, dietary: ['vegan_boost' as const] };
    const place   = { ...basePlace, tags: { cuisine: 'vegan' } };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('Vegan-friendly'))).toBe(true);
  });

  it('returns "Family-friendly" when social_flags has family + park category', () => {
    const profile = { ...baseProfile, social_flags: ['family' as const] };
    const place   = { ...basePlace, category: 'park' as const };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('Family-friendly'))).toBe(true);
  });

  it('returns "Good for slow exploration" for slow pace + museum', () => {
    const profile = { ...baseProfile, pace: 'slow' as const };
    const place   = { ...basePlace, category: 'museum' as const };
    const badges  = computePersonaBadges(place, basePersona, profile);
    expect(badges.some(b => b.text.includes('slow exploration'))).toBe(true);
  });

  it('returns empty array when null profile', () => {
    const badges = computePersonaBadges(basePlace, basePersona, null);
    // "Matches your taste" still works (uses persona.venue_filters), price/dietary/pace need profile
    // category match badge should still appear
    expect(badges.some(b => b.text.includes('Matches your taste'))).toBe(true);
  });

  it('returns no more than 2 badges in map mode', () => {
    // Give everything: matching category + price over budget + halal flag
    const profile = { ...baseProfile, price_max: 1, dietary: ['halal_certified_only' as const] };
    const place   = { ...basePlace, price_level: 4, tags: {} };
    const badges  = computePersonaBadges(place, basePersona, profile, 'map');
    expect(badges.length).toBeLessThanOrEqual(2);
  });

  it('returns more than 2 badges in itinerary mode when signals present', () => {
    const profile = { ...baseProfile, price_max: 1, dietary: ['halal_certified_only' as const], social_flags: ['family' as const] };
    const place   = { ...basePlace, price_level: 4, category: 'park' as const, tags: {} };
    // "Above budget" + "Halal not confirmed" + "Family-friendly" + "Matches taste"
    const badges  = computePersonaBadges(place, basePersona, profile, 'itinerary');
    expect(badges.length).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm test -- pincard-persona.test.ts 2>&1 | tail -20
```

Expected: `Error: Cannot find module './pincard-persona'`

- [ ] **Step 3: Implement `computePersonaBadges`**

Create `frontend/src/modules/map/pincard-persona.ts`:

```ts
import { useRef, useState, useEffect } from 'react';
import { api } from '../../shared/api';
import type { Place, Persona, PersonaProfile } from '../../shared/types';

export interface PersonaBadge {
  text: string;
  color: string;
  bg: string;
  border: string;
}

/**
 * Compute persona-match badges from place + persona data.
 * Pure — no side effects, no API calls.
 * @param mode 'map' limits to 2 badges; 'itinerary' returns all.
 */
export function computePersonaBadges(
  place: Place,
  persona: Persona,
  profile: PersonaProfile | null,
  mode: 'map' | 'itinerary' = 'map',
): PersonaBadge[] {
  const badges: PersonaBadge[] = [];

  const green  = { color: '#4ade80', bg: 'rgba(74,222,128,.1)',  border: 'rgba(74,222,128,.25)' };
  const amber  = { color: '#fbbf24', bg: 'rgba(251,191,36,.1)',  border: 'rgba(251,191,36,.25)' };
  const blue   = { color: '#60a5fa', bg: 'rgba(96,165,250,.1)',  border: 'rgba(96,165,250,.25)' };
  const indigo = { color: '#a5b4fc', bg: 'rgba(165,180,252,.1)', border: 'rgba(165,180,252,.25)' };

  // 1. Category matches persona venue_filters
  const venueFilters = persona.venue_filters ?? [];
  if (venueFilters.some(f => f.toLowerCase() === place.category)) {
    badges.push({ text: '✓ Matches your taste', ...green });
  }

  if (profile) {
    // 2. Price level checks
    if (place.price_level != null && place.price_level > 0) {
      if (place.price_level > profile.price_max) {
        badges.push({ text: '⚠ Above your budget', ...amber });
      } else if (place.price_level <= profile.price_min) {
        badges.push({ text: '✓ Budget-friendly', ...green });
      }
    }

    // 3. Dietary: halal
    if (profile.dietary.includes('halal_certified_only')) {
      const tags = place.tags ?? {};
      const isHalal =
        tags.diet_halal === 'yes' ||
        tags.cuisine?.toLowerCase().includes('halal') ||
        tags.amenity?.toLowerCase().includes('halal');
      if (!isHalal) {
        badges.push({ text: '⚠ Halal not confirmed', ...amber });
      }
    }

    // 4. Dietary: vegan-friendly
    if (profile.dietary.includes('vegan_boost')) {
      const cuisine = (place.tags?.cuisine ?? '').toLowerCase();
      if (cuisine.includes('vegan') || cuisine.includes('vegetarian')) {
        badges.push({ text: '✓ Vegan-friendly', ...green });
      }
    }

    // 5. Family-friendly
    const hasFamilyFlag = profile.social_flags.includes('family') || profile.social_flags.includes('kids' as never);
    if (hasFamilyFlag && (place.category === 'park' || place.category === 'museum')) {
      badges.push({ text: '✓ Family-friendly', ...blue });
    }

    // 6. Slow pace + museum/historic
    if (profile.pace === 'slow' && (place.category === 'museum' || place.category === 'historic')) {
      badges.push({ text: '✓ Good for slow exploration', ...indigo });
    }
  }

  return mode === 'map' ? badges.slice(0, 2) : badges;
}

/**
 * Lazy LLM insight hook. Fires once per (placeId + mode), caches result in caller's ref.
 * Returns existing place.reason immediately if present — skips the API call.
 */
export function usePersonaInsight(
  place: Place,
  persona: Persona | null,
  mode: 'map' | 'itinerary',
  insightCache: React.MutableRefObject<Map<string, string>>,
): { insight: string | null; loading: boolean } {
  const cacheKey = `${place.id}:${mode}`;

  // If place already has a reason (Our Picks), use it directly
  if (place.reason) {
    return { insight: place.reason, loading: false };
  }

  const cached = insightCache.current.get(cacheKey);
  const [insight, setInsight] = useState<string | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached && !!persona);

  useEffect(() => {
    if (!persona) return;
    const hit = insightCache.current.get(cacheKey);
    if (hit) { setInsight(hit); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    api.personaInsight({
      placeTitle: place.title,
      placeCategory: place.category,
      city: place._city ?? '',
      personaArchetype: persona.archetype_name ?? persona.archetype,
      personaDesc: persona.archetype_desc ?? '',
      mode,
      tags: place.tags ?? {},
      priceLevel: place.price_level,
    }).then(res => {
      if (cancelled) return;
      const text = res.insight ?? null;
      if (text) insightCache.current.set(cacheKey, text);
      setInsight(text);
    }).catch(() => {
      if (!cancelled) setInsight(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, mode]);

  return { insight, loading };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm test -- pincard-persona.test.ts 2>&1 | tail -20
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/pincard-persona.ts frontend/src/modules/map/pincard-persona.test.ts
git commit -m "feat: add computePersonaBadges and usePersonaInsight (TDD)"
```

---

## Task 3: `api.personaInsight()` — add to api client

**Files:**
- Modify: `frontend/src/shared/api.ts`

- [ ] **Step 1: Add the function**

Find the `recommendedPlaces` function in `api.ts` and add immediately after it:

```ts
  personaInsight: (params: {
    placeTitle: string;
    placeCategory: string;
    city: string;
    personaArchetype: string;
    personaDesc: string;
    mode: 'map' | 'itinerary';
    tags?: Record<string, string>;
    priceLevel?: number;
  }) =>
    post<{ insight: string | null }>('/persona-insight', {
      place_title:       params.placeTitle,
      place_category:    params.placeCategory,
      city:              params.city,
      persona_archetype: params.personaArchetype,
      persona_desc:      params.personaDesc,
      mode:              params.mode,
      tags:              params.tags ?? {},
      price_level:       params.priceLevel ?? null,
    }),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/shared/api.ts
git commit -m "feat: add personaInsight API client call"
```

---

## Task 4: Backend `POST /persona-insight`

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add endpoint after `/recommended-places`**

Find the line `@app.post("/recalibrate")` in `main.py` and insert the following block **before** it:

```python
@app.post("/persona-insight")
def persona_insight_endpoint(body: dict):
    """
    Generate a short persona-matched insight for a single place.
    mode='map'       → 1 sentence, ≤20 words
    mode='itinerary' → 2-3 sentences with a practical tip
    Returns: { insight: str | null }
    """
    if not ANTHROPIC_API_KEY:
        return {"insight": None}

    place_title       = body.get("place_title", "")
    place_category    = body.get("place_category", "place")
    city              = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Traveller")
    persona_desc      = body.get("persona_desc", "")
    mode              = body.get("mode", "map")
    tags              = body.get("tags", {})
    price_level       = body.get("price_level")

    if not place_title:
        return {"insight": None}

    # Build context string from tags
    tag_parts = []
    if tags.get("opening_hours"):
        tag_parts.append(f"opening hours: {tags['opening_hours']}")
    if tags.get("cuisine"):
        tag_parts.append(f"cuisine: {tags['cuisine']}")
    tag_str = "; ".join(tag_parts) if tag_parts else "no extra info"

    price_str = f"price level {price_level}/4" if price_level else "unknown price"

    if mode == "map":
        system = (
            "You are a travel assistant. In exactly one sentence of 20 words or fewer, "
            "explain why this specific place suits this traveler. Be concrete and specific — "
            "mention something about the place itself, not just the archetype."
        )
    else:
        system = (
            "You are a travel assistant. In 2-3 sentences, explain why this specific place "
            "suits this traveler. Include one practical tip: best time to visit, what to order, "
            "or a heads-up if something may not suit them."
        )

    user_msg = (
        f'Place: "{place_title}" ({place_category}) in {city}. '
        f'{price_str}. {tag_str}.\n'
        f'Traveler: "{persona_archetype}" — {persona_desc}.\n'
        f'Write the insight now.'
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        insight = response.content[0].text.strip()
        return {"insight": insight if insight else None}
    except Exception as e:
        print(f"PERSONA INSIGHT ERROR: {e}")
        return {"insight": None}
```

- [ ] **Step 2: Commit**

```bash
git add main.py
git commit -m "feat: add POST /persona-insight backend endpoint"
```

---

## Task 5: Update PinCard to use badges + shimmer + insight

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

- [ ] **Step 1: Add imports at the top of PinCard.tsx**

After the existing imports, add:

```tsx
import { ShimmerLine } from '../../shared/Shimmer';
import { computePersonaBadges, usePersonaInsight } from './pincard-persona';
import type { Persona, PersonaProfile } from '../../shared/types';
```

- [ ] **Step 2: Add new props to the Props interface**

```tsx
interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  isFavourited: boolean;
  onAdd: () => void;
  onClose: () => void;
  onSimilar: () => void;
  onFavourite: () => void;
  details?: PlaceDetails | null;
  referencePin?: ReferencePin | null;
  travelDate?: string | null;
  persona?: Persona | null;                                           // NEW
  personaProfile?: PersonaProfile | null;                             // NEW
  insightCache?: React.MutableRefObject<Map<string, string>>;         // NEW
}
```

- [ ] **Step 3: Call the badge function and hook inside PinCard**

Inside the `PinCard` function body, after the existing `const reasonSignal = ...` lines, add:

```tsx
  // Persona badges — computed synchronously
  const personaBadges = (persona && personaProfile != null)
    ? computePersonaBadges(place, persona, personaProfile, 'map')
    : [];

  // Lazy LLM insight — uses session cache passed from parent
  const fallbackCache = useRef(new Map<string, string>());
  const activeCache = insightCache ?? fallbackCache;
  const { insight, loading: insightLoading } = usePersonaInsight(
    place, persona ?? null, 'map', activeCache,
  );
```

- [ ] **Step 4: Replace the `whyRec` section in the render**

Find this block (around line 300):

```tsx
          {whyRec && (
            <div style={{ marginBottom: 14 }}>
```

Replace the entire `whyRec` block (from `{whyRec &&` through its closing `</div>}`) with:

```tsx
          {/* Persona badges */}
          {personaBadges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {personaBadges.map((badge, i) => (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 999,
                  fontSize: '0.68rem', fontWeight: 700,
                  color: badge.color,
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                }}>
                  {badge.text}
                </div>
              ))}
            </div>
          )}

          {/* Persona insight — lazy LLM sentence */}
          {(insightLoading || insight) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', color: '#6366f1', marginBottom: 5,
              }}>
                Why this for you
              </div>
              {insightLoading ? (
                <ShimmerLine width={180} height={12} />
              ) : (
                <div style={{
                  fontSize: '0.85rem', color: 'rgba(193,198,215,.85)',
                  lineHeight: 1.55, fontStyle: 'italic',
                }}>
                  {insight}
                </div>
              )}
              {!insightLoading && reasonSignal && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  marginTop: 6, padding: '3px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
                  ...(reasonSignal === 'persona'
                    ? { background: 'rgba(99,102,241,.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,.25)' }
                    : { background: 'rgba(20,184,166,.1)', color: '#5eead4', border: '1px solid rgba(20,184,166,.25)' }
                  ),
                }}>
                  {reasonSignal === 'persona' ? '✦ Matched to your travel style' : "◎ Based on what you've been exploring"}
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/PinCard.tsx
git commit -m "feat: add persona badges + shimmer insight to PinCard"
```

---

## Task 6: Wire MapScreen to pass persona/insightCache to PinCard

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add insightCacheRef + read personaProfile from store**

Find the `const { state, dispatch } = useAppStore();` line in MapScreen. The state already has `persona`. Add `personaProfile` to the destructure and create the cache ref:

```tsx
  const { state, dispatch } = useAppStore();
  // existing: const { city, ... } = state;
  // Add personaProfile to whatever destructure is already there:
  const personaProfile = state.personaProfile ?? null;

  // Session cache for PinCard persona insights
  const insightCacheRef = useRef(new Map<string, string>());
```

Import `useRef` if not already imported (it is — check the existing import).

- [ ] **Step 2: Pass new props to `<PinCard>`**

Find the `<PinCard` usage (around line 712). Add three props:

```tsx
        <PinCard
          place={activePlace}
          city={city}
          isSelected={selectedIds.has(activePlace.id)}
          onAdd={() => togglePlace(activePlace)}
          onClose={() => setActivePlace(null)}
          onSimilar={...}
          isFavourited={activePlace ? favouritedIds.has(activePlace.id) : false}
          onFavourite={...}
          details={...}
          referencePin={...}
          travelDate={...}
          persona={state.persona ?? null}
          personaProfile={personaProfile}
          insightCache={insightCacheRef}
        />
```

(Keep all existing props, just append the three new ones.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: pass persona + insightCache from MapScreen to PinCard"
```

---

## Task 7: Update ItineraryPlaceCard with badges + shimmer + insight

**Files:**
- Modify: `frontend/src/modules/route/ItineraryPlaceCard.tsx`

- [ ] **Step 1: Update Props interface and imports**

At the top of `ItineraryPlaceCard.tsx`, add imports:

```tsx
import { ShimmerBlock } from '../../shared/Shimmer';
import { computePersonaBadges, usePersonaInsight } from '../map/pincard-persona';
import type { Persona, PersonaProfile } from '../../shared/types';
```

Update Props interface:

```tsx
interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  weather?: WeatherData | null;
  referencePins: ReferencePin[];
  travelDate: string;
  onStopChange: (idx: number) => void;
  persona?: Persona | null;                                        // NEW
  personaProfile?: PersonaProfile | null;                          // NEW
  insightCache?: React.MutableRefObject<Map<string, string>>;      // NEW
}
```

Update the function signature to destructure the new props:

```tsx
export function ItineraryPlaceCard({
  stops, selectedPlaces, weather, referencePins, onStopChange,
  persona, personaProfile, insightCache,
}: Props) {
```

- [ ] **Step 2: Add badge + insight computation inside the component**

After the existing `matchedPlace` constant, add:

```tsx
  const personaBadges = (matchedPlace && persona && personaProfile != null)
    ? computePersonaBadges(matchedPlace, persona, personaProfile, 'itinerary')
    : [];

  const fallbackCache = useRef(new Map<string, string>());
  const activeCache = insightCache ?? fallbackCache;
  const { insight, loading: insightLoading } = usePersonaInsight(
    matchedPlace ?? { id: `stop-${activeIdx}`, title: stop?.place ?? '', category: 'place', lat: 0, lon: 0 },
    persona ?? null,
    'itinerary',
    activeCache,
  );
```

- [ ] **Step 3: Replace the "Why this for you" block**

Find this block in the render:

```tsx
        {/* Why this for you */}
        {(refPin?.whyRec || matchedPlace?.reason) && (
          <div style={{ marginBottom: 14 }}>
```

Replace the entire block (through its closing `</div>}`) with:

```tsx
        {/* Persona badges */}
        {personaBadges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {personaBadges.map((badge, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 999,
                fontSize: '0.68rem', fontWeight: 700,
                color: badge.color,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
              }}>
                {badge.text}
              </div>
            ))}
          </div>
        )}

        {/* Why this for you — itinerary mode: 2-3 sentences */}
        {(insightLoading || insight || refPin?.whyRec || matchedPlace?.reason) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: '#6366f1', marginBottom: 5,
            }}>
              Why this for you
            </div>
            {insightLoading ? (
              <ShimmerBlock lines={2} />
            ) : (
              <div style={{
                fontSize: '0.82rem', color: 'rgba(193,198,215,.8)',
                lineHeight: 1.55, fontStyle: 'italic',
              }}>
                {insight ?? refPin?.whyRec ?? matchedPlace?.reason}
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/ItineraryPlaceCard.tsx
git commit -m "feat: add persona badges + shimmer insight to ItineraryPlaceCard"
```

---

## Task 8: Wire ItineraryView to pass new props down

**Files:**
- Modify: `frontend/src/modules/route/ItineraryView.tsx`

- [ ] **Step 1: Find where ItineraryPlaceCard is rendered in ItineraryView.tsx**

```bash
grep -n "ItineraryPlaceCard\|personaProfile\|insightCache" /Users/souravbiswas/uncover-roads/frontend/src/modules/route/ItineraryView.tsx
```

- [ ] **Step 2: Add insightCacheRef + read personaProfile from store**

At the top of the component function in `ItineraryView.tsx`, add:

```tsx
import { useRef } from 'react';
// (useRef may already be imported)

// Inside the component:
const { state } = useAppStore();
const personaProfile = state.personaProfile ?? null;
const insightCacheRef = useRef(new Map<string, string>());
```

- [ ] **Step 3: Pass props to `<ItineraryPlaceCard>`**

Find the `<ItineraryPlaceCard` usage and add:

```tsx
  persona={state.persona ?? null}
  personaProfile={personaProfile}
  insightCache={insightCacheRef}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/ItineraryView.tsx
git commit -m "feat: wire persona + insightCache from ItineraryView to ItineraryPlaceCard"
```

---

## Task 9: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm test 2>&1 | tail -30
```

Expected: all existing tests pass + new `pincard-persona.test.ts` tests pass (≥9 new tests). Total should be ≥ 318.

- [ ] **Step 2: Fix any failures before proceeding**

If any test fails, read the error and fix before moving to the next step.

- [ ] **Step 3: Final commit if anything was fixed**

```bash
git add -p
git commit -m "fix: resolve test failures after persona messages integration"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Persona badges (client-side) → Task 2
- [x] Max 2 badges on map, all on itinerary → `mode` param in `computePersonaBadges`
- [x] LLM insight on demand → Task 4 (backend) + Task 2 (hook)
- [x] Session cache (no repeat calls) → `insightCache` ref pattern
- [x] Shimmer while loading → Tasks 1, 5, 7
- [x] Our Picks `place.reason` skips API call → early return in `usePersonaInsight`
- [x] Map PinCard integration → Tasks 5, 6
- [x] Itinerary stop card integration → Tasks 7, 8
- [x] `PersonaProfile` vs `Persona` field distinction → both threaded through correctly

**Type consistency:**
- `computePersonaBadges(place, persona, profile, mode?)` — consistent across test file, implementation, PinCard, ItineraryPlaceCard
- `usePersonaInsight(place, persona, mode, insightCache)` — consistent across implementation, PinCard, ItineraryPlaceCard
- `PersonaBadge.{ text, color, bg, border }` — consistent across implementation and render code
- `api.personaInsight({ placeTitle, placeCategory, city, personaArchetype, personaDesc, mode, tags, priceLevel })` — matches Task 3 and Task 2 hook call
