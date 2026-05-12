# Onboarding Redesign + Logic Engine Design Spec

**Date:** 2026-04-13
**Status:** Approved

---

## Overview

Replace the current 5-question static onboarding flow with a 7-question contextual system (+ 3 conditional questions) that supports multi-choice answers, inline conflict detection, and a deterministic resolution engine. The OB flow outputs a fully resolved `PersonaProfile` — the itinerary engine receives no raw multi-choice data or unresolved conflicts.

The existing `ip_engine.py` persona scoring and city conflict engine is extended (not replaced) with new input dimensions, new conflict categories, and multi-city sequence checks.

---

## 1. OB Question System

### 1.1 Always-On Questions (7)

Every user sees all 7. Questions are always shown in this order. Question wording adapts based on prior answers (see §1.3).

| Step | Key | Question | Maps to |
|---|---|---|---|
| Q1 | `group` | Who's travelling? | social_flags, venue suitability filter |
| Q2 | `mood` | What's the trip mood? | dominant venue_weights |
| Q3 | `pace` | How do you pace a day? | stops_per_day, time_per_stop |
| Q4 | `day_open` | How do you ease into the day? | day_open block, day_buffer_min |
| Q5 | `dietary` | Any food situation we should know? | dietary flags, restaurant filter |
| Q6 | `budget` | How are you travelling budget-wise? | price_min, price_max |
| Q7 | `evening` | What does a good evening look like? | evening_type, end_time |

### 1.2 Conditional Questions (3)

Triggered by specific answers above. Shown immediately after the triggering question advances.

| Key | Trigger | Question |
|---|---|---|
| Q8 `kid_focus` | Q1 = family | What matters most for the kids? |
| Q9 `budget_protect` | Q6 = budget | What do you protect? |
| Q10 `food_scene` | Q2 = eat_drink | What kind of food scene? |

### 1.3 Contextual Question Wording

The question title and subtitle change based on answers already collected. The answer options and their underlying values never change — only the display text adapts.

Each question has a `contextResolver(obAnswers) → { title, subtitle, optionLabels }` function. Example resolutions:

**Q7 — evening:**

| Prior signals | Title shown |
|---|---|
| Q1=family | "What's a good end time for the day?" |
| Q2=eat_drink | "Where does your evening usually end up?" |
| Q3=slow + Q2=relax | "How do you like to close out a slow day?" |
| Q3=pack | "How late do you push before calling it?" |
| Q5=halal | "What's your kind of evening scene?" |
| default | "What does a good evening look like?" |

**Q4 — day_open:**

| Prior signals | Title shown |
|---|---|
| Q2=relax | "How do you ease into a slow day?" |
| Q3=pack | "How fast do you get going in the morning?" |
| Q1=family | "How does the family start the day?" |
| default | "How do you ease into the day?" |

Context resolvers for all 7 questions are defined in `ob-context-resolvers.ts`.

### 1.4 Multi-Choice Rules

- Q1 (`group`): **single-choice only** — a trip has one group type
- Q2 (`mood`): multi-choice, up to 3
- Q3 (`pace`): multi-choice, up to 2 — hard conflict detection active (see §3)
- Q4 (`day_open`): **single-choice only** — one day-open block per day
- Q5 (`dietary`): multi-choice, all selectable (additive)
- Q6 (`budget`): **single-choice only** — price range is a single span
- Q7 (`evening`): **single-choice only** — one evening block per day
- Q8–Q10 (conditional): multi-choice where applicable

### 1.5 Option Card Design

**Pattern: Image rows (Option A)**

Each answer is a full-width row with:
- Thumbnail image (48×48, rounded 10px) representing the option
- Heading (Plus Jakarta Sans 700) + descriptor (Inter 12px, muted)
- Checkbox at right — animated scale+fill on select
- Selected state: `rgba(59,130,246,0.08)` background, `#3b82f6` border, glow pulse animation
- Hover: 3px right translate, left-side blue gradient bleeds in

**Hidden options CTA**

When contextual filtering removes options:
- A hairline divider CTA appears below visible options: *"These don't feel right? See all options ▾"*
- Hidden options slide in below, desaturated image, reduced opacity
- Badge: `"less common for your trip type"` in orange — small pill, no icon
- Selecting a hidden option restores full styling immediately
- After 2+ hidden-option selections across trips, behavioral learning promotes it to default set

