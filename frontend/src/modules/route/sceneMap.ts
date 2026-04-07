// ── Asset loader ────────────────────────────────────────────────

function makeMap(glob: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(glob)) {
    const name = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
    if (name) out[name] = url as string;
  }
  return out;
}

const TIME = makeMap(
  import.meta.glob('../../assets/Time/*.mp4', { eager: true, import: 'default' }) as Record<string, unknown>
);
const ACTIVITY = makeMap(
  import.meta.glob('../../assets/activity/*.mp4', { eager: true, import: 'default' }) as Record<string, unknown>
);
const WEATHER = makeMap(
  import.meta.glob('../../assets/weather/*.mp4', { eager: true, import: 'default' }) as Record<string, unknown>
);
const TRANSITION = makeMap(
  import.meta.glob('../../assets/transition/*.mp4', { eager: true, import: 'default' }) as Record<string, unknown>
);
const ANIMATION = makeMap({
  ...(import.meta.glob('../../assets/animation/*.mp4', { eager: true, import: 'default' }) as Record<string, unknown>),
  ...(import.meta.glob('../../assets/animation/*.mov', { eager: true, import: 'default' }) as Record<string, unknown>),
});

// ── App-moment exports ───────────────────────────────────────────
export const SCENE_GENERATING = ANIMATION['slow_focus'] ?? ANIMATION['shifting_sky'] ?? '';
export const SCENE_DAY_DONE   = ANIMATION['day_complete'] ?? '';
export const SCENE_SAVED      = ANIMATION['trip_saved'] ?? '';

// ── Types ────────────────────────────────────────────────────────
export interface SceneInput {
  stopName: string;
  timeMins: number;
  category: string | null;
  weather: { condition: string; temp: number } | null;
}

// ── Main resolver ────────────────────────────────────────────────
export function resolveScene({ stopName, timeMins, category, weather }: SceneInput): string {
  // 1. Weather dominates when severe or clearly dominant
  if (weather) {
    const cond = weather.condition.toLowerCase();
    const w = resolveWeather(cond, weather.temp, timeMins);
    if (w) return w;
  }

  // 2. Activity-specific (keyword + category)
  const activity = resolveActivity(stopName.toLowerCase(), category, timeMins);
  if (activity) return activity;

  // 3. Time of day fallback
  return resolveTimeOfDay(timeMins);
}

function resolveWeather(cond: string, temp: number, timeMins: number): string | null {
  if (cond.includes('thunder') || cond.includes('storm'))     return WEATHER['heavy_rain'] ?? null;
  if (cond.includes('snow'))                                   return WEATHER['snow'] ?? null;
  if (cond.includes('fog') || cond.includes('mist'))           return WEATHER['misty_morning'] ?? null;
  if (cond.includes('drizzle'))                               return WEATHER['light_drizzle'] ?? null;
  if (cond.includes('rain'))                                  return WEATHER['heavy_rain'] ?? WEATHER['light_drizzle'] ?? null;
  if (cond.includes('cloud') || cond.includes('overcast')) {
    return timeMins < 12 * 60
      ? (WEATHER['overcast_morning'] ?? null)
      : (WEATHER['overcast_afternoon'] ?? null);
  }
  if (cond.includes('sun') || cond.includes('clear')) {
    if (timeMins < 10 * 60) return WEATHER['sunny_morning'] ?? null;
    if (timeMins < 17 * 60) return WEATHER['sunny_afternoon'] ?? null;
    return WEATHER['sunny_evening'] ?? null;
  }
  if (temp >= 35)                                             return WEATHER['hot_afternoon'] ?? null;
  if (cond.includes('wind'))                                  return WEATHER['windy'] ?? null;
  return null;
}

