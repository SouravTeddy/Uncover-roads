import { useEffect, useRef, useState } from 'react';
import type { ReelRecoCard as ReelRecoCardType } from './types';
import type { Place } from '../../../shared/types';
import { api } from '../../../shared/api';

interface Props {
  card: ReelRecoCardType;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
  onMapNavigate?: (lat: number, lon: number, places: Place[]) => void;
}

const TRIGGER_CFG: Record<string, { icon: string; color: string; bg: string; border: string; chipLabel: string; searchCategory: string }> = {
  lunch:             { icon: 'restaurant',      color: '#c27c4a', bg: 'rgba(194,124,74,.08)',  border: 'rgba(194,124,74,.2)',  chipLabel: 'Lunch window',    searchCategory: 'restaurant' },
  dinner:            { icon: 'dinner_dining',   color: '#7c6f9f', bg: 'rgba(124,111,159,.08)', border: 'rgba(124,111,159,.2)', chipLabel: 'Dinner window',   searchCategory: 'restaurant' },
  evening:           { icon: 'nightlight',      color: '#7c6f9f', bg: 'rgba(124,111,159,.08)', border: 'rgba(124,111,159,.2)', chipLabel: 'Evening',         searchCategory: 'bar' },
  culture:           { icon: 'museum',          color: '#8b9e6a', bg: 'rgba(139,158,106,.08)', border: 'rgba(139,158,106,.2)', chipLabel: 'Culture',         searchCategory: 'museum' },
  rest:              { icon: 'local_cafe',      color: '#d4a853', bg: 'rgba(212,168,83,.08)',  border: 'rgba(212,168,83,.2)',  chipLabel: 'Rest break',      searchCategory: 'cafe' },
  weather:           { icon: 'wb_cloudy',       color: '#4f8fab', bg: 'rgba(79,143,171,.08)',  border: 'rgba(79,143,171,.2)',  chipLabel: 'Weather alert',   searchCategory: '' },
  closing_conflict:  { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.08)',  border: 'rgba(212,168,83,.2)',  chipLabel: 'Timing conflict', searchCategory: '' },
  walking_gap:       { icon: 'directions_walk', color: '#8b9e6a', bg: 'rgba(139,158,106,.08)', border: 'rgba(139,158,106,.2)', chipLabel: 'Long walk',       searchCategory: '' },
  crowd_peak:        { icon: 'groups',          color: '#4f8fab', bg: 'rgba(79,143,171,.08)',  border: 'rgba(79,143,171,.2)',  chipLabel: 'Peak hours',      searchCategory: '' },
  density_excess:    { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.08)',  border: 'rgba(212,168,83,.2)',  chipLabel: 'Packed day',      searchCategory: '' },
  density_sparse:    { icon: 'explore',         color: '#8b9e6a', bg: 'rgba(139,158,106,.08)', border: 'rgba(139,158,106,.2)', chipLabel: 'Room to add',     searchCategory: '' },
  geo_efficiency:    { icon: 'route',           color: '#4f8fab', bg: 'rgba(79,143,171,.08)',  border: 'rgba(79,143,171,.2)',  chipLabel: 'Route',           searchCategory: '' },
  time_balance:      { icon: 'balance',         color: '#7c6f9f', bg: 'rgba(124,111,159,.08)', border: 'rgba(124,111,159,.2)', chipLabel: 'Time balance',    searchCategory: '' },
  category_diversity:{ icon: 'grid_view',       color: '#8b9e6a', bg: 'rgba(139,158,106,.08)', border: 'rgba(139,158,106,.2)', chipLabel: 'Variety',         searchCategory: '' },
  social_gap:        { icon: 'people',          color: '#4f8fab', bg: 'rgba(79,143,171,.08)',  border: 'rgba(79,143,171,.2)',  chipLabel: 'Social',          searchCategory: '' },
  budget_mismatch:   { icon: 'payments',        color: '#d4a853', bg: 'rgba(212,168,83,.08)',  border: 'rgba(212,168,83,.2)',  chipLabel: 'Budget',          searchCategory: '' },
  live_event:        { icon: 'event',           color: '#c27c4a', bg: 'rgba(194,124,74,.08)',  border: 'rgba(194,124,74,.2)',  chipLabel: 'Live event',      searchCategory: '' },
  hidden_gem:        { icon: 'auto_awesome',    color: '#8b9e6a', bg: 'rgba(139,158,106,.08)', border: 'rgba(139,158,106,.2)', chipLabel: 'Hidden gem',      searchCategory: '' },
};

