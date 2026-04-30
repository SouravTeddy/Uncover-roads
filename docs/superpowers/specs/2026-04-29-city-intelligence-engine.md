# City Intelligence Engine & Dynamic City Profiling
**Date:** 2026-04-29
**Status:** Design spec — implementation phase

---

## 1. Overview

The city intelligence system has two parts:

1. **Static city profiles** — structured data about how a city works (neighborhoods, transit, culture, engine modifiers)
2. **Dynamic freshness system** — real-time signal processing that tracks how places change over time

Together these form the engine's brain. The static profile tells it how the city works. The dynamic system tells it what's happening right now.

---

## 2. The Hidden Gem Lifecycle

Every place moves through predictable stages. The engine tracks these and surfaces places at the right stage for the right persona.

```
Stage 1 — Unknown
  review_count: < 20, velocity: low
  → not in any layer

Stage 2 — Hidden Gem ✨
  review_count: 20–200, velocity: steady
  sentiment: overwhelmingly positive
  crowd_mentions: < 5%
  → in hidden_gems, shown for discovery_mode: 'deep'

Stage 3 — Rising 📈
  review_count: 200–1000, velocity: accelerating
  crowd_mentions: 5–20%
  viral_detected: possible
  → still in hidden_gems, flagged as 'rising'

Stage 4 — Mainstream 🌍
  review_count: 1000+, velocity: plateau
  crowd_mentions: 20–50%
  → moves to landmark_anchors
  → engine adds timing advisory: "go before 9am"

Stage 5 — Oversaturated ⚠️
  crowd_mentions: > 50%
  rating_trend: declining
  recent_reviews: "tourist trap", "not what it used to be"
  → strong timing advisory or suggest alternative

Stage 6 — Declining 📉
  rating_trend: sustained decline
  velocity: dropping
  → flagged for human review, potentially removed
```

**Persona mapping:**
- Wanderer, SlowTraveller → Stages 2–3
- Historian, Epicurean → Stages 2–4 (depending on place type)
- Voyager, Pulse → Stage 4 (reliable, open, no surprises)
- First-timer → Stage 4 (landmark anchors)
- Return visitor → Stages 2–3 (hidden gems)

---

## 3. Data Sources

### What We Use vs What We Don't

| Source | Use | License | How |
|---|---|---|---|
| Google Places API | Hours, ratings, photos, review text, review count | Paid API (already integrated) | Primary factual source |
| YouTube Data API v3 | Video titles, descriptions, tags, view counts | Free (10k units/day) | Place name extraction |
| Reddit API | Subreddit posts and comments | Free (low volume) | Sentiment and discovery |
| OpenStreetMap | Neighborhood polygons, walkable routes, scenic path geometry | ODbL (open) | Geographic structure |
| Wikidata | City timezone, coordinates, place classification | CC0 (fully open) | Structured city facts |
| Wikimedia Commons | Place photos (per-file CC license) | CC BY/BY-SA per file | Development only — production uses Google Places photos |

### What We Deliberately Avoid

| Source | Why avoided |
|---|---|
| Instagram / TikTok | No legitimate API for content. Scraping violates ToS. Signal caught indirectly via Google review velocity. |
| Lonely Planet | All rights reserved. No scraping. Used by human curators as read-only research only. |
| Wikivoyage | CC BY-SA copyleft — using content directly would require open-sourcing our city data model. Used as research only. |
| Yelp | 24-hour cache limit, AI training explicitly banned, most restrictive API. |
| TripAdvisor | AI training explicitly banned. Display-only API. |

### The Copyleft Rule

Wikivoyage and OpenStreetMap carry share-alike obligations. If we build a Derivative Database from their content, we must open-source it — which destroys the city data moat.

**Safe use:** Human curators read Wikivoyage and Lonely Planet as research, then write original content in their own words. This is research, not copying. Output is proprietary.

**Safe use of OSM:** We use OSM geographic data (coordinates, polygon geometries, road network) for routing and boundary calculations — not as a content database. Coordinates and geometries are factual — facts are not copyrightable.

---

## 4. Signal Processing Pipeline

### Signal 1 — Google Places Review Velocity

