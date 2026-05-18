import { useEffect, useState, useCallback } from 'react';
import type { Place, GeoData } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import { api } from '../../shared/api';
import { useLastSession } from './useLastSession';
import { useSheetDismiss } from '../../shared/useSheetDismiss';
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
    if (geo) {
      dispatch({ type: 'SET_CITY_GEO', geo });
    } else {
      // Curated card tap — geocode in parallel while calendar shows
      api.geocode(selectedCity)
        .then(result => dispatch({ type: 'SET_CITY_GEO', geo: result }))
        .catch(() => {}); // map screen handles missing geo gracefully
    }
    setPendingCity(selectedCity);
    setShowCalendar(true);
  }

  function handleDateSelect(start: string, end: string) {
    dispatch({ type: 'SET_TRAVEL_DATES', startDate: start, endDate: end });
  }

  // Done button inside the calendar — navigate to map
  const handleCalendarDone = useCallback(() => {
    setShowCalendar(false);
    setPendingCity(null);
    dispatch({ type: 'GO_TO', screen: 'map' });
  }, [dispatch]);

  // Backdrop tap or hardware back — just close, don't navigate
  const handleCalendarDismiss = useCallback(() => {
    setShowCalendar(false);
    setPendingCity(null);
  }, []);

  useSheetDismiss(handleCalendarDismiss, showCalendar);

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

      {!showCalendar && (
        <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>
          <ExploreSearchBar onCitySelect={handleCitySelect} />
          <RecentVisits session={session} onOpenMap={handleOpenMap} />
          <CuratedCityCards
            persona={persona}
            travelStartDate={travelStartDate}
            travelEndDate={travelEndDate}
            onCitySelect={handleCitySelect}
          />
        </div>
      )}

      {showCalendar && (
        <>
          {/* Backdrop — dismiss only, do not navigate */}
          <div
            onClick={handleCalendarDismiss}
            style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'rgba(0,0,0,0.01)' }}
          />
          <div
            className="flex-1 overflow-y-auto"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)',
              scrollbarWidth: 'none',
              animation: 'slideUp 0.3s ease forwards',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <DateRangeCalendar
              key={pendingCity ?? city}
              city={pendingCity ?? city}
              onSelect={handleDateSelect}
            />
          </div>

          {/* Done CTA — fixed above bottom nav, appears once both dates are picked */}
          {travelStartDate && travelEndDate && (
            <div
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
                zIndex: 2,
                padding: '10px 16px',
                background: 'var(--color-bg)',
                borderTop: '1px solid var(--color-divider)',
              }}
            >
              <button
                onClick={handleCalendarDone}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                Go to map
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
