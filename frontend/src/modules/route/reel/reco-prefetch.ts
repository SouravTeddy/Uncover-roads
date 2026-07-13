/**
 * Pre-fetches recommended places for every reco trigger in the itinerary
 * and injects them as EngineItineraryStop objects (isEngineAdded: true).
 *
 * This runs during the loading phase so the reel shows "Our pick" stop cards
 * instead of lazy-loading ReelRecoCard stubs.
 */
import { api, fetchPlaceDetails, getPlacePhotoUrl } from '../../../shared/api';
import type { AppState } from '../../../shared/store';
import type { EngineItinerary, EngineItineraryStop, Category, WeatherData } from '../../../shared/types';
import { computeRecoSignal, deriveRecos } from '../reco-engine';
import { rebalanceItinerary } from './rebalance';
import { getLocalFoodFact } from './local-food-facts';
import type { ReelRecoCard } from './types';

// Triggers that do NOT need a place fetch (meta/structural)
const SKIP_PREFETCH = new Set([
  'walking_gap', 'walkable_detour', 'photo_detour',
  'density_excess', 'density_sparse', 'budget_mismatch',
  'closing_conflict', 'crowd_peak', 'live_event',
  'geo_efficiency', 'time_balance',
]);

// Times must satisfy profile.ts thresholds so injected stop fills the profile gap:
//   hasDinner:  category in FOOD_CATS + time >= 17:00 (1020 min)
//   hasLunch:   category in FOOD_CATS + time in 11:00–15:00 (660–900 min)
//   hasEvening: time >= 20:00 (1200 min)
const TRIGGER_DEFAULTS: Record<string, { time: string; durationMin: number; category: string }> = {
  lunch:              { time: '13:00', durationMin: 60,  category: 'restaurant'        },
  dinner:             { time: '19:30', durationMin: 90,  category: 'restaurant'        },
  evening:            { time: '20:00', durationMin: 90,  category: 'nightlife'         },
  rest:               { time: '15:30', durationMin: 30,  category: 'cafe'              },
  culture:            { time: '10:30', durationMin: 90,  category: 'museum'            },
  social_gap:         { time: '17:00', durationMin: 60,  category: 'bar'               },
  hidden_gem:         { time: '11:00', durationMin: 45,  category: 'point_of_interest' },
  local_food:         { time: '12:30', durationMin: 60,  category: 'restaurant'        },
  famous_spots:       { time: '10:00', durationMin: 60,  category: 'tourism'           },
  weather:            { time: '10:30', durationMin: 60,  category: 'museum'            },
  category_diversity: { time: '11:00', durationMin: 60,  category: 'museum'            },
};

// Primary category hint passed to the /reel-reco endpoint
const TRIGGER_API_CATEGORY: Record<string, string> = {
  lunch:              'restaurant',
  dinner:             'restaurant',
  evening:            'nightlife',
  rest:               'cafe',
  culture:            'museum',
  social_gap:         'bar',
  hidden_gem:         'point_of_interest',
  local_food:         'restaurant',
  famous_spots:       'tourism',
  weather:            'museum',
  category_diversity: 'museum',
};

const LANDMARK_CATS = new Set(['museum', 'historic', 'tourism', 'gallery', 'amusement_park', 'zoo', 'aquarium']);
const FOOD_CATS     = new Set(['restaurant', 'cafe', 'bakery', 'street_food', 'market']);

function insertAfterStop(
  stops: EngineItineraryStop[],
  afterId: string,
  newStop: EngineItineraryStop,
): EngineItineraryStop[] {
  const idx = stops.findIndex(s => s.id === afterId);
  const at = idx === -1 ? stops.length : idx + 1;
  return [...stops.slice(0, at), newStop, ...stops.slice(at)];
}

function extractArea(address: string): string {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  // Skip house numbers (first segment often), take the second meaningful part
  return parts[1] ?? parts[0] ?? '';
}

export interface RecoPrefetchResult {
  enrichedItinerary: EngineItinerary;
  /** reco stop title → resolved image URL, for preloading */
  recoImages: Map<string, string>;
  /** dayIdx → set of trigger strings that were successfully pre-fetched */
  prefetchedByDay: Map<number, Set<string>>;
}

type StateSlice = Pick<AppState,
  'rawOBAnswers' | 'persona' | 'travelStartDate' | 'tripContext' | 'weather' |
  'savedEvents' | 'dismissedPinIds' | 'pendingTripDetails' | 'journey' | 'liveEvents'
>;

