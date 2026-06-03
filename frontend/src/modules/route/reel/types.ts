import type { EngineItineraryStop, WeatherData } from '../../../shared/types';

export type ReelCardType = 'intro' | 'summary' | 'stop' | 'reco' | 'intel' | 'transit' | 'finale' | 'day_divider' | 'balance' | 'scenic';

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
  persona: string;     // e.g. "Walk-lover"
  personaIcon: string; // icon key: walk|car|twilight|terrain|person_off|forest
  why: string;
  sensory: string;
  sensoryIcon: string; // icon key: store|camera|waves|cloud|eq|thermostat
  reelPos: string;     // e.g. "Between Stop 2 and Stop 3"
  photoUrl?: string | null; // for walk/drive scenes — real destination photo
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
}

export interface ReelSummaryCard {
  type: 'summary';
  totalDays: number;
  totalStops: number;
  persona: string;
  engineChanges: { type: string; count: number }[];
}

export interface ReelStopCard {
  type: 'stop';
  stop: EngineItineraryStop;
  stopNumber: number;
  totalStops: number;
  orderReason: string | null;
  orderConsequence: string | null;
  movedFrom: number | null;
  weather: WeatherData | null;
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
  day: number;       // day number (2, 3, …)
  city: string;      // city name for this day
  date: string;      // ISO date string e.g. "2026-05-21"
  stopCount: number; // number of stops planned this day
}

export interface ReelBalanceCard {
  type: 'balance';
  message: string;
  persona: string;
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
  | ReelScenicCard;