```typescript
interface PlaceVelocitySignals {
  review_count_now: number
  review_count_30d_ago: number
  review_count_90d_ago: number

  velocity_30d: number              // reviews in last 30 days
  velocity_ratio: number            // velocity_30d / (review_count_90d_ago / 3)
  // > 3.0 = viral spike
  // 1.5–3.0 = rising
  // 0.5–1.5 = stable
  // < 0.5 = declining interest

  rating_now: number
  rating_90d_ago: number
  rating_trend: number              // positive = improving, negative = declining

  photo_count_recent: number        // photos uploaded last 30 days
  photo_recency_score: number       // normalised 0–1
}
```

### Signal 2 — Review Sentiment NLP

Lightweight keyword clustering on Google review text. Not LLM — deterministic NLP at scale.

```typescript
const CROWD_SIGNALS = [
  'crowded', 'packed', 'queues', 'wait time', 'tourist trap',
  'not what it used to be', 'overrated', 'discovered by tourists',
  'instagram crowd', 'tiktok famous', 'ruined', 'too busy'
]

const HIDDEN_GEM_SIGNALS = [
  'hidden gem', 'best kept secret', 'locals only', 'off the beaten path',
  'not in guidebooks', 'stumbled upon', 'underrated', 'authentic',
  'no tourists', 'local favourite'
]

const QUALITY_DECLINE_SIGNALS = [
  'used to be better', 'changed owners', 'not as good',
  'disappointed', 'gone downhill', 'avoid', 'overpriced now'
]

const VIRAL_SIGNALS = [
  'saw this on instagram', 'tiktok', 'reel', 'went viral',
  'influencer', 'youtube', 'as seen on'
]

const FRAUD_SIGNALS = [
  // Detect fake review spam — high velocity + these patterns = suspicious
  'great place', 'highly recommend', 'five stars', 'amazing experience'
  // Generic reviews appearing in bulk = suspect
]

interface SentimentScores {
  total_recent_reviews: number      // last 90 days
  crowd_mentions: number
  hidden_gem_mentions: number
  quality_decline_mentions: number
  viral_mentions: number
  fraud_suspicion_score: number     // 0–1

  crowd_ratio: number               // crowd_mentions / total_recent_reviews
  hidden_gem_ratio: number
  quality_decline_ratio: number
}
```

### Signal 3 — YouTube Data API v3

```
Monthly job per Tier 1 city:

Search queries:
  "[city] hidden gems [current_year]"
  "[city] local secrets"
  "[city] underrated places"
  "[city] locals only"
  "[city] best [place_type] [current_year]"

Extract from results:
  - Video title, description, tags
  - Published date
  - View count, like count

NLP on extracted text:
  - Named entity recognition → place names
  - Cross-reference against place database
  - Signal: place in 3+ videos with > 50k views combined = rising

Output:
  youtube_mentions_30d: number
  youtube_mention_view_count: number      // total views of mentioning videos
  youtube_high_confidence: boolean        // place name exact match vs fuzzy
```

YouTube Data API v3 is free within quota (10,000 units/day). Returns metadata only — no video content analysis needed. Titles and descriptions alone extract 80%+ of place names.

### Signal 4 — Reddit API

```
Weekly job per city:

Subreddits monitored:
  r/[city]                  // local community
  r/travel (city flair)     // global travel community
  r/solotravel (city flair)
  r/backpacking (city flair)

Signal extraction:
  - Hot posts mentioning known places → sentiment
  - New posts mentioning unknown places → discovery candidate
  - Post with > 50 upvotes + "hidden gem" language → strong discovery signal
  - Downvoted post about known place → quality decline signal
  - Comment threads "X is ruined now" on known place → crowd signal

Output:
  reddit_sentiment_score: number          // -1 to +1
  reddit_discovery_candidates: string[]   // place names from new posts
  reddit_crowd_flags: string[]            // places flagged as overcrowded
```

---

## 5. Composite Freshness Score

Updated weekly per place. Drives engine decisions.

