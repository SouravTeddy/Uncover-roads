import { useEffect, useRef, useState } from 'react';
import type { ReelRecoCard as ReelRecoCardType } from './types';
import { ReelImg } from './ReelImg';

interface Props {
  card: ReelRecoCardType;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
  onMapNavigate?: (lat: number, lon: number) => void;
}


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

export function ReelRecoCard({ card, active, archetype: _archetype, existingPlaceIds: _existing, onInteract, onMapNavigate }: Props) {
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.lunch;
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPhoto = !!card.anchorPhotoUrl;
  const [photoFailed, setPhotoFailed] = useState(false);

  const onInteractRef = useRef(onInteract);
  useEffect(() => { onInteractRef.current = onInteract; });

  // Only [active] in deps — onInteract is an inline function from the parent and would
  // change every render, causing an infinite dispatch loop via ADD_RECO_INTERACTION.
  useEffect(() => { if (active) onInteractRef.current?.('viewed'); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteractRef.current?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="reel-card" style={{ width: '100%', height: '100dvh', background: '#0f0d0c', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Photo / visual top half */}
      <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden' }}>
        {hasPhoto && !photoFailed
          ? <ReelImg
              src={card.anchorPhotoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
              onFallback={() => setPhotoFailed(true)}
            />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1714 0%, #0f0d0c 100%)' }} />
        }
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
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Browse on map CTA */}
        <button
          onClick={() => {
            onInteract?.('tapped');
            if (card.stopLat != null && card.stopLon != null) {
              onMapNavigate?.(card.stopLat, card.stopLon);
            }
          }}
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
