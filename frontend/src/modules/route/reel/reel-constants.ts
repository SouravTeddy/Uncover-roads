// frontend/src/modules/route/reel/reel-constants.ts
// All values extracted from frontend/public/reel-mock.html — do not edit without checking mock first.

// ── Layout ────────────────────────────────────────────────────
export const REEL_CONTENT_PADDING_INTRO = '0 17px 32px'
export const REEL_CONTENT_PADDING_STOP  = '0 15px 26px'
export const REEL_CONTENT_PADDING_RECO  = '0 18px 88px'

// ── Shared scrim (identical on all photo cards) ───────────────
export const REEL_SCRIM =
  'linear-gradient(180deg,transparent 0%,transparent 35%,rgba(0,0,0,.45) 65%,rgba(0,0,0,.85) 90%,rgba(10,10,13,.95) 100%)'

// ── Sky tints ─────────────────────────────────────────────────
export const SKY_TINT_SUNNY    = 'linear-gradient(180deg,rgba(255,210,140,.18),rgba(255,210,140,.04) 40%,transparent 70%)'
export const SKY_TINT_RAIN     = 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))'   // used as double layer
export const SKY_TINT_THUNDER  = 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))'  // used as double layer
export const SKY_TINT_OVERCAST = 'linear-gradient(180deg,rgba(70,82,100,.65) 0%,rgba(70,82,100,.48) 60%,rgba(70,82,100,.35) 100%)'
export const SKY_TINT_PC       = 'linear-gradient(180deg,rgba(150,165,185,.16),rgba(150,165,185,.04) 60%,transparent)'
export const SKY_TINT_FOG      = 'linear-gradient(180deg,rgba(90,100,115,.55),rgba(70,82,95,.40))'
export const SKY_TINT_DRIZZLE  = 'linear-gradient(180deg,rgba(40,55,80,.55),rgba(40,55,80,.35))'
export const SKY_TINT_SNOW     = 'linear-gradient(180deg,rgba(50,65,90,.45),rgba(50,65,90,.28))'
export const SKY_TINT_NIGHT    = 'linear-gradient(180deg,rgba(20,28,55,.30),rgba(35,50,98,.45) 45%,rgba(40,55,110,.65) 75%,rgba(22,32,72,.85))'

// ── Time-of-day gradients (reduced 80% per mock comment) ─────
export const TOD_EARLY_MORNING = 'linear-gradient(180deg,rgba(255,210,180,.08) 0%,rgba(255,180,140,.18) 40%,rgba(250,150,110,.40) 72%,rgba(228,118,86,.62) 92%,rgba(212,98,68,.68) 100%)'
export const TOD_MORNING       = 'linear-gradient(180deg,rgba(255,225,180,.05) 0%,rgba(255,205,140,.16) 50%,rgba(238,168,100,.40) 78%,rgba(216,138,80,.62) 100%)'
export const TOD_AFTERNOON     = 'linear-gradient(180deg,rgba(180,210,235,.14) 0%,rgba(220,225,210,.08) 35%,rgba(245,225,170,.24) 70%,rgba(232,205,150,.40) 92%,rgba(218,188,130,.50) 100%)'
export const TOD_DUSK          = 'linear-gradient(180deg,rgba(80,55,120,.18) 0%,rgba(180,70,110,.28) 38%,rgba(200,80,90,.44) 60%,rgba(160,55,110,.60) 82%,rgba(95,40,130,.68) 100%)'
export const TOD_NIGHT         = 'linear-gradient(180deg,rgba(20,28,55,.24) 0%,rgba(35,50,98,.36) 45%,rgba(40,55,110,.52) 75%,rgba(22,32,72,.68) 100%)'

// ── ToD badge dot colours ─────────────────────────────────────
export const TOD_DOT_EARLY_MORNING = '#f0a079'
export const TOD_DOT_MORNING       = '#f0b878'
export const TOD_DOT_AFTERNOON     = '#e8d292'
export const TOD_DOT_DUSK          = '#d4706a'
export const TOD_DOT_NIGHT         = '#6a82c8'

