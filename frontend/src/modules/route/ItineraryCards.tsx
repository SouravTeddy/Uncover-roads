import { useState, useRef, useEffect } from 'react';
import type { ItineraryStop, Place, TripContext, Persona, WeatherData, ItinerarySummary } from '../../shared/types';
import { resolveScene } from './sceneMap';
import {
  parseTimeLabel,
  buildTimeline,
  personaMatchNote,
  type StopWithTime,
} from './ItineraryView';

// ── Constants ────────────────────────────────────────────────────

const CARD_GRADIENT =
  'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.38) 60%, rgba(0,0,0,0.82) 78%, rgba(0,0,0,0.95) 100%)';

// ── Types ────────────────────────────────────────────────────────

interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  allPlaces: Place[];
  tripContext: TripContext;
  summary?: ItinerarySummary;
  persona?: Persona | null;
  weather?: WeatherData | null;
  city?: string;
  onRemove: (idx: number) => void;
  onAddMeal: () => void;
  onAddSuggestion: (place: Place) => void;
  onSceneChange: (src: string) => void;
  onSave: () => void;
  saved: boolean;
  onGoBack: () => void;
  onGoToNav: () => void;
  onViewSaved: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────

function startMinsFromContext(tc: TripContext): number {
  const t = tc.arrivalTime ?? '9:00';
  const [h, m] = t.split(':').map(Number);
  return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
}

// ── Main component ───────────────────────────────────────────────

export function ItineraryCards({
  stops,
  selectedPlaces,
  tripContext,
  summary,
  persona,
  weather,
  city,
  onRemove,
  onAddMeal,
  onSceneChange,
  onSave,
  saved,
  onGoBack,
  onGoToNav,
  onViewSaved,
}: Props) {
  const startMins = startMinsFromContext(tripContext);
  const timeline = buildTimeline(stops, startMins, selectedPlaces);
  const totalCards = 1 + timeline.length + 1; // intro + stops + finale
  const [activeCard, setActiveCard] = useState(0);
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Store timeline + weather in refs so scroll handler never goes stale
  const timelineRef = useRef(timeline);
  const weatherRef  = useRef(weather);
  useEffect(() => { timelineRef.current = timeline; }, [timeline]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  // Scroll-based scene tracker — fires only when snap settles on a new card
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    let lastIdx = -1;

    const update = () => {
      const cardH = root.clientHeight;
      if (!cardH) return;
      const idx = Math.round(root.scrollTop / cardH);
      if (idx === lastIdx) return;
      lastIdx = idx;
      setActiveCard(idx);
      setExpandedStop(null);

      const tl = timelineRef.current;
      const wx = weatherRef.current;
      if (idx === 0 || idx > tl.length) {
        onSceneChange('');
      } else {
        const { stop, startMins: sMins, matchedCategory } = tl[idx - 1];
        onSceneChange(resolveScene({
          stopName: stop.place ?? '',
          timeMins: sMins,
          category: matchedCategory,
          weather: wx ?? null,
        }));
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    // Fire once on mount so the intro card sets the right scene
    update();
    return () => {
      root.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle: React.CSSProperties = {
    height: '100dvh',
    flexShrink: 0,
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <>
      {/* Scroll container */}
      <div
        ref={scrollRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 25,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
        } as React.CSSProperties}
      >
        {/* Intro card */}
        <div
          data-card-idx="0"
          style={cardStyle}
        >
          <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENT }} />
          <IntroCard
            city={city}
            tripContext={tripContext}
            stops={stops}
            summary={summary}
            weather={weather}
            persona={persona}
          />
        </div>

        {/* Stop cards */}
        {timeline.map((item, i) => {
          const cardIdx = i + 1;
          return (
            <div
              key={i}
              data-card-idx={String(cardIdx)}
              style={cardStyle}
            >
              <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENT }} />
              <StopCard
                item={item}
                total={timeline.length}
                persona={persona}
                onExpand={() => setExpandedStop(i)}
              />
              {/* Transit strip */}
              {i < timeline.length - 1 && item.stop.transit_to_next && (
                <TransitStrip transit={item.stop.transit_to_next} />
              )}
            </div>
          );
        })}

        {/* Finale card */}
        <div
          data-card-idx={String(totalCards - 1)}
          style={cardStyle}
        >
          <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENT }} />
          <FinaleCard
            city={city}
            stops={stops}
            onSave={onSave}
            saved={saved}
            onGoToNav={onGoToNav}
            onViewSaved={onViewSaved}
          />
        </div>
      </div>

      {/* Expanded stop bottom sheet — outside scroll container so it never clips */}
      {expandedStop !== null && timeline[expandedStop] && (
        <ExpandedSheet
          stop={timeline[expandedStop].stop}
          onClose={() => setExpandedStop(null)}
          onRemove={() => { onRemove(timeline[expandedStop!].index); setExpandedStop(null); }}
          onAddMeal={onAddMeal}
        />
      )}

      {/* Floating header — always on top */}
      <FloatingHeader
        weather={weather}
        onGoBack={onGoBack}
      />

      {/* Progress dots */}
      <ProgressDots total={totalCards} active={activeCard} />
    </>
  );
}

