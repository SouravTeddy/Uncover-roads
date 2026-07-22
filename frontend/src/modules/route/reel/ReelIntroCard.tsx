import { useEffect, useRef } from 'react';
import type { ReelIntroCard as ReelIntroCardType } from './types';
import { ReelImg } from './ReelImg';
import {
  REEL_SCRIM, REEL_CONTENT_PADDING_INTRO,
  INTRO_CITY_FS, INTRO_CITY_MB,
  INTRO_TEXT_SHADOW,
  WEATHER_ICON,
} from './reel-constants';

interface Props {
  card: ReelIntroCardType;
  active: boolean;
  onShowTripDetails?: () => void;
  onInteract?: (action: 'viewed' | 'lingered') => void;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  tripTimingNote?: string | null;
}

const STYLE_TAG: Record<string, string> = {
  gastronaut:          'Food & local flavour',
  flaneur:             'Open-ended wandering',
  slowscholar:         'Culture & depth',
  neighbourhoodlocal:  'Off the tourist trail',
  efficientexplorer:   'Maximum coverage',
  aesthete:            'Design & beauty',
  nightcreature:       'Evening-first',
  ritualseeker:        'Slow & intentional',
};

function travelStyleTag(persona: string): string {
  const key = persona.toLowerCase().replace(/[\s_-]/g, '');
  return STYLE_TAG[key] ?? persona.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const TRIP_IDENTITY: Record<string, string> = {
  gastronaut:          'A food-first exploration',
  flaneur:             'An open-ended wander',
  slowscholar:         'A deep cultural immersion',
  neighbourhoodlocal:  'Off the tourist trail',
  efficientexplorer:   'Maximum ground covered',
  aesthete:            'A journey through design and beauty',
  nightcreature:       'An evening-first adventure',
  ritualseeker:        'A slow, intentional stay',
};

// Emoji → Material Symbol mapping for engine intel items
const INTEL_ICON: Record<string, string> = {
  '📍': 'reorder',
  '✨': 'add_circle',
  '🔄': 'swap_horiz',
  '⛅': 'wb_cloudy',
  '🗺️': 'route',
  '⏱️': 'schedule',
};

function tripIdentityLine(persona: string, city: string): string {
  const key = persona.toLowerCase().replace(/[\s_-]/g, '');
  const base = TRIP_IDENTITY[key] ?? 'An exploration';
  const primaryCity = city.includes(' · ') ? city.split(' · ')[0] : city;
  const cityStr = /\+\d+$/.test(primaryCity) ? `${primaryCity} cities` : primaryCity;
  return `${base} of ${cityStr}`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  if (start === end) return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (sameMonth) return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.getDate()}`;
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear ? { year: 'numeric' } : {}) })}`;
}

// Shared chip style — all metadata chips use this base
const CHIP: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 9px', borderRadius: 999,
  background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 13, fontWeight: 600,
  color: 'rgba(255,255,255,0.72)',
  fontFamily: 'var(--font-sans)',
  lineHeight: 1,
};

const DATE_CHIP: React.CSSProperties = {
  ...CHIP,
  background: 'rgba(212,168,83,0.14)',
  border: '1px solid rgba(212,168,83,0.28)',
  color: '#d4a853',
};

