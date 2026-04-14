export type AdvisorTrigger =
  | 'long_haul_arrival'
  | 'hotel_checkout_squeeze'
  | 'home_departure'
  | 'city_over_budget'
  | 'duration_exceeded'
  | 'duration_under_used'
  | 'travel_days_eating_budget'
  | 'transit_auto_flight'
  | 'place_removed_city'
  | 'short_flight_no_day_deducted';

export interface AdvisorContext {
  cityName?: string;
  flightHours?: number;
  checkoutTime?: string;
  departureTime?: string;
  placeCount?: number;
  estimatedDays?: number;
  budgetDays?: number;
  travelDays?: number;
  cityDays?: number;
  flightDuration?: string;
}

/** Returns time minus 30 minutes as a display string, e.g. "11:00" → "10:30 AM" */
function thirtyMinBefore(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m - 30;
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  const ampm = rh < 12 ? 'AM' : 'PM';
  const displayH = rh > 12 ? rh - 12 : rh === 0 ? 12 : rh;
  return `${displayH}:${String(rm).padStart(2, '0')} ${ampm}`;
}

const TEMPLATES: Record<AdvisorTrigger, (ctx: AdvisorContext) => string> = {
  long_haul_arrival: ({ flightHours = 12, cityName = 'the city' }) =>
    `After ${flightHours} hours in a plane, we've kept your first day in ${cityName} light. You can always add more once you're there.`,

  hotel_checkout_squeeze: ({ checkoutTime = '11:00' }) =>
    `Ending your last morning by ${thirtyMinBefore(checkoutTime)} — gives you half an hour to pack before check-out at ${checkoutTime}.`,

  home_departure: ({ departureTime = '9:00' }) =>
    `Leaving at ${departureTime} — we'll make sure you're not rushing to your first spot before it even opens.`,

  city_over_budget: ({ cityName = 'this city', placeCount = 0, estimatedDays = 2 }) =>
    `That's now ${placeCount} spots in ${cityName} — one more than a relaxed ${estimatedDays - 1}-day city. Added a day so you're not rushing.`,

  duration_exceeded: ({ placeCount = 0, estimatedDays = 0, budgetDays = 0 }) =>
    `You've picked ${placeCount} spots across your cities — that needs about ${estimatedDays} days, you've got ${budgetDays}. Want to add time, or should we help you choose the best ones?`,

  duration_under_used: ({ budgetDays = 0 }) =>
    `Plenty of room left in your ${budgetDays}-day trip — you could add another city or slow down and go deeper.`,

  travel_days_eating_budget: ({ travelDays = 2, cityDays = 0, cityName = 'the city' }) =>
    `Flights take ${travelDays === 2 ? 'a day each way' : `${travelDays} travel days`}, so you've really got ${cityDays} day${cityDays !== 1 ? 's' : ''} in ${cityName}. Tight but doable — want to add time, or make the most of it?`,

  transit_auto_flight: ({ cityName }) =>
    `There's no road between these two — looks like you're flying${cityName ? ` to ${cityName}` : ''}.`,

  place_removed_city: ({ cityName = 'this city' }) =>
    `Dropped a spot in ${cityName} — you've got a bit of breathing room now. Good for wandering.`,

  short_flight_no_day_deducted: ({ flightDuration = 'an hour', cityName = 'the next city' }) =>
    `It's only ${flightDuration} to ${cityName} — you'll still have the afternoon when you land.`,
};

export function generateAdvisorMessage(
  trigger: AdvisorTrigger,
  context: AdvisorContext = {},
): string {
  return TEMPLATES[trigger](context);
}
