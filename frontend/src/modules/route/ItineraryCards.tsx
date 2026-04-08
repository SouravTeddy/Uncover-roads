import { useState, useRef, useEffect, useCallback } from 'react';
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
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // IntersectionObserver drives scene changes + active dot
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.cardIdx);
          setActiveCard(idx);
          setExpandedStop(null); // collapse on scroll

          // Resolve scene for this card
          if (idx === 0) {
            // Intro — time of day scene
            onSceneChange('');
          } else if (idx <= timeline.length) {
            const { stop, startMins: sMins, matchedCategory } = timeline[idx - 1];
            onSceneChange(resolveScene({
              stopName: stop.place ?? '',
              timeMins: sMins,
              category: matchedCategory,
              weather: weather ?? null,
            }));
          } else {
            // Finale
            onSceneChange('');
          }
        }
      },
      { root, threshold: 0.55 }
    );
    cardRefs.current.forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline.length, weather]);

  const setCardRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    cardRefs.current[idx] = el;
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
        } as React.CSSProperties}
      >
        {/* Intro card */}
        <div
          ref={el => setCardRef(el, 0)}
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
              ref={el => setCardRef(el, cardIdx)}
              data-card-idx={String(cardIdx)}
              style={cardStyle}
            >
              <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENT }} />
              <StopCard
                item={item}
                total={timeline.length}
                persona={persona}
                isExpanded={expandedStop === i}
                onTap={() => setExpandedStop(expandedStop === i ? null : i)}
                onRemove={() => onRemove(item.index)}
                onAddMeal={onAddMeal}
              />
              {/* Transit strip between cards */}
              {i < timeline.length - 1 && item.stop.transit_to_next && (
                <TransitStrip transit={item.stop.transit_to_next} />
              )}
            </div>
          );
        })}

        {/* Finale card */}
        <div
          ref={el => setCardRef(el, totalCards - 1)}
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
  isExpanded,
  onTap,
  onRemove,
  onAddMeal,
}: {
  item: StopWithTime;
  total: number;
  persona?: Persona | null;
  isExpanded: boolean;
  onTap: () => void;
  onRemove: () => void;
  onAddMeal: () => void;
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
      onClick={onTap}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Collapsed content */}
      <div
        style={{
          padding: `0 24px calc(env(safe-area-inset-bottom, 0px) + ${isExpanded ? 20 : 72}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          transition: 'padding-bottom 0.35s ease',
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

        {/* Quick bits row — category, transit, persona tag */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categoryPill && (
            <QuickPill icon={categoryPill.icon} label={categoryPill.label} />
          )}
          {stop.transit_to_next && !isExpanded && (
            <QuickPill icon="directions_walk" label={stop.transit_to_next} />
          )}
          {firstTag && (
            <QuickPill icon={firstTag.icon} label={firstTag.label} color={firstTag.color} />
          )}
          {matchNote && (
            <QuickPill icon="auto_awesome" label={matchNote} color="#60a5fa" />
          )}
        </div>

        {/* Tip — 2 lines collapsed, full expanded */}
        {tip && (
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            lineHeight: 1.55,
            margin: 0,
            fontStyle: 'italic',
            display: '-webkit-box',
            WebkitLineClamp: isExpanded ? undefined : 2,
            WebkitBoxOrient: isExpanded ? undefined : 'vertical',
            overflow: isExpanded ? 'visible' : 'hidden',
            transition: 'all 0.35s ease',
          }}>
            {tip}
          </p>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <ExpandedDetails
            stop={stop}
            onRemove={onRemove}
            onAddMeal={onAddMeal}
          />
        )}

        {/* Tap hint when not expanded */}
        {!isExpanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>Tap for details</span>
            <span className="ms" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>keyboard_arrow_up</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ExpandedDetails ──────────────────────────────────────────────

function ExpandedDetails({
  stop,
  onRemove,
  onAddMeal,
}: {
  stop: ItineraryStop;
  onRemove: () => void;
  onAddMeal: () => void;
}) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Tags */}
      {stop.tags && stop.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {stop.tags.map(tag => (
            <span
              key={tag}
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 99,
                padding: '3px 10px',
                color: 'rgba(255,255,255,0.55)',
                fontSize: 11,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Transit to next */}
      {stop.transit_to_next && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="ms fill" style={{ color: 'rgba(56,189,248,0.7)', fontSize: 14 }}>directions</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>Then: {stop.transit_to_next}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={onAddMeal}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <span className="ms fill" style={{ fontSize: 14 }}>restaurant</span>
          Add meal
        </button>
        <button
          onClick={onRemove}
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.08)',
            color: 'rgba(239,68,68,0.7)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span className="ms fill" style={{ fontSize: 14 }}>remove_circle</span>
          Remove
        </button>
      </div>
    </div>
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
