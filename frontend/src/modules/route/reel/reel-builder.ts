import type {
  EngineItinerary,
  EngineItineraryStop,
  EngineItineraryDay,
  EngineWeights,
  JourneyLeg,
  WeatherData,
} from '../../../shared/types';
import { getPlacePhotoUrl } from '../../../shared/api';
import { REC_RULES } from '../rec-rules';
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelIntelCard, ReelSummaryCard, ReelDayDividerCard, ReelScenicCard } from './types';

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

// Returns the earliest closing minute across all weekday entries, or null if unparseable.
// Regex targets "– 6:00 PM" style (Google Places format).
function parseEarliestClosingMinute(weekdayText: string[] | null): number | null {
  if (!weekdayText?.length) return null;
  let earliest: number | null = null;
  for (const entry of weekdayText) {
    const match = entry.match(/–\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) continue;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const totalMin = h * 60 + m;
    if (earliest === null || totalMin < earliest) earliest = totalMin;
  }
  return earliest;
}

const OUTDOOR_CATEGORIES = new Set([
  'park', 'viewpoint', 'beach', 'market', 'street_art', 'amusement_park', 'zoo',
]);
const BAD_WEATHER_CONDITIONS = new Set([
  'rain', 'drizzle', 'storm', 'thunderstorm', 'snow', 'sleet', 'hail', 'blizzard', 'fog',
]);

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

    const beforeWindow = stops
      .filter(s => timeToMinutes(s.time) < timeToMinutes(window.start))
      .at(-1);
    if (!beforeWindow) continue;

    const label = window.type === 'lunch'
      ? "Nothing scheduled for lunch after 14:00"
      : "No dinner in the plan yet";

    const consequence = window.type === 'lunch'
      ? "A few well-rated options nearby."
      : "A few places worth considering for the evening.";

    recos.push({
      type: 'reco',
      id: `meal-${window.type}-${beforeWindow.id}`,
      trigger: window.type as 'lunch' | 'dinner',
      label,
      consequence,
      nearbyCity: city,
      persona,
      afterStopId: beforeWindow.id,
      stopLat: beforeWindow.lat,
      stopLon: beforeWindow.lon,
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
      const anchorStop = stops[Math.floor(stops.length / 2)] ?? stops[0];
      recos.push({
        type: 'reco',
        id: `culture-${anchorStop.id}`,
        trigger: 'culture',
        label: "No cultural stop in today's plan",
        consequence: `A few options near ${anchorStop.area || 'here'} worth looking at.`,
        nearbyCity: city,
        persona,
        afterStopId: anchorStop.id,
        weightScore: weights.w_culture_depth,
        stopLat: anchorStop.lat,
        stopLon: anchorStop.lon,
      });
    }
  }

  // Rest: rest need > 0.55 (or archetype match), 3+ stops with no cafe break
  const restThreshold = REST_ARCHETYPES.includes(archetypeLower) ? 0 : 0.55;
  if (weights.w_rest_need >= restThreshold && stops.length >= 3) {
    const hasCafeBreak = stops.some(s => s.category === 'cafe');
    if (!hasCafeBreak) {
      const midStop = stops[1] ?? stops[0];
      recos.push({
        type: 'reco',
        id: `rest-${midStop.id}`,
        trigger: 'rest',
        label: `${stops.length} stops, no break scheduled`,
        consequence: 'A cafe or rest spot nearby could fit in here.',
        nearbyCity: city,
        persona,
        afterStopId: midStop.id,
        weightScore: weights.w_rest_need,
        stopLat: midStop.lat,
        stopLon: midStop.lon,
      });
    }
  }

  // TODO (crowd_peak): when Popular Times data is available on EngineItineraryStop,
  // add a trigger here: if stop.popularTimes shows a peak hour overlapping stop.time,
  // and w_crowd_aversion > 0.55, push a 'crowd_peak' reco suggesting an off-peak visit.

  return recos;
}

// ── Weather reco cards ────────────────────────────────────────

