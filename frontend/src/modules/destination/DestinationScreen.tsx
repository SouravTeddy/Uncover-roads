import { useEffect, useState } from 'react';
import type { Place, GeoData } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import { useLastSession } from './useLastSession';
import { ExploreHero } from './ExploreHero';
import { ExploreSearchBar } from './ExploreSearchBar';
import CuratedCityCards from './CuratedCityCards';
import RecentVisits from './RecentVisits';
import { DateRangeCalendar } from './DateRangeCalendar';

export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { city, travelStartDate, travelEndDate, persona, savedItineraries } = state;
  const { session } = useLastSession();
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingCity, setPendingCity] = useState<string | null>(null);
  const [userName, setUserName] = useState('Traveller');

  const savedTripCity = savedItineraries[savedItineraries.length - 1]?.city ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata ?? {};
        const name = meta.given_name ?? meta.full_name?.split(' ')[0] ?? meta.name?.split(' ')[0] ?? null;
        setUserName(name ?? 'Traveller');
      }
    });
  }, []);

  function handleCitySelect(selectedCity: string, geo?: GeoData) {
    dispatch({ type: 'SET_CITY', city: selectedCity });
    if (geo) dispatch({ type: 'SET_CITY_GEO', geo });
    setPendingCity(selectedCity);
    setShowCalendar(true);
  }

  function handleNearMe() {
    const todayIso = new Date().toISOString().split('T')[0];
    dispatch({ type: 'SET_TRAVEL_DATES', startDate: todayIso, endDate: todayIso });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleDateSelect(start: string, end: string) {
    dispatch({ type: 'SET_TRAVEL_DATES', startDate: start, endDate: end });
  }

  function handleCalendarClose() {
    setShowCalendar(false);
    setPendingCity(null);
    if (travelStartDate) dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleOpenMap(places: Place[]) {
    places.forEach(p => dispatch({ type: 'SET_PENDING_PLACE', place: p }));
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 20, background: 'var(--color-bg)' }}>
      <ExploreHero
        city={city || null}
        persona={persona}
        savedTripCity={savedTripCity}
        userName={userName}
      />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <ExploreSearchBar onCitySelect={handleCitySelect} onNearMe={handleNearMe} />
        <CuratedCityCards
          persona={persona}
          travelStartDate={travelStartDate}
          travelEndDate={travelEndDate}
          onCitySelect={handleCitySelect}
        />
        <RecentVisits session={session} onOpenMap={handleOpenMap} />
      </div>
      {showCalendar && (
        <DateRangeCalendar
          key={pendingCity ?? city}
          onSelect={handleDateSelect}
          onClose={handleCalendarClose}
        />
      )}
    </div>
  );
}
