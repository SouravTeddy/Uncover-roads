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
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelIntelCard, ReelSummaryCard } from './types';

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

// ── Meal reco cards (existing logic) ─────────────────────────

function buildMealRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
): ReelRecoCard[] {
  const recos: ReelRecoCard[] = [];

  for (const window of REC_RULES.MEAL_WINDOWS) {
    if (hasMealInWindow(stops, window.start, window.end)) continue;

    const hasStopAtOrAfterWindow = stops.some(
      s => timeToMinutes(s.time) >= timeToMinutes(window.start),
    );
    if (!hasStopAtOrAfterWindow) continue;

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

function buildPersonaRecos(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
  weights: EngineWeights,
): ReelRecoCard[] {
  const recos: ReelRecoCard[] = [];
  if (stops.length === 0) return recos;

  const lastStop = stops.at(-1)!;
  const lastEndMin = timeToMinutes(lastStop.time) + lastStop.durationMin;

  // Evening: nightlife weight > 0.65, day wraps before 21:00
  if (weights.w_nightlife > 0.65 && lastEndMin < 21 * 60) {
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

  // Culture: culture depth > 0.65, no museum/gallery/historic in day
  if (weights.w_culture_depth > 0.65) {
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

  // Rest: rest need > 0.70, 4+ consecutive stops with no cafe break
  if (weights.w_rest_need > 0.7 && stops.length >= 4) {
    const hasCafeBreak = stops.some(s => s.category === 'cafe');
    if (!hasCafeBreak) {
      const midStop = stops[1];
      recos.push({
        type: 'reco',
        id: `rest-${midStop.id}`,
        trigger: 'rest',
        label: `${stops.length} consecutive stops, no break scheduled`,
        consequence: `Nothing in between them.`,
        nearbyCity: city,
        persona,
        afterStopId: midStop.id,
        weightScore: weights.w_rest_need,
        stopLat: midStop.lat,
        stopLon: midStop.lon,
      });
    }
  }

  return recos;
}

// ── Intel cards from engine messages ─────────────────────────

function buildIntelCards(day: EngineItineraryDay): ReelIntelCard[] {
  if (!day.messages?.length) return [];

  return day.messages.map(msg => {
    const INTEL_MAP: Record<string, { headline: string; detail: string }> = {
      swap:        { headline: msg.what, detail: msg.why },
      insert:      { headline: msg.what, detail: msg.why },
      resequence:  { headline: msg.what, detail: msg.why },
      weather:     { headline: msg.what, detail: msg.why },
      transit:     { headline: msg.what, detail: msg.why },
      advisory:    { headline: msg.what, detail: msg.why },
      event:       { headline: msg.what, detail: msg.why },
    };
    const text = INTEL_MAP[msg.type] ?? { headline: msg.what, detail: msg.why };
    return {
      type: 'intel' as const,
      id: msg.id,
      messageType: msg.type as ReelIntelCard['messageType'],
      headline: text.headline,
      detail: text.detail,
      afterStopId: null,
    };
  });
}

// ── Main builder ─────────────────────────────────────────────

export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weather: WeatherData | null,
  persona: string,
): ReelCard[] {
  if (!itinerary?.days?.length) return [];

  const weights: EngineWeights = itinerary.personaSnapshot ?? DEFAULT_WEIGHTS;
  const cards: ReelCard[] = [];
  const allStops = itinerary.days.flatMap(d => d.stops);
  const stopCount = allStops.length;
  const cityLabel = itinerary.city ?? itinerary.cities.join(' · ');

  // Resolve intro image: imageUrl → photoRef → null
  const heroStop = allStops[0];
  const introImage = heroStop?.imageUrl
    ?? (heroStop?.photoRef ? getPlacePhotoUrl(heroStop.photoRef, 800) : null)
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
    weather,
    proTip: itinerary.summary?.pro_tip ?? null,
    persona,
    engineChanges,
  });

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

    // Intel cards at the start of each day (engine decisions for this day)
    const intelCards = buildIntelCards(day);
    cards.push(...intelCards);

    // Build all reco cards for this day keyed by afterStopId
    const mealRecos = buildMealRecos(day.stops, persona, day.city);
    const personaRecos = buildPersonaRecos(day.stops, persona, day.city, weights);
    const allRecos = [...mealRecos, ...personaRecos];

    // Group by afterStopId (multiple recos can follow the same stop)
    const recosByStop = new Map<string, ReelRecoCard[]>();
    for (const reco of allRecos) {
      const existing = recosByStop.get(reco.afterStopId) ?? [];
      // Deduplicate by trigger
      if (!existing.some(r => r.trigger === reco.trigger)) {
        existing.push(reco);
      }
      recosByStop.set(reco.afterStopId, existing);
    }

    for (const stop of day.stops) {
      globalStopNumber += 1;

      const stopCard: ReelStopCard = {
        type: 'stop',
        stop,
        stopNumber: globalStopNumber,
        totalStops: stopCount,
        orderReason: stop.orderReason ?? null,
        orderConsequence: stop.orderConsequence ?? null,
        movedFrom: stop.movedFrom ?? null,
      };
      cards.push(stopCard);

      const recos = recosByStop.get(stop.id);
      if (recos) cards.push(...recos);
    }
  }

  cards.push({
    type: 'finale',
    city: cityLabel,
    totalStops: stopCount,
    persona,
  });

  return cards;
}
