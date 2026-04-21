import { useState, useCallback, useRef } from 'react';
import { placesAutocomplete, geocodePlace, fetchPlaceDetails } from '../../shared/api';
import { classifyOriginType } from '../../shared/origin-utils';
import { ORIGIN_STRINGS } from '../../shared/strings';
import type { AutocompleteResult, OriginPlace } from '../../shared/types';

export type OriginStep = 'opening' | 'searching' | 'selected' | 'not_decided';

function newSessionId() { return Math.random().toString(36).slice(2); }

export interface OriginInputState {
  step: OriginStep;
  searchQuery: string;
  searchResults: AutocompleteResult[];
  searchLoading: boolean;
  selectedOrigin: OriginPlace | null;
  /** Label for the optional time field, or null if not applicable for this place type */
  timeFieldLabel: string | null;
  /** The user-entered optional time value (HH:MM) */
  timeValue: string;
  handleSearchInput: (query: string) => void;
  handleSelectResult: (result: AutocompleteResult) => Promise<void>;
  handleTimeChange: (time: string) => void;
  chooseNotDecided: () => void;
  /** Returns the final OriginPlace (with optional time applied), or null if not_decided */
  buildOrigin: () => OriginPlace | null;
  reset: () => void;
}

export function useOriginInput(): OriginInputState {
  const [step, setStep] = useState<OriginStep>('opening');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AutocompleteResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<OriginPlace | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const sessionRef = useRef(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    setStep('searching');
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // No type filter — accepts hotels, airports, streets, anything
        const results = await placesAutocomplete(query, sessionRef.current, '');
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSelectResult = useCallback(async (result: AutocompleteResult) => {
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const geo = await geocodePlace(result.place_id, sessionRef.current);
      sessionRef.current = newSessionId();
      if (!geo) return;

      const details = await fetchPlaceDetails(result.place_id);
      const types = details?.types ?? [];
      const originType = classifyOriginType(types);

      const origin: OriginPlace = {
        placeId: result.place_id,
        name: geo.name,
        address: result.secondary_text,
        lat: geo.lat,
        lon: geo.lon,
        originType,
      };

      setSelectedOrigin(origin);
      setSearchQuery(geo.name);
      setStep('selected');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleTimeChange = useCallback((time: string) => {
    setTimeValue(time);
  }, []);

  const chooseNotDecided = useCallback(() => {
    setStep('not_decided');
  }, []);

  const reset = useCallback(() => {
    setStep('opening');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedOrigin(null);
    setTimeValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    sessionRef.current = newSessionId();
  }, []);

  const timeFieldLabel: string | null = (() => {
    if (!selectedOrigin) return null;
    if (selectedOrigin.originType === 'hotel') return ORIGIN_STRINGS.hotelFollowUp;
    if (selectedOrigin.originType === 'airport') return ORIGIN_STRINGS.airportFollowUp;
    return null;
  })();

  const buildOrigin = useCallback((): OriginPlace | null => {
    if (step === 'not_decided') return null;
    if (!selectedOrigin) return null;
    if (!timeValue) return selectedOrigin;

    if (selectedOrigin.originType === 'hotel') {
      return { ...selectedOrigin, checkInTime: timeValue };
    }
    if (selectedOrigin.originType === 'airport') {
      return { ...selectedOrigin, departureTime: timeValue };
    }
    return selectedOrigin;
  }, [step, selectedOrigin, timeValue]);

  return {
    step,
    searchQuery,
    searchResults,
    searchLoading,
    selectedOrigin,
    timeFieldLabel,
    timeValue,
    handleSearchInput,
    handleSelectResult,
    handleTimeChange,
    chooseNotDecided,
    buildOrigin,
    reset,
  };
}
