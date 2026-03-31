import { useState } from 'react';
import { useRoute } from './useRoute';
import { ItineraryView } from './ItineraryView';
import { RecSheet } from './RecSheet';
import { WeatherCanvas } from './WeatherCanvas';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary, Place } from '../../shared/types';

const START_TYPE_META: Record<string, { icon: string; label: string }> = {
  hotel:   { icon: 'meeting_room', label: 'Hotel' },
  airport: { icon: 'flight_land',  label: 'Airport' },
  pin:     { icon: 'place',        label: 'Drop Pin' },
  station: { icon: 'train',        label: 'Station' },
  airbnb:  { icon: 'home',         label: 'Airbnb' },
};

const WEATHER_ICONS: Record<string, string> = {
  sunny: 'wb_sunny', clear: 'wb_sunny',
  rain: 'water_drop', drizzle: 'water_drop',
  snow: 'ac_unit', cloud: 'cloud', overcast: 'cloud',
  fog: 'foggy', mist: 'foggy', thunder: 'thunderstorm', storm: 'thunderstorm',
};

function getWeatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (c.includes(key)) return icon;
  }
  return 'wb_sunny';
}

const HERO_HEIGHT = 220;

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

  const { state, dispatch } = useAppStore();
  const { tripContext, places } = state;
  const [showRecSheet, setShowRecSheet] = useState(false);

  const startMeta = START_TYPE_META[tripContext.startType] ?? START_TYPE_META.hotel;
  const locationLabel = tripContext.locationName || startMeta.label;

  const formattedDate = (() => {
    try {
      return new Date(tripContext.date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch {
      return tripContext.date;
    }
  })();

  function handleAddSuggestion(place: Place) {
    dispatch({ type: 'TOGGLE_PLACE', place });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {/* ── Hero: weather + city info ── */}
      <div className="relative flex-shrink-0" style={{ height: HERO_HEIGHT }}>
        {/* Weather canvas fills the hero */}
        {weather
          ? <WeatherCanvas condition={weather.condition} height={HERO_HEIGHT} />
          : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(160deg, rgba(30,58,138,.25) 0%, rgba(15,20,30,0) 100%)' }}
            />
          )
        }

        {/* Dark gradient at bottom so text is legible */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(10,14,20,.92) 0%, rgba(10,14,20,.4) 55%, transparent 100%)' }}
        />

        {/* Top row: back + share */}
        <div
          className="absolute left-0 right-0 flex items-center justify-between px-4"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
          >
            <span className="ms text-white/80 text-base">arrow_back</span>
          </button>
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
            onClick={() => {}}
          >
            <span className="ms text-white/80 text-base">share</span>
          </button>
        </div>

        {/* Bottom row: city + date chip + weather badge */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end justify-between">
          <div>
            <h1 className="font-heading font-bold text-white text-2xl leading-tight">
              {city || 'Itinerary'}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-white/50 text-xs">{formattedDate}</span>
              {/* Starting point chip */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/15"
                style={{ background: 'rgba(255,255,255,.08)' }}
              >
                <span className="ms fill text-teal-400" style={{ fontSize: 11 }}>{startMeta.icon}</span>
                <span className="text-white/70 text-[10px] font-medium">{locationLabel}</span>
                {tripContext.arrivalTime && (
                  <span className="text-white/40 text-[10px]">· {tripContext.arrivalTime}</span>
                )}
              </div>
            </div>
          </div>

          {/* Weather badge */}
          {weather && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 flex-shrink-0"
              style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)' }}
            >
              <span className="ms fill text-amber-400 text-sm">{getWeatherIcon(weather.condition)}</span>
              <span className="text-white font-bold text-sm">{weather.temp}°</span>
              <span className="text-white/50 text-xs hidden sm:inline">{weather.condition}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary chips (conflict + tips) ── */}
      {tab === 'active' && itinerary?.summary && !loading && (
        <SummaryChips summary={itinerary.summary} />
      )}

      {/* ── Tabs ── */}
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

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-28">
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
                allPlaces={places}
                tripContext={tripContext}
                summary={itinerary.summary}
                onRemove={removeStop}
                onAddMeal={() => {
                  dispatch({ type: 'SET_FILTER', filter: 'restaurant' });
                  dispatch({ type: 'GO_TO', screen: 'map' });
                }}
                onAddSuggestion={handleAddSuggestion}
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

      {/* ── Footer ── */}
      {tab === 'active' && itinerary && !loading && (
        <div
          className="absolute inset-x-0 bottom-0 border-t border-white/8 px-4 py-3 flex gap-3"
          style={{
            background: 'rgba(10,14,20,.95)',
            backdropFilter: 'blur(12px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          }}
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

// ── Summary chips ──────────────────────────────────────────────

interface SummaryProps {
  summary: { best_transport?: string; pro_tip?: string; conflict_notes?: string };
}

function SummaryChips({ summary }: SummaryProps) {
  const chips: { icon: string; text: string; color: string; bg: string }[] = [];

  if (summary.best_transport) {
    chips.push({
      icon: 'directions_transit',
      text: summary.best_transport,
      color: 'text-sky-400',
      bg: 'rgba(14,165,233,.12)',
    });
  }
  if (summary.pro_tip) {
    const tip = summary.pro_tip.length > 48
      ? summary.pro_tip.slice(0, 48) + '…'
      : summary.pro_tip;
    chips.push({
      icon: 'lightbulb',
      text: tip,
      color: 'text-amber-400',
      bg: 'rgba(251,191,36,.12)',
    });
  }
  if (summary.conflict_notes) {
    const note = summary.conflict_notes.length > 48
      ? summary.conflict_notes.slice(0, 48) + '…'
      : summary.conflict_notes;
    chips.push({
      icon: 'info',
      text: note,
      color: 'text-orange-400',
      bg: 'rgba(251,146,60,.12)',
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 pb-2 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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
    <div className="flex flex-col gap-3 pt-2 px-4">
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
