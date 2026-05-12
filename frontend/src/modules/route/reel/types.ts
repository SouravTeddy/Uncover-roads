import type { EngineItineraryStop, WeatherData } from '../../../shared/types';

export type ReelCardType = 'intro' | 'stop' | 'reco' | 'transit' | 'finale';

export interface ReelIntroCard {
  type: 'intro';
  city: string;
  imageUrl: string | null;
  totalStops: number;
  weather: WeatherData | null;
  proTip: string | null;
  persona: string;
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

export interface ReelRecoCard {
  type: 'reco';
  trigger: 'lunch' | 'dinner' | 'coffee' | 'persona';
  label: string;
  consequence: string;
  nearbyCity: string;
  persona: string;
  afterStopId: string;
}

export interface ReelTransitCard {
  type: 'transit';
  mode: 'flight' | 'drive' | 'train' | 'bus';
  from: string;
  to: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  imageUrl: string | null;
}

export interface ReelFinaleCard {
  type: 'finale';
  city: string;
  totalStops: number;
  persona: string;
}

export type ReelCard =
  | ReelIntroCard
  | ReelStopCard
  | ReelRecoCard
  | ReelTransitCard
  | ReelFinaleCard;
