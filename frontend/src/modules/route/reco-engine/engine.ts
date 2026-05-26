import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';
import type { ItineraryProfile } from './profile';
import type { ReelRecoCard } from '../reel/types';
import { computeTargetProfile, computeActualProfile } from './profile';
import { getDimensionWeight, CONFLICT_PAIRS } from './dimensions';

export interface Gap {
  dimension: keyof ItineraryProfile;
  target: number;
  actual: number;
  delta: number;
  dimensionWeight: number;
  significance: number;
  direction: 'missing' | 'excess';
  conflictPresent: boolean;
}

const CONFIDENCE_THRESHOLD_BOOST = 0.15;
const BASE_THRESHOLD = 0.28;
const MAX_RECOS = 3;
const CONFLICT_BOOST = 1.4;

const OB_MAPPED: Partial<Record<keyof ItineraryProfile, boolean>> = {
  densityScore: true, hasRest: true, hasCulture: true, hasOutdoor: true,
};

export function detectGaps(
  target: ItineraryProfile,
  actual: ItineraryProfile,
  signal: RecoSignal,
): Gap[] {
  const threshold = BASE_THRESHOLD + (signal.archetypeConfidence < 0.5 ? CONFIDENCE_THRESHOLD_BOOST : 0);
  const gaps: Gap[] = [];

  for (const dim of Object.keys(target) as Array<keyof ItineraryProfile>) {
    const t = target[dim];
    const a = actual[dim];
    if (t === null || a === null) continue;

    const delta = (t as number) - (a as number);
    const dimensionWeight = getDimensionWeight(dim, signal);

    // liveEventOverlap: actual > 0 means there are unadded saved events — always surface this
    const rawSignificance = Math.abs(delta) * dimensionWeight;
    const isLiveEventGap = dim === 'liveEventOverlap' && (a as number) > 0;
    const significance = isLiveEventGap
      ? Math.max(rawSignificance, threshold + 0.01)
      : rawSignificance;

    if (significance < threshold) continue;

    const conflictPresent = !!OB_MAPPED[dim] && Math.abs(delta) > 0.4;
    // For live event gaps, treat as 'missing' regardless of delta sign
    const direction: 'missing' | 'excess' = isLiveEventGap ? 'missing' : (delta > 0 ? 'missing' : 'excess');

    gaps.push({
      dimension: dim,
      target: t as number,
      actual: a as number,
      delta,
      dimensionWeight,
      significance: conflictPresent ? significance * CONFLICT_BOOST : significance,
      direction,
      conflictPresent,
    });
  }

  return gaps.sort((a, b) => b.significance - a.significance);
}

export function resolveConflicts(gaps: Gap[]): Gap[] {
  const removed = new Set<string>();
  for (const [dimA, dimB] of CONFLICT_PAIRS) {
    const a = gaps.find(g => g.dimension === dimA);
    const b = gaps.find(g => g.dimension === dimB);
    if (a && b) {
      removed.add(a.significance < b.significance ? dimA : dimB);
    }
  }
  return gaps.filter(g => !removed.has(g.dimension));
}

function anchorStop(
  stops: EngineItineraryStop[],
  prefer?: (s: EngineItineraryStop) => boolean,
): EngineItineraryStop | null {
  if (stops.length === 0) return null;
  if (prefer) {
    const found = stops.find(prefer);
    if (found) return found;
  }
  return stops[Math.floor(stops.length / 2)] ?? stops[0];
}