// ── IntroCard ────────────────────────────────────────────────────

function IntroCard({
  city, tripContext, stops, summary, weather, persona,
}: {
  city?: string;
  tripContext: TripContext;
  stops: ItineraryStop[];
  summary?: ItinerarySummary;
  weather?: WeatherData | null;
  persona?: Persona | null;
}) {
  const dayLabel = tripContext.days && tripContext.days > 1
    ? `Day ${tripContext.dayNumber ?? 1} of ${tripContext.days}`
    : 'Your day';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 80px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Day label */}
      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {dayLabel}
      </span>

      {/* City name */}
      <h1 style={{ color: '#fff', fontSize: 42, fontWeight: 900, lineHeight: 1.05, margin: 0, fontFamily: 'var(--font-heading, inherit)' }}>
        {city ?? 'Your Journey'}
      </h1>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill icon="pin_drop" label={`${stops.length} stops`} />
        {weather && <Pill icon="wb_sunny" label={`${weather.temp}° · ${weather.condition}`} />}
        {persona && <Pill icon="person" label={persona.archetype_name ?? persona.archetype} />}
        {summary?.best_transport && <Pill icon="directions_transit" label={summary.best_transport} />}
      </div>

      {/* Narrative / pro tip */}
      {summary?.pro_tip && (
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>
          {summary.pro_tip}
        </p>
      )}

      {/* Swipe hint */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Swipe to explore</span>
        <span className="ms" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 20, animation: 'bounce 1.8s infinite' }}>expand_more</span>
      </div>
    </div>
  );
}

// ── StopCard ─────────────────────────────────────────────────────

const CATEGORY_PILL: Record<string, { icon: string; label: string }> = {
  museum:     { icon: 'museum',        label: 'Museum' },
  historic:   { icon: 'account_balance', label: 'Historic' },
  restaurant: { icon: 'restaurant',   label: 'Restaurant' },
  cafe:       { icon: 'local_cafe',   label: 'Café' },
  park:       { icon: 'park',         label: 'Park' },
  tourism:    { icon: 'photo_camera', label: 'Sightseeing' },
  place:      { icon: 'location_on',  label: 'Place' },
};

const TAG_PILL: Record<string, { icon: string; label: string; color: string }> = {
  heat:     { icon: 'thermometer',  label: 'Beat the heat', color: '#fbbf24' },
  jetlag:   { icon: 'flight',       label: 'Jet lag tip',   color: '#818cf8' },
  ramadan:  { icon: 'nights_stay',  label: 'Ramadan',       color: '#c084fc' },
  altitude: { icon: 'landscape',    label: 'Altitude',      color: '#2dd4bf' },
};

