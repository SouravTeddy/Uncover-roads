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
  liveEvents: import('../../../shared/types').LiveEvent[];
}

export function computeRecoSignal(
  state: Pick<AppState, 'rawOBAnswers' | 'persona' | 'travelStartDate' | 'tripContext' | 'weather' | 'savedEvents' | 'dismissedPinIds' | 'pendingTripDetails' | 'journey' | 'liveEvents'>,
  dayIdx: number,
  itinerary: EngineItinerary,
): RecoSignal {
  const raw = state.rawOBAnswers;
  const weights: EngineWeights = itinerary.personaSnapshot;
  const archetype = (itinerary.archetypeSnapshot as string) ?? state.persona?.archetype ?? 'explorer';
  const archetypeKey = archetype.toLowerCase().replace(/\s+/g, '');

  // pace: first entry in raw.pace array
  const paceMap: Record<string, 'slow' | 'moderate' | 'fast'> = {
    slow: 'slow', balanced: 'moderate', pack: 'fast', spontaneous: 'moderate',
  };
  const pace = raw?.pace?.[0] ? (paceMap[raw.pace[0]] ?? 'moderate') : 'moderate';

  // social
  const socialMap: Record<string, 'solo' | 'duo' | 'group'> = {
    solo: 'solo', couple: 'duo', family: 'group', friends: 'group',
  };
  const social = raw?.group ? (socialMap[raw.group] ?? 'solo') : 'solo';
  const isFamily = raw?.group === 'family';

  // ritual strength from day_open answer
  const ritualMap: Record<string, number> = {
    coffee: 0.8, breakfast: 0.5, grab_go: 0.3, straight: 0.1,
  };
  const ritualStrength = raw?.day_open ? (ritualMap[raw.day_open] ?? 0.4) : 0.4;

  // sensory intensity: max of mood array values
  const sensoryMap: Record<string, number> = {
    culture: 0.7, eat_drink: 0.7, explore: 0.6, relax: 0.4,
  };
  const sensoryIntensity = raw?.mood?.length
    ? Math.max(...raw.mood.map(m => sensoryMap[m] ?? 0.4))
    : 0.4;

  // spontaneity bias
  const spontaneityBias = Math.min(
    1,
    weights.w_spontaneity * 0.6 + (raw?.pace?.includes('spontaneous') ? 0.4 : 0),
  );

  // archetypeConfidence: OB is mandatory — always 1.0
  const archetypeConfidence = 1.0;

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
    liveEvents: state.liveEvents ?? [],
  };
}
