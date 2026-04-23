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

  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null } | null = rawUser
    ? JSON.parse(rawUser)
    : null;

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
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
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
        </div>
        <div
          className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(108,143,255,0.3), rgba(176,108,255,0.3))',
            border: '1px solid rgba(108,143,255,0.2)',
          }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-xs" style={{ color: '#8aa8ff' }}>
              {(user?.name ?? 'U')[0].toUpperCase()}
            </span>
          )}
        </div>
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
