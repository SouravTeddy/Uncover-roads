import type { EngineItineraryStop, WeatherData } from '../../../shared/types';

export type ReelCardType = 'intro' | 'summary' | 'stop' | 'reco' | 'intel' | 'transit' | 'finale';

export interface ReelIntroCard {
  type: 'intro';
  city: string;
  imageUrl: string | null;
  totalStops: number;
  totalDays: number;
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
}

export type RecoTrigger = 'lunch' | 'dinner' | 'evening' | 'culture' | 'rest';

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
  afterStopId: string | null; // null = placed at day start
}

export interface ReelTransitCard {
  type: 'transit';
  mode: 'flight' | 'drive' | 'train' | 'bus';
  from: string;
  to: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  imageUrl: string | null;
  isEstimated: boolean;
  departureTime?: string | null;
  arrivalTime?: string | null;
  ref?: string | null; // flight number, "Your rental", etc.
}

export interface ReelFinaleCard {
  type: 'finale';
  city: string;
  totalStops: number;
  persona: string;
}

export type ReelCard =
  | ReelIntroCard
  | ReelSummaryCard
  | ReelStopCard
  | ReelRecoCard
  | ReelIntelCard
  | ReelTransitCard
  | ReelFinaleCard;
