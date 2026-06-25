import type {
  EngineItinerary,
  EngineItineraryStop,
  EngineItineraryDay,
  EngineWeights,
  JourneyLeg,
  WeatherData,
  TripDetails,
} from '../../../shared/types';
import { getPlacePhotoUrl } from '../../../shared/api';
import { formatCityLabel } from '../../../shared/cityPhoto';
import { REC_RULES } from '../rec-rules';
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelIntelCard, ReelScenicCard, ReelDayTransitionCard, DayIntelObservation, ReelDayIntelCard } from './types';
import { computeHotelAnchorRow } from './hotel-anchor';

// ── Helpers ───────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Timing cascade helpers ─────────────────────────────────────

function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function parseClosingTimeMin(weekdayText: string[] | null | undefined, isoDate: string | null | undefined): number | null {
  if (!weekdayText?.length || !isoDate) return null;
  const d = new Date(isoDate + 'T12:00:00');
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  const entry = weekdayText.find(e => e.startsWith(dayName));
  if (!entry || entry.includes('Closed') || entry.includes('24 hours')) return null;
  const match = entry.match(/[–\-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const min = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function arrivalModeBuffer(mode: string | null): number {
  if (mode === 'flight') return 90;
  if (mode === 'train') return 45;
  if (mode === 'drive' || mode === 'bus') return 30;
  return 60; // default: unknown or ferry
}

interface CascadeAdj {
  stopId: string;
  originalTime: string;
  newTime: string;
  consequenceNote: string | null;
  isClosingConflict: boolean;
  departurePressureNote: string | null;
}

function cascadeDay(stops: EngineItineraryStop[], earliestStartMin: number, dayDate: string): CascadeAdj[] {
  const sorted = [...stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const result: CascadeAdj[] = [];
  let floorMin = earliestStartMin;

  for (const stop of sorted) {
    const origMin = timeToMinutes(stop.time);
    if (origMin >= floorMin) {
      floorMin = origMin + (stop.durationMin ?? 60) + 15;
      continue;
    }

    const newMin = floorMin;
    const newTime = minutesToTime(newMin);
    const closingMin = parseClosingTimeMin(stop.weekdayText, dayDate);
    const stopEndMin = newMin + (stop.durationMin ?? 60);

    let consequenceNote: string | null = null;
    let isClosingConflict = false;

    if (closingMin !== null) {
      if (newMin >= closingMin) {
        isClosingConflict = true;
        consequenceNote = `Closes at ${fmt12h(minutesToTime(closingMin))} — worth confirming it's still open`;
      } else if (stopEndMin > closingMin) {
        const availMin = closingMin - newMin;
        const h = Math.floor(availMin / 60);
        const m = availMin % 60;
        const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
        consequenceNote = `Closes at ${fmt12h(minutesToTime(closingMin))} — about ${dur} inside`;
      }
    }

    result.push({ stopId: stop.id, originalTime: stop.time, newTime, consequenceNote, isClosingConflict, departurePressureNote: null });
    floorMin = newMin + (stop.durationMin ?? 60) + 15;
  }

  return result;
}

const WALK_THRESHOLD_KM = 0.8;

function dayDistanceSplit(stops: EngineItineraryStop[]): { walkKm: number; rideKm: number } {
  let walkTotal = 0, rideTotal = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const d = haversineKm(stops[i].lat, stops[i].lon, stops[i + 1].lat, stops[i + 1].lon);
    if (d < WALK_THRESHOLD_KM) walkTotal += d;
    else rideTotal += d;
  }
  return { walkKm: Math.round(walkTotal * 10) / 10, rideKm: Math.round(rideTotal * 10) / 10 };
}

function hasMealInWindow(stops: EngineItineraryStop[], start: string, end: string): boolean {
  // Widen by 90 min each side so an engine-inserted lunch at e.g. 11:00 or 14:45 isn't missed
  const startMin = timeToMinutes(start) - 90;
  const endMin   = timeToMinutes(end)   + 90;
  return stops.some(s => {
    const isMeal = s.category === 'restaurant' || s.category === 'cafe' || s.category === 'bakery'
      || s.category === 'fast_food' || s.category === 'food' || s.category === 'meal_takeaway';
    const t = timeToMinutes(s.time);
    return isMeal && t >= startMin && t <= endMin;
  });
}

const DEFAULT_WEIGHTS: EngineWeights = {
  w_walk_affinity: 0.5,
  w_scenic: 0.5,
  w_efficiency: 0.5,
  w_food_density: 0.5,
  w_culture_depth: 0.5,
  w_nightlife: 0.5,
  w_budget_sensitivity: 0.5,
  w_crowd_aversion: 0.5,
  w_spontaneity: 0.5,
  w_rest_need: 0.5,
};

// ── Geo helpers ───────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ── Pair-with helper ──────────────────────────────────────────

const _BROAD_CAT: Record<string, string> = {
  museum: 'cultural', gallery: 'cultural', historic: 'cultural', temple: 'cultural',
  shrine: 'cultural', castle: 'cultural', church: 'cultural',
  park: 'outdoor', garden: 'outdoor', beach: 'outdoor', viewpoint: 'outdoor',
  nature_reserve: 'outdoor', hiking: 'outdoor',
  restaurant: 'food', cafe: 'food', coffee: 'food', bar: 'food',
  market: 'food', lunch: 'food', dinner: 'food',
};

function findPairWith(
  stop: EngineItineraryStop,
  dayStops: EngineItineraryStop[],
): { title: string; category: string; time: string } | null {
  const myBroad = _BROAD_CAT[stop.category?.toLowerCase() ?? ''] ?? 'other';
  if (myBroad === 'other') return null;

  // Find the nearest-scheduled stop with a different broad category (not 'other')
  const myMin = stop.time ? timeToMinutes(stop.time) : 0;

  let best: EngineItineraryStop | null = null;
  let bestDist = Infinity;

  for (const s of dayStops) {
    if (s.id === stop.id) continue;
    const broad = _BROAD_CAT[s.category?.toLowerCase() ?? ''] ?? 'other';
    if (broad === 'other' || broad === myBroad) continue;
    const sMin = s.time ? timeToMinutes(s.time) : 0;
    const dist = Math.abs(sMin - myMin);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }

  if (!best) return null;
  return {
    title: best.title,
    category: best.category ?? '',
    time: best.time ?? '',
  };
}

// ── Day-intel observation builders ───────────────────────────
// Each builder returns DayIntelObservation[] (content for the single Day Intelligence card).

const TRIGGER_SEARCH: Record<string, string> = {
  lunch:    'restaurant',
  dinner:   'restaurant',
  evening:  'bar',
  culture:  'museum',
  rest:     'cafe',
  walking_gap: 'cafe',
  hidden_gem:  '',
};

function triggerCTA(trigger: string, city: string): string {
  const label: Record<string, string> = {
    lunch:       'Browse lunch spots',
    dinner:      'Browse dinner spots',
    evening:     'Browse evening options',
    culture:     'Browse culture nearby',
    rest:        'Browse cafés nearby',
    walking_gap: 'Browse spots en route',
    hidden_gem:  'View on map',
  };
  const base = label[trigger] ?? 'Browse nearby';
  return city ? `${base} in ${city}` : base;
}

function buildMealObservations(
  stops: EngineItineraryStop[],
  city: string,
): DayIntelObservation[] {
  const obs: DayIntelObservation[] = [];

  for (const window of REC_RULES.MEAL_WINDOWS) {
    if (hasMealInWindow(stops, window.start, window.end)) continue;

    if (window.type === 'lunch') {
      const hasStopAtOrAfterWindow = stops.some(
        s => timeToMinutes(s.time) >= timeToMinutes(window.start),
      );
      if (!hasStopAtOrAfterWindow) continue;
    }

    const lastStop = stops.at(-1);
    if (!lastStop) continue;

    const trigger = window.type as 'lunch' | 'dinner';
    obs.push({
      id: `meal-${window.type}-${lastStop.id}`,
      trigger,
      what: window.type === 'lunch' ? 'No lunch in the plan' : 'No dinner in the plan',
      why: window.type === 'lunch'
        ? 'Day runs through midday with no meal window covered.'
        : 'Day plan has nothing for the evening meal.',
      consequence: window.type === 'lunch'
        ? 'A few well-rated spots are within reach.'
        : 'Worth one reservation if you plan to eat out.',
      ctaLabel: triggerCTA(trigger, city),
      stopLat: lastStop.lat,
      stopLon: lastStop.lon,
      searchCategory: TRIGGER_SEARCH[trigger] ?? '',
      anchorCity: city,
    });
  }

  return obs;
}

// Archetypes that strongly care about each reco type — threshold drops to 0 for these
const CULTURE_ARCHETYPES  = ['slowscholar', 'aesthete', 'historian'];
const EVENING_ARCHETYPES  = ['nightcreature', 'pulse'];
const REST_ARCHETYPES     = ['ritualseeker', 'flaneur'];

function buildPersonaObservations(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
  weights: EngineWeights,
): DayIntelObservation[] {
  const obs: DayIntelObservation[] = [];
  if (stops.length === 0) return obs;

  const archetypeLower = persona.toLowerCase().replace(/\s+/g, '');
  const lastStop = stops.at(-1)!;
  const lastEndMin = timeToMinutes(lastStop.time) + lastStop.durationMin;

  const eveningThreshold = EVENING_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_nightlife >= eveningThreshold && lastEndMin < 21 * 60) {
    obs.push({
      id: `evening-${lastStop.id}`,
      trigger: 'evening',
      what: 'Evening is completely free',
      why: `Day wraps at ${minutesToTime(lastEndMin)} with nothing after.`,
      consequence: `${Math.round((21 * 60 - lastEndMin) / 60)}+ hours in ${city || 'the city'} with no plan — worth one intentional pick.`,
      ctaLabel: triggerCTA('evening', city),
      stopLat: lastStop.lat,
      stopLon: lastStop.lon,
      searchCategory: TRIGGER_SEARCH.evening,
      anchorCity: city,
    });
  }

  const cultureThreshold = CULTURE_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_culture_depth >= cultureThreshold) {
    const hasCulture = stops.some(s =>
      s.category === 'museum' || s.category === 'gallery' || s.category === 'historic',
    );
    if (!hasCulture) {
      const cats = [...new Set(stops.map(s => s.category).filter(Boolean))].slice(0, 3).join(', ');
      obs.push({
        id: `culture-${lastStop.id}`,
        trigger: 'culture',
        what: 'No cultural visit today',
        why: `${stops.length} stops${cats ? ` — ${cats}` : ''}. No museum, gallery, or historic interior.`,
        consequence: `Most likely gap to leave the day feeling thin for your style. ${city ? `${city}'s` : 'Local'} galleries are worth a look.`,
        ctaLabel: triggerCTA('culture', city),
        stopLat: lastStop.lat,
        stopLon: lastStop.lon,
        searchCategory: TRIGGER_SEARCH.culture,
        anchorCity: city,
      });
    }
  }

  const restThreshold = REST_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_rest_need >= restThreshold && stops.length >= 3) {
    const hasCafeBreak = stops.some(s => s.category === 'cafe');
    if (!hasCafeBreak) {
      obs.push({
        id: `rest-${lastStop.id}`,
        trigger: 'rest',
        what: `${stops.length} stops, no break`,
        why: 'Back-to-back with no café or sit-down rest window.',
        consequence: 'A 20-minute sit-down mid-day could reduce fatigue on a full schedule.',
        ctaLabel: triggerCTA('rest', city),
        stopLat: lastStop.lat,
        stopLon: lastStop.lon,
        searchCategory: TRIGGER_SEARCH.rest,
        anchorCity: city,
      });
    }
  }

  return obs;
}