export function ReelIntroCard({ card, active, onShowTripDetails: _onShowTripDetails, onInteract, tripStartDate, tripEndDate, tripTimingNote }: Props) {
  const dateRange = tripStartDate && tripEndDate ? formatDateRange(tripStartDate, tripEndDate) : null;
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active, onInteract]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active, onInteract]);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#0c0c0e' }}>

      <ReelImg
        src={card.imageUrl}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'contrast(1.12) saturate(1.2)' }}
      />

      {/* Weather pill */}
      {card.weather?.temp != null && (
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 68px)', left: 13, zIndex: 11, ...CHIP, background: 'rgba(9,12,22,.82)' }}>
          <span className="ms fill" style={{ fontSize: 13, color: '#38bdf8' }}>{WEATHER_ICON[card.weather.condition?.toLowerCase() ?? ''] ?? 'wb_sunny'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)' }}>{card.weather.temp}°C</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font-sans)' }}>{card.weather.condition ?? ''}</span>
        </div>
      )}

      {/* Trip details button — hidden until feature is revisited
      <button
        onClick={onShowTripDetails}
        style={{ position: 'absolute', top: 48, right: 13, zIndex: 10, ...CHIP, padding: '10px 16px', cursor: 'pointer', background: 'rgba(212,168,83,.28)', border: '1px solid rgba(212,168,83,.75)', color: '#f5d060', fontSize: 15, fontWeight: 700, gap: 7, boxShadow: '0 2px 12px rgba(212,168,83,.25)' }}
      >
        <span className="ms fill" style={{ fontSize: 17, color: '#f5d060' }}>edit_calendar</span>
        Add trip details
      </button>
      */}

      {/* Gradient scrim */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* Soft overlay behind bottom text for readability */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 9,
        height: '55%', pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)',
      }} />

      {/* Content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: REEL_CONTENT_PADDING_INTRO }}>

        {/* City heading */}
        {(() => {
          const cities = card.city.split(' · ');
          if (cities.length > 1) {
            return (
              <div style={{ marginBottom: INTRO_CITY_MB }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {cities.map((c, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1, textShadow: INTRO_TEXT_SHADOW }}>{c}</span>
                      {i < cities.length - 1 && (
                        <span className="ms" style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>arrow_forward</span>
                      )}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {card.totalDays}-day multi-city trip
                </span>
              </div>
            );
          }
          return (
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: INTRO_CITY_FS, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: INTRO_CITY_MB, textShadow: INTRO_TEXT_SHADOW }}>
              {card.city}
            </h1>
          );
        })()}

        {/* Trip identity */}
        <p style={{
          fontFamily: 'var(--font-heading)',
          fontStyle: 'italic',
          fontSize: 18,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.62)',
          lineHeight: 1.35,
          marginBottom: 12,
          textShadow: '0 1px 6px rgba(0,0,0,0.6)',
        }}>
          {tripIdentityLine(card.persona, card.city)}
        </p>

        {/* Trip timing note — arrival/departure context (Scenario B/C) */}
        {tripTimingNote && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, padding: '6px 10px', borderRadius: 8, background: 'rgba(212,168,83,.10)', border: '1px solid rgba(212,168,83,.22)' }}>
            <span className="ms fill" style={{ fontSize: 13, color: 'rgba(212,168,83,.8)', flexShrink: 0 }}>info</span>
            <span style={{ fontSize: 13, color: 'rgba(255,235,180,.82)', lineHeight: 1.35, fontFamily: 'var(--font-sans)' }}>{tripTimingNote}</span>
          </div>
        )}

        {/* Metadata chips — all same base style */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {dateRange && (
            <span style={DATE_CHIP}>
              <span className="ms fill" style={{ fontSize: 15 }}>calendar_month</span>
              {dateRange}
            </span>
          )}
          <span style={CHIP}>
            <span className="ms fill" style={{ fontSize: 15 }}>place</span>
            {card.totalStops} {card.totalStops === 1 ? 'stop' : 'stops'}{(card.totalRecos ?? 0) > 0 ? ` · ${card.totalRecos} picks` : ''}
          </span>
          {card.totalDistanceKm > 0 && (
            <span style={CHIP}>
              <span className="ms fill" style={{ fontSize: 15 }}>directions_transit</span>
              {card.totalDistanceKm} km
            </span>
          )}
          <span style={{ ...CHIP, background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.25)', color: '#c9a14a' }}>
            <span className="ms fill" style={{ fontSize: 15 }}>auto_awesome</span>
            {travelStyleTag(card.persona)}
          </span>
        </div>

        {/* Engine intel items — compact, Material Symbols, DM Sans */}
        {card.intelItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
            {card.intelItems.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="ms fill" style={{ fontSize: 15, color: 'rgba(212,168,83,0.7)', flexShrink: 0 }}>
                  {INTEL_ICON[item.icon] ?? 'info'}
                </span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.35 }}>
                  <strong style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600 }}>{item.count} {item.label}</strong>
                  {' '}{item.detail}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <span className="ms" style={{ fontSize: 19, color: 'rgba(255,255,255,.18)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
