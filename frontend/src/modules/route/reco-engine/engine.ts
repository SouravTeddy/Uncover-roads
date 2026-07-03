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
export const L1_THRESHOLD = 0.10;   // softer gate — more recos surface at L1
export const L2_THRESHOLD = 0.25;   // significance floor for persona-amplified L2 copy
const MAX_RECOS = 3;
const CONFLICT_BOOST = 1.4;

const OB_MAPPED: Partial<Record<keyof ItineraryProfile, boolean>> = {
  densityScore: true, hasRest: true, hasCulture: true, hasOutdoor: true,
};

// Which profile dimensions align with each archetype group for L2 tagging
const L2_ALIGNED: Partial<Record<'cultural' | 'sensory' | 'social' | 'explorer', Array<keyof ItineraryProfile>>> = {
  cultural: ['hasCulture', 'hasHiddenGem'],
  sensory:  ['hasRest', 'hasLunch', 'hasDinner'],
  social:   ['hasSocialStop'],
  explorer: ['hasHiddenGem', 'walkIntensity'],
};

export function detectGaps(
  target: ItineraryProfile,
  actual: ItineraryProfile,
  signal: RecoSignal,
): Gap[] {
  const threshold = L1_THRESHOLD + (signal.archetypeConfidence < 0.5 ? CONFIDENCE_THRESHOLD_BOOST : 0);
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
        : (() => {
            const cond = (signal.weather?.condition ?? '').toLowerCase();
            const isBadWeather = cond.includes('rain') || cond.includes('storm') || cond.includes('snow') || cond.includes('extreme') || cond.includes('heat') || cond.includes('fog');
            return isBadWeather
              ? `${signal.weather?.condition} may make some of these tough — worth checking the forecast.`
              : `Lots of outdoor stops today — good for keeping the energy up.`;
          })(),
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
        ? `Your steps will add up today — a mid-day sit-down or cafe break helps pace it well.`
        : `Most stops are compact — room for a walk if you want one.`,
    },
    hasHiddenGem: {
      trigger: 'hidden_gem',
      label: (() => {
        const GROUP_LABEL: Record<string, string> = {
          cultural: 'A lesser-known cultural gem',
          sensory:  'A local haunt worth finding',
          social:   'Where locals actually go',
          explorer: 'Off the tourist trail',
        };
        return GROUP_LABEL[signal.archetypeGroup] ?? 'A local spot worth knowing about';
      })(),
      consequence: (() => {
        const GROUP_COPY: Record<string, string> = {
          cultural: `A spot near ${area} that locals visit but guidebooks miss.`,
          sensory:  `A neighbourhood find near ${area} — the kind that rewards wandering.`,
          social:   `Near ${area} — frequented by locals, rarely listed on review apps.`,
          explorer: `Close to your route near ${area} — the kind of place most visitors walk past.`,
        };
        return GROUP_COPY[signal.archetypeGroup] ?? `Close to your route — the kind of place most visitors walk past.`;
      })(),
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

  // Determine reco level: L2 if significance exceeds L2 threshold AND dimension aligns with archetype
  const l2Dimensions = L2_ALIGNED[signal.archetypeGroup as keyof typeof L2_ALIGNED] ?? [];
  const isL2 = gap.significance >= L2_THRESHOLD && l2Dimensions.includes(gap.dimension);
  const recoLevel: 'l1' | 'l2' = isL2 ? 'l2' : 'l1';

  // Persona-amplified copy for L2 recos — bolder, persona-named
  const l2Consequence: Partial<Record<keyof ItineraryProfile, string>> = {
    hasCulture: `A day without culture is something a historian notices. There's a spot near ${area} that earns your time — not on the tourist circuit.`,
    hasHiddenGem: signal.archetypeGroup === 'explorer'
      ? `You don't need the guidebook version of ${area}. There's a place nearby that most people never find — it's yours if you look.`
      : `A neighbourhood find near ${area} worth seeking out — the kind that rewards the curious.`,
    hasRest: `Your pace is intentional — protect it. Find a quiet spot near ${area} to sit and let the day settle.`,
    hasLunch: `You're built for proper meals, not grab-and-go. This midday window near ${area} deserves a real sit-down.`,
    hasDinner: `End the day the right way. There's good food near ${area} that fits your kind of evening.`,
    hasSocialStop: `You're at your best in a crowd. Find somewhere near ${area} worth showing up to — locals know it, tourists don't.`,
    walkIntensity: `You're built for longer stretches. This day has room — push the distance a bit near ${area}.`,
  };

  const tmpl = templates[gap.dimension];
  if (!tmpl) return null;

  const consequence = (isL2 && l2Consequence[gap.dimension]) ? l2Consequence[gap.dimension]! : tmpl.consequence;

  return {
    type: 'reco',
    id: `${gap.dimension}-${afterStopId}${gap.conflictPresent ? '-conflict' : ''}`,
    trigger: tmpl.trigger as ReelRecoCard['trigger'],
    label: gap.conflictPresent ? `⚡ ${tmpl.label}` : tmpl.label,
    consequence,
    nearbyCity: city,
    persona,
    afterStopId,
    weightScore: gap.significance,
    recoLevel,
    stopLat: anchor?.lat,
    stopLon: anchor?.lon,
  };
}

const ARCHETYPE_FLOOR: Record<string, { dimension: keyof ItineraryProfile; trigger: string }> = {
  cultural: { dimension: 'hasCulture',    trigger: 'culture'    },
  sensory:  { dimension: 'hasRest',       trigger: 'rest'       },
  social:   { dimension: 'hasSocialStop', trigger: 'social_gap' },
  explorer: { dimension: 'hasHiddenGem',  trigger: 'hidden_gem' },
};

export function deriveRecos(
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ReelRecoCard[] {
  const target = computeTargetProfile(signal);
  const actual = computeActualProfile(stops, signal);
  const gaps = detectGaps(target, actual, signal);
  const resolved = resolveConflicts(gaps);

  const maxRecos = resolved.some(g => g.conflictPresent) ? MAX_RECOS + 1 : MAX_RECOS;

  const result = resolved
    .slice(0, maxRecos)
    .map(g => gapToCard(g, stops, signal))
    .filter((c): c is ReelRecoCard => c !== null);

  // Persona floor: inject one archetype-aligned reco if none already present and day has enough stops
  if (stops.length >= 2) {
    const floor = ARCHETYPE_FLOOR[signal.archetypeGroup];
    if (floor && !result.some(r => r.trigger === floor.trigger)) {
      const floorGap: Gap = {
        dimension: floor.dimension,
        target: target[floor.dimension] as number ?? 0.5,
        actual: actual[floor.dimension] as number ?? 0.5,
        delta: 0,
        dimensionWeight: 0.5,
        significance: L2_THRESHOLD + 0.01,   // floor is always persona-aligned → always L2
        direction: 'missing',
        conflictPresent: false,
      };
      const floorCard = gapToCard(floorGap, stops, signal);
      if (floorCard) {
        floorCard.recoLevel = 'l2';
        result.push(floorCard);
      }
    }
  }

  return result;
}
