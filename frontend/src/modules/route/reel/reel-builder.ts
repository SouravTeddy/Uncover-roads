import type {
  EngineItinerary,
  EngineItineraryStop,
  EngineItineraryDay,
  EngineWeights,
  JourneyLeg,
  WeatherData,
} from '../../../shared/types';
import { getPlacePhotoUrl } from '../../../shared/api';
import { formatCityLabel } from '../../../shared/cityPhoto';
import { REC_RULES } from '../rec-rules';
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelIntelCard, ReelScenicCard, ReelDayTransitionCard } from './types';

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

function isInWindow(time: string, start: string, end: string): boolean {
  const t = timeToMinutes(time);
  return t >= timeToMinutes(start) && t <= timeToMinutes(end);
}

function hasMealInWindow(stops: EngineItineraryStop[], start: string, end: string): boolean {
  return stops.some(s => {
    const isMeal = s.category === 'restaurant' || s.category === 'cafe';
    return isMeal && isInWindow(s.time, start, end);
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

// ── Meal reco cards (existing logic) ─────────────────────────

function buildMealRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
): ReelRecoCard[] {
  const recos: ReelRecoCard[] = [];

  for (const window of REC_RULES.MEAL_WINDOWS) {
    if (hasMealInWindow(stops, window.start, window.end)) continue;

    // For lunch, require there's activity at or after the window (day reaches lunch time)
    // For dinner, always surface it if day has any stops — dinner is always relevant
    if (window.type === 'lunch') {
      const hasStopAtOrAfterWindow = stops.some(
        s => timeToMinutes(s.time) >= timeToMinutes(window.start),
      );
      if (!hasStopAtOrAfterWindow) continue;
    }

    const inWindow = stops
      .filter(s => timeToMinutes(s.time) >= timeToMinutes(window.start) && timeToMinutes(s.time) <= timeToMinutes(window.end))
      .at(0);
    const afterStopAnchor = inWindow ?? stops
      .filter(s => timeToMinutes(s.time) < timeToMinutes(window.start))
      .at(-1);
    if (!afterStopAnchor) continue;

    const label = window.type === 'lunch'
      ? "Nothing scheduled for lunch after 14:00"
      : "No dinner in the plan yet";

    const consequence = window.type === 'lunch'
      ? "A few well-rated options nearby."
      : "A few places worth considering for the evening.";

    recos.push({
      type: 'reco',
      id: `meal-${window.type}-${afterStopAnchor.id}`,
      trigger: window.type as 'lunch' | 'dinner',
      label,
      consequence,
      nearbyCity: city,
      persona,
      afterStopId: afterStopAnchor.id,
      stopLat: afterStopAnchor.lat,
      stopLon: afterStopAnchor.lon,
    });
  }

  return recos;
}

// ── Persona-weight reco cards (deterministic templates) ───────

// Archetypes that strongly care about each reco type — threshold drops to 0 for these
const CULTURE_ARCHETYPES  = ['slowscholar', 'aesthete', 'historian'];
const EVENING_ARCHETYPES  = ['nightcreature', 'pulse'];
const REST_ARCHETYPES     = ['ritualseeker', 'flaneur'];

function buildPersonaRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
  weights: EngineWeights,
): ReelRecoCard[] {
  const recos: ReelRecoCard[] = [];
  if (stops.length === 0) return recos;

  const archetypeLower = persona.toLowerCase().replace(/\s+/g, '');
  const lastStop = stops.at(-1)!;
  const lastEndMin = timeToMinutes(lastStop.time) + lastStop.durationMin;

  // Evening: nightlife weight > 0.55 (or archetype match), day wraps before 21:00
  const eveningThreshold = EVENING_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_nightlife >= eveningThreshold && lastEndMin < 21 * 60) {
    recos.push({
      type: 'reco',
      id: `evening-${lastStop.id}`,
      trigger: 'evening',
      label: 'Evening is still open',
      consequence: `Day ends at ${minutesToTime(lastEndMin)}. The evening is unscheduled.`,
      nearbyCity: city,
      persona,
      afterStopId: lastStop.id,
      weightScore: weights.w_nightlife,
      stopLat: lastStop.lat,
      stopLon: lastStop.lon,
    });
  }

  // Culture: culture depth > 0.55 (or archetype match), no museum/gallery/historic in day
  const cultureThreshold = CULTURE_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_culture_depth >= cultureThreshold) {
    const hasCulture = stops.some(s =>
      s.category === 'museum' || s.category === 'gallery' || s.category === 'historic',
    );
    if (!hasCulture) {
      recos.push({
        type: 'reco',
        id: `culture-${lastStop.id}`,
        trigger: 'culture',
        label: "No cultural stop in today's plan",
        consequence: `A few options near ${lastStop.area || 'here'} worth looking at.`,
        nearbyCity: city,
        persona,
        afterStopId: lastStop.id,
        weightScore: weights.w_culture_depth,
        stopLat: lastStop.lat,
        stopLon: lastStop.lon,
      });
    }
  }

  // Rest: rest need > 0.55 (or archetype match), 3+ stops with no cafe break
  const restThreshold = REST_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_rest_need >= restThreshold && stops.length >= 3) {
    const hasCafeBreak = stops.some(s => s.category === 'cafe');
    if (!hasCafeBreak) {
      recos.push({
        type: 'reco',
        id: `rest-${lastStop.id}`,
        trigger: 'rest',
        label: `${stops.length} stops, no break scheduled`,
        consequence: 'A cafe or rest spot nearby could fit in here.',
        nearbyCity: city,
        persona,
        afterStopId: lastStop.id,
        weightScore: weights.w_rest_need,
        stopLat: lastStop.lat,
        stopLon: lastStop.lon,
      });
    }
  }

  // TODO (crowd_peak): when Popular Times data is available on EngineItineraryStop,
  // add a trigger here: if stop.popularTimes shows a peak hour overlapping stop.time,
  // and w_crowd_aversion > 0.55, push a 'crowd_peak' reco suggesting an off-peak visit.

  return recos;
}