---

## 2. Answer Weight Vectors

Each answer writes into the 9 itinerary dimensions. Multi-choice stacks with decay: **1st pick = 1.0×, 2nd = 0.4×, 3rd = 0.2×**.

### Q1 — Group
```
solo     → social_flags:{solo},   flexibility +0.2,  venue_weights.communal +0.2
couple   → social_flags:{couple}, venue_weights.romantic +0.4, venue_weights.table_for_2 +0.3
family   → social_flags:{family,kids}, time_per_stop +20, venue_weights.family +0.5,
           price_min floor=1, evening_type soft-default=early (overrideable)
friends  → social_flags:{group},  venue_weights.social +0.4, venue_weights.group_booking +0.3
```

### Q2 — Mood
```
explore   → venue_weights:{neighbourhood:0.4, landmark:0.3, viewpoint:0.3}, flexibility +0.2
relax     → stops_per_day -1.5, time_per_stop +30, venue_weights:{park:0.4, spa:0.3, cafe:0.3}
eat_drink → venue_weights:{restaurant:0.5, market:0.4, street_food:0.3}
culture   → venue_weights:{museum:0.5, heritage:0.4, gallery:0.3}
```

### Q3 — Pace
```
slow         → stops_per_day=2.5, time_per_stop=105
balanced     → stops_per_day=4.5, time_per_stop=52
pack         → stops_per_day=7.0, time_per_stop=32
spontaneous  → stops_per_day=3.0, time_per_stop=60, flexibility=1.0
```

### Q4 — Day open
```
coffee    → day_open=coffee,    day_buffer_min=30
breakfast → day_open=breakfast, day_buffer_min=45
straight  → day_open=straight,  day_buffer_min=0,  first_stop_opens_early=true
grab_go   → day_open=grab_go,   day_buffer_min=0,  street_food_am=true
```

### Q5 — Dietary
```
none        → dietary=[]
plant_based → dietary=[vegan_boost, meat_flag]
halal       → dietary=[halal_certified_only]
kosher      → dietary=[kosher_certified_only]
allergy     → dietary=[allergy_warning:{type}]
```

### Q6 — Budget
```
budget      → price_min=1, price_max=1, free_attractions_first=true, street_food_pref=true
mid_range   → price_min=1, price_max=3
comfortable → price_min=2, price_max=4, premium_per_day=1
luxury      → price_min=3, price_max=4, premium_pref=true
```

### Q7 — Evening
```
bars        → evening_type=bars,    evening_end_time="02:00"
dinner_wind → evening_type=dinner,  evening_end_time="22:00"
markets     → evening_type=markets, evening_end_time="23:00"
early       → evening_type=early,   evening_end_time="20:00"
```

---

## 3. OB Conflict System

### 3.1 Hard Conflict Pairs

Detected in real time as user selects. Panel appears inline between the two conflicting rows.

| ID | Pair | Conflicting dimension |
|---|---|---|
| C1 | slow + pack | stops_per_day |
| C2 | budget + luxury | price_level |
| C3 | early_dinner + bars | evening_type |
| C4 | budget + comfortable | price_level |

### 3.2 Soft Conflict Pairs

No inline panel shown. Resolved automatically by the decision engine at OB completion.

| ID | Pair | Engine strategy |
|---|---|---|
| S1 | slow + balanced | Morning=slow(105min), afternoon=balanced(52min) — split-day |
| S2 | relax + pack | Anchor stops long, filler stops short |
| S3 | family + bars | Evening block forced to dinner; bar stops excluded |
| S4 | plant_based + grab_go | Proceed; non-plant stops receive badge |
| S5 | halal + alcohol venues | Flag with disclaimer; do not exclude venue entirely |

### 3.3 Inline Conflict UI

When a hard conflict is triggered:

- Both conflicting rows dim to `opacity: 0.65`, border shifts to `rgba(99,120,160,0.35)` — no amber/yellow
- A soft blue panel slides in between the rows with copy: *"These two shape your day differently — pick one to lead, or let us blend them."*
- Panel contains:
  1. **Best fit suggestion row** — highest-scoring compatible option with one-line "why" derived from score signals
  2. **"Let the app decide"** — reads full profile, blends at itinerary level (not forced to a single value)