function buildWeatherReco(
  stops: EngineItineraryStop[],
  weather: WeatherData | null,
  persona: string,
  city: string,
): ReelRecoCard[] {
  if (!weather) return [];
  const conditionLower = weather.condition.toLowerCase();
  const isBadWeather = [...BAD_WEATHER_CONDITIONS].some(c => conditionLower.includes(c));
  if (!isBadWeather) return [];

  const outdoorStop = stops.find(s => OUTDOOR_CATEGORIES.has(s.category));
  if (!outdoorStop) return [];

  return [{
    type: 'reco',
    id: `weather-${outdoorStop.id}`,
    trigger: 'weather',
    label: `${weather.condition} forecast today`,
    consequence: 'Outdoor stops may be affected. Indoor alternatives nearby.',
    nearbyCity: city,
    persona,
    afterStopId: outdoorStop.id,
    stopLat: outdoorStop.lat,
    stopLon: outdoorStop.lon,
  }];
}

// ── Closing-conflict reco cards ───────────────────────────────

function buildClosingConflictRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
): ReelRecoCard[] {
  const recos: ReelRecoCard[] = [];
  for (const stop of stops) {
    const closingMin = parseEarliestClosingMinute(stop.weekdayText);
    if (closingMin === null) continue;
    const stopEndMin = timeToMinutes(stop.time) + stop.durationMin;
    if (stopEndMin <= closingMin) continue;
    recos.push({
      type: 'reco',
      id: `closing-${stop.id}`,
      trigger: 'closing_conflict',
      label: `${stop.title} may close before you finish`,
      consequence: `Your visit runs until ${minutesToTime(stopEndMin)} — check hours before heading over.`,
      nearbyCity: city,
      persona,
      afterStopId: stop.id,
      stopLat: stop.lat,
      stopLon: stop.lon,
    });
  }
  return recos;
}

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

// ── Main builder ─────────────────────────────────────────────

