import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { ItineraryStop, Place, WeatherData, ReferencePin } from '../../shared/types';
import { WeatherCanvas } from './WeatherCanvas';
import { ShimmerBlock } from '../../shared/Shimmer';
import { computePersonaBadges, usePersonaInsight } from '../map/pincard-persona';
import type { Persona, PersonaProfile } from '../../shared/types';
import { Button } from '../../shared/ui/Button';

interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  weather?: WeatherData | null;
  referencePins: ReferencePin[];
  travelDate: string;
  onStopChange: (idx: number) => void;
  persona?: Persona | null;
  personaProfile?: PersonaProfile | null;
  insightCache?: MutableRefObject<Map<string, string>>;
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export function ItineraryPlaceCard({
  stops, selectedPlaces, weather, referencePins, onStopChange,
  persona, personaProfile, insightCache,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const touchStartX = useRef(0);

  const stop = stops[activeIdx] ?? null;

  useEffect(() => {
    onStopChange(activeIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= stops.length) return;
    setActiveIdx(idx);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      goTo(activeIdx + (dx < 0 ? 1 : -1));
    }
  };

  const refPin = referencePins.find(rp =>
    rp.title.toLowerCase() === (stop?.place ?? '').toLowerCase()
  ) ?? null;

  const matchedPlace = selectedPlaces.find(p =>
    p.title.toLowerCase() === (stop?.place ?? '').toLowerCase()
  ) ?? null;

  const personaBadges = (matchedPlace && persona && personaProfile != null)
    ? computePersonaBadges(matchedPlace, persona, personaProfile, 'itinerary')
    : [];

  const fallbackCache = useRef(new Map<string, string>());
  const activeCache = insightCache ?? fallbackCache;
  const { insight, loading: insightLoading } = usePersonaInsight(
    matchedPlace ?? { id: `stop-${activeIdx}`, title: stop?.place ?? '', category: 'place', lat: 0, lon: 0 },
    persona ?? null,
    'itinerary',
    activeCache,
  );

  if (!stop) {
    return (
      <div style={{
        height: '100%', background: '#0f1420',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: '0.85rem',
      }}>
        No stops planned yet
      </div>
    );
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative', height: '100%', overflow: 'hidden' }}
      className="bg-[var(--color-bg)]"
    >
      {weather && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <WeatherCanvas condition={weather.condition} />
        </div>
      )}

      <div
        style={{
          position: 'relative', zIndex: 1,
          height: '100%', overflowY: 'auto',
          padding: '16px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        {/* Card container with entry animation */}
        <div
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 [box-shadow:var(--shadow-md)]"
          style={{ animation: 'springUp 0.4s ease both' }}
        >
        {/* Pagination dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 14,
        }}>
          {stops.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIdx ? 20 : 6,
                height: 6, borderRadius: 3,
                background: i === activeIdx ? 'var(--color-primary)' : 'rgba(255,255,255,.2)',
                border: 'none', padding: 0, cursor: 'pointer',
                transition: 'width 0.2s ease, background 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* Stop number + time badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="text-[11px] text-[var(--color-primary)] font-semibold bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
            Stop {activeIdx + 1} of {stops.length}{stop.time ? ` · ${stop.time}` : ''}
          </span>
        </div>

        {/* Place name */}
        <h3 className="font-[family-name:var(--font-heading)] text-[var(--color-text-1)] text-[17px] font-semibold mt-2">
          {stop.place}
        </h3>

        {/* Category + duration chips row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, marginTop: 8,
        }}>
          {matchedPlace?.category && (
            <span className="text-[11px] bg-[var(--color-surface2)] text-[var(--color-text-2)] px-2 py-0.5 rounded-full">
              {matchedPlace.category}
            </span>
          )}
          {stop.duration && (
            <span className="text-[11px] bg-[var(--color-surface2)] text-[var(--color-text-2)] px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="ms" style={{ fontSize: 12 }}>schedule</span>
              {stop.duration}
            </span>
          )}
          {matchedPlace?.price_level != null && matchedPlace.price_level > 0 && (
            <span className="text-[11px] bg-[var(--color-surface2)] text-[var(--color-text-2)] px-2 py-0.5 rounded-full">
              {PRICE[matchedPlace.price_level]}
            </span>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 14 }} />

        {/* Tip / intel pill */}
        {stop.tip && (
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(251,191,36,.07)',
            border: '1px solid rgba(251,191,36,.15)',
            marginBottom: 14,
            fontSize: '0.75rem', color: '#fbbf24', lineHeight: 1.5,
          }}>
            ⚡ {stop.tip}
          </div>
        )}

        {/* Persona badges */}
        {personaBadges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {personaBadges.map((badge) => (
              <div key={badge.text} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 999,
                fontSize: '0.68rem', fontWeight: 700,
                color: badge.color,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
              }}>
                {badge.text}
              </div>
            ))}
          </div>
        )}

        {/* Why this for you — itinerary mode: 2-3 sentences */}
        {(insightLoading || insight || refPin?.whyRec || matchedPlace?.reason) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: '#6366f1', marginBottom: 5,
            }}>
              Why this for you
            </div>
            {insightLoading ? (
              <ShimmerBlock lines={2} />
            ) : (
              <div style={{
                fontSize: '0.82rem', color: 'rgba(193,198,215,.8)',
                lineHeight: 1.55, fontStyle: 'italic',
              }}>
                {insight ?? refPin?.whyRec ?? matchedPlace?.reason}
              </div>
            )}
          </div>
        )}

        {/* Local tip */}
        {refPin?.localTip && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(251,191,36,.07)',
            border: '1px solid rgba(251,191,36,.15)',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
              Local tip
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(193,198,215,.8)', lineHeight: 1.5 }}>
              {refPin.localTip}
            </div>
          </div>
        )}

        {/* Transit to next */}
        {stop.transit_to_next && (
          <div style={{ marginBottom: 14 }}>
            <span className="text-[11px] bg-[var(--color-sky-bg)] text-[var(--color-sky)] border border-[var(--color-sky-bdr)] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <span className="ms" style={{ fontSize: 12 }}>directions_transit</span>
              {stop.transit_to_next}
            </span>
          </div>
        )}

        {/* CTA */}
        <Button variant="primary" className="w-full mt-4">Start navigating</Button>

        </div>{/* end card container */}

        {/* Nav arrows */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12,
        }}>
          <button
            onClick={() => goTo(activeIdx - 1)}
            disabled={activeIdx === 0}
            style={{
              flex: 1, padding: '10px 0',
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12, color: '#94a3b8',
              fontSize: '0.78rem', fontWeight: 600, cursor: activeIdx > 0 ? 'pointer' : 'not-allowed',
              opacity: activeIdx === 0 ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <span className="ms" style={{ fontSize: 16 }}>chevron_left</span>
            Prev
          </button>
          <button
            onClick={() => goTo(activeIdx + 1)}
            disabled={activeIdx === stops.length - 1}
            style={{
              flex: 1, padding: '10px 0',
              background: activeIdx < stops.length - 1 ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.05)',
              border: activeIdx < stops.length - 1 ? '1px solid rgba(99,102,241,.3)' : '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              color: activeIdx < stops.length - 1 ? '#a5b4fc' : '#94a3b8',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: activeIdx < stops.length - 1 ? 'pointer' : 'not-allowed',
              opacity: activeIdx === stops.length - 1 ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            Next
            <span className="ms" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