```typescript
interface PlaceDynamicProfile {
  place_id: string
  stage: PlaceStage                 // unknown | hidden_gem | rising | mainstream | oversaturated | declining
  freshness_score: number           // 0–1
  crowd_index_current: number       // 0–1 (was static in city model, now dynamic)
  crowd_trend: 'rising' | 'stable' | 'falling'
  last_updated: string

  signals: PlaceVelocitySignals & SentimentScores & {
    youtube_mentions_30d: number
    youtube_mention_view_count: number
    reddit_sentiment_score: number
    viral_detected: boolean
    viral_detected_date: string | null
    fraud_suspicion_score: number
  }

  stage_history: { stage: PlaceStage; date: string }[]

  engine_flags: {
    recommend_early_morning: boolean
    recommend_off_peak: boolean
    timing_advisory: string | null          // "Go before 9am — packed by 10"
    trend_note: string | null               // LLM-narrated, marked ✦
    human_review_flagged: boolean
    human_review_reason: string | null
  }
}
```

```typescript
freshness_score =
  (0.30 × normalize(velocity_ratio))
  + (0.25 × hidden_gem_ratio)
  + (0.20 × normalize(youtube_mentions_30d × youtube_view_count))
  + (0.15 × normalize(reddit_sentiment_score, -1, 1))
  + (0.10 × photo_recency_score)
  - (0.40 × crowd_ratio)               // heavy crowd penalty
  - (0.30 × max(0, -rating_trend))     // rating decline penalty
  - (0.20 × fraud_suspicion_score)     // penalise suspected fake reviews
```

```typescript
function calculatePlaceStage(signals: PlaceDynamicProfile['signals']): PlaceStage {
  const { velocity_ratio, rating_trend, review_count_now } = signals
  const { crowd_ratio, hidden_gem_ratio, quality_decline_ratio, viral_detected } = signals

  if (review_count_now < 20) return 'unknown'
  if (crowd_ratio > 0.5 && quality_decline_ratio > 0.1 && rating_trend < -0.2) return 'declining'
  if (crowd_ratio > 0.5) return 'oversaturated'
  if (crowd_ratio > 0.2 || review_count_now > 1000) return 'mainstream'
  if (velocity_ratio > 1.5 || viral_detected) return 'rising'
  if (review_count_now < 300 && crowd_ratio < 0.05 && hidden_gem_ratio > 0.1) return 'hidden_gem'
  return 'mainstream'
}
```

---

## 6. Human Review Queue (Exception-Based)

Curation is no longer continuous — it's triggered by significant automated signals.

```typescript
type ReviewTrigger =
  | 'stage_transition'          // hidden_gem → mainstream, mainstream → oversaturated
  | 'viral_spike'               // velocity_ratio > 5.0
  | 'rating_decline'            // rating_trend < -0.5 over 90 days
  | 'reddit_negative'           // reddit_sentiment < -0.6
  | 'new_discovery'             // YouTube/Reddit mentions unknown place
  | 'fraud_suspected'           // fraud_suspicion_score > 0.7
  | 'closure_suspected'         // velocity → 0, recent "closed" mentions

interface HumanReviewItem {
  place_id: string
  city_id: string
  trigger: ReviewTrigger
  created_at: string
  signals_snapshot: PlaceDynamicProfile['signals']
  suggested_action: string    // "Consider moving to landmark_anchors", "Add timing advisory", etc.
  status: 'pending' | 'approved' | 'rejected' | 'snoozed'
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
}
```

**Expected volume:** ~80 cities × ~5 significant stage transitions per city per month = ~400 review items/month. At 2-3 minutes per item, that's ~15 hours/month — manageable for one part-time curator.

---

## 7. How This Changes the Engine

### Layer 4 (Insert Detection) — Dynamic Inserts

Previously: insert candidates are static.
Now: insert candidates are scored by `freshness_score` and `stage`.

```typescript
// Boost insert score for rising hidden gems
insert_affinity_score ×= (1 + place.freshness_score × W.spontaneity)

// Suppress oversaturated places as inserts (unless user explicitly added them)
if (place.stage === 'oversaturated' && !user_added) {
  insert_affinity_score *= 0.3
}
```

### Layer 2 (Sequence) — Dynamic Timing

If `crowd_index_current` is dynamic, time-of-day scoring uses it:

