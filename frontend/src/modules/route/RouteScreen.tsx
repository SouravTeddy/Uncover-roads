import { useState } from 'react';
import { useRoute } from './useRoute';
import { ItineraryView } from './ItineraryView';
import { RecSheet } from './RecSheet';
import { WeatherCanvas } from './WeatherCanvas';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary } from '../../shared/types';

export function RouteScreen() {
  const {
    loading,
    error,
    tab,
    setTab,
    itinerary,
    weather,
    city,
    selectedPlaces,
    savedItineraries,
    removeStop,
    saveItinerary,
    buildItinerary,
    goBack,
    goToNav,
  } = useRoute();

  const { dispatch } = useAppStore();
  const [showRecSheet, setShowRecSheet] = useState(false);

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {weather && <WeatherCanvas condition={weather.condition} />}

      {/* Weather badge */}
      {weather && (
        <div
          className="absolute flex items-center gap-2 px-3 py-2 rounded-full bg-surface/80 border border-white/8"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)',
            right: '1rem',
            backdropFilter: 'blur(8px)',
            zIndex: 5,
          }}
        >
          <span className="ms fill text-primary text-sm">wb_sunny</span>
          <span className="text-text-2 text-xs">{weather.condition}</span>
          <span className="text-text-1 text-xs font-bold">{weather.temp}°</span>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent border-none"
          >
            <span className="ms text-text-2 text-base">arrow_back</span>
          </button>
          <h1 className="font-heading font-bold text-text-1 text-lg">
            {city ? `${city} — ` : ''}Itinerary
          </h1>
        </div>
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center"
          onClick={() => {}}
        >
          <span className="ms text-text-2 text-base">share</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 flex-shrink-0">
        {(['active', 'saved'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              tab === t ? 'bg-primary text-white' : 'bg-surface text-text-2'
            }`}
          >
            {t === 'active' ? 'Active' : 'Saved'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {tab === 'active' && (
          <>
            {loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-4">
                <span className="ms text-primary text-4xl animate-spin">autorenew</span>
                <p className="text-text-2 text-sm">Building your journey…</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-4">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={buildItinerary}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && itinerary && (
              <ItineraryView
                stops={itinerary.itinerary}
                selectedPlaces={selectedPlaces}
                onRemove={removeStop}
                onAddMeal={() => {
                  dispatch({ type: 'SET_FILTER', filter: 'restaurant' });
                  dispatch({ type: 'GO_TO', screen: 'map' });
                }}
              />
            )}
          </>
        )}

        {tab === 'saved' && (
          <SavedList
            items={savedItineraries}
            onOpen={() => {}}
          />
        )}
      </div>

      {/* Footer */}
      {tab === 'active' && itinerary && !loading && (
        <div
          className="absolute inset-x-0 bottom-0 bg-bg/95 border-t border-white/8 px-4 py-3 flex gap-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <button
            onClick={() => setShowRecSheet(true)}
            className="flex-1 h-12 rounded-2xl bg-surface border border-white/10 text-text-2 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <span className="ms fill text-base">edit_location</span>
            Modify
          </button>
          <button
            onClick={saveItinerary}
            className="flex-1 h-12 rounded-2xl bg-surface border border-white/10 text-text-2 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <span className="ms fill text-base">bookmark</span>
            Save
          </button>
          <button
            onClick={goToNav}
            className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <span className="ms fill text-base">navigation</span>
            Start
          </button>
        </div>
      )}

      {showRecSheet && <RecSheet onClose={() => setShowRecSheet(false)} />}
    </div>
  );
}

function SavedList({
  items,
  onOpen,
}: {
  items: SavedItinerary[];
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <span className="ms text-5xl text-white/10">route</span>
        <p className="text-text-3 text-sm text-center leading-relaxed">
          No saved itineraries yet.
          <br />
          Build one and tap <strong className="text-text-2">Save</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onOpen(item.id)}
          className="w-full bg-surface rounded-2xl p-4 text-left border border-white/8"
        >
          <div className="font-heading font-bold text-text-1 text-sm">{item.city}</div>
          <div className="text-text-3 text-xs mt-1">
            {new Date(item.date).toLocaleDateString()} ·{' '}
            {item.itinerary.itinerary.length} stops
          </div>
        </button>
      ))}
    </div>
  );
}
