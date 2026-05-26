import type { AppState } from '../../../shared/store';
import type { EngineItinerary, EngineWeights } from '../../../shared/types';

export type ArchetypeGroup = 'sensory' | 'cultural' | 'social' | 'explorer';

const ARCHETYPE_GROUPS: Record<string, ArchetypeGroup> = {
  historian: 'cultural', slowscholar: 'cultural',
  epicurean: 'sensory', aesthete: 'sensory', slowtraveller: 'sensory', ritualseeker: 'sensory',
  pulse: 'social', nightcreature: 'social',
  wanderer: 'explorer', voyager: 'explorer', explorer: 'explorer', flaneur: 'explorer', drifter: 'explorer',
};

const BAD_WEATHER = new Set(['rain', 'drizzle', 'storm', 'thunderstorm', 'snow', 'sleet', 'hail', 'blizzard', 'fog']);

export interface RecoSignal {
  weights: EngineWeights;
  archetype: string;
  archetypeGroup: ArchetypeGroup;
  archetypeConfidence: number;
  pace: 'slow' | 'moderate' | 'fast';
  social: 'solo' | 'duo' | 'group';
  isFamily: boolean;
  ritualStrength: number;
  sensoryIntensity: number;
  spontaneityBias: number;
  trip: {
    totalDays: number;
    dayNumber: number;
    isFirstDay: boolean;
    isLastDay: boolean;
    isWeekend: boolean;
    isLongHaul: boolean;
    startType: string;
    arrivalTime: string | null;
    departureTime: string | null;
    city: string;
    currentDayDate: string;
  };
  weather: { condition: string; tempC: number; isOutdoorFriendly: boolean } | null;
  dismissedPinIds: Set<string>;
  savedEvents: AppState['savedEvents'];
}

export function computeRecoSignal(
  state: Pick<AppState, 'obAnswers' | 'persona' | 'travelStartDate' | 'tripContext' | 'weather' | 'savedEvents' | 'dismissedPinIds' | 'pendingTripDetails' | 'journey'>,
  dayIdx: number,
  itinerary: EngineItinerary,
): RecoSignal {
  const ob = state.obAnswers;
  const weights: EngineWeights = itinerary.personaSnapshot;
  const archetype = (itinerary.archetypeSnapshot as string) ?? state.persona?.archetype ?? 'explorer';
  const archetypeKey = archetype.toLowerCase().replace(/\s+/g, '');

  const paceMap: Record<string, 'slow' | 'moderate' | 'fast'> = {
    walking: 'slow', transit: 'fast', self: 'moderate', any: 'moderate',
  };
  const pace = ob.pace ? (paceMap[ob.pace] ?? 'moderate') : 'moderate';

  const socialMap: Record<string, 'solo' | 'duo' | 'group'> = {
    solo: 'solo', couple: 'duo', group: 'group', family: 'group',
  };
  const social = ob.social ? (socialMap[ob.social] ?? 'solo') : 'solo';
  const isFamily = ob.social === 'family';

  const ritualMap: Record<string, number> = { coffee: 0.8, tea: 0.6, alcohol: 0.4, neither: 0.1 };
  const ritualStrength = ob.ritual ? (ritualMap[ob.ritual] ?? 0.4) : 0.4;

  const sensoryMap: Record<string, number> = { visual: 0.8, taste: 0.7, movement: 0.6, history: 0.5 };
  const sensoryIntensity = ob.sensory ? (sensoryMap[ob.sensory] ?? 0.4) : 0.4;

  const spontaneityBias = Math.min(1, weights.w_spontaneity * 0.6 + (ob.style === 'spontaneous' ? 0.4 : 0));

  const answeredCount = [
    ob.ritual !== null,
    ob.sensory !== null,
    ob.style !== null,
    ob.pace !== null,
    ob.social !== null,
    ob.attractions.length > 0,
  ].filter(Boolean).length;
  const archetypeConfidence = answeredCount / 6;

  const day = itinerary.days[dayIdx];
  const totalDays = itinerary.days.length;
  const dayNumber = dayIdx + 1;
  const currentDayDate = day?.date ?? state.travelStartDate ?? '';
  let isWeekend = false;
  if (currentDayDate) {
    const d = new Date(currentDayDate);
    isWeekend = d.getDay() === 0 || d.getDay() === 6;
  }

  const departureTime = dayIdx === totalDays - 1
    ? (state.pendingTripDetails?.departureTime ?? null)
    : null;

  const wx = state.weather;
  const weather = wx ? {
    condition: wx.condition,
    tempC: wx.temp,
    isOutdoorFriendly: !BAD_WEATHER.has(wx.condition) && wx.temp > 10,
  } : null;

  return {
    weights,
    archetype,
    archetypeGroup: ARCHETYPE_GROUPS[archetypeKey] ?? 'explorer',
    archetypeConfidence,
    pace,
    social,
    isFamily,
    ritualStrength,
    sensoryIntensity,
    spontaneityBias,
    trip: {
      totalDays,
      dayNumber,
      isFirstDay: dayIdx === 0,
      isLastDay: dayIdx === totalDays - 1,
      isWeekend,
      isLongHaul: state.tripContext.isLongHaul,
      startType: state.tripContext.startType,
      arrivalTime: state.tripContext.arrivalTime,
      departureTime,
      city: day?.city ?? '',
      currentDayDate,
    },
    weather,
    dismissedPinIds: new Set(state.dismissedPinIds),
    savedEvents: state.savedEvents,
  };
}