// ── ToD helpers ───────────────────────────────────────────────
export function todGradient(hour: number): string {
  if (hour >= 20 || hour < 6) return TOD_NIGHT
  if (hour < 8)               return TOD_EARLY_MORNING
  if (hour < 11)              return TOD_MORNING
  if (hour < 17)              return TOD_AFTERNOON
  return TOD_DUSK
}

export function todDotColor(hour: number): string {
  if (hour >= 20 || hour < 6) return TOD_DOT_NIGHT
  if (hour < 8)               return TOD_DOT_EARLY_MORNING
  if (hour < 11)              return TOD_DOT_MORNING
  if (hour < 17)              return TOD_DOT_AFTERNOON
  return TOD_DOT_DUSK
}

export function todLabel(hour: number): string {
  if (hour >= 20 || hour < 6) return 'Night · 20:00–04:30'
  if (hour < 8)               return 'Early morning · 06:00–08:00'
  if (hour < 11)              return 'Morning · 08:00–11:00'
  if (hour < 17)              return 'Afternoon · 11:00–16:00'
  return 'Dusk · 18:00–20:00'
}

// ── Sky tint helper ───────────────────────────────────────────
// Returns the tint gradient string(s). Double-layer conditions return an array.
export type SkyTintResult = { single: string } | { double: string }

export function skyTintForCondition(condition: string): SkyTintResult {
  const c = condition.toLowerCase()
  if (c.includes('thunder') || c.includes('storm')) return { double: SKY_TINT_THUNDER }
  if (c === 'rain')                                  return { double: SKY_TINT_RAIN }
  if (c.includes('snow') || c.includes('blizzard'))  return { single: SKY_TINT_SNOW }
  if (c === 'drizzle')                               return { single: SKY_TINT_DRIZZLE }
  if (c === 'fog' || c === 'mist')                   return { single: SKY_TINT_FOG }
  if (c.includes('overcast') || c === 'cloud')       return { single: SKY_TINT_OVERCAST }
  if (c.includes('partly'))                          return { single: SKY_TINT_PC }
  if (c === 'night' || c === 'clear night')          return { single: SKY_TINT_NIGHT }
  return { single: SKY_TINT_SUNNY } // sunny, clear, default
}

// ── Rain / drizzle particle params ───────────────────────────
export const RAIN_COUNT         = 64    // full rain streak count
export const DRIZZLE_COUNT      = 44    // drizzle streak count
export const RAIN_SEED          = 42    // deterministic seed (intro card)
export const RAIN_WIDTH         = '1.5px'
export const RAIN_LEN_MIN       = 20    // px
export const RAIN_LEN_RANGE     = 26    // px added by rng
export const RAIN_DUR_MIN       = 0.45  // seconds
export const RAIN_DUR_RANGE     = 0.45
export const RAIN_DELAY_RANGE   = 1.8   // max negative delay
export const RAIN_OPACITY_MIN   = 0.6
export const RAIN_OPACITY_RANGE = 0.4
export const RAIN_BG = 'linear-gradient(to bottom,transparent,rgba(200,225,255,1))'

export const DRIZZLE_WIDTH      = '1px'
export const DRIZZLE_LEN_MIN   = 8
export const DRIZZLE_LEN_RANGE = 10
export const DRIZZLE_DUR_MIN   = 0.9
export const DRIZZLE_DUR_RANGE = 0.5

// ── Thunder extra ─────────────────────────────────────────────
export const THUNDER_COUNT  = 56
export const THUNDER_SEED   = 55
export const THUNDER_LEN_MIN    = 22
export const THUNDER_LEN_RANGE  = 30
export const THUNDER_COLOR  = 'rgba(230,220,255,1)'

// ── Snow particle params ──────────────────────────────────────
export const SNOW_COUNT = 44
export const SNOW_SEED  = 2