```typescript
time_score(stop, arrival_time) =
  stop.neighborhood.best_times[time_bucket(arrival_time)]
  × city.time_windows[stop.type].in_window(arrival_time)
  × (1 - stop.dynamic_profile.crowd_index_current × W.crowd_aversion)
  //           ↑ now live, not static
```

### Engine Messages — Dynamic Trend Notes

```typescript
// If user added an oversaturated place:
{
  type: 'advisory',
  what: "Yanaka Ginza is very popular right now",
  why:  "Review volumes have tripled in the last 30 days",
  consequence: "We've scheduled it for 7:30am before the crowds arrive"
}

// If engine inserts a rising hidden gem:
{
  type: 'insert',
  what: "Added Shimokita Espresso between Stop 2 and Stop 3",
  why:  "It's gaining attention fast among locals — worth visiting now",
  consequence: "Adds 20 minutes, fits your gap before the museum opens"
}
```

### Pin Card — Stage Badges

Add a subtle stage indicator to the pin card (below rating):

```
Stage: hidden_gem  → "✨ Local favourite — not yet on the tourist trail"
Stage: rising      → "📈 Rising fast — visit before it changes"
Stage: mainstream  → no badge (normal display)
Stage: oversaturated → "⏰ Best visited before 9am"
Stage: declining   → no display (filtered by engine unless user explicitly taps)
```

All stage badge text is template-driven, not LLM-generated. Marked for human review before shipping.

---

## 8. City Data Model — Full Structure

### Tier System

| Tier | Cities | Data layers | Engine capability |
|---|---|---|---|
| Tier 1 | 80 (45 existing + 35 new) | All layers | Full 5-layer engine |
| Tier 2 | 300+ | Auto-seeded | Layers 1–3 |
| Tier 3 | Unlimited | Minimal (coords + country) | Layers 1–2 |
| On-demand | Any city searched | Auto-seeded in real-time | Layers 1–3 after ~15s |

### On-Demand City Seeding Pipeline

When user searches a city not in database:

```
1. Google Places API (parallel calls):
   - top 30 places by rating across 8 categories
   - extract neighborhood clusters from vicinity field
   - pull hours, ratings, photos, price level

2. Apply country profile (from countryDB)

3. Apply climate zone (from coordinates)

4. LLM enrichment (single structured prompt, not open-ended):
   Input: Google Places result set (structured JSON)
   Output: {
     landmark_anchors: string[],       // top 5 by rating + category diversity
     hidden_gems: string[],            // lower rating_count but high rating
     dinner_hour_local: string,        // local dining norm
     siesta_window: [string,string] | null,
     monday_closures: boolean,
     walkable_neighborhoods: string[],
     engine_modifier_notes: string     // any city-specific behaviour to flag
   }
   Rule: output is JSON only, no narrative, no factual claims beyond what's in input

5. Store as Tier 2 city object
   - shared across all future users of that city
   - seeded once, updated weekly by City Intelligence Sync

Total time: 10–15 seconds first search, instant for all subsequent users
```

### Global Defaults (Layer A — every city)

```typescript
const GLOBAL_DEFAULTS = {
  avg_walk_speed_kmh: 4.2,
  max_comfortable_walk_km: { hot: 0.8, warm: 2.5, cool: 4.0, cold: 2.0 },
  avg_transit_wait_min: 8,
  rain_walk_penalty: 0.6,
  lunch_window: ['12:00', '14:00'],
  dinner_hour_local: '19:00',
  monday_closures: ['museums'],
  sunday_closures: ['government_offices'],
  day_buffer_min: { slow: 45, balanced: 30, pack: 0, spontaneous: 0 },
  time_windows: {
    temple:      { ideal: ['07:00','11:00'], soft: ['11:00','17:00'] },
    museum:      { ideal: ['09:00','13:00'], soft: ['13:00','17:00'] },
    market:      { ideal: ['07:00','10:00'], soft: ['10:00','13:00'] },
    restaurant:  { ideal: ['12:00','14:00'], soft: ['18:00','21:00'] },
    park:        { ideal: ['07:00','11:00'], soft: ['15:00','19:00'] },
    rooftop_bar: { ideal: ['19:00','23:00'], soft: ['17:00','19:00'] },
    nightclub:   { ideal: ['22:00','02:00'], soft: ['20:00','22:00'] },
  }
}
```