- "Use this" applies suggestion: deselects both conflicting, selects suggestion, dismisses panel
- "Let the app decide" dismisses panel, keeps both selected, sets `auto_blend=true`

### 3.4 Suggestion Scoring Formula

For each hard conflict, the resolution engine scores all non-conflicting alternatives:

```
score(option_X) = Σ_d [ accumulated_weight[d] × alignment_table[X][d] ]
                  ─────────────────────────────────────────────────────
                               num_active_dimensions
```

`accumulated_weight[d]` = sum of all answer contributions to dimension `d` from non-conflicting answers collected so far.

**Alignment table — pace:**
```
             slow  balanced  pack  spontaneous
slow          1.0    0.6     0.0      0.5
balanced      0.6    1.0     0.4      0.7
pack          0.0    0.4     1.0      0.3
spontaneous   0.5    0.7     0.3      1.0
```

**Alignment table — price:**
```
             budget  mid  comfortable  luxury
budget         1.0   0.5     0.1        0.0
mid_range      0.5   1.0     0.6        0.2
comfortable    0.1   0.6     1.0        0.7
luxury         0.0   0.2     0.7        1.0
```

The suggestion "why" line surfaces the two highest-weight signals: e.g. *"Relax mood · solo → 0.82"*. No AI — pure dot product over the lookup table.

---

## 4. Decision Engine (ob-resolver)

### 4.1 Pipeline

```
RawOBAnswers  →  [Stage 1] ConflictResolver  →  [Stage 2] WeightComputer  →  [Stage 3] ProfileAssembler  →  PersonaProfile
```

**Stage 1 — Conflict Resolver**
- Scans all answers for hard conflict pairs (C1–C4)
- For each conflict:
  - User resolved via "Use this" → use that answer, record in `resolved_conflicts`
  - User chose "Let app decide" → keep both values, set `auto_blend=true`; itinerary engine resolves via split-day logic (no forced winner at this stage)
  - Output: hard conflicts either have a single winner (user_pick or suggestion) or auto_blend=true; no unresolved conflicts remain

**Stage 2 — Weight Computer**
- Handles non-conflicting multi-choice: primary (1.0×) + secondary (0.4×) + tertiary (0.2×)
- Merges venue_weights across all mood + attraction answers via weighted sum then normalise
- Computes final `stops_per_day` and `time_per_stop` from resolved pace answers

```python
def merge_venue_weights(selections: list[Answer]) -> dict:
    decay = [1.0, 0.4, 0.2]
    result = defaultdict(float)
    for i, answer in enumerate(selections):
        w = decay[min(i, 2)]
        for venue_type, base_weight in answer.venue_weights.items():
            result[venue_type] += base_weight * w
    max_w = max(result.values(), default=1)
    return {k: v / max_w for k, v in result.items()}
```

**Stage 3 — Profile Assembler**
- Assembles `PersonaProfile` from resolved dimensions
- Runs `score_archetype()` against resolved profile (existing function in `ip_engine.py`)
- Stores `resolved_conflicts` log for behavioral learning

### 4.2 PersonaProfile Shape

```typescript
interface PersonaProfile {
  // Core itinerary params — always single resolved values
  stops_per_day:     number;
  time_per_stop:     number;          // minutes
  venue_weights:     Record<VenueType, number>;
  price_min:         1 | 2 | 3 | 4;
  price_max:         1 | 2 | 3 | 4;
  flexibility:       number;           // 0.0–1.0
  day_open:          'coffee' | 'breakfast' | 'straight' | 'grab_go';
  day_buffer_min:    number;
  evening_type:      'bars' | 'dinner' | 'markets' | 'early';
  evening_end_time:  string;           // "HH:MM" 24h
  social_flags:      SocialFlag[];
  dietary:           DietaryFlag[];

  // Conditional (present only if triggered)
  kid_focus?:        'outdoor' | 'edu' | 'food' | 'slow';
  budget_protect?:   'free_only' | 'one_splurge' | 'street_food' | 'local_transport';
  food_scene?:       'street' | 'restaurant' | 'cafe' | 'bars';

  // Archetype (from existing score_archetype)
  archetype:         ArchetypeName;
  archetype_score:   number;

  // Resolution metadata
  resolved_conflicts: ResolvedConflict[];
  auto_blend:         boolean;
}

interface ResolvedConflict {
  conflict_id:   'C1' | 'C2' | 'C3' | 'C4';
  method:        'user_pick' | 'suggestion' | 'auto_blend';
  winner?:       string;   // answer key of winning option, if method !== auto_blend
  score?:        number;
}
```