// ── Weather + closing-conflict info is shown on each ReelStopCard ────────────
// (weather chip, conflict banner, logistics bar) — no separate reco cards needed

// ── Walking-gap observation ───────────────────────────────────

function buildWalkingGapObservations(
  stops: EngineItineraryStop[],
  city: string,
  weights: EngineWeights,
): DayIntelObservation[] {
  if (weights.w_walk_affinity >= 0.45) return [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (distKm > 2.0) {
      return [{
        id: `walking-${a.id}-${b.id}`,
        trigger: 'walking_gap',
        what: `${distKm.toFixed(1)} km gap between stops`,
        why: `${a.title} → ${b.title} is a long stretch on foot.`,
        consequence: 'A rest spot or café midway could break it up without losing time.',
        ctaLabel: triggerCTA('walking_gap', city),
        stopLat: a.lat,
        stopLon: a.lon,
        searchCategory: TRIGGER_SEARCH.walking_gap,
        anchorCity: city,
      }];
    }
  }
  return [];
}

// ── Discovery observations ────────────────────────────────────
function buildDiscoveryObservations(
  stops: EngineItineraryStop[],
  city: string,
): DayIntelObservation[] {
  const obs: DayIntelObservation[] = [];
  for (const stop of stops) {
    if (stop.stage === 'rising' && (stop.velocityRatio ?? 0) >= 2.0) {
      obs.push({
        id: `trending-${stop.id}`,
        trigger: 'hidden_gem',
        what: `${stop.title} is trending`,
        why: `Gaining traction ${Math.round(stop.velocityRatio ?? 2)}× faster than similar places.`,
        consequence: 'Catch it before the crowds arrive — it may be harder to visit a year from now.',
        ctaLabel: 'View on map',
        stopLat: stop.lat,
        stopLon: stop.lon,
        searchCategory: '',
        anchorCity: city,
      });
    }
  }
  return obs;
}