### Country Profile (Layer B — 195 countries)

```typescript
interface CountryProfile {
  code: string                          // "JP", "FR", "TH"

  cultural: {
    tipping_norm: 'none'|'optional'|'expected'|'mandatory'
    tipping_pct: number
    haggling_norm: 'none'|'markets_only'|'everywhere'
    dress_code_general: 'relaxed'|'modest'|'conservative'
    religious_considerations: string[]
    language_barrier: number            // 0–1
    english_signage: number             // 0–1
    photography_sensitivity: 'low'|'medium'|'high'
    lgbtq_climate: 'welcoming'|'neutral'|'caution'
    scam_risk_level: number             // 0–1
  }

  movement: {
    drive_side: 'left'|'right'
    taxi_culture: 'metered'|'app_only'|'negotiated'|'avoid'
    app_transport: string[]             // ["Grab", "Bolt", "Uber"]
    ferry_culture: boolean
  }

  health: {
    tap_water_advisory: 'safe'|'caution'|'avoid'
    food_safety_general: 'high'|'medium'|'take_care'
    official_advisory_url: string       // link to traveler's home govt advisory
  }

  currency: {
    code: string
    cash_culture: 'card_preferred'|'mixed'|'cash_preferred'|'cash_only'
  }

  engine_modifiers: {
    walk_score_modifier: number         // Japan: 1.1, India: 0.7
    transit_reliability_default: number
    lunch_window_strict: boolean
    siesta_window: [string, string] | null
    dinner_hour_local: string
    sunday_closure_culture: boolean
  }

  persona_country_affinity: Partial<Record<ArchetypeId, number>>
}
```

**Build plan:** Top 50 travel destination countries before launch (covers ~95% of user searches). Remaining 145 post-launch within first month.

### Climate Zone (Layer C — coordinate-derived, no manual tagging)

```typescript
type ClimateZone =
  | 'tropical_humid'        // SE Asia, Central Africa, Amazon
  | 'tropical_dry'          // Sahel, parts of India
  | 'subtropical'           // Mediterranean, California, South Africa
  | 'temperate_oceanic'     // UK, NW Europe, Pacific NW
  | 'temperate_continental' // Central Europe, Midwest US
  | 'arid'                  // Middle East, Atacama
  | 'semi_arid'             // Parts of Africa, inland Spain
  | 'highland'              // Andes, Nepal, Ethiopian highlands
  | 'polar_subarctic'       // Scandinavia winter, Canada

const CLIMATE_ZONE_DEFAULTS: Record<ClimateZone, {
  heat_threshold_c: number
  cold_threshold_c: number
  humidity_modifier: number
  rain_walk_penalty: number
  max_walk_km_hot: number
  morning_activity_boost: number
  afternoon_rest_recommended: boolean
  evening_activity_boost: number
  altitude_fatigue_modifier?: number
  shade_route_preference?: number
  umbrella_advisory?: boolean
  hydration_advisory?: boolean
}> = {
  tropical_humid: {
    heat_threshold_c: 30,
    cold_threshold_c: 18,
    humidity_modifier: 1.3,
    rain_walk_penalty: 0.5,
    max_walk_km_hot: 0.6,
    morning_activity_boost: 1.4,
    afternoon_rest_recommended: true,
    evening_activity_boost: 1.2,
    umbrella_advisory: true,
  },
  arid: {
    heat_threshold_c: 35,
    cold_threshold_c: 5,
    humidity_modifier: 0.8,
    rain_walk_penalty: 0.9,
    max_walk_km_hot: 0.5,
    morning_activity_boost: 1.3,
    afternoon_rest_recommended: true,
    evening_activity_boost: 1.5,
    shade_route_preference: 0.9,
    hydration_advisory: true,
  },
  highland: {
    heat_threshold_c: 25,
    cold_threshold_c: 5,
    humidity_modifier: 0.9,
    rain_walk_penalty: 0.7,
    max_walk_km_hot: 2.0,
    morning_activity_boost: 1.0,
    afternoon_rest_recommended: false,
    evening_activity_boost: 0.8,
    altitude_fatigue_modifier: 0.7,   // reduces stops_per_day
  },
  subtropical: {
    heat_threshold_c: 32,
    cold_threshold_c: 8,
    humidity_modifier: 1.1,
    rain_walk_penalty: 0.65,
    max_walk_km_hot: 1.5,
    morning_activity_boost: 1.2,
    afternoon_rest_recommended: true,
    evening_activity_boost: 1.3,
  },
  temperate_oceanic: {
    heat_threshold_c: 28,
    cold_threshold_c: 3,
    humidity_modifier: 1.0,
    rain_walk_penalty: 0.55,
    max_walk_km_hot: 3.0,
    morning_activity_boost: 1.0,
    afternoon_rest_recommended: false,
    evening_activity_boost: 1.0,
    umbrella_advisory: true,
  },
  // temperate_continental, tropical_dry, semi_arid, polar_subarctic follow same pattern
}
```

