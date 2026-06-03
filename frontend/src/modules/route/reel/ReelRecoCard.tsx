import { useEffect, useRef } from 'react';
import { useReelRecommendations } from './useReelRecommendations';
import type { ReelRecoCard as ReelRecoCardType } from './types';
import type { ReelRecoPlace } from '../../../shared/types';

interface Props {
  card: ReelRecoCardType;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
}

const TRIGGER_CATEGORY: Partial<Record<string, string>> = {
  lunch:             'restaurant',
  dinner:            'restaurant',
  culture:           'museum',
  rest:              'cafe',
  evening:           'nightlife',
  social_gap:        'bar',
  hidden_gem:        'point_of_interest',
  category_diversity:'attraction',
  weather:           'indoor_attraction',
};

const TRIGGER_CFG: Record<string, { icon: string; color: string; bg: string; chipLabel: string }> = {
  lunch:             { icon: 'restaurant',      color: '#c27c4a', bg: 'rgba(194,124,74,.1)',  chipLabel: 'Lunch window' },
  dinner:            { icon: 'dinner_dining',   color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Dinner window' },
  evening:           { icon: 'nightlight',      color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Evening' },
  culture:           { icon: 'museum',          color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Culture' },
  rest:              { icon: 'local_cafe',      color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Rest break' },
  weather:           { icon: 'wb_cloudy',       color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Weather alert' },
  closing_conflict:  { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Timing conflict' },
  walking_gap:       { icon: 'directions_walk', color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Long walk' },
  crowd_peak:        { icon: 'groups',          color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Peak hours' },
  density_excess:    { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Packed day' },
  density_sparse:    { icon: 'explore',         color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Room to add' },
  geo_efficiency:    { icon: 'route',           color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Route' },
  time_balance:      { icon: 'balance',         color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Time balance' },
  category_diversity:{ icon: 'grid_view',       color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Variety' },
  social_gap:        { icon: 'people',          color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Social' },
  budget_mismatch:   { icon: 'payments',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Budget' },
  live_event:        { icon: 'event',           color: '#c27c4a', bg: 'rgba(194,124,74,.1)',  chipLabel: 'Live event' },
  hidden_gem:        { icon: 'auto_awesome',    color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Hidden gem' },
};

const PRICE_DOTS: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

function PlaceRow({ place, idx, active, accentColor }: { place: ReelRecoPlace; idx: number; active: boolean; accentColor: string }) {
  const delay = `${0.55 + idx * 0.1}s`;
  const isFirst = idx === 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: isFirst ? '11px 12px' : '10px 12px',
      borderRadius: 11,
      background: 'rgba(255,255,255,0.04)',
      border: isFirst ? `1.5px solid ${accentColor}28` : '1px solid rgba(255,255,255,0.07)',
      opacity: active ? 1 : 0,
      transform: active ? 'translateY(0)' : 'translateY(8px)',
      transition: `opacity .4s ${delay} ease, transform .4s ${delay} ease`,
    }}>
      {/* Rank */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: isFirst ? `${accentColor}22` : 'rgba(255,255,255,0.06)',
        border: isFirst ? `1px solid ${accentColor}55` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        color: isFirst ? accentColor : '#a09880',
        marginTop: 1,
      }}>
        {idx + 1}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#f5f0ea', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {place.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {place.rating != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#a09880' }}>
              <span className="ms fill" style={{ fontSize: 10, color: '#d4a853' }}>star</span>
              {place.rating}
            </span>
          )}
          {place.priceLevel != null && (
            <span style={{ fontSize: 10, color: '#5a5248' }}>{PRICE_DOTS[place.priceLevel]}</span>
          )}
          <span style={{ fontSize: 10, color: '#5a5248' }}>
            {place.distanceM < 1000 ? `${place.distanceM}m` : `${(place.distanceM / 1000).toFixed(1)}km`}
          </span>
        </div>
        {place.matchReasons.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
            {place.matchReasons.map(r => (
              <span key={r} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.25)', color: '#d4a853' }}>{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Maps link */}
      <a href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#5a5248', flexShrink: 0, marginTop: 1 }} onClick={e => e.stopPropagation()}>
        <span className="ms" style={{ fontSize: 15, color: '#5a5248' }}>map</span>
      </a>
    </div>
  );
}

export function ReelRecoCard({ card, active, archetype, existingPlaceIds, onInteract }: Props) {
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.lunch;
  const { places, loading, error } = useReelRecommendations(card, archetype, existingPlaceIds, active, TRIGGER_CATEGORY[card.trigger]);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPhoto = !!card.anchorPhotoUrl;

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
    <div className="reel-card" style={{ width: '100%', height: '100dvh', background: '#0f0d0c', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Photo / visual top half */}
      <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden' }}>
        {hasPhoto ? (
          <img
            src={card.anchorPhotoUrl!}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1714 0%, #0f0d0c 100%)' }} />
        )}
        {/* Scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,13,12,0.1) 0%, rgba(15,13,12,0.9) 100%)', pointerEvents: 'none' }} />

        {/* Trigger chip */}
        <div style={{
          position: 'absolute', top: 20, left: 20,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', borderRadius: 999,
          background: cfg.bg, border: `1px solid ${cfg.color}26`,
          opacity: active ? 1 : 0,
          transition: 'opacity .4s .05s ease',
        }}>
          <span className="ms fill" style={{ fontSize: 12, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: cfg.color }}>{cfg.chipLabel}</span>
        </div>

        {/* Label overlay at bottom of photo */}
        <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24 }}>
          <div style={{ color: '#a09880', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Nearby</div>
          <div style={{
            color: '#f5f0ea', fontSize: 22,
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity .45s .17s ease, transform .45s .17s ease',
          }}>
            {card.label}
          </div>
        </div>
      </div>

      {/* Info bottom half */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 20px 28px', gap: 12, overflowY: 'auto' }}>

        {/* Consequence */}
        <div style={{
          color: '#a09880', fontSize: 13, lineHeight: 1.5,
          opacity: active ? 1 : 0,
          transition: 'opacity .45s .24s ease',
        }}>
          {card.consequence || `Explore ${card.label.toLowerCase()} near ${card.nearbyCity}`}
        </div>

        {/* Loading shimmer */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 56, borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', opacity: 0.5 - i * 0.1, animation: 'pulse 1.6s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div style={{ padding: '14px 12px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 11, color: '#a09880', textAlign: 'center', margin: 0 }}>
              Couldn't load nearby spots — check your connection.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && places.length === 0 && (
          <div style={{ padding: '14px 12px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 11, color: '#a09880', textAlign: 'center', margin: 0 }}>
              No nearby spots found for this.
            </p>
          </div>
        )}

        {/* Place recommendations */}
        {places.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {places.map((p, i) => (
              <PlaceRow key={p.placeId} place={p} idx={i} active={active} accentColor={cfg.color} />
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Browse on map CTA */}
        <button
          onClick={() => onInteract?.('tapped')}
          style={{
            background: 'rgba(212,168,83,0.15)',
            border: '1px solid rgba(212,168,83,0.5)',
            borderRadius: 8,
            padding: '14px 20px',
            color: '#d4a853',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
          }}
        >
          Browse on map →
        </button>

        <div style={{ color: '#5a5248', fontSize: 11, textAlign: 'center', letterSpacing: '0.08em' }}>
          Near {card.nearbyCity}
        </div>
      </div>
    </div>
  );
}