function resolveActivity(name: string, category: string | null, timeMins: number): string | null {
  // Morning coffee
  if (timeMins < 11 * 60 && /\b(coffee|café|cafe|espresso|brew|kopi)\b/.test(name))
    return ACTIVITY['morning_coffee'] ?? null;

  // Meals
  if (/\bbreakfast\b/.test(name))     return ACTIVITY['breakfast_table'] ?? null;
  if (/\bbrunch\b/.test(name))        return ACTIVITY['brunch'] ?? null;
  if (/\bstreet food\b/.test(name))   return ACTIVITY['street_food_stall'] ?? null;

  // Night market (before local market to avoid false match)
  if (/\bnight market\b/.test(name))  return ACTIVITY['night_market'] ?? null;

  // Rooftop (before bar/restaurant checks)
  if (/\brooftop\b/.test(name)) {
    if (timeMins >= 18 * 60)          return ACTIVITY['rooftop_dinner'] ?? ACTIVITY['rooftop'] ?? null;
    if (/\bbar\b/.test(name))         return ACTIVITY['rooftop_bar'] ?? ACTIVITY['rooftop'] ?? null;
    return ACTIVITY['rooftop'] ?? null;
  }

  // Culture / historic
  if (/\b(museum|musée|gallery|galleria)\b/.test(name) || category === 'museum')
    return ACTIVITY['museum'] ?? null;
  if (/\b(palace|castle|château|chateau|citadel)\b/.test(name))
    return ACTIVITY['palace'] ?? null;
  if (/\b(temple|mosque|church|cathedral|shrine|synagogue|basilica|abbey|monastery)\b/.test(name))
    return ACTIVITY['religious_site'] ?? null;
  if (/\b(monument|ruins|ruin|ancient|archaeological|fort|memorial)\b/.test(name) || category === 'historic')
    return ACTIVITY['historic_monument'] ?? null;

  // Nature
  if (/\b(beach|coast|shore|seaside|bay)\b/.test(name))
    return ACTIVITY['beach'] ?? null;
  if (/\b(lake|river|canal|waterfront|harbor|harbour|pier|dock|quay)\b/.test(name))
    return ACTIVITY['lakeside'] ?? null;
  if (/\b(mountain|summit|peak|viewpoint|belvedere|mirador|overlook|hilltop)\b/.test(name))
    return ACTIVITY['mountain_viewpoint'] ?? null;
  if (/\b(botanical|botanic)\b/.test(name))
    return ACTIVITY['botanical_garden'] ?? null;

  // Markets
  if (/\b(flea|antique|vintage)\b/.test(name))
    return ACTIVITY['flea_market'] ?? null;
  if (/\b(market|bazaar|souk|bazar|mercado)\b/.test(name))
    return ACTIVITY['local_market'] ?? null;

  // Shopping / creative
  if (/\b(bookshop|bookstore|library)\b/.test(name))
    return ACTIVITY['bookshop'] ?? null;
  if (/\b(shopping|mall|boutique|shop|store)\b/.test(name))
    return ACTIVITY['shopping_street'] ?? null;
  if (/\b(art district|mural|graffiti|creative district)\b/.test(name))
    return ACTIVITY['art_district'] ?? null;

  // Wellness / stay
  if (/\b(spa|hammam|bath|onsen|sauna)\b/.test(name))
    return ACTIVITY['spa'] ?? null;
  if (/\b(hotel|check.?in|accommodation|airbnb|hostel)\b/.test(name))
    return ACTIVITY['hotel_check-in'] ?? null;
  if (/\b(afternoon nap|rest)\b/.test(name))
    return ACTIVITY['afternoon_nap'] ?? null;

  // Nightlife
  if (/\b(club|disco|nightclub)\b/.test(name))
    return ACTIVITY['club'] ?? null;
  if (/\b(live music|jazz|concert|gig)\b/.test(name))
    return ACTIVITY['live_music'] ?? null;
  if (/\b(bar|pub|tavern|lounge|cocktail|speakeasy)\b/.test(name)) {
    if (timeMins >= 18 * 60)  return ACTIVITY['pub'] ?? null;
    return ACTIVITY['pub'] ?? null;
  }

  // Category-based fallbacks
  if (category === 'restaurant') {
    if (timeMins >= 19 * 60) return ACTIVITY['fine_dine'] ?? ACTIVITY['rooftop_dinner'] ?? null;
    return ACTIVITY['casual_lunch'] ?? null;
  }
  if (category === 'cafe')    return ACTIVITY['morning_coffee'] ?? null;
  if (category === 'park' || /\b(park|garden|square|plaza)\b/.test(name))
    return ACTIVITY['park'] ?? null;

  return null;
}

