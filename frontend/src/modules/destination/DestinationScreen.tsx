// useState removed — was only used for DateRangeSheet (deleted in Phase 4)
import type { Place } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { ExploreSearchBar } from './ExploreSearchBar';
import { InProgressSection } from './InProgressSection';
import { ExploreEmptyState } from './ExploreEmptyState';
// DateRangeSheet removed — TravelDateBar deleted in Phase 4, calendar rebuilt in Phase 7

export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { city, selectedPlaces, travelStartDate, travelEndDate } = state;
  // showDatePicker removed — DateRangeSheet deleted in Phase 4, calendar rebuilt in Phase 7

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
      // Date picker removed — Phase 7 will add calendar directly on destination screen
      goToMap();
    }
  }

  function openPlaceOnMap(place: Place) {
    dispatch({ type: 'SET_PENDING_PLACE', place });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {/* DateRangeSheet removed — calendar will be rebuilt in Phase 7 */}

      {/* Header */}
      <header
        className="px-5 flex-shrink-0 flex items-center justify-between"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <p className="text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">{today}</p>
          <h1
            className="font-[family-name:var(--font-heading)] text-[28px] font-bold"
            style={{ background: 'linear-gradient(135deg, #f5f0ea, #e07854)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            uncover roads
          </h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[14px]">
          U
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
