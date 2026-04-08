import { useState, useCallback, useRef, useMemo } from 'react';
import { placesAutocomplete, geocodePlace } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import type { AutocompleteResult } from '../../shared/types';
import { getAllCachedDetails, getCachedPlaceIdKey } from './usePlaceDetails';
import {
  computeRecommendedStartTime,
  formatTimeDisplay,
  generateDateStrip,
} from './trip-utils';

export type StartChip = 'hotel' | 'airport' | 'pin';

// Google Places types filter per chip
const CHIP_PLACE_TYPES: Record<StartChip, string | undefined> = {
  hotel:   'lodging',
  airport: 'airport',
  pin:     undefined,
};

function newSessionId() {
  return Math.random().toString(36).slice(2);
}

export function useTripPlanInput() {
  const { state, dispatch } = useAppStore();
  const selectedPlaces = state.selectedPlaces;

  // ── Date strip ─────────────────────────────────────────────────
  const dates = useMemo(() => generateDateStrip(7), []);
  const [selectedDate, setSelectedDate] = useState(dates[0].isoDate);

  // ── Starting point ─────────────────────────────────────────────
  const [startChip, setStartChip] = useState<StartChip>('hotel');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<AutocompleteResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string; lat: number; lon: number;
  } | null>(null);
  const sessionIdRef = useRef(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Recommended start time ──────────────────────────────────────
  const startTime = useMemo(() => {
    const getDetails = (title: string, lat: number, lon: number) => {
      const placeId = getCachedPlaceIdKey(title, lat, lon);
      if (!placeId) return undefined;
      return getAllCachedDetails().get(placeId);
    };
    return computeRecommendedStartTime(selectedPlaces, getDetails, selectedDate);
  }, [selectedPlaces, selectedDate]);

  const startTimeDisplay = formatTimeDisplay(startTime);

  // ── Handlers ────────────────────────────────────────────────────
  const handleLocationInput = useCallback((query: string) => {
    setLocationQuery(query);
    setSelectedLocation(null);
    setLocationResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const types = CHIP_PLACE_TYPES[startChip];
        const results = await placesAutocomplete(query, sessionIdRef.current, types);
        setLocationResults(results);
      } finally {
        setLocationLoading(false);
      }
    }, 300);
  }, [startChip]);

  const handleSelectLocation = useCallback(async (result: AutocompleteResult) => {
    setLocationLoading(true);
    try {
      const geo = await geocodePlace(result.place_id, sessionIdRef.current);
      sessionIdRef.current = newSessionId(); // new session after selection (billing event)
      setLocationResults([]);
      if (geo) {
        setLocationQuery(geo.name);
        setSelectedLocation({ name: geo.name, lat: geo.lat, lon: geo.lon });
      }
    } catch {
      // Leave prior results intact; user can retry
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const handleChipChange = useCallback((chip: StartChip) => {
    setStartChip(chip);
    setLocationQuery('');
    setSelectedLocation(null);
    setLocationResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    sessionIdRef.current = newSessionId();
  }, []);

  // Always true in practice — starting-point is optional per spec; place-selection guard is upstream.
  const canBuild = !!selectedDate;

  const handleBuild = useCallback((pinDropResult?: { lat: number; lon: number } | null) => {
    const locationLat = pinDropResult?.lat ?? selectedLocation?.lat ?? null;
    const locationLon = pinDropResult?.lon ?? selectedLocation?.lon ?? null;
    const locationName = pinDropResult
      ? 'Custom pin'
      : selectedLocation?.name ?? (locationQuery.trim() || null);

    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date:        selectedDate,
        startType:   startChip === 'pin' ? 'pin' : startChip,
        arrivalTime: startTime, // app-recommended start time
        days:        1,
        dayNumber:   1,
        locationLat,
        locationLon,
        locationName,
        flightTime:  null,
        isLongHaul:  false,
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }, [dispatch, selectedDate, startChip, startTime, selectedLocation, locationQuery]);

  return {
    // date strip
    dates,
    selectedDate,
    setSelectedDate,
    // starting point
    startChip,
    handleChipChange,
    locationQuery,
    locationResults,
    locationLoading,
    selectedLocation,
    handleLocationInput,
    handleSelectLocation,
    // start time
    startTime,
    startTimeDisplay,
    // build
    canBuild,
    handleBuild,
  };
}
