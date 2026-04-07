import { useState } from 'react';
import { useRoute } from './useRoute';
import { ItineraryView } from './ItineraryView';
import { RecSheet } from './RecSheet';
import { WeatherCanvas } from './WeatherCanvas';
import { AmbientVideo } from './AmbientVideo';
import { SCENE_GENERATING } from './sceneMap';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary, Place, ItineraryStop } from '../../shared/types';

const WEATHER_ICONS: Record<string, string> = {
  sunny: 'wb_sunny', clear: 'wb_sunny',
  rain: 'water_drop', drizzle: 'water_drop',
  snow: 'ac_unit',
  cloud: 'cloud', overcast: 'cloud',
  fog: 'foggy', mist: 'foggy',
  thunder: 'thunderstorm', storm: 'thunderstorm',
};

function getWeatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (c.includes(key)) return icon;
  }
  return 'wb_sunny';
}

function downloadICS(stops: ItineraryStop[], date: string, city: string): void {
  function toICSDateTime(dateStr: string, timeStr?: string): string {
    const parts = dateStr.split('-');
    const y = parts[0]; const m = parts[1]; const d = parts[2];
    let h = 9, min = 0;
    if (timeStr) {
      const m12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const m24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (m12) {
        h = parseInt(m12[1]); min = parseInt(m12[2]);
        if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0;
      } else if (m24) { h = parseInt(m24[1]); min = parseInt(m24[2]); }
    }
    return `${y}${m}${d}T${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}00`;
  }

  function parseDurMins(s?: string): number {
    if (!s) return 60;
    const hm = s.match(/(\d+\.?\d*)\s*h/i);
    const mm = s.match(/(\d+)\s*min/i);
    return (hm ? parseFloat(hm[1]) * 60 : 0) + (mm ? parseInt(mm[1]) : 0) || 60;
  }

  function addMinsDT(dtStr: string, mins: number): string {
    const yr = parseInt(dtStr.slice(0, 4));
    const mo = parseInt(dtStr.slice(4, 6)) - 1;
    const dy = parseInt(dtStr.slice(6, 8));
    const hr = parseInt(dtStr.slice(9, 11));
    const mn = parseInt(dtStr.slice(11, 13));
    const dt = new Date(yr, mo, dy, hr, mn + mins);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`;
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uncover Roads//EN',
    'CALSCALE:GREGORIAN',
  ];

  stops.forEach((stop, i) => {
    const dtStart = toICSDateTime(date, stop.time);
    const dtEnd   = addMinsDT(dtStart, parseDurMins(stop.duration));
    const desc    = (stop.tip ?? '').replace(/[\\;,]/g, ' ');
    lines.push(
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${stop.place}`,
      ...(desc ? [`DESCRIPTION:${desc}`] : []),
      `LOCATION:${city}`,
      `UID:stop-${i}-${date}@uncover-roads`,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${city.replace(/\s+/g, '-')}-itinerary.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

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
    addSuggestion,
    goBack,
    goToNav,
  } = useRoute();

  const { state, dispatch } = useAppStore();
  const { tripContext, places, persona } = state;
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

  function handleAddSuggestion(place: Place) {
    addSuggestion(place);
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 20, background: 'transparent' }}>

      {/* ── Ambient scene video (fullscreen, behind everything) ── */}
      <AmbientVideo
        src={currentScene}
        timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()}
      />

      {/* ── Weather particle layer (above video, below content) ── */}
      {weather && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
          <WeatherCanvas condition={weather.condition} />
        </div>
      )}

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b border-white/6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: '1rem',
          position: 'relative',
          zIndex: 2,
          background: 'rgba(10,14,20,0.72)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,.07)' }}
          >
            <span className="ms text-text-2 text-base">arrow_back</span>
          </button>
          <h1 className="font-heading font-bold text-text-1 text-base truncate">
            {city ? `Your ${city} Journey` : 'Itinerary'}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Weather badge */}
          {weather && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-white/10"
              style={{ background: 'rgba(255,255,255,.07)' }}
            >
              <span className="ms fill text-sky-300 text-sm">{getWeatherIcon(weather.condition)}</span>
              <span className="text-text-2 text-xs">{weather.condition}</span>
              <span className="text-text-1 text-xs font-bold">{weather.temp}°</span>
            </div>
          )}
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,.07)' }}
            title="Export to Calendar"
            onClick={() => {
              if (itinerary && tripContext.date && city) {
                downloadICS(itinerary.itinerary, tripContext.date, city);
              }
            }}
          >
            <span className="ms text-text-2 text-sm">share</span>
          </button>
        </div>
      </div>

      {/* ── Summary chips (transport / tip / conflict) ── */}
      {tab === 'active' && itinerary?.summary && !loading && (
        <SummaryChips summary={itinerary.summary} />
      )}

      {/* ── Tabs ── */}
      <div
        className="flex gap-1 px-4 py-3 flex-shrink-0"
        style={{ position: 'relative', zIndex: 2, background: 'rgba(10,14,20,0.55)', backdropFilter: 'blur(12px)' }}
      >
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

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-28" style={{ position: 'relative', zIndex: 2 }}>
        {tab === 'active' && (
          <>
            {loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-4" ref={_ => { if (SCENE_GENERATING) setCurrentScene(SCENE_GENERATING); }}>
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
                allPlaces={places}
                tripContext={tripContext}
                summary={itinerary.summary}
                persona={persona}
                weather={weather}
                city={city ?? itinerary.city}
                onRemove={removeStop}
                onAddMeal={() => {
                  dispatch({ type: 'SET_FILTER', filter: 'restaurant' });
                  dispatch({ type: 'GO_TO', screen: 'map' });
                }}
                onAddSuggestion={handleAddSuggestion}
                onSceneChange={setCurrentScene}
              />
            )}
          </>
        )}

        {tab === 'saved' && (
          <SavedList items={savedItineraries} onOpen={() => {}} />
        )}
      </div>

      {/* ── Footer ── */}
      {tab === 'active' && itinerary && !loading && (
        <div
          className="absolute inset-x-0 bottom-0 border-t border-white/8 px-4 py-3 flex gap-3"
          style={{
            background: 'rgba(10,14,20,.95)',
            backdropFilter: 'blur(12px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
            zIndex: 2,
          }}
        >
          <button
            onClick={() => setShowRecSheet(true)}
            className="w-11 h-12 rounded-2xl bg-surface border border-white/10 text-text-2 flex items-center justify-center flex-shrink-0"
          >
            <span className="ms fill text-base">edit_location</span>
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              saved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-surface border border-white/15 text-text-1'
            }`}
          >
            <span className="ms fill text-base">{saved ? 'check_circle' : 'bookmark_add'}</span>
            {saved ? 'Saved!' : 'Save Trip'}
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

// ── Summary chips ──────────────────────────────────────────────

interface SummaryProps {
  summary: { best_transport?: string; pro_tip?: string; conflict_notes?: string };
}

function SummaryChips({ summary }: SummaryProps) {
  const chips: { icon: string; text: string; color: string; bg: string }[] = [];

  if (summary.best_transport) {
    chips.push({ icon: 'directions_transit', text: summary.best_transport,        color: 'text-sky-400',    bg: 'rgba(14,165,233,.12)' });
  }
  if (summary.pro_tip) {
    const tip = summary.pro_tip.length > 52 ? summary.pro_tip.slice(0, 52) + '…' : summary.pro_tip;
    chips.push({ icon: 'lightbulb',          text: tip,                             color: 'text-amber-400',  bg: 'rgba(251,191,36,.12)' });
  }
  if (summary.conflict_notes) {
    const note = summary.conflict_notes.length > 52 ? summary.conflict_notes.slice(0, 52) + '…' : summary.conflict_notes;
    chips.push({ icon: 'info',               text: note,                            color: 'text-orange-400', bg: 'rgba(251,146,60,.12)' });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="flex gap-2 px-4 pb-2 flex-shrink-0 overflow-x-auto"
      style={{ scrollbarWidth: 'none', position: 'relative', zIndex: 1 }}
    >
      {chips.map((chip, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 border border-white/8"
          style={{ background: chip.bg }}
        >
          <span className={`ms fill ${chip.color} text-sm`}>{chip.icon}</span>
          <span className="text-text-2 text-xs">{chip.text}</span>
        </div>
      ))}
    </div>
  );
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
