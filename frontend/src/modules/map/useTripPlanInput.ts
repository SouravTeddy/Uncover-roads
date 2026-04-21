import { useCallback } from 'react';
import { useAppStore } from '../../shared/store';
import type { OriginPlace, StartType } from '../../shared/types';
import { computeTotalDays } from './trip-capacity-utils';

function toStartType(origin: OriginPlace): StartType {
  if (origin.originType === 'hotel')   return 'hotel';
  if (origin.originType === 'airport') return 'airport';
  return 'pin';
}

export function useTripPlanInput() {
  const { state, dispatch } = useAppStore();
  const { selectedPlaces, travelStartDate, travelEndDate } = state;

  const canBuild = selectedPlaces.length >= 1;

  const handleBuild = useCallback((origin: OriginPlace | null) => {
    const totalDays = computeTotalDays(travelStartDate, travelEndDate);
    const days      = totalDays > 0 ? totalDays : 1;
    const startDate = travelStartDate ?? new Date().toISOString().split('T')[0];

    dispatch({ type: 'SET_ITINERARY',      itinerary: null });
    dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date:        startDate,
        startType:   origin ? toStartType(origin) : undefined,
        arrivalTime: null,
        days,
        dayNumber:   1,
        locationLat:  origin?.lat  ?? null,
        locationLon:  origin?.lon  ?? null,
        locationName: origin?.name ?? null,
        flightTime:  origin?.departureTime ?? null,
        isLongHaul:  origin?.isLongHaul ?? false,
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }, [dispatch, travelStartDate, travelEndDate]);

  return { canBuild, handleBuild };
}