export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weather: WeatherData | null,
  persona: string,
  recosByDayIdx: Map<number, ReelRecoCard[]> = new Map(),
  cityPhotoMap: Map<string, string> = new Map(),
): ReelCard[] {
  if (!itinerary?.days?.length) return [];

  const weights: EngineWeights = itinerary.personaSnapshot ?? DEFAULT_WEIGHTS;
  const cards: ReelCard[] = [];
  const allStops = itinerary.days.flatMap(d => d.stops);
  const stopCount = allStops.length;
  const cityLabel = itinerary.city ?? itinerary.cities.join(' · ');

  // Totals for intro card
  const totalDurationMin = allStops.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
  const totalDistanceKm = allStops.reduce((sum, s, i) => {
    if (i === 0) return sum;
    const prev = allStops[i - 1];
    return sum + haversineKm(prev.lat, prev.lon, s.lat, s.lon);
  }, 0);

  // City image: prefer city-level photo, fall back to first stop photo
  const primaryCity = itinerary.city ?? itinerary.cities[0] ?? '';
  const introImage = cityPhotoMap.get(primaryCity.toLowerCase())
    ?? cityPhotoMap.get(primaryCity)
    ?? null;

  // Aggregate engine changes for intro summary section
  const allMessages = itinerary.days.flatMap(d => d.messages ?? []);
  const changeCounts = allMessages.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});
  const engineChanges = Object.entries(changeCounts).map(([type, count]) => ({ type, count }));

  cards.push({
    type: 'intro',
    city: cityLabel,
    imageUrl: introImage,
    totalStops: stopCount,
    totalDays: itinerary.days.length,
    totalDurationMin,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    weather,
    proTip: itinerary.summary?.pro_tip ?? null,
    persona,
    engineChanges,
  });

  // ── DEV: inject all 6 scenic test cards after intro ──────────────────────────
  if (import.meta.env.DEV) {
    const SCENIC_TEST: ReelScenicCard[] = [
      { type: 'scenic', sceneType: 'walk', accent: '#c4b5fd', cardType: 'WALK SPINE', pos: 1, total: 6,
        timing: 'Evening · 8:00 PM', metaRight: 'Shibuya Ward', place: 'Omotesando Boulevard',
        from: 'Harajuku', to: 'Omotesando Hills', modeIcon: 'walk', tag: 'Walk',
        vizType: 'corridor', persona: 'Walk-lover', personaIcon: 'walk',
        why: 'Slotted in because you walk between consecutive stops — no transit gap to bridge.',
        sensory: 'Boutique-lined and at its quietest after 8 PM — none of the daytime crowds.',
        sensoryIcon: 'store', reelPos: 'Between Stop 2 and Stop 3', photoUrl: null },
      { type: 'scenic', sceneType: 'drive', accent: '#f4c478', cardType: 'SELF-DRIVE DAY', pos: 2, total: 6,
        timing: 'Afternoon · 3:30 PM', metaRight: '2h 30m', place: 'Coastal Highway 17',
        from: 'Panaji', to: 'Baga', modeIcon: 'car', tag: 'Self-drive',
        vizType: 'route', persona: 'Self-drive', personaIcon: 'car',
        why: 'Framed as your Day 2 intro — built for self-drive, with zero transit dependencies.',
        sensory: 'Hits all 3 coastal viewpoints without the NH-66 toll detour. Fort Aguada is a 20-min stop.',
        sensoryIcon: 'camera', reelPos: 'Day 2 intro card variant', photoUrl: null },
      { type: 'scenic', sceneType: 'coastal', accent: '#f0a06a', cardType: 'COASTAL ROAD', pos: 3, total: 6,
        timing: 'Sunset window · 6:10 PM', metaRight: '18 km', place: 'Marine Drive, Calangute',
        from: 'Calangute', to: 'Sinquerim', modeIcon: 'car', tag: 'Coastal',
        vizType: 'sunset', persona: 'Light-chaser', personaIcon: 'twilight',
        why: 'Timed to your eye for light — golden hour lands on the water at the exact midpoint.',
        sensory: 'Road sits within 80 m of the sea the entire 18 km — no inland detours.',
        sensoryIcon: 'waves', reelPos: 'Between Stop 4 and Stop 5 · evening', photoUrl: null },
      { type: 'scenic', sceneType: 'ridge', accent: '#9ec5ff', cardType: 'RIDGE ROAD', pos: 4, total: 6,
        timing: 'Morning · 7:30 AM', metaRight: 'Murree Hills', place: 'Nathia Gali Pass',
        from: 'Murree', to: 'Nathia Gali', modeIcon: 'car', tag: 'Mountain',
        vizType: 'elevation', persona: 'Peak-seeker', personaIcon: 'terrain',
        why: 'Picked for the elevation change you favour — a 270° panorama opens at the saddle.',
        sensory: 'Start before 8 AM — cloud closes in from the west by noon and blocks the views.',
        sensoryIcon: 'cloud', reelPos: 'Day 1 morning connector', photoUrl: null },
      { type: 'scenic', sceneType: 'crowd', accent: '#5cd97a', cardType: 'CROWD-FREE', pos: 5, total: 6,
        timing: 'Pre-dawn · 6:00 AM', metaRight: '9 km', place: 'Sal Forest Bypass',
        from: 'Palolem', to: 'Agonda Beach', modeIcon: 'car', tag: 'Quiet',
        vizType: 'quiet', persona: 'Crowd-averse', personaIcon: 'person_off',
        why: 'Your crowd score is high — this road was effectively built for you. No coaches, no tags.',
        sensory: 'Untagged on Google Maps. 9 km of Sal canopy in full silence, except birdsong.',
        sensoryIcon: 'eq', reelPos: 'Day 3 dawn connector', photoUrl: null },
      { type: 'scenic', sceneType: 'forest', accent: '#86efac', cardType: 'FOREST CANOPY', pos: 6, total: 6,
        timing: 'Morning · 9:00 AM', metaRight: 'Central Goa', place: 'Spice Plantation Trail',
        from: 'Ponda', to: 'Savoi Plantation', modeIcon: 'car', tag: 'Canopy',
        vizType: 'canopy', persona: 'Nature-lover', personaIcon: 'forest',
        why: 'A nature-archetype match — runs straight into the Savoi spice estate you saved.',
        sensory: 'Full overhead canopy the entire 8 km drops the temperature 4–5 °C inside.',
        sensoryIcon: 'thermostat', reelPos: 'Day 2 morning slow road', photoUrl: null },
    ];
    cards.push(...SCENIC_TEST);
  }
  // ── end DEV scenic test ───────────────────────────────────────────────────────

  // "Before you go" summary card — always shown, gives full trip overview + engine changes
  const summaryCard: ReelSummaryCard = {
    type: 'summary',
    totalDays: itinerary.days.length,
    totalStops: stopCount,
    persona,
    engineChanges,
  };
  cards.push(summaryCard);

  let globalStopNumber = 0;

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];

    // Transit card between cities
    if (dayIdx > 0 && journeyLegs) {
      const prevCity = itinerary.days[dayIdx - 1].city;
      const transitLeg = journeyLegs.find(
        l => l.type === 'transit' &&
          (l as Extract<JourneyLeg, { type: 'transit' }>).from === prevCity &&
          (l as Extract<JourneyLeg, { type: 'transit' }>).to === day.city,
      ) as Extract<JourneyLeg, { type: 'transit' }> | undefined;

      if (transitLeg) {
        const hasActual = !!(transitLeg.departureTime && transitLeg.arrivalTime);
        cards.push({
          type: 'transit',
          mode: transitLeg.mode,
          from: prevCity,
          to: day.city,
          durationMinutes: transitLeg.durationMinutes ?? null,
          distanceKm: transitLeg.distanceKm ?? null,
          imageUrl: null,
          isEstimated: !hasActual,
          departureTime: transitLeg.departureTime ?? null,
          arrivalTime: transitLeg.arrivalTime ?? null,
          ref: transitLeg.transitRef ?? null,
        });
      }
    }

    // Day divider card — shown after any transit card, before the day's stops
    // Skip day 1 (no need to announce the first day before any cards)
    if (day.day > 1) {
      const dividerCard: ReelDayDividerCard = {
        type: 'day_divider',
        day: day.day,
        city: day.city,
        date: day.date,
        stopCount: day.stops.length,
      };
      cards.push(dividerCard);
    }

    // Sort stops chronologically — engine may return them out of order
    const sortedStops = [...day.stops].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );

    // Use pre-computed recos from the engine; fall back to legacy functions when not provided
    const allRecos: ReelRecoCard[] = recosByDayIdx.has(dayIdx)
      ? (recosByDayIdx.get(dayIdx) ?? [])
      : [
          ...buildMealRecos(sortedStops, persona, day.city),
          ...buildPersonaRecos(sortedStops, persona, day.city, weights),
          ...buildWeatherReco(sortedStops, weather, persona, day.city),
          ...buildClosingConflictRecos(sortedStops, persona, day.city),
          ...buildWalkingGapRecos(sortedStops, persona, day.city, weights),
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
        orderReason: stop.orderReason ?? null,
        orderConsequence: stop.orderConsequence ?? null,
        movedFrom: stop.movedFrom ?? null,
        weather: weather ?? null,
      };
      cards.push(stopCard);

      const recos = recosByStop.get(stop.id);
      if (recos) cards.push(...recos);

      // Intel cards that reference this stop (by placeId match)
      const stopIntelCards = buildIntelCards(day, stopImageUrl).filter(
        ic => ic.stopId != null && ic.stopId === stop.placeId,
      );
      cards.push(...stopIntelCards);
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
  }

  // Balance card: when engine ran but found zero recos for all days — surface a positive message
  const allRecosCount = Array.from(recosByDayIdx.values()).reduce((sum, r) => sum + r.length, 0);
  if (recosByDayIdx.size > 0 && allRecosCount === 0) {
    cards.push({ type: 'balance', message: 'Your day looks well-balanced for your style.', persona });
  }

  cards.push({
    type: 'finale',
    city: cityLabel,
    totalStops: stopCount,
    persona,
  });

  return cards;
}