export function ReelRecoCard({ card, active, archetype: _archetype, existingPlaceIds: _existing, onInteract, onMapNavigate }: Props) {
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.lunch;
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInteractRef = useRef(onInteract);
  useEffect(() => { onInteractRef.current = onInteract; });

  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);

  // Pre-fetch nearby places when card becomes active so Browse on Map is instant
  useEffect(() => {
    if (!active || !cfg.searchCategory || card.stopLat == null || card.stopLon == null) return;
    if (nearbyPlaces.length > 0) return;
    (api as unknown as Record<string, (opts: { lat: number; lon: number; category: string; limit: number }) => Promise<Place[]>>).nearbyPlaces?.({ lat: card.stopLat, lon: card.stopLon, category: cfg.searchCategory, limit: 8 })
      ?.then(places => { if (places?.length) setNearbyPlaces(places); })
      ?.catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => { if (active) onInteractRef.current?.('viewed'); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteractRef.current?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasBrowse = card.stopLat != null && card.stopLon != null;
  const canBrowse = hasBrowse && !!onMapNavigate;

  return (
    <div
      className="reel-card"
      style={{
        width: '100%', height: '100dvh',
        background: '#0f0d0c',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
        overflow: 'hidden',
      }}
    >
      {/* Large trigger icon */}
      <div
        style={{
          width: 72, height: 72, borderRadius: 20,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(0.88)',
          transition: 'opacity .4s ease, transform .4s ease',
        }}
      >
        <span className="ms fill" style={{ fontSize: 30, color: cfg.color }}>{cfg.icon}</span>
      </div>

      {/* Chip label */}
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 999,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          marginBottom: 16,
          opacity: active ? 1 : 0,
          transition: 'opacity .4s .06s ease',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: cfg.color }}>{cfg.chipLabel}</span>
      </div>

      {/* Main label */}
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 24, fontWeight: 600,
          color: 'var(--color-text-1)',
          lineHeight: 1.2, textAlign: 'center',
          margin: 0, marginBottom: 12,
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity .45s .12s ease, transform .45s .12s ease',
        }}
      >
        {card.label}
      </p>

      {/* Consequence */}
      <p
        style={{
          fontSize: 13, color: 'var(--color-text-3)',
          lineHeight: 1.55, textAlign: 'center',
          margin: 0, marginBottom: 36,
          maxWidth: 280,
          opacity: active ? 1 : 0,
          transition: 'opacity .45s .2s ease',
        }}
      >
        {card.consequence || `Explore options near ${card.nearbyCity}`}
      </p>

      {/* Browse CTA */}
      {canBrowse && (
        <button
          onClick={() => {
            onInteract?.('tapped');
            onMapNavigate(card.stopLat!, card.stopLon!, nearbyPlaces);
          }}
          style={{
            width: '100%', maxWidth: 320,
            padding: '14px 20px',
            borderRadius: 10,
            background: 'rgba(212,168,83,0.12)',
            border: '1px solid rgba(212,168,83,0.35)',
            color: 'var(--color-primary)',
            fontSize: 14, fontWeight: 600,
            letterSpacing: '.03em',
            cursor: 'pointer',
            textAlign: 'center',
            opacity: active ? 1 : 0,
            transition: 'opacity .45s .28s ease',
          }}
        >
          Browse nearby on map →
        </button>
      )}

      {card.nearbyCity && (
        <p style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 12, letterSpacing: '.06em', opacity: active ? 0.7 : 0, transition: 'opacity .45s .32s ease' }}>
          Near {card.nearbyCity}
        </p>
      )}
    </div>
  );
}