export function gapToCard(
  gap: Gap,
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ReelRecoCard | null {
  const city = signal.trip.city;
  const persona = signal.archetype;
  const anchor = anchorStop(stops);
  const afterStopId = anchor?.id ?? stops.at(-1)?.id ?? 'intro';
  const area = anchor?.area ?? city;

  const templates: Partial<Record<keyof ItineraryProfile, { trigger: string; label: string; consequence: string }>> = {
    hasLunch: {
      trigger: 'lunch',
      label: 'No lunch planned',
      consequence: `You've got a window around midday — grab something near ${area}.`,
    },
    hasDinner: {
      trigger: 'dinner',
      label: 'Evening meal not scheduled',
      consequence: `Your day wraps without dinner. A few options near ${area} worth considering.`,
    },
    hasEveningActivity: {
      trigger: 'evening',
      label: 'Evening is still open',
      consequence: `Your day ends early. ${area} has options if you want to keep going.`,
    },
    hasCulture: {
      trigger: 'culture',
      label: 'No cultural stop today',
      consequence: `A few gallery or historic spots near ${area} that match your taste.`,
    },
    hasOutdoor: {
      trigger: 'weather',
      label: gap.direction === 'missing' ? 'No outdoor stops today' : 'Heavy outdoor schedule',
      consequence: gap.direction === 'missing'
        ? `It's a good day for it — a few options near ${area}.`
        : `${signal.weather?.condition ?? 'Weather'} may make some of these tough.`,
    },
    hasRest: {
      trigger: 'rest',
      label: 'No breaks in the schedule',
      consequence: `Long stretches without a pause. A cafe near ${area} could help.`,
    },
    hasSocialStop: {
      trigger: 'social_gap',
      label: 'No social spaces today',
      consequence: `A few spots near ${area} that work well for ${signal.social === 'group' ? 'groups' : 'meeting people'}.`,
    },
    densityScore: {
      trigger: gap.direction === 'excess' ? 'density_excess' : 'density_sparse',
      label: gap.direction === 'excess' ? 'Packed schedule ahead' : 'Lighter day than usual',
      consequence: gap.direction === 'excess'
        ? `Your profile suggests a slower rhythm — consider dropping a stop.`
        : `Room to add something spontaneous near ${area}.`,
    },
    budgetAlignment: {
      trigger: 'budget_mismatch',
      label: 'Some pricier stops in this plan',
      consequence: `A few free or low-cost alternatives near ${area} if you'd prefer.`,
    },
    crowdOptimization: {
      trigger: 'crowd_peak',
      label: 'Busy spots at peak hours',
      consequence: `Some stops are scheduled when crowds tend to peak — earlier or later works better.`,
    },
    liveEventOverlap: {
      trigger: 'live_event',
      label: "Event happening while you're here",
      consequence: "You have a saved event on this date — it's not in your plan yet.",
    },
    weatherAlignment: {
      trigger: 'weather',
      label: gap.direction === 'excess' ? 'Outdoor stops in uncertain weather' : 'Great day — more outdoors?',
      consequence: gap.direction === 'excess'
        ? `${signal.weather?.condition ?? 'Forecast'} may affect ${gap.actual > 0.5 ? 'several' : 'some'} of your stops.`
        : `Conditions are good — a viewpoint or park near ${area} could fit well.`,
    },
    walkIntensity: {
      trigger: 'walking_gap',
      label: gap.direction === 'excess' ? 'High walking day' : 'Minimal walking today',
      consequence: gap.direction === 'excess'
        ? `More walking than your profile suggests. Consider a transit option between some stops.`
        : `Most stops are compact — room for a walk if you want one.`,
    },
    hasHiddenGem: {
      trigger: 'hidden_gem',
      label: 'A local spot worth knowing about',
      consequence: `Close to your route — the kind of place most visitors walk past.`,
    },
    categoryDiversity: {
      trigger: 'category_diversity',
      label: 'All similar stops today',
      consequence: `One different kind of stop often makes the rest feel better.`,
    },
    timeBalance: {
      trigger: 'time_balance',
      label: gap.direction === 'excess' ? 'Heavy start, quiet finish' : 'Light start to the day',
      consequence: gap.direction === 'excess'
        ? `Most of today is front-loaded. The afternoon is clear if you want to add something.`
        : `The morning is quiet — room to add something before the day picks up.`,
    },
    geoEfficiency: {
      trigger: 'geo_efficiency',
      label: 'Route doubles back today',
      consequence: `A couple of stops are out of sequence — reordering saves meaningful time.`,
    },
  };

  const tmpl = templates[gap.dimension];
  if (!tmpl) return null;

  return {
    type: 'reco',
    id: `${gap.dimension}-${afterStopId}${gap.conflictPresent ? '-conflict' : ''}`,
    trigger: tmpl.trigger as ReelRecoCard['trigger'],
    label: gap.conflictPresent ? `⚡ ${tmpl.label}` : tmpl.label,
    consequence: tmpl.consequence,
    nearbyCity: city,
    persona,
    afterStopId,
    weightScore: gap.significance,
    stopLat: anchor?.lat,
    stopLon: anchor?.lon,
  };
}

export function deriveRecos(
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ReelRecoCard[] {
  const target = computeTargetProfile(signal);
  const actual = computeActualProfile(stops, signal);
  const gaps = detectGaps(target, actual, signal);
  const resolved = resolveConflicts(gaps);

  const maxRecos = resolved.some(g => g.conflictPresent) ? MAX_RECOS + 1 : MAX_RECOS;

  return resolved
    .slice(0, maxRecos)
    .map(g => gapToCard(g, stops, signal))
    .filter((c): c is ReelRecoCard => c !== null);
}
