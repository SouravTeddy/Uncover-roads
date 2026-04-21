import { useState } from 'react';
import { useRoute } from './useRoute';
import { ItineraryCards } from './ItineraryCards';
import { RecSheet } from './RecSheet';
import { WeatherCanvas } from './WeatherCanvas';
import { AmbientVideo } from './AmbientVideo';
import { DayShimmer } from './DayShimmer';
import { DayStops } from './DayStops';
import { SCENE_GENERATING } from './sceneMap';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary } from '../../shared/types';
import { addDaysToIso } from '../map/trip-capacity-utils';
import { ORIGIN_STRINGS } from '../../shared/strings';


export function RouteScreen() {
  const {
    loading,
    error,
    tab,
    setTab,
    itinerary,
    itineraryDays,
    totalDays,
    streamingDays,
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

  const { state, dispatch } = useAppStore();
  const { tripContext, persona } = state;

  // True when the user chose "not decided" — no origin leg in journey
  const hasOrigin = (state.journey ?? []).length > 0 && state.journey![0].type === 'origin';
  const [showRecSheet, setShowRecSheet] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentScene, setCurrentScene] = useState(() =>
    loading ? SCENE_GENERATING : ''
  );

  function handleSave() {
    saveItinerary();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }


  // Loading / error screens rendered over the ambient bg
  if (loading) {
    return (
      <>
        <AmbientVideo src={SCENE_GENERATING} timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()} />
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ zIndex: 25 }}>
          <span className="ms text-primary text-4xl animate-spin">autorenew</span>
          <p className="text-text-2 text-sm">Building your journey…</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AmbientVideo src="" timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()} />
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ zIndex: 25 }}>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => buildItinerary()}
            className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  // Saved itineraries view (not the reel)
  if (tab === 'saved') {
    return (
      <>
        <AmbientVideo src={currentScene} timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()} />
        <div className="fixed inset-0 flex flex-col" style={{ zIndex: 25 }}>
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 border-b border-white/6"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
              paddingBottom: '1rem',
              background: 'rgba(10,14,20,0.82)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <button
              onClick={() => setTab('active')}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,.07)' }}
            >
              <span className="ms text-text-2 text-base">arrow_back</span>
            </button>
            <h1 className="font-heading font-bold text-text-1 text-base">Saved Trips</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10 pt-2">
            <SavedList items={savedItineraries} onOpen={() => {}} />
          </div>
        </div>
      </>
    );
  }

  // Multi-day view — totalDays > 1 OR itineraryDays already has content
  if (totalDays > 1 || itineraryDays.length > 1) {
    const startIso = state.travelStartDate ?? state.tripContext.date;
    const displayDays = Math.max(totalDays, itineraryDays.length);
    return (
      <>
        <AmbientVideo src={currentScene} timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()} />
        <div
          className="fixed inset-0 overflow-y-auto"
          style={{ zIndex: 25, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0 20px 16px',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
              background: 'rgba(10,14,20,0.82)',
              backdropFilter: 'blur(16px)',
              position: 'sticky', top: 0, zIndex: 10,
              borderBottom: '1px solid rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <button
              onClick={goBack}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span className="ms" style={{ fontSize: 18, color: '#94a3b8' }}>arrow_back</span>
            </button>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase', color: '#3b82f6',
                fontFamily: 'Inter, sans-serif', marginBottom: 2,
              }}>
                Your trip
              </div>
              <div style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: 18, fontWeight: 800, color: '#f1f5f9',
              }}>
                {city} · {displayDays} days
                {streamingDays && (
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>
                    building…
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* No-origin nudge */}
          {!hasOrigin && (
            <div style={{ padding: '16px 16px 0' }}>
              <button
                onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(59,130,246,.08)',
                  border: '1px solid rgba(59,130,246,.2)',
                  borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                  marginBottom: 12,
                }}
              >
                <span className="ms" style={{ fontSize: 16, color: '#3b82f6', flexShrink: 0 }}>add_location</span>
                <span style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                  {ORIGIN_STRINGS.itineraryNudge}
                </span>
              </button>
            </div>
          )}

          {/* Day slots */}
          {Array.from({ length: displayDays }, (_, i) => {
            const day = itineraryDays[i];
            const dayDate = addDaysToIso(startIso, i);
            const dayLabel = new Date(dayDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            });
            return (
              <div key={i} style={{ padding: '0 16px' }}>
                {/* Day divider */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  margin: '24px 0 16px',
                }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                  <div style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 13, fontWeight: 700, color: '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}>
                    Day {i + 1} · {dayLabel}
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                </div>

                {/* Slot content */}
                {day === undefined ? (
                  <DayShimmer />
                ) : day === null ? (
                  <div style={{
                    textAlign: 'center', padding: '20px 0', color: '#8e9099',
                    fontFamily: 'Inter, sans-serif', fontSize: 12,
                  }}>
                    Could not load this day
                  </div>
                ) : (
                  <DayStops stops={day.itinerary} />
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // Main reel — itinerary exists
  if (itinerary) {
    return (
      <>
        <AmbientVideo src={currentScene} timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()} />
        {/* No-origin nudge overlay */}
        {!hasOrigin && (
          <div
            style={{
              position: 'fixed',
              top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
              left: 16, right: 16,
              zIndex: 35,
            }}
          >
            <button
              onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(59,130,246,.08)',
                border: '1px solid rgba(59,130,246,.2)',
                borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="ms" style={{ fontSize: 16, color: '#3b82f6', flexShrink: 0 }}>add_location</span>
              <span style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                {ORIGIN_STRINGS.itineraryNudge}
              </span>
            </button>
          </div>
        )}
        {weather && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }}>
            <WeatherCanvas condition={weather.condition} />
          </div>
        )}
        <ItineraryCards
          stops={itinerary.itinerary}
          selectedPlaces={selectedPlaces}
          tripContext={tripContext}
          summary={itinerary.summary}
          persona={persona}
          weather={weather}
          city={city ?? itinerary.city}
          onRemove={removeStop}
          onSceneChange={setCurrentScene}
          onSave={handleSave}
          saved={saved}
          onGoBack={goBack}
          onGoToNav={goToNav}
          onViewSaved={() => setTab('saved')}
        />
        {showRecSheet && <RecSheet onClose={() => setShowRecSheet(false)} />}
        {/* Edit stops FAB */}
        <button
          onClick={() => setShowRecSheet(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            left: 20,
            zIndex: 30,
            width: 48,
            height: 48,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(10px)',
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="ms fill" style={{ fontSize: 20 }}>edit_location</span>
        </button>
      </>
    );
  }

  return null;
}


// ── Saved list ─────────────────────────────────────────────────

function SavedList({ items, onOpen }: { items: SavedItinerary[]; onOpen: (id: string) => void }) {
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
            {new Date(item.date).toLocaleDateString()} · {item.itinerary.itinerary.length} stops
          </div>
        </button>
      ))}
    </div>
  );
}
