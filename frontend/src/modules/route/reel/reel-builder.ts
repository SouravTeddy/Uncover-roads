import type {
  EngineItinerary,
  EngineItineraryStop,
  JourneyLeg,
  WeatherData,
} from '../../../shared/types';
import { REC_RULES } from '../rec-rules';
import type { ReelCard, ReelStopCard, ReelRecoCard, ReelTransitCard } from './types';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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

function buildRecoCards(
  stops: EngineItineraryStop[],
  persona: string,
  city: string,
): Map<string, ReelRecoCard> {
  const recos = new Map<string, ReelRecoCard>();

  for (const window of REC_RULES.MEAL_WINDOWS) {
    if (hasMealInWindow(stops, window.start, window.end)) continue;

    // Only inject reco if there are stops that reach into or past the window
    const hasStopAtOrAfterWindow = stops.some(
      s => timeToMinutes(s.time) >= timeToMinutes(window.start)
    );
    if (!hasStopAtOrAfterWindow) continue;

    const beforeWindow = stops
      .filter(s => timeToMinutes(s.time) < timeToMinutes(window.start))
      .at(-1);
    if (!beforeWindow) continue;

    const label = window.type === 'lunch'
      ? "You haven't added lunch"
      : "No dinner planned yet";

    recos.set(beforeWindow.id, {
      type: 'reco',
      trigger: window.type,
      label,
      consequence: `Options matching your taste near your next stop`,
      nearbyCity: city,
      persona,
      afterStopId: beforeWindow.id,
    });
  }

  return recos;
}

export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weather: WeatherData | null,
  persona: string,
): ReelCard[] {
  const cards: ReelCard[] = [];
  const allStops = itinerary.days.flatMap(d => d.stops);
  const stopCount = allStops.length;

  cards.push({
    type: 'intro',
    city: itinerary.city,
    imageUrl: allStops[0]?.imageUrl ?? null,
    totalStops: stopCount,
    weather,
    proTip: itinerary.summary?.pro_tip ?? null,
    persona,
  });

  let globalStopNumber = 0;

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];

    if (dayIdx > 0 && journeyLegs) {
      const prevCity = itinerary.days[dayIdx - 1].city;
      const transitLeg = journeyLegs.find(
        l => l.type === 'transit' &&
          (l as Extract<JourneyLeg, { type: 'transit' }>).from === prevCity &&
          (l as Extract<JourneyLeg, { type: 'transit' }>).to === day.city
      ) as Extract<JourneyLeg, { type: 'transit' }> | undefined;

      // Only emit transit card when a matching leg exists
      if (transitLeg) {
        cards.push({
          type: 'transit',
          mode: transitLeg.mode,
          from: prevCity,
          to: day.city,
          durationMinutes: transitLeg.durationMinutes ?? null,
          distanceKm: transitLeg.distanceKm ?? null,
          imageUrl: null,
        });
      }
    }

    const recos = buildRecoCards(day.stops, persona, day.city);

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

      if (recos.has(stop.id)) {
        cards.push(recos.get(stop.id)!);
      }
    }
  }

  cards.push({
    type: 'finale',
    city: itinerary.city,
    totalStops: stopCount,
    persona,
  });

  return cards;
}