// ── Intel cards from engine messages ─────────────────────────

function buildIntelCards(day: EngineItineraryDay, anchorImageUrl: string | null): ReelIntelCard[] {
  if (!day.messages?.length) return [];

  return day.messages.map(msg => ({
    type: 'intel' as const,
    id: msg.id,
    messageType: msg.type as ReelIntelCard['messageType'],
    headline: msg.what,
    detail: `${msg.why}${msg.consequence ? ' · ' + msg.consequence : ''}`,
    afterStopId: null,
    imageUrl: anchorImageUrl,
    stopId: msg.stopId ?? null,
  }));
}

// ── Scenic cards ─────────────────────────────────────────────

const SCENIC_ARCHETYPES = new Set(['flaneur', 'aesthete', 'slowscholar', 'naturelover']);

function buildScenicCards(
  stops: EngineItineraryStop[],
  persona: string,
  weights: EngineWeights,
): Array<ReelScenicCard & { _afterStopId: string }> {
  const archetypeLower = persona.toLowerCase().replace(/\s+/g, '');
  const threshold = SCENIC_ARCHETYPES.has(archetypeLower) ? 0.2 : 0.4;
  if (weights.w_scenic < threshold) return [];

  const results: Array<ReelScenicCard & { _afterStopId: string }> = [];

  const personaDisplay = persona.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  for (let i = 0; i < stops.length - 1; i++) {
    // Fix 5: cap at 2 scenic cards per day
    if (results.length >= 2) break;

    const a = stops[i];
    const b = stops[i + 1];
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    // Fix 5: skip pairs that are too close (not walkable) or too far
    if (distKm < 0.1 || distKm > 2.0) continue;

    // Fix 4: area label dedup — use title as fallback when both areas are the same
    const fromLabel = (a.area && a.area !== b.area) ? a.area : a.title;
    const toLabel   = (b.area && a.area !== b.area) ? b.area : b.title;

    const distLabel = distKm < 1
      ? `${Math.round(distKm * 1000)}m walk`
      : `${distKm.toFixed(1)} km walk`;
    const walkMins = Math.max(1, Math.round((distKm / 5) * 60));

    results.push({
      type: 'scenic',
      sceneType: 'walk',
      accent: '#c4b5fd',
      cardType: 'WALK SPINE',
      pos: results.length + 1,
      total: -1,
      timing: minutesToTime(timeToMinutes(a.time) + a.durationMin),
      metaRight: distLabel,
      place: `${fromLabel} → ${toLabel}`,
      from: fromLabel,
      to: toLabel,
      modeIcon: 'walk',
      tag: 'Walk',
      vizType: 'corridor',
      persona: archetypeLower,
      personaDisplay,
      personaIcon: 'walk',
      why: SCENIC_ARCHETYPES.has(archetypeLower)
        ? `This is the walk, not just the route — ${distLabel} through the neighbourhood between ${a.title} and ${b.title}, past things most visitors never find. Given how much you enjoy exploring on foot, this one's worth the ${walkMins} minutes.`
        : `There's a ${distLabel} walking path between these two if you want it — quiet neighbourhood lane, ${walkMins} minutes.`,
      sensory: `~${walkMins} min on foot.`,
      sensoryIcon: 'directions_walk',
      reelPos: `Between Stop ${i + 1} and Stop ${i + 2}`,
      photoUrl: null,
      originPhotoUrl: a.imageUrl ?? (a.photoRef ? getPlacePhotoUrl(a.photoRef, 800, 600) : null),
      destPhotoUrl: b.imageUrl ?? (b.photoRef ? getPlacePhotoUrl(b.photoRef, 800, 600) : null),
      detourKm: Math.round(distKm * 10) / 10,
      detourMin: walkMins,
      _afterStopId: a.id,
    });
  }

  const total = results.length;
  return results.map((c, idx) => ({ ...c, pos: idx + 1, total }));
}

