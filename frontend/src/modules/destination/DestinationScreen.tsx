import { useState } from 'react';
import type { Place } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { ExploreSearchBar } from './ExploreSearchBar';
import { InProgressSection } from './InProgressSection';
import { ExploreEmptyState } from './ExploreEmptyState';
import { DateRangeCalendar } from './DateRangeCalendar';

const CITY_PHOTOS: Record<string, string> = {
  'paris':     'photo-1499856871958-5b9627545d1a',
  'tokyo':     'photo-1540959733332-eab4deabeeaf',
  'rome':      'photo-1552832230-c0197dd311b5',
  'barcelona': 'photo-1583422409516-2895a77efded',
  'lisbon':    'photo-1585208798174-6cedd4b9b6e5',
  'london':    'photo-1520986606214-8b456906c813',
  'amsterdam': 'photo-1534351590666-13e3e96b5017',
  'kyoto':     'photo-1528360983277-13d401cdc186',
  'new york':  'photo-1496442226666-8d4d0e62e6e9',
  'istanbul':  'photo-1524231757912-21f4fe3a7200',
}

const DEFAULT_CITY_PHOTO = 'photo-1476514525405-09b77a9d1f66'

export function getCityPhotoUrl(cityName: string): string {
  const key = cityName.toLowerCase()
  const id = Object.entries(CITY_PHOTOS).find(([k]) => key.includes(k))?.[1] ?? DEFAULT_CITY_PHOTO
  return `https://images.unsplash.com/${id}?w=600&q=75`
}

export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { city, selectedPlaces, travelStartDate, travelEndDate } = state;
  const [showCalendar, setShowCalendar] = useState(false);

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
      const todayIso = new Date().toISOString().split('T')[0];
      dispatch({ type: 'SET_TRAVEL_DATES', startDate: todayIso, endDate: todayIso });
      goToMap();
    } else {
      setShowCalendar(true);
    }
  }

  function handleDateSelect(startDate: string, endDate: string) {
    dispatch({ type: 'SET_TRAVEL_DATES', startDate, endDate });
  }

  function handleCalendarClose() {
    setShowCalendar(false);
    if (travelStartDate) goToMap();
  }

  function openPlaceOnMap(place: Place) {
    dispatch({ type: 'SET_PENDING_PLACE', place });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function formatDateLabel(start: string, end: string): string {
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (start === end) return s.toLocaleDateString('en-US', opts);
    return `${s.toLocaleDateString('en-US', opts)}–${e.toLocaleDateString('en-US', opts)}`;
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <header
        className="px-5 flex-shrink-0 flex items-center justify-between"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <p className="text-[12px] text-[var(--color-text-3)] uppercase tracking-wide">{today}</p>
          <h1
            className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-1)]"
            style={{ fontSize: 28, letterSpacing: '-0.01em', lineHeight: 1.15 }}
          >
            uncover roads
          </h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[14px]">
          U
        </div>
      </header>

      {/* Search bar + 📅 icon row */}
      <div className="flex-shrink-0 flex items-center gap-2 pr-4">
        <div className="flex-1">
          <ExploreSearchBar onCitySelected={handleCitySelected} />
        </div>
        {city && !showCalendar && (
          <button
            onClick={() => setShowCalendar(true)}
            className="flex-shrink-0 flex items-center gap-1.5 h-10 px-3 rounded-2xl text-[13px] font-semibold"
            style={{
              background: travelStartDate ? 'var(--color-primary-bg)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${travelStartDate ? 'rgba(224,120,84,.3)' : 'rgba(255,255,255,.1)'}`,
              color: travelStartDate ? 'var(--color-primary)' : 'var(--color-text-3)',
            }}
          >
            <span className="ms text-sm">calendar_today</span>
            {travelStartDate && travelEndDate ? formatDateLabel(travelStartDate, travelEndDate) : ''}
          </button>
        )}
      </div>

      {/* Calendar — slides in after city selected */}
      {showCalendar && (
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ animation: 'slideDown 0.3s ease forwards' }}
        >
          <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <DateRangeCalendar
            key={city}
            onSelect={handleDateSelect}
            onClose={handleCalendarClose}
          />
          <div className="px-4 pt-2 pb-3 flex gap-2">
            <button
              onClick={() => { setShowCalendar(false); goToMap(); }}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,.06)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
            >
              Skip for now
            </button>
            {travelStartDate && (
              <button
                onClick={() => { setShowCalendar(false); goToMap(); }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                Explore {city}
              </button>
            )}
          </div>
        </div>
      )}

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