function StopCard({
  item,
  total,
  persona,
  onExpand,
}: {
  item: StopWithTime;
  total: number;
  persona?: Persona | null;
  onExpand: () => void;
}) {
  const { stop, index, startMins, matchedCategory } = item;
  const timeLabel = parseTimeLabel(startMins);
  const durationLabel = stop.duration ?? '';
  const matchNote = personaMatchNote(persona?.archetype, matchedCategory);
  const tip = stop.tip ?? '';
  const categoryPill = matchedCategory ? CATEGORY_PILL[matchedCategory] : null;
  const tags = stop.tags ?? [];
  const firstTag = tags.length > 0 ? TAG_PILL[tags[0]] : null;

  return (
    <div
      onClick={onExpand}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        cursor: 'pointer',
        userSelect: 'none',
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 72px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Stop counter */}
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Stop {index + 1} of {total}
      </span>

      {/* Time · duration */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>{timeLabel}</span>
        {durationLabel && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{durationLabel}</span>
          </>
        )}
      </div>

      {/* Place name */}
      <h2 style={{ color: '#fff', fontSize: 32, fontWeight: 900, lineHeight: 1.1, margin: 0, fontFamily: 'var(--font-heading, inherit)' }}>
        {stop.place}
      </h2>

      {/* Quick bits row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {categoryPill && <QuickPill icon={categoryPill.icon} label={categoryPill.label} />}
        {stop.transit_to_next && <QuickPill icon="directions_walk" label={stop.transit_to_next} />}
        {firstTag && <QuickPill icon={firstTag.icon} label={firstTag.label} color={firstTag.color} />}
        {matchNote && <QuickPill icon="auto_awesome" label={matchNote} color="#60a5fa" />}
      </div>

      {/* Tip — always 2 lines max on the card */}
      {tip && (
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          lineHeight: 1.55,
          margin: 0,
          fontStyle: 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {tip}
        </p>
      )}

      {/* Tap hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>Tap for details</span>
        <span className="ms" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>keyboard_arrow_up</span>
      </div>
    </div>
  );
}

// ── ExpandedSheet — fixed bottom sheet, outside scroll container ──

function ExpandedSheet({
  stop,
  onClose,
  onRemove,
  onAddMeal,
}: {
  stop: ItineraryStop;
  onClose: () => void;
  onRemove: () => void;
  onAddMeal: () => void;
}) {
  return (
    <>
      {/* Dim backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 34,
          background: 'rgba(0,0,0,0.4)',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 35,
          background: 'rgba(10,14,20,0.97)',
          backdropFilter: 'blur(24px)',
          borderRadius: '22px 22px 0 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          padding: '16px 24px calc(env(safe-area-inset-bottom, 0px) + 28px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', alignSelf: 'center' }} />

        {/* Place name + close */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.2, flex: 1 }}>
            {stop.place}
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: 'none', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="ms" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Full tip */}
        {stop.tip && (
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {stop.tip}
          </p>
        )}

        {/* Transit to next */}
        {stop.transit_to_next && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)' }}>
            <span className="ms fill" style={{ color: '#38bdf8', fontSize: 16 }}>directions</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Then: {stop.transit_to_next}</span>
          </div>
        )}

        {/* Tags */}
        {stop.tags && stop.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {stop.tags.map(tag => (
              <QuickPill key={tag} icon="label" label={tag} />
            ))}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={onAddMeal}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span className="ms fill" style={{ fontSize: 15 }}>restaurant</span>
            Add meal nearby
          </button>
          <button
            onClick={onRemove}
            style={{
              padding: '13px 18px', borderRadius: 16,
              border: '1px solid rgba(239,68,68,0.22)',
              background: 'rgba(239,68,68,0.08)',
              color: 'rgba(239,68,68,0.8)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span className="ms fill" style={{ fontSize: 15 }}>remove_circle</span>
            Remove
          </button>
        </div>
      </div>
    </>
  );
}

// ── TransitStrip ─────────────────────────────────────────────────

function TransitStrip({ transit }: { transit: string }) {
  const mins = transit.match(/(\d+)\s*min/i)?.[1];
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 99,
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
        marginBottom: 8,
        pointerEvents: 'none',
      }}
    >
      <span className="ms fill" style={{ color: 'rgba(56,189,248,0.85)', fontSize: 14 }}>directions_walk</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{transit}{mins ? '' : ''}</span>
    </div>
  );
}