// ── Intel items builder ──────────────────────────────────────

function buildIntelItems(
  engineChanges: { type: string; count: number }[],
  totalDays: number,
  scenicCount: number,
): { icon: string; label: string; count: number; detail: string }[] {
  const items: { icon: string; label: string; count: number; detail: string }[] = [];

  for (const change of engineChanges) {
    switch (change.type) {
      case 'resequence':
        items.push({ icon: '📍', label: 'stops reordered', count: change.count, detail: 'for the best flow' });
        break;
      case 'insert':
        items.push({ icon: '✨', label: 'spots added', count: change.count, detail: 'to enrich your day' });
        break;
      case 'swap':
        items.push({ icon: '🔄', label: 'stops swapped', count: change.count, detail: 'for timing or crowds' });
        break;
      case 'weather':
        items.push({ icon: '⛅', label: 'weather checks', count: change.count, detail: 'factored into your plan' });
        break;
    }
  }

  if (scenicCount > 0) {
    items.push({ icon: '🗺️', label: 'walkable corridors', count: scenicCount, detail: 'mapped through the neighborhood' });
  }

  if (totalDays > 1) {
    items.push({ icon: '⏱️', label: 'days balanced', count: totalDays, detail: 'for a comfortable pace' });
  }

  return items;
}

// ── Transit mode derivation ──────────────────────────────────