---

## 5. City × Persona Conflict Checks — Extended

Extends existing 10 checks in `ip_engine.py`. New checks K–Q added to `run_conflict_check()`.

### New checks

**K — Dietary × city supply**
```
halal + city.halal_supply ≤ 1   → HIGH   "Limited halal options in this city — certified spots only"
halal + city.halal_supply = 0   → HIGH   (also blocks non-certified restaurants entirely)
kosher + city.kosher_supply = 0 → HIGH   "Kosher dining unavailable — self-catering note added"
kosher + city.kosher_supply = 1 → MEDIUM
plant_based + city.veg_supply ≤ 1 → LOW  "Plant-based options are scarce here — flagged where available"
```

**L — Family × city**
```
family + evening=bars + city.nightlife ≥ 2 → MEDIUM
  instruction: "Replace evening block with family night market or early dinner"
family + city.family_friendly ≤ 1 → LOW
  instruction: "Fewer family venues — add 15min buffer between stops"
```

**M — Budget × city cost**
```
price_max=1 + city.cost_tier=4 → HIGH
  instruction: "Restrict to free attractions + street food only"
price_max=1 + city.cost_tier=3 → MEDIUM
  instruction: "Flag all paid attractions; prioritise free"
price_max=2 + city.cost_tier=4 → LOW
  instruction: "One paid highlight max per day"
```

**N — Group supply**
```
group=friends + city.tourist_only=true + city.nightlife ≤ 1 → MEDIUM
  instruction: "Prioritise communal dining and food markets over bars"
```

**O — Terrain × group**
```
family + city.terrain_hilly=true + stops_per_day > 5 → MEDIUM
  instruction: "Hilly terrain with kids — cap at 5 stops, +15min per stop"
family + city.terrain_hilly=true + pace=pack → MEDIUM
  instruction: "Pack-it-in pace is hard on hilly terrain with kids — recommend balanced"
```

**P — Meal time mismatch**
```
day_open=breakfast + city.meal_times.breakfast_late=true → LOW
  instruction: "Local breakfast culture starts late — shift day-open block +1hr"
evening=early + city.meal_times.dinner > "21:00" → MEDIUM
  instruction: "Restaurants may not open until 21:00 — early dinner slot shifted to 19:30 local"
  affected cities: Barcelona, Rome, Milan, Lisbon, Buenos Aires, Mexico City
```

**Q — Alcohol × evening**
```
city.alcohol=false + evening=bars → HIGH
  instruction: "No licensed venues — replace evening block with night souk / tea culture / rooftop café"
```

---

## 6. Multi-City Logic

### 6.1 New Input Type

```python
@dataclass
class MultiCityTrip:
    cities:           list[str]   # ordered
    nights_per_city:  list[int]   # parallel — must sum to trip_days
    start_date:       str         # "YYYY-MM-DD"
```

### 6.2 Per-City Checks

Run existing 10 + new 7 checks (K–Q) independently for each city, using the city's date window derived from `start_date + cumulative nights`.

### 6.3 Sequence-Level Checks

Run once across the full trip after per-city checks.

**SEQ-1 — Walkability drop**
```python
# Triggers when user prefers slow/spontaneous pace (implying on-foot exploration)
prefers_walking = persona.stops_per_day <= 3.5 or persona.flexibility >= 0.8
for i in range(len(cities) - 1):
    if city[i].walkability - city[i+1].walkability >= 2 and prefers_walking:
        MEDIUM — "Moving from walkable {A} to car-dependent {B} — transit weighting increased for {B}"
```

**SEQ-2 — Cumulative cost**
```python
weighted_avg = sum(city[i].cost_tier * nights[i] for i in ...) / sum(nights)
if weighted_avg > persona.price_max + 1: HIGH
elif weighted_avg > persona.price_max:   MEDIUM
```