// ── FinaleCard ───────────────────────────────────────────────────

function FinaleCard({
  city, stops, onSave, saved, onGoToNav, onViewSaved,
}: {
  city?: string;
  stops: ItineraryStop[];
  onSave: () => void;
  saved: boolean;
  onGoToNav: () => void;
  onViewSaved: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 40px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <span className="ms fill" style={{ color: '#facc15', fontSize: 48 }}>star</span>
      <h2 style={{ color: '#fff', fontSize: 30, fontWeight: 900, margin: 0, fontFamily: 'var(--font-heading, inherit)' }}>
        {city ? `${city}, done right.` : 'Day complete.'}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
        {stops.length} stops · curated just for you
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
        <button
          onClick={onGoToNav}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: 18,
            background: 'var(--color-primary, #6c63ff)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span className="ms fill" style={{ fontSize: 18 }}>navigation</span>
          Start navigating
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onSave}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 16,
              border: `1px solid ${saved ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.12)'}`,
              background: saved ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.06)',
              color: saved ? '#4ade80' : 'rgba(255,255,255,0.75)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.3s',
            }}
          >
            <span className="ms fill" style={{ fontSize: 16 }}>{saved ? 'check_circle' : 'bookmark_add'}</span>
            {saved ? 'Saved!' : 'Save trip'}
          </button>

          <button
            onClick={onViewSaved}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span className="ms fill" style={{ fontSize: 16 }}>folder_open</span>
            Saved trips
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FloatingHeader ───────────────────────────────────────────────

function FloatingHeader({
  weather, onGoBack,
}: {
  weather?: WeatherData | null;
  onGoBack: () => void;
}) {
  const WEATHER_ICONS: Record<string, string> = {
    sunny: 'wb_sunny', clear: 'wb_sunny',
    rain: 'water_drop', drizzle: 'water_drop',
    snow: 'ac_unit', cloud: 'cloud', overcast: 'cloud',
    fog: 'foggy', mist: 'foggy', thunder: 'thunderstorm', storm: 'thunderstorm',
  };
  function getWeatherIcon(c: string) {
    const lc = c.toLowerCase();
    for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
      if (lc.includes(key)) return icon;
    }
    return 'wb_sunny';
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
        pointerEvents: 'none',
      }}
    >
      <button
        onClick={onGoBack}
        style={{
          pointerEvents: 'auto',
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.38)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span className="ms" style={{ fontSize: 18 }}>arrow_back</span>
      </button>

      {weather && (
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 99,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span className="ms fill" style={{ color: '#7dd3fc', fontSize: 14 }}>{getWeatherIcon(weather.condition)}</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{weather.condition}</span>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{weather.temp}°</span>
        </div>
      )}
    </div>
  );
}

// ── ProgressDots ─────────────────────────────────────────────────

function ProgressDots({ total, active }: { total: number; active: number }) {
  // Cap at 9 visible dots to avoid overflow on long itineraries
  const maxDots = 9;
  const clipped = Math.min(total, maxDots);

  return (
    <div
      style={{
        position: 'fixed',
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        pointerEvents: 'none',
      }}
    >
      {Array.from({ length: clipped }).map((_, i) => {
        const isActive = i === Math.min(active, clipped - 1);
        return (
          <div
            key={i}
            style={{
              width: isActive ? 6 : 4,
              height: isActive ? 18 : 4,
              borderRadius: 99,
              background: isActive ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.3s ease',
            }}
          />
        );
      })}
    </div>
  );
}

// ── QuickPill (per-stop compact tag) ────────────────────────────

function QuickPill({ icon, label, color }: { icon: string; label: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 99,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(6px)',
        flexShrink: 0,
      }}
    >
      <span className="ms fill" style={{ color: color ?? 'rgba(255,255,255,0.5)', fontSize: 12 }}>{icon}</span>
      <span style={{ color: color ?? 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ── Pill (intro card) ─────────────────────────────────────────────

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        borderRadius: 99,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.07)',
      }}
    >
      <span className="ms fill" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{icon}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500 }}>{label}</span>
    </div>
  );
}