function deriveTransitMode(distKm: number): 'flight' | 'drive' | 'train' | null {
  if (distKm < 30) return null;        // same metro area — no dedicated transit card needed
  if (distKm < 80) return 'drive';
  if (distKm < 600) return 'train';
  return 'flight';
}

// ── Balance message builder ──────────────────────────────────

function buildBalanceMessage(
  persona: string,
  stopCount: number,
  categories: Set<string>,
): string {
  const hasFood = categories.has('restaurant') || categories.has('cafe');
  const hasCulture = categories.has('museum') || categories.has('gallery') || categories.has('historic');
  const hasNature = categories.has('park') || categories.has('viewpoint') || categories.has('beach');

  if (stopCount <= 2) return `A focused ${stopCount}-stop day — everything at your pace.`;
  if (hasCulture && hasFood && hasNature) return `Culture, food, and open space. A complete day.`;
  if (hasCulture && hasFood) return `${stopCount} stops — culture and meals balanced.`;
  if (hasNature && hasFood) return `${stopCount} stops — outdoor and food covered.`;
  if (hasFood) return `${stopCount} stops with meals built in.`;
  return `${stopCount} stops, well-paced for ${persona}.`;
}

// ── Main builder ─────────────────────────────────────────────

export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weatherByCity: Map<string, WeatherData> = new Map(),
  persona: string,
  recosByDayIdx: Map<number, ReelRecoCard[]> = new Map(),
  cityPhotoMap: Map<string, string | null> = new Map(),
  _cityCountries: Record<string, string> = {},
  tripDetails?: TripDetails | null,
  travelGroup?: string,
): ReelCard[] {
  if (!itinerary?.days?.length) return [];

  const getWeatherForCity = (cityName: string): WeatherData | null =>
    weatherByCity.get(cityName.toLowerCase()) ?? null;

  const weights: EngineWeights = itinerary.personaSnapshot ?? DEFAULT_WEIGHTS;
  const cards: ReelCard[] = [];
  const allStops = itinerary.days.flatMap(d => d.stops);
  const stopCount = allStops.length;
  // Collect all distinct cities — prefer explicit cities array, fall back to per-day cities
  const fromDays = [...new Set(itinerary.days.map(d => d.city).filter(Boolean))];
  const fromList = itinerary.cities?.filter(Boolean) ?? [];
  const uniqueCities = fromList.length > fromDays.length ? fromList : fromDays.length > 1 ? fromDays : fromList.length > 0 ? fromList : [itinerary.city ?? ''];
  const cityLabel = formatCityLabel(
    uniqueCities.length > 0 ? uniqueCities : [itinerary.city ?? '']
  );

  // Totals for intro card
  const totalDurationMin = allStops.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
  const totalDistanceKm = allStops.reduce((sum, s, i) => {
    if (i === 0) return sum;
    const prev = allStops[i - 1];
    return sum + haversineKm(prev.lat, prev.lon, s.lat, s.lon);
  }, 0);

  // City image: prefer city-level photo, fall back to first stop photo
  const primaryCity = itinerary.city ?? itinerary.cities[0] ?? '';
  const firstStop = itinerary.days[0]?.stops[0];
  const firstStopPhotoUrl = firstStop?.imageUrl
    ?? (firstStop?.photoRef ? getPlacePhotoUrl(firstStop.photoRef, 800, 1200) : null)
    ?? null;
  const introImage = cityPhotoMap.get(primaryCity.toLowerCase()) ?? firstStopPhotoUrl ?? null;

  // Aggregate engine changes for intro summary section
  const allMessages = itinerary.days.flatMap(d => d.messages ?? []);
  const changeCounts = allMessages.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});
  const engineChanges = Object.entries(changeCounts).map(([type, count]) => ({ type, count }));

  // Count scenic cards across all days (needed for intelItems on the intro card)
  const totalScenicCount = itinerary.days.reduce((sum, day) => {
    const sortedStops = [...day.stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    return sum + buildScenicCards(sortedStops, persona, weights).length;
  }, 0);

  cards.push({
    type: 'intro',
    city: cityLabel,
    imageUrl: introImage,
    totalStops: stopCount,
    totalDays: itinerary.days.length,
    totalDurationMin,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    weather: getWeatherForCity(primaryCity),
    proTip: itinerary.summary?.pro_tip ?? null,
    persona,
    engineChanges,
    intelItems: buildIntelItems(engineChanges, itinerary.days.length, totalScenicCount),
    neighborhoods: [],
  });

  let globalStopNumber = 0;
  const cascadeMap = new Map<string, CascadeAdj>();

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];

    // Single day-transition card between consecutive days — replaces wrap + transit + day-intro
    if (dayIdx > 0) {
      const prevDay = itinerary.days[dayIdx - 1];
      const prevCity = prevDay.city || (itinerary.cities?.[dayIdx - 1] ?? '');
      const thisCity = day.city || (itinerary.cities?.[dayIdx] ?? '');
      const isCityChange = !!(prevCity && thisCity && prevCity.toLowerCase() !== thisCity.toLowerCase());

      // Previous day time range
      const prevSorted = [...prevDay.stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const prevFirst = prevSorted[0] ?? null;
      const prevLast  = prevSorted.at(-1) ?? null;
      const prevEndMin = prevLast ? timeToMinutes(prevLast.time) + prevLast.durationMin : null;

      // Next day (current) first stop time
      const thisSorted = [...day.stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const thisFirst  = thisSorted[0] ?? null;

      // Inter-city transit
      let transitMode: ReelDayTransitionCard['transitMode'] = null;
      let transitDistanceKm: number | null = null;
      let transitDurationMin: number | null = null;
      let transitIsEstimated = true;
      let transitDep: string | null = null;
      let transitArr: string | null = null;
      let transitRef: string | null = null;

      if (isCityChange) {
        const transitLeg = journeyLegs
          ? (journeyLegs.find(
              l => l.type === 'transit' &&
                (l as Extract<JourneyLeg, { type: 'transit' }>).from === prevCity &&
                (l as Extract<JourneyLeg, { type: 'transit' }>).to === thisCity,
            ) as Extract<JourneyLeg, { type: 'transit' }> | undefined)
          : undefined;

        if (transitLeg) {
          transitMode         = transitLeg.mode as ReelDayTransitionCard['transitMode'];
          transitDistanceKm   = transitLeg.distanceKm ?? null;
          transitDurationMin  = transitLeg.durationMinutes ?? null;
          transitIsEstimated  = !(transitLeg.departureTime && transitLeg.arrivalTime);
          transitDep          = transitLeg.departureTime ?? null;
          transitArr          = transitLeg.arrivalTime ?? null;
          transitRef          = transitLeg.transitRef ?? null;
        } else {
          // Derive mode from distance between last stop of prev day and first stop of this day
          if (prevLast && thisFirst) {
            const distKm = haversineKm(prevLast.lat, prevLast.lon, thisFirst.lat, thisFirst.lon);
            transitDistanceKm = Math.round(distKm);
            transitMode = deriveTransitMode(distKm);
          }
        }
      }

      const { walkKm: nextDayWalkKm, rideKm: nextDayRideKm } = dayDistanceSplit(day.stops);
      const transitionCard: ReelDayTransitionCard = {
        type: 'day_transition',
        prevDay: prevDay.day,
        prevCity,
        prevDate: prevDay.date,
        prevStopCount: prevDay.stops.length,
        prevStartTime: prevFirst?.time ?? null,
        prevEndTime: prevEndMin !== null ? minutesToTime(prevEndMin) : null,
        nextDay: day.day,
        nextCity: thisCity,
        nextDate: day.date,
        nextStopCount: day.stops.length,
        nextStartTime: thisFirst?.time ?? null,
        nextDayWalkKm,
        nextDayRideKm,
        isCityChange,
        transitMode,
        transitDistanceKm,
        transitDurationMin,
        transitIsEstimated,
        transitDepartureTime: transitDep,
        transitArrivalTime: transitArr,
        transitRef,
      };
      cards.push(transitionCard);

      // Inter-city arrival cascade: if the transit leg has an arrival time, shift Day N stops forward
      if (tripDetails && isCityChange && transitArr) {
        const buffer = arrivalModeBuffer(transitMode);
        for (const adj of cascadeDay(day.stops, timeToMinutes(transitArr) + buffer, day.date)) {
          cascadeMap.set(adj.stopId, adj);
        }
      }
    }

    // Sort stops chronologically — engine may return them out of order
    const sortedStops = [...day.stops].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );

    // Day 0 arrival cascade: user arrives on the first itinerary day.
    // Allow when dates match OR when day.date is unset (itinerary built without start date).
    const arrivalDateMatchesDay0 = !day.date || !tripDetails?.arrivalDate || tripDetails.arrivalDate === day.date;
    if (tripDetails && dayIdx === 0 && arrivalDateMatchesDay0 && tripDetails.arrivalTime) {
      for (const adj of cascadeDay(day.stops, timeToMinutes(tripDetails.arrivalTime) + 60, day.date ?? tripDetails.arrivalDate ?? '')) {
        cascadeMap.set(adj.stopId, adj);
      }
    }

    // Departure day pressure: flag stops that run into departure prep time.
    // Allow when dates match OR when day.date is unset (last day).
    const departureDateMatchesDay = !day.date || !tripDetails?.departureDate || tripDetails.departureDate === day.date;
    const isLastDay = dayIdx === itinerary.days.length - 1;
    if (tripDetails?.departureTime && (departureDateMatchesDay || (isLastDay && !day.date))) {
      const depMin = timeToMinutes(tripDetails.departureTime);
      const latestLeaveMin = depMin - 90; // 90 min before departure
      for (let i = sortedStops.length - 1; i >= 0; i--) {
        const s = sortedStops[i];
        const existing = cascadeMap.get(s.id);
        const startMin = existing ? timeToMinutes(existing.newTime) : timeToMinutes(s.time);
        const endMin = startMin + (s.durationMin ?? 60);
        if (endMin > latestLeaveMin) {
          const leaveByMin = Math.max(0, latestLeaveMin);
          const depNote = leaveByMin <= startMin
            ? `Your departure is at ${fmt12h(tripDetails.departureTime)} — leave directly from here`
            : `Your departure is at ${fmt12h(tripDetails.departureTime)} — head out by ${fmt12h(minutesToTime(leaveByMin))}`;
          cascadeMap.set(s.id, {
            ...(existing ?? { stopId: s.id, originalTime: s.time, newTime: s.time, consequenceNote: null, isClosingConflict: false }),
            departurePressureNote: depNote,
          });
        }
      }
    }

    // Build scenic card lookup: stop.id → scenic card placed after that stop
    const dayScenic = buildScenicCards(sortedStops, persona, weights);
    const scenicByStopId = new Map<string, ReelScenicCard>(
      dayScenic.map(({ _afterStopId, ...card }) => [_afterStopId, card as ReelScenicCard]),
    );

    // Build day intel observations — one card per day, placed after the last stop
    const engineRecos = recosByDayIdx.get(dayIdx) ?? [];
    const engineTriggers = new Set(engineRecos.map(r => r.trigger));

    // Convert engine recos (ReelRecoCard) to DayIntelObservation
    const engineObservations: DayIntelObservation[] = engineRecos.map(r => ({
      id: r.id,
      trigger: r.trigger,
      what: r.label,
      why: r.consequence,
      consequence: '',
      ctaLabel: triggerCTA(r.trigger, r.nearbyCity),
      stopLat: r.stopLat ?? null,
      stopLon: r.stopLon ?? null,
      searchCategory: TRIGGER_SEARCH[r.trigger] ?? '',
      anchorCity: r.nearbyCity,
    }));

    const allObservations: DayIntelObservation[] = [
      ...engineObservations,
      ...buildMealObservations(sortedStops, day.city),
      ...buildPersonaObservations(sortedStops, persona, day.city, weights),
      ...(engineTriggers.has('walking_gap') ? [] : buildWalkingGapObservations(sortedStops, day.city, weights)),
      ...(engineTriggers.has('hidden_gem') ? [] : buildDiscoveryObservations(sortedStops, day.city)),
    ];
    // Deduplicate by trigger
    const seenTriggers = new Set<string>();
    const dedupedObservations = allObservations.filter(o => {
      if (seenTriggers.has(o.trigger)) return false;
      seenTriggers.add(o.trigger);
      return true;
    });

    for (let si = 0; si < sortedStops.length; si++) {
      const stop = sortedStops[si];
      globalStopNumber += 1;

      // Resolve stop image for intel card background
      const stopImageUrl = stop.imageUrl
        ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 600) : null);

      const adj = cascadeMap.get(stop.id);
      const effectiveStop = adj && adj.newTime !== adj.originalTime ? { ...stop, time: adj.newTime } : stop;

      // Compute next-leg transit info
      const nextStop = sortedStops[si + 1] ?? null;
      let nextLeg: ReelStopCard['nextLeg'] = null;
      if (nextStop && stop.lat != null && stop.lon != null && nextStop.lat != null && nextStop.lon != null) {
        const distKm = haversineKm(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        const isWalk = distKm < WALK_THRESHOLD_KM;
        const durationMin = isWalk
          ? Math.max(1, Math.round(distKm / 5 * 60))
          : Math.max(3, Math.round(distKm / 25 * 60));
        nextLeg = { distKm: Math.round(distKm * 10) / 10, durationMin, mode: isWalk ? 'walk' : 'ride', nextStopTitle: nextStop.title };
      }

      const stopCard: ReelStopCard = {
        type: 'stop',
        stop: effectiveStop,
        stopNumber: globalStopNumber,
        totalStops: stopCount,
        day: dayIdx + 1,
        totalDays: itinerary.days.length,
        orderReason: stop.orderReason ?? null,
        orderConsequence: stop.orderConsequence ?? null,
        movedFrom: stop.movedFrom ?? null,
        weather: getWeatherForCity(day.city),
        nextLeg,
        pairWith: findPairWith(stop, sortedStops),
        visitDate: day.date ?? null,
        timingAdjustment: adj ? {
          originalTime: adj.originalTime,
          consequenceNote: adj.consequenceNote,
          isClosingConflict: adj.isClosingConflict,
          departurePressureNote: adj.departurePressureNote,
        } : null,
      };
      // Hotel anchor row
      const cityName = day.city || (itinerary.cities?.[dayIdx] ?? '');
      const hotelEntry = tripDetails?.hotels?.find(h => h.city === cityName) ?? null;
      const cityArrivalEntry = tripDetails?.cityArrivals?.find(c => c.city === cityName) ?? null;
      const isLastDayInCity = dayIdx < itinerary.days.length - 1
        ? (itinerary.days[dayIdx + 1].city || itinerary.cities?.[dayIdx + 1]) !== cityName
        : true;
      const isFirstOfDay = si === 0;
      const isLastOfDay = si === sortedStops.length - 1;
      stopCard.hotelAnchor = computeHotelAnchorRow({
        stopTime: effectiveStop.time ?? null,
        stopLat: stop.lat ?? null,
        stopLon: stop.lon ?? null,
        isFirstOfDay,
        isLastOfDay,
        isLastDayInCity,
        travelGroup: travelGroup ?? 'solo',
        hotel: hotelEntry && hotelEntry.lat != null && hotelEntry.lon != null
          ? { name: hotelEntry.name ?? cityName, lat: hotelEntry.lat, lon: hotelEntry.lon, checkInTime: hotelEntry.checkInTime ?? null }
          : null,
        cityArrivalTime: cityArrivalEntry?.arrivalTime ?? (dayIdx === 0 ? (tripDetails?.arrivalTime ?? null) : null),
        cityArrivalVia: cityArrivalEntry?.arrivalVia ?? null,
        cityDepartureTime: cityArrivalEntry?.departureTime ?? (isLastDayInCity && dayIdx === itinerary.days.length - 1 ? (tripDetails?.departureTime ?? null) : null),
      });

      cards.push(stopCard);

      // Intel cards that reference this stop (by placeId match)
      // Suppress 'insert' type — the stop card's orderReason already covers it
      const stopIntelCards = buildIntelCards(day, stopImageUrl).filter(
        ic => ic.stopId != null && ic.stopId === stop.placeId && ic.messageType !== 'insert',
      );
      cards.push(...stopIntelCards);

      // Scenic walk card after this stop (if the next stop is within walking distance)
      const scenicCard = scenicByStopId.get(stop.id);
      if (scenicCard) cards.push(scenicCard);
    }

    // Single Day Intelligence card after the last stop of this day
    const lastStopForIntel = sortedStops.at(-1);
    if (lastStopForIntel && dedupedObservations.length > 0) {
      const dayIntelCard: ReelDayIntelCard = {
        type: 'day_intel',
        id: `day-intel-${dayIdx}`,
        day: dayIdx + 1,
        totalDays: itinerary.days.length,
        dayCity: day.city || primaryCity,
        afterStopId: lastStopForIntel.id,
        observations: dedupedObservations,
      };
      cards.push(dayIntelCard);
    }

    // Remaining intel cards not matched to a specific stop — push after all stops
    const lastStop = sortedStops.at(-1);
    const lastStopImage = lastStop
      ? (lastStop.imageUrl ?? (lastStop.photoRef ? getPlacePhotoUrl(lastStop.photoRef, 600) : null))
      : null;
    const allIntelIds = new Set(cards.filter(c => c.type === 'intel').map(c => (c as ReelIntelCard).id));
    const unplacedIntel = buildIntelCards(day, lastStopImage).filter(
      ic => !allIntelIds.has(ic.id) && ic.messageType !== 'insert',
    );
    cards.push(...unplacedIntel);

    // Day-boundary transition cards are now emitted at the START of each day > 1 (above).
    // No separate wrap-up card needed.
  }

  // Balance card: when engine ran but found zero recos for all days — surface a positive message
  const allRecosCount = Array.from(recosByDayIdx.values()).reduce((sum, r) => sum + r.length, 0);
  if (recosByDayIdx.size > 0 && allRecosCount === 0) {
    const allCategories = new Set(allStops.map(s => s.category));
    cards.push({
      type: 'balance',
      message: buildBalanceMessage(persona, stopCount, allCategories),
      persona,
    });
  }

  cards.push({
    type: 'finale',
    city: cityLabel,
    totalStops: stopCount,
    persona,
  });

  return cards;
}