**SEQ-3 — Climate whiplash**
```python
for i in range(len(cities) - 1):
    month_a = travel_month(start_date, cumulative_nights[:i])
    month_b = travel_month(start_date, cumulative_nights[:i+1])
    if (month_a in city[i].climate_hot) != (month_b in city[i+1].climate_hot):
        LOW — "Significant climate change between {A} and {B} — packing note added"
```

**SEQ-4 — Ramadan continuity**
```python
# Existing per-city Ramadan logic re-used; SEQ check flags total affected days
affected = sum(nights[i] for i, c in enumerate(cities)
               if profiles[c].ramadan_affected and overlaps_ramadan(date_window[i]))
if affected > 0:
    HIGH — "{N} days of your trip fall during Ramadan across {cities}"
```

**SEQ-5 — Pace sustainability**
```python
total_stops = persona.stops_per_day * sum(nights)
if total_stops > 40 and sum(nights) > 7:
    MEDIUM — "High stop count over a long trip — rest day suggested in {longest_stay_city}"
```

**SEQ-6 — Visa complexity**
```python
for i in range(len(cities) - 1):
    if city[i+1].visa_complexity == 2:
        LOW — "Entry requirements for {city} may need advance planning"
```

**SEQ-7 — Museum fatigue**
```python
museum_heavy = [c for c in cities if profiles[c].heritage >= 3]
if len(museum_heavy) >= 3 and all_consecutive(museum_heavy, cities):
    LOW — "Three high-culture cities back to back — consider a lighter stop between them"
```

**SEQ-8 — Dietary continuity**
```python
if 'halal_certified_only' in persona.dietary:
    scarce = [c for c in cities if profiles[c].halal_supply <= 1]
    for c in scarce:
        HIGH — "Halal options limited in {c} — stock up before arriving"
```

---

## 7. New City Profile Attributes (5 additions)

Required for checks K, L, M, N, SEQ-6. All 45 existing cities must be populated before the engine runs new checks.

```python
# Added to each city entry in ip_engine.py CITY_PROFILES
"halal_supply":    int,  # 0=none, 1=few certified, 2=moderate, 3=widely available
"kosher_supply":   int,  # 0=none, 1=few, 2=moderate, 3=widely available
"veg_supply":      int,  # 0=none, 1=scarce, 2=moderate, 3=abundant
"family_friendly": int,  # 0=low, 1=some, 2=good, 3=excellent
"visa_complexity": int,  # 0=visa-free, 1=on-arrival, 2=advance-required
```

---

## 8. Edge Case Catalog

| # | Scenario | Conflict | Severity | Resolution |
|---|---|---|---|---|
| E1 | All 4 pace options selected | C1 (slow+pack) | HARD | Auto-resolve to spontaneous |
| E2 | Solo + luxury + cheap city (Colombo) | luxury_supply=1 | LOW | "One premium experience max" |
| E3 | Family + pack-it-in | S3 soft | MEDIUM | Cap at 5 stops, +15min buffer |
| E4 | Halal + Japan | halal_supply=1 | HIGH | Certified list only, all others flagged |
| E5 | Plant-based + South Korea | veg_supply=1 | MEDIUM | Flag; Korean cuisine heavily meat-based |
| E6 | Kosher + any non-Jewish city | kosher_supply=0 | HIGH | Self-catering note added |
| E7 | Early dinner + Spain/Italy | meal_times.dinner>21:00 | MEDIUM | Shift block, restaurants open late |
| E8 | Pack-it-in + Kathmandu | elevation=1400m + hilly + pack | MEDIUM | Reduce to 4 stops, no hills after 15:00 |
| E9 | Bars evening + Dubai | alcohol=false | HIGH | Replace with night souk / rooftop café |
| E10 | Budget + Zurich | cost_tier=4, price_max=1 | HIGH | Free attractions only; street food scarce |
| E11 | Group + Marrakech tourist_only | tourist_only=true | MEDIUM | Riad dining, hammam, medina group tours |
| E12 | Multi-city: Tokyo→Kyoto→Osaka | 3× heritage≥3, culture mood | SEQ-7 | Suggest Nara or Hakone as palette cleanser |
| E13 | Multi-city: Dubai→Marrakech in Ramadan | both ramadan_affected | HIGH×2+SEQ-4 | Flag all affected days across trip |
| E14 | Luxury + Kathmandu | luxury_supply=1 | LOW | "Premium options limited — one top-tier restaurant" |
| E15 | Couple + halal + bars evening | dietary halal + bars | Q conflict | Dietary wins → replace bars with night market |
| E16 | Pack-it-in + museum-dominant city | stops=7 + museum venues | MEDIUM | Cap museums at 3; fill rest with quick street/market stops |
| E17 | Allergy + street food preference | allergy + street_food_pref | LOW | Flag street stops with allergy badge; no exclusion |
| E18 | Slow + culture + 1-night city | stops=2 + museum_heavy + nights=1 | LOW | Top 2 cultural stops only |
| E19 | Solo + bars + low nightlife city | solo + bars + nightlife=0 | MEDIUM | Suggest communal dining instead |
| E20 | Family + high altitude | kids + elevation>2500m | HIGH | Altitude sickness risk; reduce stops, no strenuous activity |
| E21 | All dietary flags selected | halal+kosher+plant_based | — | Treat as strictest intersection: certified halal+plant-based only |
| E22 | Grab-go + no street food city | grab_go + street_food=false | MEDIUM | Shift to quick-service café; no dedicated day-open stop |
| E23 | Pack-it-in + tight opening hours | stops=7 + short venue windows | MEDIUM | Compute max feasible stops from opening hours; cap accordingly |
| E24 | Spontaneous + multi-city | flexibility=1.0 + 3+ cities | LOW | Anchor stops only per city; discovery gaps built per city |
| E25 | Budget city → luxury city transition | cost_tier jump ≥ 2 within trip | SEQ-2 | Cumulative cost warning if average exceeds price_max |

