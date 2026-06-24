import type { EngineItineraryStop, WeatherData } from '../../../shared/types';

export interface TransitInfo {
  has_transit: boolean;
  transit_type: string | null;   // SUBWAY | BUS | TRAM | HEAVY_RAIL | COMMUTER_TRAIN | FERRY
  duration_min: number | null;
  line_name: string | null;
  departure_stop: string | null;
  arrival_stop: string | null;
  transfers: number | null;
  walk_to_stop_min: number | null;
}

export type ReelCardType = 'intro' | 'summary' | 'stop' | 'reco' | 'intel' | 'transit' | 'finale' | 'day_divider' | 'balance' | 'scenic' | 'day_transition';

export type ScenicSceneType = 'walk' | 'drive' | 'coastal' | 'ridge' | 'crowd' | 'forest';
export type ScenicVizType   = 'corridor' | 'route' | 'sunset' | 'elevation' | 'quiet' | 'canopy';

export interface ReelScenicCard {
  type: 'scenic';
  sceneType: ScenicSceneType;
  accent: string;
  cardType: string;    // e.g. "WALK SPINE", "COASTAL ROAD"
  pos: number;         // position within all scenic cards in this reel
  total: number;       // total scenic cards in this reel
  timing: string;      // e.g. "Evening · 8:00 PM"
  metaRight: string;   // e.g. "Shibuya Ward", "18 km"
  place: string;       // e.g. "Omotesando Boulevard"
  from: string;
  to: string;
  modeIcon: 'walk' | 'car';
  tag: string;         // e.g. "Walk", "Coastal", "Mountain"
  vizType: ScenicVizType;
  persona: string;        // slug e.g. "walk_lover"
  personaDisplay: string; // e.g. "Walk Lover"
  personaIcon: string; // icon key: walk|car|twilight|terrain|person_off|forest
  why: string;
  sensory: string;
  sensoryIcon: string; // icon key: store|camera|waves|cloud|eq|thermostat
  reelPos: string;     // e.g. "Between Stop 2 and Stop 3"
  photoUrl?: string | null; // for walk/drive scenes — real destination photo
  originPhotoUrl?: string | null; // origin stop photo for dual-photo walk card
  destPhotoUrl?: string | null;   // destination stop photo for dual-photo walk card
  transitInfo?: TransitInfo | null;
  detourKm: number;
  detourMin: number;
}

export interface ReelIntroCard {
  type: 'intro';
  city: string;
  imageUrl: string | null;
  totalStops: number;
  totalDays: number;
  totalDurationMin: number;
  totalDistanceKm: number;
  weather: WeatherData | null;
  proTip: string | null;
  persona: string;
  engineChanges: { type: string; count: number }[];
  intelItems: { icon: string; label: string; count: number; detail: string }[];
  neighborhoods: string[];
}

export interface ReelSummaryCard {
  type: 'summary';
  totalDays: number;
  totalStops: number;
  persona: string;
  engineChanges: { type: string; count: number }[];
  intelItems: { icon: string; label: string; count: number; detail: string }[];
  startDate?: string;
  neighborhoods: string[];
}

export interface ReelStopCard {
  type: 'stop';
  stop: EngineItineraryStop;
  stopNumber: number;
  totalStops: number;
  day: number;       // 1-based day index within this itinerary
  totalDays: number; // total number of days — badge shown only when > 1
  orderReason: string | null;
  orderConsequence: string | null;
  movedFrom: number | null;
  weather: WeatherData | null;
  pairWith?: { title: string; category: string; time: string } | null;
  visitDate: string | null;  // ISO "YYYY-MM-DD" — the actual date the user visits this stop
  nextLeg?: { distKm: number; durationMin: number; mode: 'walk' | 'ride'; nextStopTitle: string } | null;
  timingAdjustment?: {
    originalTime: string;          // engine time before cascade
    consequenceNote: string | null; // e.g., "Closes at 5 PM — about 1h inside"
    isClosingConflict: boolean;    // arrives after closing time
    departurePressureNote: string | null; // e.g., "Your flight is at 8 AM — leave by 6 AM"
  } | null;
  hotelAnchor?: {
    text: string;
    isWarning: boolean;
    isBlue: boolean;
    icon: string;
  } | null;
}

export type RecoTrigger =
  | 'lunch' | 'dinner' | 'evening' | 'culture' | 'rest'
  | 'weather' | 'closing_conflict' | 'walking_gap' | 'crowd_peak'
  // New engine dimensions:
  | 'density_excess' | 'density_sparse' | 'geo_efficiency'
  | 'time_balance' | 'category_diversity' | 'social_gap'
  | 'budget_mismatch' | 'live_event' | 'hidden_gem';