function resolveTimeOfDay(timeMins: number): string {
  if (timeMins < 5 * 60)  return TIME['early_morning_city']      ?? TIME['Early_morning_soft_lights'] ?? '';
  if (timeMins < 7 * 60)  return TIME['Early_morning_soft_lights'] ?? TIME['early_morning_empty_street'] ?? '';
  if (timeMins < 9 * 60)  return TIME['golden_morning_light']    ?? TIME['people_starting_day'] ?? '';
  if (timeMins < 11 * 60) return TIME['mid_morning_bright']      ?? TIME['active_street'] ?? '';
  if (timeMins < 13 * 60) return TIME['active_street']           ?? TIME['busy_afternoon'] ?? '';
  if (timeMins < 15 * 60) return TIME['afternoon_daylight']      ?? TIME['busy_afternoon'] ?? '';
  if (timeMins < 17 * 60) return TIME['busy_afternoon']          ?? TIME['late_afternoon'] ?? '';
  if (timeMins < 18 * 60) return TIME['late_afternoon']          ?? TIME['Golden_hour'] ?? '';
  if (timeMins < 19 * 60) return TIME['Golden_hour']             ?? TIME['evening'] ?? '';
  if (timeMins < 21 * 60) return TIME['evening']                 ?? '';
  return TIME['night'] ?? '';
}

// ── Transition resolver ──────────────────────────────────────────
export function resolveTransition(transitToNext: string | undefined): string {
  if (!transitToNext) return TRANSITION['city_street'] ?? '';
  const t = transitToNext.toLowerCase();
  if (/metro|subway|underground|tube/i.test(t))  return TRANSITION['metro']           ?? TRANSITION['city_street'] ?? '';
  if (/tram/i.test(t))                           return TRANSITION['tram']            ?? TRANSITION['city_street'] ?? '';
  if (/cab|taxi|uber|lyft|grab/i.test(t))        return TRANSITION['cab']             ?? TRANSITION['city_street'] ?? '';
  if (/ferry|boat|water/i.test(t))               return TRANSITION['ferry']           ?? TRANSITION['city_street'] ?? '';
  if (/cycl|bike/i.test(t))                      return TRANSITION['cycling']         ?? TRANSITION['city_street'] ?? '';
  if (/bridge/i.test(t))                         return TRANSITION['bridge']          ?? TRANSITION['city_street'] ?? '';
  if (/stair|climb|uphill/i.test(t))             return TRANSITION['climb_stairs']    ?? TRANSITION['city_street'] ?? '';
  if (/cobble/i.test(t))                         return TRANSITION['cobblestone_road'] ?? TRANSITION['city_street'] ?? '';
  if (/park|garden/i.test(t))                    return TRANSITION['park_path']       ?? TRANSITION['city_street'] ?? '';
  return TRANSITION['city_street'] ?? '';
}

// ── Gradient fallback (CSS, no video needed) ─────────────────────
export function timeGradient(timeMins: number): string {
  if (timeMins < 5 * 60)  return 'linear-gradient(160deg, #0a0010 0%, #0d0d1a 100%)';
  if (timeMins < 7 * 60)  return 'linear-gradient(160deg, #1a0a2e 0%, #2d1b69 50%, #0d1117 100%)';
  if (timeMins < 9 * 60)  return 'linear-gradient(160deg, #c9510c 0%, #e8813a 40%, #1a1a3e 100%)';
  if (timeMins < 11 * 60) return 'linear-gradient(160deg, #1a6fa8 0%, #4ba3d3 50%, #87ceeb 100%)';
  if (timeMins < 15 * 60) return 'linear-gradient(160deg, #2980b9 0%, #6dd5fa 100%)';
  if (timeMins < 17 * 60) return 'linear-gradient(160deg, #f9ca24 0%, #f0932b 60%, #2c3e50 100%)';
  if (timeMins < 19 * 60) return 'linear-gradient(160deg, #e55039 0%, #f0932b 50%, #2c3e50 100%)';
  if (timeMins < 21 * 60) return 'linear-gradient(160deg, #2c3e50 0%, #e74c3c 40%, #2c3e50 100%)';
  return 'linear-gradient(160deg, #0a0e14 0%, #1a1a2e 100%)';
}