export async function prefetchRecoStops(
  itinerary: EngineItinerary,
  state: StateSlice,
  wxByCity: Map<string, WeatherData>,
  existingPlaceIds: string[],
): Promise<RecoPrefetchResult> {
  const recoImages     = new Map<string, string>();
  const prefetchedByDay = new Map<number, Set<string>>();

  // Work on a rebalanced copy so timing matches what buildFiltered would see
  const balanced    = rebalanceItinerary(itinerary);
  const enrichedDays = balanced.days.map(d => ({ ...d, stops: [...d.stops] }));

  await Promise.all(
    balanced.days.map(async (day, dayIdx) => {
      if (day.isTravel || !day.stops?.length) return;

      const cityWeather = wxByCity.get(day.city.toLowerCase()) ?? null;
      const signal      = computeRecoSignal({ ...state, weather: cityWeather }, dayIdx, balanced);
      const dayStops    = balanced.days[dayIdx].stops;

      // Derive engine recos for this day
      const recos: ReelRecoCard[] = deriveRecos(dayStops, signal);

      // Famous spots: same logic as buildFiltered
      const hasLandmark = dayStops.some(s => LANDMARK_CATS.has(s.category));
      if (!hasLandmark && dayStops.length > 0 && recos.length < 4) {
        const anchor = dayStops[Math.floor(dayStops.length / 2)];
        recos.push({
          type: 'reco',
          id: `famous-spots-${day.city}-${dayIdx}`,
          trigger: 'famous_spots',
          label: `Famous spots in ${day.city}`,
          consequence: `You haven't added any of ${day.city}'s iconic landmarks.`,
          nearbyCity: day.city,
          persona: signal.archetype,
          afterStopId: anchor.id,
          weightScore: 0.4,
          stopLat: anchor.lat,
          stopLon: anchor.lon,
        });
      }

      // Local food: same logic as buildFiltered
      const hasFoodReco = recos.some(r =>
        r.trigger === 'lunch' || r.trigger === 'dinner' || r.trigger === 'local_food'
      );
      const foodFact = getLocalFoodFact(day.city);
      const hasLowRichnessFoodStop = dayStops.some(
        s => FOOD_CATS.has(s.category) && (!s.localTip || s.localTip.length < 80),
      );
      if (!hasFoodReco && foodFact && hasLowRichnessFoodStop) {
        const anchor = dayStops[Math.floor(dayStops.length / 2)];
        recos.push({
          type: 'reco',
          id: `local-food-${day.city}-${dayIdx}`,
          trigger: 'local_food',
          label: foodFact.dish,
          consequence: `${foodFact.context} ${foodFact.where}.`,
          nearbyCity: day.city,
          persona: signal.archetype,
          afterStopId: anchor.id,
          weightScore: 0.45,
          stopLat: anchor.lat,
          stopLon: anchor.lon,
        });
      }

      // Deduplicate by trigger (take first per trigger)
      const seen     = new Set<string>();
      const deduped  = recos.filter(r => {
        if (seen.has(r.trigger)) return false;
        seen.add(r.trigger);
        return true;
      });

      const dayFetched = new Set<string>();

      // Fetch all recos for this day in parallel
      await Promise.all(deduped.map(async (reco) => {
        if (SKIP_PREFETCH.has(reco.trigger)) return;
        if (!reco.stopLat || !reco.stopLon) return;

        const defaults = TRIGGER_DEFAULTS[reco.trigger];
        if (!defaults) return;

        try {
          const places = await api.reelReco({
            lat: reco.stopLat,
            lon: reco.stopLon,
            trigger: reco.trigger,
            archetype: signal.archetype,
            existingPlaceIds,
            category: TRIGGER_API_CATEGORY[reco.trigger],
          });

          const top = places[0];
          if (!top) return;

          const details = await fetchPlaceDetails(top.placeId);
          if (!details) return;

          // Resolve image — photo_ref from PlaceDetails is the most reliable
          let imageUrl: string | null = null;
          if (details.photo_ref) {
            imageUrl = getPlacePhotoUrl(details.photo_ref, 800, 1200);
          } else {
            // Fallback to place-image endpoint with placeId
            try {
              imageUrl = await api.placeImage(top.name, reco.nearbyCity, top.placeId);
            } catch { /* non-critical */ }
          }

          const recoStop: EngineItineraryStop = {
            id:           `reco-${reco.trigger}-${dayIdx}-${top.placeId}`,
            placeId:      top.placeId,
            title:        details.name || top.name,
            area:         extractArea(details.address ?? ''),
            day:          dayIdx + 1,
            time:         defaults.time,
            durationMin:  defaults.durationMin,
            category:     (top.category || defaults.category) as Category,
            lat:          top.lat,
            lon:          top.lon,
            priceLevel:   details.price_level ?? top.priceLevel,
            rating:       details.rating ?? top.rating,
            weekdayText:  details.weekday_text ?? null,
            whyForYou:    top.matchReasons.join('. ') || reco.consequence,
            localTip:     details.editorial_summary ?? details.review_summary ?? null,
            googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${top.placeId}`,
            website:      details.website ?? null,
            photoRef:     details.photo_ref ?? null,
            imageUrl,
            isEngineAdded: true,
          };

          if (imageUrl) recoImages.set(recoStop.title, imageUrl);

          enrichedDays[dayIdx].stops = insertAfterStop(
            enrichedDays[dayIdx].stops,
            reco.afterStopId,
            recoStop,
          );

          dayFetched.add(reco.trigger);
        } catch {
          // Non-critical: failed reco stays as gap, buildFiltered may generate a ReelRecoCard fallback
        }
      }));

      if (dayFetched.size > 0) prefetchedByDay.set(dayIdx, dayFetched);
    })
  );

  return {
    enrichedItinerary: { ...balanced, days: enrichedDays },
    recoImages,
    prefetchedByDay,
  };
}