### Full City Data Structure (Tier 1)

```typescript
interface CityData {
  id: string
  name: string
  country: string
  timezone: string
  center: [number, number]
  bounds: GeoJSON.BBox
  tier: 1 | 2 | 3

  // Layer B + C applied
  climate_zone: ClimateZone
  country_code: string

  // Layer D — Google Places seeded
  google_place_ids: string[]        // top 50 places tracked

  // Layer E — Hand curated (Tier 1 only)
  climate: {
    heat_threshold_c: number        // city-specific override of climate zone default
    cold_threshold_c: number
    humidity_modifier: number
    rain_walk_penalty: number
    shoulder_months: number[]       // [3,4,10,11]
    peak_months: number[]
    monsoon_months: number[]
    avg_annual_rain_days: number
  }

  movement: {
    avg_walk_speed_kmh: number
    avg_transit_wait_min: number
    traffic_peak_hours: string[]
    available_modes: TransitMode[]
    walkability_global: number
    max_comfortable_walk_km: Record<'hot'|'warm'|'cool'|'cold', number>
    cycling_available: boolean
    cycling_safety: number
  }

  culture: {
    tipping_norm: string
    dress_codes: Record<string, string>
    shoe_removal_norms: string[]
    photography_restrictions: Record<string, string>
    religious_calendar: CityEvent[]
    language_barrier: number
    english_signage: number
    scam_risk_level: number
  }

  temporal: {
    monthly: Record<Month, {
      crowd_multiplier: number
      price_multiplier: number
      weather_summary: string         // source: curated, verified
      special_events: CityEvent[]
    }>
    weekly: Record<DayOfWeek, {
      crowd_index: number
      museum_closures: boolean
      market_days: string[]
      local_favorite_day: string
      transport_frequency: 'normal'|'reduced'|'weekend_schedule'
    }>
  }

  neighborhoods: Neighborhood[]
  micro_districts: MicroDistrict[]
  scenic_routes: ScenicRoute[]
  transit_edges: TransitEdge[]
  insert_candidates: InsertCandidate[]
  time_windows: PlaceTimeWindow[]

  personality: {
    archetypes: string[]            // ["layered", "ancient", "walkable"]
    pace: 'frenetic'|'moderate'|'slow'
    food_philosophy: string         // source: curated
    time_culture: string            // source: curated
    weather_personality: string     // source: curated
  }

  engine_modifiers: {
    walk_score_multiplier: number
    transit_preference_bias: number
    lunch_window_strict: boolean
    siesta_window: [string, string] | null
    dinner_hour_local: string
    sunday_closures: string[]
    monday_closures: string[]
    public_holiday_risk: number
  }

  landmark_anchors: DynamicPlaceRef[]   // was string[], now dynamic
  hidden_gems: DynamicPlaceRef[]
  local_insider: DynamicPlaceRef[]

  persona_city_affinity: Partial<Record<ArchetypeId, number>>
}

interface DynamicPlaceRef {
  place_id: string
  added_date: string
  current_stage: PlaceStage
  confidence: number
  human_verified: boolean
  last_validated: string
}
```

### Tier 1 City List (80 cities)

**Existing 45 cities** (assumed from current codebase)

**35 additions:**