// ── Intro card ────────────────────────────────────────────────
export const INTRO_CITY_FS          = 50
export const INTRO_CITY_MB          = 13
export const INTRO_LABEL_MB         = 7
export const INTRO_PILL_GAP         = 6
export const INTRO_PILL_MB          = 11
export const INTRO_STRIP_BR         = 9
export const INTRO_STRIP_GAP        = 5
export const INTRO_TEXT_SHADOW      = '0 1px 6px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.6)'
export const TOD_BADGE_TOP          = 48
export const TOD_BADGE_LEFT         = 13

// ── Stop card ─────────────────────────────────────────────────
export const STOP_H2_FS             = 30
export const STOP_H2_LH             = 1.05
export const STOP_H2_MB             = 8
export const STOP_H2_TEXT_SHADOW    = '0 1px 5px rgba(0,0,0,.85),0 2px 14px rgba(0,0,0,.5)'
export const STOP_COUNTER_BR        = 5
export const STOP_COUNTER_PAD       = '2px 8px'
export const STOP_COUNTER_MB        = 5
export const STOP_TIME_ROW_BR       = 6
export const STOP_TIME_ROW_PAD      = '3px 9px'
export const STOP_TIME_ROW_MB       = 8
export const STOP_META_ROW_MB       = 9

// ── Reco card ─────────────────────────────────────────────────
export const RECO_NEAR_BR           = 9
export const RECO_NEAR_MB           = 12
export const RECO_TRIGGER_BR        = 7
export const RECO_TRIGGER_MB        = 9
export const RECO_HEADLINE_FS       = 26
export const RECO_HEADLINE_MB       = 5
export const RECO_CONSEQUENCE_MB    = 16
export const RECO_PLACE_ROWS_GAP    = 7
export const RECO_PLACE_ROWS_MB     = 14
export const RECO_RANK_SIZE         = 20
export const RECO_RANK_FS           = 9

// ── Day divider card ──────────────────────────────────────────
export const DIVIDER_BG       = 'linear-gradient(160deg,#0c1018 0%,#141820 50%,#0e1410 100%)'
export const DIVIDER_GHOST_FS = 88
export const DIVIDER_CITY_FS  = 42
export const DIVIDER_DATE_FS  = 10
export const DIVIDER_LINE_W   = 40

// ── Weather icon map ──────────────────────────────────────────
export const WEATHER_ICON: Record<string, string> = {
  sunny: 'wb_sunny', clear: 'wb_sunny',
  partly_cloudy: 'partly_cloudy_day',
  overcast: 'cloud', cloud: 'cloud',
  drizzle: 'rainy_light',
  rain: 'water_drop',
  thunderstorm: 'thunderstorm', storm: 'thunderstorm',
  snow: 'ac_unit', sleet: 'weather_mix', blizzard: 'ac_unit',
  fog: 'foggy', mist: 'foggy',
  night: 'bedtime', 'clear night': 'bedtime',
}

// ── Engine strip copy (intro card engine changes) ─────────────
export const ENGINE_STRIP_COPY: Record<string, { icon: string; text: (n: number) => string }> = {
  swap:       { icon: 'swap_horiz', text: n => n > 1 ? `Rearranged ${n} stops to improve your route` : 'Rearranged one stop to improve your route' },
  insert:     { icon: 'add_circle', text: n => `Added ${n > 1 ? `${n} stops` : 'a stop'} based on your preferences` },
  resequence: { icon: 'swap_horiz', text: n => `Reordered ${n > 1 ? `${n} stops` : 'stops'} for a better route` },
  weather:    { icon: 'wb_cloudy',  text: _ => 'Outdoor stops adjusted around the weather forecast' },
  transit:    { icon: 'train',      text: _ => 'Timing adjusted around your transit' },
  advisory:   { icon: 'info',       text: _ => 'A few adjustments based on local knowledge' },
  evening:    { icon: 'nightlife',  text: _ => 'Evening kept open based on your exploration preference' },
  culture:    { icon: 'museum',     text: _ => 'Added a cultural stop matching your profile' },
}

// ── Seeded RNG factory ────────────────────────────────────────
// Same algorithm as reel-mock.html: (seed * 9301 + 49297) % 233280
export function makeRng(initial: number): () => number {
  let seed = initial
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}
