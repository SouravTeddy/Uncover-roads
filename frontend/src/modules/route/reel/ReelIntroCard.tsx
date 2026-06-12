import { useEffect, useRef } from 'react';
import type { ReelIntroCard as ReelIntroCardType } from './types';
import { ReelImg } from './ReelImg';
import {
  REEL_SCRIM, REEL_CONTENT_PADDING_INTRO,
  INTRO_CITY_FS, INTRO_CITY_MB, INTRO_PILL_GAP, INTRO_PILL_MB,
  INTRO_TEXT_SHADOW,
  WEATHER_ICON,
} from './reel-constants';

interface Props {
  card: ReelIntroCardType;
  active: boolean;
  onShowTripDetails?: () => void;
  onInteract?: (action: 'viewed' | 'lingered') => void;
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

function tripIdentityLine(persona: string, city: string): string {
  const key = persona.toLowerCase().replace(/[\s_-]/g, '');
  const base = TRIP_IDENTITY[key] ?? 'An exploration';
  const primaryCity = city.includes(' · ') ? city.split(' · ')[0] : city;
  return `${base} of ${primaryCity}`;
}

export function ReelIntroCard({ card, active, onShowTripDetails, onInteract }: Props) {
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

      {/* City photo — shimmer while city photo API is in-flight, fades in when resolved */}
      <ReelImg
        src={card.imageUrl}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'contrast(1.12) saturate(1.2)' }}
      />

      {/* Weather pill — only render when temp is actually available */}
      {card.weather?.temp != null && (
        <div style={{ position: 'absolute', top: 48, left: 13, zIndex: 11, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: 'rgba(9,12,22,.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.1)' }}>
          <span className="ms fill" style={{ fontSize: 12, color: '#38bdf8' }}>{WEATHER_ICON[card.weather.condition?.toLowerCase() ?? ''] ?? 'wb_sunny'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{card.weather.temp}°</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.55)' }}>{card.weather.condition ?? ''}</span>
        </div>
      )}

      {/* Trip details button z-index:10 — top:48px right:13px per mock */}
      <button
        onClick={onShowTripDetails}
        style={{ position: 'absolute', top: 48, right: 13, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 999, background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.18)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.82)', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span className="ms" style={{ fontSize: 13 }}>edit_calendar</span>
        Add trip details
      </button>

      {/* GRADIENT scrim — dark bottom for text, clear top for photo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* Content z-index:10 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: REEL_CONTENT_PADDING_INTRO }}>
        {(() => {
          const cities = card.city.split(' · ');
          if (cities.length > 1) {
            return (
              <div style={{ marginBottom: INTRO_CITY_MB }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {cities.map((c, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1, textShadow: INTRO_TEXT_SHADOW }}>{c}</span>
                      {i < cities.length - 1 && (
                        <span className="ms" style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>arrow_forward</span>
                      )}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: 17,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.72)',
          lineHeight: 1.35,
          marginBottom: 10,
          textShadow: '0 1px 6px rgba(0,0,0,0.6)',
        }}>
          {tripIdentityLine(card.persona, card.city)}
        </p>

        {/* Info pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: INTRO_PILL_GAP, marginBottom: INTRO_PILL_MB }}>
          <span className="pill pg">
            <span className="ms fill" style={{ fontSize: 11 }}>place</span>
            {card.totalStops} {card.totalStops === 1 ? 'stop' : 'stops'}
          </span>
          {card.totalDistanceKm > 0 && (
            <span className="pill pg">
              <span className="ms fill" style={{ fontSize: 11 }}>directions_transit</span>
              {card.totalDistanceKm} km
            </span>
          )}
        </div>

        {/* Travel style tag */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(212,168,83,0.4)',
            color: '#d4a853', backdropFilter: 'blur(8px)',
          }}>
            Optimised for · {travelStyleTag(card.persona)}
          </span>
        </div>

        {/* Intel items */}
        {card.intelItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {card.intelItems.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                  <span style={{ color: '#d4a853', fontWeight: 700 }}>{item.count} {item.label}</span>
                  {' '}{item.detail}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Neighborhood pills */}
        {card.neighborhoods?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {card.neighborhoods.slice(0, 4).map((n, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(6px)' }}>
                {n}
              </span>
            ))}
          </div>
        )}


        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.2)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