---

## 9. File Map

### New frontend files

| File | Purpose |
|---|---|
| `src/modules/onboarding/ob-resolver.ts` | Pure function: RawOBAnswers → PersonaProfile |
| `src/modules/onboarding/ob-conflict-map.ts` | Conflict pairs, alignment tables, score weights |
| `src/modules/onboarding/ob-context-resolvers.ts` | Per-question contextual wording functions |
| `src/modules/onboarding/types.ts` | Extended — new ObAnswers + PersonaProfile types |

### Modified frontend files

| File | Change |
|---|---|
| `src/modules/onboarding/OB1–OB7.tsx` | New questions replacing OB1–OB5; use contextResolver |
| `src/modules/onboarding/OB8–OB10.tsx` | New conditional question screens |
| `src/modules/onboarding/OnboardingShell.tsx` | Conditional step logic; passes obAnswers to contextResolver |
| `src/modules/onboarding/useOnboarding.ts` | Calls ob-resolver at finish(); dispatches PersonaProfile |
| `src/shared/questionnaire/` | Replace BentoCard with ImageRowCard (new pattern) |
| `src/shared/types.ts` | Add PersonaProfile, RawOBAnswers, ResolvedConflict |
| `src/shared/store.ts` | Store PersonaProfile instead of raw obAnswers |

### Modified backend files

| File | Change |
|---|---|
| `ip_engine.py` | Extend `score_archetype()` inputs; add checks K–Q to `run_conflict_check()`; add `run_multi_city_check()`; add 5 new city attributes to all 45 cities |
| `main.py` | Add `POST /persona/multi-city` endpoint |

### What does NOT change

- Map, PinCard, TripPlanningCard, ItineraryCards, chip-utils — untouched
- Google Places / Supabase cache layer — untouched
- Routing and navigation logic — untouched
- Existing 10 conflict check categories — untouched (only extended)
- Existing 7 archetypes — untouched (scoring inputs expanded)

---

## 10. Behavioral Learning Hooks

Stored in `localStorage`, applied on next trip as OB defaults.

| Signal | Detection | Effect on next trip |
|---|---|---|
| Pace drift | User chose balanced but engaged every stop in a packed day | Pre-select pack-it-in |
| Constraint override | Plant-based user taps 2+ flagged meat stops | Reduce badge frequency |
| Mood correction | Culture user engages only food stops | Pre-select eat_drink |
| Budget signal | Mid-range user engages luxury-tier places | Pre-select comfortable |
| Evening pattern | Dinner user taps bar recommendations 2+ times | Pre-select bars |
| Hidden option promotion | Hidden option selected 2+ times across trips | Promote to default set, remove badge |
