import type {
  EngineItinerary,
  EngineItineraryStop,
  EngineItineraryDay,
  EngineWeights,
  JourneyLeg,
  WeatherData,
  TripDetails,
  ScenicCorridorCard,
} from '../../../shared/types';
import { getPlacePhotoUrl } from '../../../shared/api';
import { formatCityLabel } from '../../../shared/cityPhoto';
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelIntelCard, ReelScenicCard, ReelDayTransitionCard, DayIntelObservation } from './types';
import { computeHotelAnchorRow } from './hotel-anchor';

// ── Helpers ───────────────────────────────────────────────────

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Timing cascade helpers ─────────────────────────────────────

function fmt12h(time: string | null | undefined): string {
  if (!time) return '';
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

interface CascadeAdj {
  stopId: string;
  originalTime: string;
  newTime: string;
  consequenceNote: string | null;
  isClosingConflict: boolean;
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

    result.push({ stopId: stop.id, originalTime: stop.time, newTime, consequenceNote, isClosingConflict });
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
  lunch:            'restaurant',
  dinner:           'restaurant',
  evening:          'bar',
  culture:          'museum',
  rest:             'cafe',
  walking_gap:      'cafe',
  walkable_detour:  '',
  hidden_gem:       '',
  famous_spots:     'tourist_attraction',
};

function triggerCTA(trigger: string, city: string): string {
  const label: Record<string, string> = {
    lunch:            'Browse lunch spots',
    dinner:           'Browse dinner spots',
    evening:          'Browse evening options',
    culture:          'Browse culture nearby',
    rest:             'Browse cafés nearby',
    walking_gap:      'Browse spots en route',
    walkable_detour:  'View walking route',
    hidden_gem:       'View on map',
    famous_spots:     'Browse famous spots',
  };
  const base = label[trigger] ?? 'Browse nearby';
  return city ? `${base} in ${city}` : base;
}


// ── Walkable detour observations ─────────────────────────────
// Fires for non-walk personas when a walkable leg exists that they'd naturally skip.
// Distinct from walking_gap (which warns about a stretch that's *too far*) — this
// surfaces a stretch that's *worth walking* even for non-walkers.
export function buildWalkableDetourObservations(
  stops: EngineItineraryStop[],
  city: string,
  weights: EngineWeights,
  walkBaseKm = 2.0,
  persona?: string,
): DayIntelObservation[] {
  // L1 gate: raised from 0.55 to 0.80 so more personas get detour suggestions
  if (weights.w_walk_affinity >= 0.80) return [];

  const archetypeLower = (persona ?? '').toLowerCase().replace(/\s+/g, '');
  const EXPLORER_ARCHETYPES = new Set(['wanderer', 'voyager', 'explorer', 'flaneur', 'drifter']);
  const isExplorerL2 = EXPLORER_ARCHETYPES.has(archetypeLower) && weights.w_walk_affinity < 0.35;

  // Detour window: 0.3 km – maxKm (the full scenic ceiling, ignoring persona discount)
  // L2 explorer path: extend range up to 2× walkBaseKm (max 4km) for bolder suggestions
  const minKm = 0.3;
  const maxKm = isExplorerL2 ? Math.min(walkBaseKm * 2, 4.0) : walkBaseKm;

  const obs: DayIntelObservation[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];

    // Use real Google Routes data when available, fall back to haversine
    const realWalk = b.walkFromPrev;
    const distKm = realWalk ? realWalk.distanceMeters / 1000 : haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (distKm < minKm || distKm > maxKm) continue;

    const walkMins = realWalk
      ? Math.max(1, Math.round(realWalk.durationSeconds / 60))
      : Math.max(1, Math.round((distKm / 5) * 60));
    const distLabel = distKm < 1
      ? `${Math.round(distKm * 1000)} m`
      : `${distKm.toFixed(1)} km`;

    const consequence = isExplorerL2
      ? `~${walkMins} min walk between stops — the kind of detour you'll remember. Take it.`
      : "Worth the legs if you have time — you'll see more than from a ride.";

    obs.push({
      id: `walkable-detour-${a.id}-${b.id}`,
      trigger: 'walkable_detour',
      what: `${distLabel} walkable stretch`,
      why: `${a.title} to ${b.title} is short enough to walk — ~${walkMins} min on foot.`,
      consequence,
      ctaLabel: triggerCTA('walkable_detour', city),
      stopLat: a.lat,
      stopLon: a.lon,
      searchCategory: TRIGGER_SEARCH.walkable_detour,
      anchorCity: city,
    });

    if (obs.length >= 1) break; // surface at most one per day — don't overwhelm
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
  walkBaseKm = 2.0,
): Array<ReelScenicCard & { _afterStopId: string }> {
  const archetypeLower = persona.toLowerCase().replace(/\s+/g, '');
  const threshold = SCENIC_ARCHETYPES.has(archetypeLower) ? 0.2 : 0.4;
  if (weights.w_scenic < threshold) return [];

  // Dynamic walk ceiling: city pedestrian density × walk affinity modifier
  const walkThresholdKm = walkBaseKm * (0.6 + weights.w_walk_affinity * 0.8);

  const results: Array<ReelScenicCard & { _afterStopId: string }> = [];

  const personaDisplay = persona.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  for (let i = 0; i < stops.length - 1; i++) {
    if (results.length >= 2) break;

    const a = stops[i];
    const b = stops[i + 1];
    const realWalk = b.walkFromPrev;
    const distKm = realWalk ? realWalk.distanceMeters / 1000 : haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (distKm < 0.1 || distKm > walkThresholdKm) continue;

    // Fix 4: area label dedup — use title as fallback when both areas are the same
    const fromLabel = (a.area && a.area !== b.area) ? a.area : a.title;
    const toLabel   = (b.area && a.area !== b.area) ? b.area : b.title;

    const distLabel = distKm < 1
      ? `${Math.round(distKm * 1000)}m walk`
      : `${distKm.toFixed(1)} km walk`;
    const walkMins = realWalk
      ? Math.max(1, Math.round(realWalk.durationSeconds / 60))
      : Math.max(1, Math.round((distKm / 5) * 60));

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
      originPlaceId: a.placeId ?? null,
      destPlaceId: b.placeId ?? null,
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
    return sum + buildScenicCards(sortedStops, persona, weights, day.walkBaseKm ?? 2.0).length;
  }, 0);

  const totalRecoCards = Array.from(recosByDayIdx.values()).reduce((sum, r) => sum + r.length, 0);

  cards.push({
    type: 'intro',
    city: cityLabel,
    imageUrl: introImage,
    totalStops: stopCount,
    totalRecos: totalRecoCards,
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

  // Pre-pass: detect days that are same-day continuations.
  // Case 1: same city, same calendar date (engine merged them because prev day ended before 4 PM)
  // Case 2: different cities, prev ends before 13:00, transit ≤ 3h or distance ≤ 300km
  const sameDayMergeSet = new Set<number>();
  // Subset of sameDayMergeSet: only same-city same-date entries.
  // These days get their stops merged into the first day of the group so stops sort globally by time
  // rather than appearing in day-object order (which produces 10am, 12pm, 8am sequences).
  const sameCityDateMergeSet = new Set<number>();
  for (let di = 1; di < itinerary.days.length; di++) {
    const prevD = itinerary.days[di - 1];
    const currD = itinerary.days[di];
    const prevCityRaw = prevD.city || (itinerary.cities?.[di - 1] ?? '');
    const currCityRaw = currD.city || (itinerary.cities?.[di] ?? '');
    const prevCityKey = prevCityRaw.toLowerCase();
    const currCityKey = currCityRaw.toLowerCase();

    // Same city, same calendar date → engine already merged them as a same-day continuation
    if (prevCityKey && currCityKey && prevCityKey === currCityKey && prevD.date === currD.date) {
      sameDayMergeSet.add(di);
      sameCityDateMergeSet.add(di);
      continue;
    }

    if (!prevCityKey || !currCityKey || prevCityKey === currCityKey) continue;
    const prevSortedPre = [...prevD.stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const prevLastPre = prevSortedPre.at(-1);
    if (!prevLastPre) continue;
    const prevEndMinPre = timeToMinutes(prevLastPre.time) + (prevLastPre.durationMin ?? 60);
    if (prevEndMinPre >= 13 * 60) continue; // prev day runs past 1 PM — not a morning-only city
    const transitLegPre = journeyLegs
      ? (journeyLegs.find(
          l => l.type === 'transit' &&
            (l as Extract<JourneyLeg, { type: 'transit' }>).from === prevCityRaw &&
            (l as Extract<JourneyLeg, { type: 'transit' }>).to === currCityRaw,
        ) as Extract<JourneyLeg, { type: 'transit' }> | undefined)
      : undefined;
    if (transitLegPre?.durationMinutes !== undefined && transitLegPre.durationMinutes > 180) continue;
    if (!transitLegPre) {
      const currSortedPre = [...currD.stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const currFirstPre = currSortedPre[0];
      if (currFirstPre && haversineKm(prevLastPre.lat, prevLastPre.lon, currFirstPre.lat, currFirstPre.lon) > 300) continue;
    }
    sameDayMergeSet.add(di);
  }
  const logicalTotalDays = itinerary.days.length - sameDayMergeSet.size;
  let logicalDayNum = 0;

  // Pre-merge stops for same-city same-date groups so all stops sort globally by time.
  // Walk backward so chained merges (di-1 also merged) resolve correctly to the anchor day.
  const effectiveStops: Map<number, EngineItineraryStop[]> = new Map(
    itinerary.days.map((d, i) => [i, [...d.stops]])
  );
  for (let di = itinerary.days.length - 1; di >= 1; di--) {
    if (!sameCityDateMergeSet.has(di)) continue;
    let anchor = di - 1;
    while (sameCityDateMergeSet.has(anchor) && anchor > 0) anchor--;
    effectiveStops.set(anchor, [...(effectiveStops.get(anchor) ?? []), ...(effectiveStops.get(di) ?? [])]);
    effectiveStops.set(di, []); // consumed — no stop cards emitted for this day
  }

  let globalStopNumber = 0;
  const cascadeMap = new Map<string, CascadeAdj>();

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];
    const isMergedWithPrev = sameDayMergeSet.has(dayIdx);
    if (!isMergedWithPrev) logicalDayNum++;

    // Same-city same-date days had their stops merged into the anchor day — skip entirely.
    if (sameCityDateMergeSet.has(dayIdx)) continue;

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
        sameDay: isMergedWithPrev,
        ...(transitMode === 'drive' && prevLast && thisFirst ? {
          driveOriginLat: prevLast.lat,
          driveOriginLon: prevLast.lon,
          driveDestLat:   thisFirst.lat,
          driveDestLon:   thisFirst.lon,
        } : {}),
      };
      cards.push(transitionCard);

      // Inter-city arrival: shift stops to start no earlier than arrival time (no buffer — times are suggested)
      if (tripDetails && isCityChange && transitArr) {
        const stopsForCascade = effectiveStops.get(dayIdx) ?? day.stops;
        for (const adj of cascadeDay(stopsForCascade, timeToMinutes(transitArr), day.date)) {
          cascadeMap.set(adj.stopId, adj);
        }
      }
    }

    // Sort stops chronologically — use effectiveStops which may include stops merged from
    // same-city same-date continuation days so they appear in true time order.
    const dayStops = effectiveStops.get(dayIdx) ?? day.stops;
    const sortedStops = [...dayStops].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );

    // Day 0 arrival cascade: shift stops to start no earlier than arrival time (no arbitrary buffer)
    const arrivalDateMatchesDay0 = !day.date || !tripDetails?.arrivalDate || tripDetails.arrivalDate === day.date;
    if (tripDetails && dayIdx === 0 && arrivalDateMatchesDay0 && tripDetails.arrivalTime) {
      for (const adj of cascadeDay(dayStops, timeToMinutes(tripDetails.arrivalTime), day.date ?? tripDetails.arrivalDate ?? '')) {
        cascadeMap.set(adj.stopId, adj);
      }
    }

    const isLastDay = dayIdx === itinerary.days.length - 1;

    // Build scenic card lookup: stop.id → scenic card placed after that stop
    const dayScenic = buildScenicCards(sortedStops, persona, weights, day.walkBaseKm ?? 2.0);
    const scenicByStopId = new Map<string, ReelScenicCard>(
      dayScenic.map(({ _afterStopId, ...card }) => [_afterStopId, card as ReelScenicCard]),
    );

    // Build reco lookup: afterStopId → ReelRecoCard[]
    // Recos are pushed directly to cards after their anchor stop (not converted to observations).
    const engineRecos = recosByDayIdx.get(dayIdx) ?? [];
    // Deduplicate by trigger type per day — keep only the first reco for each trigger
    const seenTriggers = new Set<string>();
    const dedupedRecos = engineRecos.filter(r => {
      if (seenTriggers.has(r.trigger)) return false;
      seenTriggers.add(r.trigger);
      return true;
    });
    const recoByAfterStopId = new Map<string, ReelRecoCard[]>();
    for (const reco of dedupedRecos) {
      const key = reco.afterStopId ?? '__end__';
      if (!recoByAfterStopId.has(key)) recoByAfterStopId.set(key, []);
      recoByAfterStopId.get(key)!.push(reco);
    }

    // Build scenic corridor map from backend-generated cards (ORS + Overpass + pysolar).
    const backendScenicByOriginId = new Map<string, ScenicCorridorCard>();
    for (const sc of (day.scenicCorridors ?? [])) {
      if (sc.originStopId) backendScenicByOriginId.set(sc.originStopId, sc);
    }

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
        const realWalk = nextStop.walkFromPrev;
        const distKm = realWalk
          ? realWalk.distanceMeters / 1000
          : haversineKm(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        const isWalk = distKm < WALK_THRESHOLD_KM;
        const durationMin = isWalk
          ? realWalk
            ? Math.max(1, Math.round(realWalk.durationSeconds / 60))
            : Math.max(1, Math.round(distKm / 5 * 60))
          : Math.max(3, Math.round(distKm / 25 * 60));
        nextLeg = { distKm: Math.round(distKm * 10) / 10, durationMin, mode: isWalk ? 'walk' : 'ride', nextStopTitle: nextStop.title };
      }

      // Previous stop — needed for transit lazy-fetch and detourKm
      const prevStop = si > 0 ? sortedStops[si - 1] : null;

      // detourKm: extra distance when engine inserted this stop vs. going direct prev→next
      let detourKm: number | null = null;
      if (stop.isEngineAdded && prevStop && nextStop
          && stop.lat != null && stop.lon != null
          && prevStop.lat != null && prevStop.lon != null
          && nextStop.lat != null && nextStop.lon != null) {
        const directKm = haversineKm(prevStop.lat, prevStop.lon, nextStop.lat, nextStop.lon);
        const viaKm = haversineKm(prevStop.lat, prevStop.lon, stop.lat, stop.lon)
                    + haversineKm(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        detourKm = Math.max(0, Math.round((viaKm - directKm) * 10) / 10);
      }

      const stopCard: ReelStopCard = {
        type: 'stop',
        stop: effectiveStop,
        stopNumber: globalStopNumber,
        totalStops: stopCount,
        day: logicalDayNum,
        totalDays: logicalTotalDays,
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
        } : null,
        prevStopLat: prevStop?.lat ?? null,
        prevStopLon: prevStop?.lon ?? null,
        prevStopTitle: prevStop?.title ?? null,
        detourKm,
        transitInfo: null,
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

      // Arrival context note — first stop of Day 1, when user set an arrival slot
      if (dayIdx === 0 && si === 0 && tripDetails?.arrivalTime) {
        const h = parseInt(tripDetails.arrivalTime.split(':')[0], 10);
        const slotLabel = h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
        const via = tripDetails.cityArrivals?.[0]?.arrivalVia;
        stopCard.arrivalNote = `Arriving this ${slotLabel}${via ? ` · ${via}` : ''}`;
      }

      // Departure context note — all stops on the last day, when user set a departure slot
      if (isLastDay && tripDetails?.departureTime) {
        const h = parseInt(tripDetails.departureTime.split(':')[0], 10);
        const slotLabel = h < 11 ? 'morning' : h < 14 ? 'midday' : 'afternoon';
        stopCard.departureNote = `Departure day · ${slotLabel} slot`;
      }

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

      // Reco cards anchored to this stop — pushed as full ReelRecoCard objects
      const stopRecos = recoByAfterStopId.get(stop.id);
      if (stopRecos) {
        for (const reco of stopRecos) cards.push(reco);
        recoByAfterStopId.delete(stop.id);
      }

      // Backend scenic corridor card — richer than the frontend heuristic (ORS + Overpass + pysolar).
      // Only fires when the backend sent scenicCorridors; otherwise falls back to walkable detour below.
      const backendScenic = backendScenicByOriginId.get(stop.id);
      if (backendScenic && !scenicCard) {
        if (backendScenic.type === 'scenic') {
          const nextStop = sortedStops[si + 1];
          cards.push({
            ...backendScenic,
            type:        'scenic',
            sceneType:   (backendScenic.sceneType ?? 'walk') as ReelScenicCard['sceneType'],
            accent:      backendScenic.accent ?? '#6b9470',
            cardType:    backendScenic.cardType ?? 'SCENIC WALK',
            pos:         backendScenic.pos ?? 1,
            total:       backendScenic.total ?? 1,
            timing:      minutesToTime(timeToMinutes(stop.time) + (stop.durationMin ?? 60)),
            metaRight:   nextStop?.area ?? nextStop?.title ?? '',
            place:       backendScenic.routeLabel ?? `${backendScenic.from ?? stop.title} → ${backendScenic.to ?? (nextStop?.title ?? '')}`,
            from:        backendScenic.from ?? stop.area ?? stop.title,
            to:          backendScenic.to ?? nextStop?.area ?? nextStop?.title ?? '',
            modeIcon:    (backendScenic.modeIcon ?? 'walk') as ReelScenicCard['modeIcon'],
            tag:         backendScenic.tag ?? 'Scenic route',
            vizType:     (backendScenic.vizType ?? 'corridor') as ReelScenicCard['vizType'],
            persona,
            personaDisplay: persona.split(/[\s_]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            personaIcon: 'walk',
            why:         backendScenic.why ?? '',
            sensory:     backendScenic.sensory ?? '',
            sensoryIcon: backendScenic.sensoryIcon ?? 'directions_walk',
            reelPos:     `Between Stop ${globalStopNumber} and Stop ${globalStopNumber + 1}`,
            photoUrl:    stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 600) : null),
            detourKm:    backendScenic.detourKm ?? 0,
            detourMin:   backendScenic.detourMin ?? 0,
            routeLabel:  backendScenic.routeLabel,
            conditionNote: backendScenic.conditionNote,
            isTrending:  backendScenic.isTrending,
            trendNote:   backendScenic.trendNote,
          } as ReelScenicCard);
        } else if (backendScenic.type === 'scenic_pending') {
          cards.push({ type: 'scenic_pending', from: backendScenic.from ?? '', to: backendScenic.to ?? '' } as unknown as ReelScenicCard);
        }
      }

    }

    // Flush any recos whose afterStopId wasn't found in this day's stops
    for (const recos of recoByAfterStopId.values()) {
      for (const reco of recos) cards.push(reco);
    }

    // Remaining intel cards not matched to a specific stop — push after all stops
    const intelAnchorStop = sortedStops.at(-1);
    const lastStopImage = intelAnchorStop
      ? (intelAnchorStop.imageUrl ?? (intelAnchorStop.photoRef ? getPlacePhotoUrl(intelAnchorStop.photoRef, 600) : null))
      : null;
    const allIntelIds = new Set(cards.filter(c => c.type === 'intel').map(c => (c as ReelIntelCard).id));
    const unplacedIntel = buildIntelCards(day, lastStopImage).filter(
      ic => !allIntelIds.has(ic.id) && ic.messageType !== 'insert',
    );
    cards.push(...unplacedIntel);

    // Day-boundary transition cards are now emitted at the START of each day > 1 (above).
    // No separate wrap-up card needed.

    // day_nudge removed — reco engine fills sparse days with prefetched "Our pick" stops
  }

  // Balance card: engine ran, zero recos, and no observations — plan is genuinely well-balanced
  const allRecosCount = Array.from(recosByDayIdx.values()).reduce((sum, r) => sum + r.length, 0);
  if (recosByDayIdx.size > 0 && allRecosCount === 0) {
    const allCategories = new Set(allStops.map(s => s.category));
    cards.push({
      type: 'balance',
      message: buildBalanceMessage(persona, stopCount, allCategories),
      persona,
    });
  }

  const orderedStops = itinerary.days.flatMap(d =>
    [...d.stops].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
  );
  const pts = orderedStops.filter(s => typeof s.lat === 'number' && typeof s.lon === 'number');
  let finaleGoogleMapsUrl: string | null = null;
  if (pts.length >= 2) {
    const origin = `${pts[0].lat},${pts[0].lon}`;
    const dest = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lon}`;
    const middle = pts.slice(1, -1).slice(0, 8);
    const base = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=walking`;
    finaleGoogleMapsUrl = middle.length > 0
      ? `${base}&waypoints=${middle.map(p => encodeURIComponent(`${p.lat},${p.lon}`)).join('%7C')}`
      : base;
  }

  cards.push({
    type: 'finale',
    city: cityLabel,
    totalStops: stopCount,
    persona,
    googleMapsUrl: finaleGoogleMapsUrl,
  });

  return cards;
}
