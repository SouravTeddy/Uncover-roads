// frontend/src/shared/strings.ts
// All user-facing copy for the origin card. Edit here to change tone/phrasing.

export const ORIGIN_STRINGS = {
  cardHeading:       "Where are you starting your trip from?",
  searchPlaceholder: "Hotel, airport, anywhere...",
  hotelFollowUp:     "When do you check in?",
  airportFollowUp:   "When do you land?",
  optionalNudge:     "You can always come back to fine-tune your plan.",
  notDecidedLabel:   "Haven't decided yet",
  notDecidedHeading: "No starting point? No problem.",
  notDecidedSub:     "We'll build your plan around the places — just get to the first stop on time.",
  itineraryNudge:    "Add where you're staying to see travel times",
  cta:               "Build my itinerary",
  ctaDays:           (n: number) => `Build my ${n}-day itinerary`,
} as const;

export const PLACE_TYPE_LABELS: Record<string, string> = {
  hotel:   'Hotel',
  airport: 'Airport',
  home:    'Home',
  custom:  'Place',
};