| Region | Cities |
|---|---|
| Europe | Lisbon, Porto, Amsterdam, Prague, Vienna, Budapest, Dubrovnik, Santorini, Reykjavik, Edinburgh |
| Asia | Bangkok, Bali, Chiang Mai, Ho Chi Minh City, Hanoi, Mumbai, Delhi, Colombo, Kathmandu, Tbilisi |
| Americas | Buenos Aires, Medellín, Lima, Mexico City, Cartagena, Havana, Montreal, Vancouver, New Orleans |
| Middle East/Africa | Marrakech, Cairo, Amman, Muscat, Cape Town, Nairobi |
| Oceania | Melbourne, Sydney, Auckland |

---

## 9. City Intelligence Sync Service (Backend)

### Job Schedule

```
review_velocity_job      — weekly, all tracked places in Tier 1+2 cities
sentiment_analysis_job   — weekly, Google review text NLP
youtube_mentions_job     — monthly, per Tier 1 city
reddit_monitor_job       — weekly, per Tier 1 city
stage_classifier_job     — weekly, combines signals → updates PlaceDynamicProfile
human_review_flagging    — runs after stage_classifier, creates HumanReviewItem records
on_demand_seed_job       — triggered by user search of unknown city
```

### Stack

- **Scheduler:** Simple cron jobs on the backend server (or Railway/Heroku scheduler)
- **NLP:** `compromise` (JS) or `spaCy` (Python) for keyword clustering and entity recognition — no LLM needed
- **YouTube:** YouTube Data API v3 (free tier, 10k units/day)
- **Reddit:** Reddit API (PRAW Python wrapper)
- **Storage:** Supabase — `place_dynamic_profiles` table, `human_review_queue` table
- **Processing:** Python async jobs (FastAPI background tasks or standalone scripts)

### Database Tables Required

```sql
-- Dynamic place profiles (updated weekly)
CREATE TABLE place_dynamic_profiles (
  place_id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  freshness_score FLOAT,
  crowd_index_current FLOAT,
  crowd_trend TEXT,
  signals JSONB,
  stage_history JSONB,
  engine_flags JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Human review queue
CREATE TABLE human_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  city_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  signals_snapshot JSONB,
  suggested_action TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Country profiles (195 rows, mostly static)
CREATE TABLE country_profiles (
  code TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- City data (Tier 1–3)
CREATE TABLE city_data (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. Content Safety Rules for Dynamic Content

All dynamic signals inform engine decisions. LLM narrates results in WHAT+WHY+CONSEQUENCE format.

**LLM is never told:**
- Raw review text (security/bias risk)
- User identity or location history
- Other users' itinerary patterns

**LLM is told (structured only):**
- Place stage: `{ stage: 'rising', crowd_trend: 'increasing', timing_advisory: true }`
- Engine decision: `{ action: 'add_timing_advisory', recommended_time: '07:30' }`
- Persona context: `{ archetype: 'wanderer', w_crowd_aversion: 0.8 }`

LLM writes the sentence. Engine made the decision.

**Stage badge text is template-driven, not LLM-generated:**
```typescript
const STAGE_BADGE_TEMPLATES: Record<PlaceStage, string> = {
  hidden_gem:    "Local favourite — not yet on the tourist trail",
  rising:        "Rising fast — a good time to visit",
  mainstream:    "",                                          // no badge
  oversaturated: "Best visited early morning",
  declining:     "",                                          // not shown
  unknown:       "",
}
```

Human curator reviews all badge templates before shipping. Not generated per-place.

---

## 11. Honest Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| New places take 2–4 weeks to appear in Google Places | Miss very new openings | Reddit monitoring catches word-of-mouth earlier |
| Review text NLP misses non-English reviews | Signal loss for local reviews | Tourist reviews (our target) are overwhelmingly English |
| Viral spike → review spike lag is 7–14 days | Trending places appear slightly late | YouTube monitoring is faster (3–5 days post-video) |
| Fake review detection is imperfect | Some fraud slips through | Human review queue catches extreme cases |
| Climate zone is coordinate-derived | May misclassify edge cases | Country profile overrides where needed |
| Reddit subreddits vary in quality | Some cities have inactive subreddits | Fallback: weight Google + YouTube signals more |
