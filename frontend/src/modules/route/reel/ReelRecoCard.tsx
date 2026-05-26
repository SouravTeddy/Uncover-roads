import { useEffect, useRef } from 'react';
import { useReelRecommendations } from './useReelRecommendations';
import { useAppStore } from '../../../shared/store';
import type { ReelRecoCard } from './types';
import type { ReelRecoPlace } from '../../../shared/types';

interface Props {
  card: ReelRecoCard;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
}

const TRIGGER_CFG: Record<string, { icon: string; color: string; bg: string; chipLabel: string }> = {
  lunch:            { icon: 'restaurant',      color: '#c27c4a', bg: 'rgba(194,124,74,.1)',  chipLabel: 'Lunch window' },
  dinner:           { icon: 'dinner_dining',   color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Dinner window' },
  evening:          { icon: 'nightlight',      color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Evening' },
  culture:          { icon: 'museum',          color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Culture' },
  rest:             { icon: 'local_cafe',      color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Rest break' },
  weather:          { icon: 'wb_cloudy',       color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Weather alert' },
  closing_conflict: { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Timing conflict' },
  walking_gap:      { icon: 'directions_walk', color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Long walk' },
  // TODO (crowd_peak): implement trigger logic once Popular Times data is available on EngineItineraryStop
  crowd_peak:       { icon: 'groups',          color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Peak hours' },
  density_excess:   { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Packed day' },
  density_sparse:   { icon: 'explore',         color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Room to add' },
  geo_efficiency:   { icon: 'route',           color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Route' },
  time_balance:     { icon: 'balance',         color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Time balance' },
  category_diversity: { icon: 'grid_view',     color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Variety' },
  social_gap:       { icon: 'people',          color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Social' },
  budget_mismatch:  { icon: 'payments',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Budget' },
  live_event:       { icon: 'event',           color: '#c27c4a', bg: 'rgba(194,124,74,.1)',  chipLabel: 'Live event' },
  hidden_gem:       { icon: 'auto_awesome',    color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Hidden gem' },
};

const PRICE_DOTS: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

function PlaceRow({ place, idx, active, accentColor }: { place: ReelRecoPlace; idx: number; active: boolean; accentColor: string }) {
  const delay = `${0.55 + idx * 0.1}s`;
  const isFirst = idx === 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', borderRadius: 12,
      background: 'var(--color-surface)',
      border: isFirst ? `1.5px solid ${accentColor}47` : '1px solid var(--color-border)',
      opacity: active ? 1 : 0,
      transform: active ? 'translateY(0)' : 'translateY(8px)',
      transition: `opacity .4s ${delay} ease, transform .4s ${delay} ease`,
    }}>
      {/* Rank */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: isFirst ? `${accentColor}22` : 'var(--color-surface2)',
        border: isFirst ? `1px solid ${accentColor}55` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        color: isFirst ? accentColor : 'var(--color-text-3)',
        marginTop: 1,
      }}>
        {idx + 1}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {place.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {place.rating != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-2)' }}>
              <span className="ms fill" style={{ fontSize: 11, color: '#d4a853' }}>star</span>
              {place.rating}
            </span>
          )}
          {place.priceLevel != null && (
            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{PRICE_DOTS[place.priceLevel]}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
            {place.distanceM < 1000
              ? `${place.distanceM}m`
              : `${(place.distanceM / 1000).toFixed(1)}km`}
          </span>
        </div>
        {/* Match reasons */}
        {place.matchReasons.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {place.matchReasons.map(r => (
              <span key={r} style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 999,
                background: 'var(--color-primary-bg)',
                border: '1px solid var(--color-primary-glow)',
                color: 'var(--color-primary-text)',
              }}>{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Maps link */}
      <a
        href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--color-text-4)', flexShrink: 0, marginTop: 1 }}
        onClick={e => e.stopPropagation()}
      >
        <span className="ms" style={{ fontSize: 16 }}>open_in_new</span>
      </a>
    </div>
  );
}

export function ReelRecoCard({ card, active, archetype, existingPlaceIds, onInteract }: Props) {
  const { dispatch } = useAppStore();
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.lunch;
  const { places, loading } = useReelRecommendations(card, archetype, existingPlaceIds, active);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) onInteract?.('viewed');
  }, [active]);

  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]);

  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 22px 88px',
      overflow: 'hidden',
    }}>

      {/* Background glow */}
      <div style={{
        position: 'absolute', bottom: -40, right: -40,
        width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${cfg.bg} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Near-stop badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 12px', borderRadius: 10,
        background: 'rgba(56,189,248,.07)',
        border: '1px solid rgba(56,189,248,.16)',
        marginBottom: 14, alignSelf: 'flex-start',
        animation: active ? 'fadeUp .45s .05s both' : 'none',
      }}>
        <span className="ms" style={{ fontSize: 13, color: '#38bdf8' }}>near_me</span>
        <span style={{ fontSize: 11, color: 'rgba(56,189,248,.85)', fontWeight: 600 }}>Near {card.nearbyCity}</span>
      </div>

      {/* Trigger chip */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8,
        background: cfg.bg,
        border: `1px solid ${cfg.color}26`,
        marginBottom: 10, alignSelf: 'flex-start',
        animation: active ? 'fadeUp .45s .1s both' : 'none',
      }}>
        <span className="ms fill" style={{ fontSize: 13, color: cfg.color }}>{cfg.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: cfg.color }}>{cfg.chipLabel}</span>
      </div>

      {/* Headline */}
      <p style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 26, fontWeight: 600,
        color: 'var(--color-text-1)',
        lineHeight: 1.25, marginBottom: 6,
        animation: active ? 'fadeUp .45s .17s both' : 'none',
      }}>
        {card.label}
      </p>

      {/* Consequence — always visible, above place list */}
      <p style={{
        fontSize: 13, color: 'var(--color-text-2)',
        lineHeight: 1.6, marginBottom: 16,
        animation: active ? 'fadeUp .45s .24s both' : 'none',
      }}>
        {card.consequence}
      </p>

      {/* Loading shimmer */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 64, borderRadius: 12,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              opacity: 0.5 - i * 0.1,
              animation: 'pulse 1.6s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {/* Place recommendations */}
      {places.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {places.map((p, i) => (
            <PlaceRow key={p.placeId} place={p} idx={i} active={active} accentColor={cfg.color} />
          ))}
        </div>
      )}

      {/* Add to plan CTA */}
      <button
        onClick={() => {
          onInteract?.('added_to_plan');
          dispatch({ type: 'GO_TO', screen: 'map' });
        }}
        style={{
          marginTop: 8, padding: '8px 16px', borderRadius: 999,
          background: 'rgba(107,148,112,.18)', border: '1px solid rgba(107,148,112,.35)',
          color: '#6b9470', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          animation: active ? 'fadeUp .45s .5s both' : 'none',
        }}
      >
        <span className="ms" style={{ fontSize: 15 }}>add_circle</span>
        Add to plan
      </button>
    </div>
  );
}
