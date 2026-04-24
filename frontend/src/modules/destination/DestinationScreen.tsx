import { useState } from 'react';
import type { Place } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { ExploreSearchBar } from './ExploreSearchBar';
import { InProgressSection } from './InProgressSection';
import { ExploreEmptyState } from './ExploreEmptyState';
import { DateRangeSheet } from '../map/TravelDateBar';

export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { city, selectedPlaces, travelStartDate, travelEndDate } = state;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function goToMap() {
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleCitySelected(nearMe?: boolean) {
    if (nearMe) {
      // Near me = current date, skip date picker
      const todayIso = new Date().toISOString().split('T')[0];
      dispatch({ type: 'SET_TRAVEL_DATES', startDate: todayIso, endDate: todayIso });
      goToMap();
    } else {
      setShowDatePicker(true);
    }
  }

  function openPlaceOnMap(place: Place) {
    dispatch({ type: 'SET_PENDING_PLACE', place });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {showDatePicker && (
        <DateRangeSheet
          initialStart={travelStartDate}
          initialEnd={travelEndDate}
          onDone={(start, end) => {
            dispatch({ type: 'SET_TRAVEL_DATES', startDate: start, endDate: end });
            setShowDatePicker(false);
            goToMap();
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Header */}
      <header
        className="px-5 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <p className="text-white/30 text-[10px]">{today}</p>
        <h1
          className="font-heading font-bold text-lg leading-tight"
          style={{
            background: 'linear-gradient(90deg, #6c8fff, #b06cff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          uncover roads
        </h1>
      </header>

      {/* Search bar */}
      <div className="flex-shrink-0">
        <ExploreSearchBar onCitySelected={handleCitySelected} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>
        {selectedPlaces.length > 0 && city ? (
          <InProgressSection
            city={city}
            selectedPlaces={selectedPlaces}
            startDate={travelStartDate}
            endDate={travelEndDate}
            onResume={goToMap}
            onChipTap={openPlaceOnMap}
            onPlaceTap={openPlaceOnMap}
            onAddTap={goToMap}
          />
        ) : (
          <ExploreEmptyState />
        )}
      </div>
    </div>
  );
}