// ── Weather + closing-conflict info is shown on each ReelStopCard ────────────
// (weather chip, conflict banner, logistics bar) — no separate reco cards needed

// ── Walking-gap reco cards ────────────────────────────────────

function buildWalkingGapRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
  weights: EngineWeights,
): ReelRecoCard[] {
  if (weights.w_walk_affinity >= 0.45) return [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (distKm > 2.0) {
      return [{
        type: 'reco',
        id: `walking-${a.id}-${b.id}`,
        trigger: 'walking_gap',
        label: `${distKm.toFixed(1)} km walk to next stop`,
        consequence: `That's a long stretch on foot. A rest spot or transit option could help.`,
        nearbyCity: city,
        persona,
        afterStopId: a.id,
        stopLat: a.lat,
        stopLon: a.lon,
      }];
    }
  }
  return [];
}

// ── Discovery reco cards ─────────────────────────────────────
function buildDiscoveryRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
): ReelRecoCard[] {
  const recos: ReelRecoCard[] = [];
  for (const stop of stops) {
    if (stop.stage === 'rising' && (stop.velocityRatio ?? 0) >= 2.0) {
      recos.push({
        type: 'reco',
        id: `trending-${stop.id}`,
        trigger: 'hidden_gem',
        label: `${stop.title} is trending`,
        consequence: `This place is gaining momentum fast — catch it before the crowds arrive.`,
        nearbyCity: city,
        persona,
        afterStopId: stop.id,
        stopLat: stop.lat,
        stopLon: stop.lon,
      });
    }
  }
  return recos;
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
    }

    // Sort stops chronologically — engine may return them out of order
    const sortedStops = [...day.stops].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );

    // Build scenic card lookup: stop.id → scenic card placed after that stop
    const dayScenic = buildScenicCards(sortedStops, persona, weights);
    const scenicByStopId = new Map<string, ReelScenicCard>(
      dayScenic.map(({ _afterStopId, ...card }) => [_afterStopId, card as ReelScenicCard]),
    );

    // Collect engine recos and their triggers so local builders can be skipped for covered triggers
    const engineRecos = recosByDayIdx.get(dayIdx) ?? [];
    const engineTriggers = new Set(engineRecos.map(r => r.trigger));

    const allRecos: ReelRecoCard[] = [
      ...engineRecos,
      ...buildMealRecos(sortedStops, persona, day.city),
      ...buildPersonaRecos(sortedStops, persona, day.city, weights),
      // weather and closing_conflict info is already shown on each stop card
      // (weather chip, conflict banner, logistics bar) — no separate reco card needed
      ...(engineTriggers.has('walking_gap') ? [] : buildWalkingGapRecos(sortedStops, persona, day.city, weights)),
      ...(engineTriggers.has('hidden_gem') ? [] : buildDiscoveryRecos(sortedStops, persona, day.city)),
    ];

    const recosByStop = new Map<string, ReelRecoCard[]>();
    for (const reco of allRecos) {
      const existing = recosByStop.get(reco.afterStopId) ?? [];
      if (!existing.some(r => r.trigger === reco.trigger)) existing.push(reco);
      recosByStop.set(reco.afterStopId, existing);
    }

    for (const stop of sortedStops) {
      globalStopNumber += 1;

      // Resolve stop image for intel card background
      const stopImageUrl = stop.imageUrl
        ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 600) : null);

      const stopCard: ReelStopCard = {
        type: 'stop',
        stop,
        stopNumber: globalStopNumber,
        totalStops: stopCount,
        day: dayIdx + 1,
        totalDays: itinerary.days.length,
        orderReason: stop.orderReason ?? null,
        orderConsequence: stop.orderConsequence ?? null,
        movedFrom: stop.movedFrom ?? null,
        weather: getWeatherForCity(day.city),
        pairWith: findPairWith(stop, sortedStops),
        visitDate: day.date ?? null,
      };
      cards.push(stopCard);

      const recos = recosByStop.get(stop.id);
      if (recos) {
        const ADVISORY_TRIGGERS = new Set([
          'density_excess', 'density_sparse', 'geo_efficiency',
          'time_balance', 'category_diversity', 'social_gap',
          'budget_mismatch', 'walking_gap', 'crowd_peak',
        ]);
        cards.push(...recos.map(r => ({
          ...r,
          anchorPhotoUrl: ADVISORY_TRIGGERS.has(r.trigger) ? null : stopImageUrl,
        })));
      }

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

    // Remaining intel cards not matched to a specific stop — push after all stops
    const lastStop = sortedStops.at(-1);
    const lastStopImage = lastStop
      ? (lastStop.imageUrl ?? (lastStop.photoRef ? getPlacePhotoUrl(lastStop.photoRef, 600) : null))
      : null;
    const allIntelIds = new Set(cards.filter(c => c.type === 'intel').map(c => (c as ReelIntelCard).id));
    const unplacedIntel = buildIntelCards(day, lastStopImage).filter(
      ic => !allIntelIds.has(ic.id),
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