export interface ReelRecoCard {
  type: 'reco';
  id: string;
  trigger: RecoTrigger;
  label: string;
  consequence: string;
  nearbyCity: string;
  persona: string;
  afterStopId: string;
  weightScore?: number;
  // Coordinates of the anchor stop — used to fetch nearby recommendations
  stopLat?: number;
  stopLon?: number;
  // Photo of the anchor stop — used as background in the reco card top half
  anchorPhotoUrl?: string | null;
}

/**
 * Engine intelligence card — surfaces a decision made by the sequencer/inserter.
 * All text is deterministic (template-based from engine message type + weights).
 * No LLM prose shown directly.
 */
export interface ReelIntelCard {
  type: 'intel';
  id: string;
  messageType: 'swap' | 'insert' | 'resequence' | 'weather' | 'transit' | 'advisory' | 'evening' | 'culture';
  headline: string;
  detail: string;
  afterStopId: string | null;
  imageUrl: string | null; // background image from the anchor stop
  stopId: string | null;   // place_id for per-stop anchoring; null = day-level
}

export interface ReelTransitCard {
  type: 'transit';
  mode: 'flight' | 'drive' | 'train' | 'bus' | 'ferry';
  from: string;
  to: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  imageUrl: string | null;
  isEstimated: boolean;
  departureTime?: string | null;
  arrivalTime?: string | null;
  ref?: string | null; // flight number, train service, ferry route, etc.
}

export interface ReelFinaleCard {
  type: 'finale';
  city: string;
  totalStops: number;
  persona: string;
}

export interface ReelDayDividerCard {
  type: 'day_divider';
  day: number;       // day number (1, 2, 3, …)
  city: string;      // city name for this day
  date: string;      // ISO date string e.g. "2026-05-21"
  stopCount: number; // number of stops planned this day
  startTime: string | null;  // "09:00" — first stop's scheduled time
  endTime: string | null;    // "18:30" — last stop's end time (time + duration)
  isWrapUp?: boolean;        // true = end-of-day recap card; false/absent = start-of-day card
  nextCity?: string | null;  // city of the next day (for wrap-up cards)
}

export interface ReelBalanceCard {
  type: 'balance';
  message: string;
  persona: string;
}

export interface ReelGroupMiniCard {
  type: 'walk' | 'reco' | 'activity';
  title: string;       // chip label e.g. "Scenic Walk"
  imageUrl: string | null;
  name: string;        // main subject e.g. "Hibiya Park Promenade"
  data: string;        // key stat e.g. "8 min · 600 m" or "4.3 ★ · $$"
  footer: string;      // context e.g. "On the way to Ginza Six"
  icon: string;        // material icon name
  accent: string;      // hex colour
}

export interface ReelGroupCard {
  type: 'group';
  fromStop: string;
  toStop: string;
  fromArea: string;
  toArea: string;
  cards: ReelGroupMiniCard[];
  // Anchor coordinates for the group-level "add places" CTA
  anchorLat?: number;
  anchorLon?: number;
}

/**
 * Unified day-transition card that replaces the three separate "That's a wrap" +
 * transit + "Day N" cards. One card per boundary between consecutive days.
 */
export interface ReelDayTransitionCard {
  type: 'day_transition';
  // Previous day recap
  prevDay: number;
  prevCity: string;
  prevDate: string;
  prevStopCount: number;
  prevStartTime: string | null;
  prevEndTime: string | null;
  // Next day preview
  nextDay: number;
  nextCity: string;
  nextDate: string;
  nextStopCount: number;
  nextStartTime: string | null;
  nextDayWalkKm: number;
  nextDayRideKm: number;
  // Inter-city transit (null when same city)
  isCityChange: boolean;
  transitMode: 'flight' | 'drive' | 'train' | 'bus' | 'ferry' | null;
  transitDistanceKm: number | null;
  transitDurationMin: number | null;
  transitIsEstimated: boolean;
  transitDepartureTime?: string | null;
  transitArrivalTime?: string | null;
  transitRef?: string | null;
}

export interface DayIntelObservation {
  id: string;
  trigger: RecoTrigger;
  what: string;        // headline — "No cultural visit today"
  why: string;         // italic context — "5 stops, no museum or gallery"
  consequence: string; // actionable — "Tokyo's galleries are walkable from here"
  ctaLabel: string;    // "Browse culture near Shibuya"
  stopLat?: number | null;
  stopLon?: number | null;
  searchCategory: string; // passed to nearbyPlaces API
  anchorCity: string;
}

export interface ReelDayIntelCard {
  type: 'day_intel';
  id: string;
  day: number;
  totalDays: number;
  dayCity: string;
  afterStopId: string; // last stop of the day
  observations: DayIntelObservation[];
}

export type ReelCard =
  | ReelIntroCard
  | ReelSummaryCard
  | ReelStopCard
  | ReelRecoCard
  | ReelIntelCard
  | ReelTransitCard
  | ReelFinaleCard
  | ReelDayDividerCard
  | ReelBalanceCard
  | ReelScenicCard
  | ReelGroupCard
  | ReelDayTransitionCard
  | ReelDayIntelCard;
