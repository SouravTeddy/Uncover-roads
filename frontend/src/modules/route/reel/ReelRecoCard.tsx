import { useEffect, useRef, useState } from 'react';
import type { ReelRecoCard as ReelRecoCardType } from './types';
import { useReelRecommendations } from './useReelRecommendations';

interface Props {
  card: ReelRecoCardType;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
}

const TRIGGER_CATEGORY: Partial<Record<string, string>> = {
  lunch:              'restaurant',
  dinner:             'restaurant',
  culture:            'museum',
  rest:               'cafe',
  evening:            'nightlife',
  social_gap:         'bar',
  hidden_gem:         'point_of_interest',
  category_diversity: 'attraction',
  weather:            'indoor_attraction',
  local_food:         'restaurant',
  photo_detour:       'scenic',
  famous_spots:       'tourism',
  walking_gap:        'park',
};

const TRIGGER_CFG: Record<string, { icon: string; color: string; bg: string; border: string; chipLabel: string }> = {
  lunch:              { icon: 'restaurant',      color: '#c27c4a', bg: 'rgba(194,124,74,.12)',  border: 'rgba(194,124,74,.3)',  chipLabel: 'Lunch'         },
  dinner:             { icon: 'dinner_dining',   color: '#9b8eb8', bg: 'rgba(155,142,184,.12)', border: 'rgba(155,142,184,.3)', chipLabel: 'Dinner'        },
  evening:            { icon: 'nightlight',      color: '#9b8eb8', bg: 'rgba(155,142,184,.12)', border: 'rgba(155,142,184,.3)', chipLabel: 'Evening'       },
  culture:            { icon: 'museum',          color: '#8b9e6a', bg: 'rgba(139,158,106,.12)', border: 'rgba(139,158,106,.3)', chipLabel: 'Culture'       },
  rest:               { icon: 'local_cafe',      color: '#d4a853', bg: 'rgba(212,168,83,.12)',  border: 'rgba(212,168,83,.3)',  chipLabel: 'Rest break'    },
  walking_gap:        { icon: 'directions_walk', color: '#8b9e6a', bg: 'rgba(139,158,106,.12)', border: 'rgba(139,158,106,.3)', chipLabel: 'Walk'          },
  social_gap:         { icon: 'people',          color: '#4f8fab', bg: 'rgba(79,143,171,.12)',  border: 'rgba(79,143,171,.3)',  chipLabel: 'Social'        },
  hidden_gem:         { icon: 'auto_awesome',    color: '#8b9e6a', bg: 'rgba(139,158,106,.12)', border: 'rgba(139,158,106,.3)', chipLabel: 'Hidden gem'   },
  local_food:         { icon: 'lunch_dining',    color: '#c27c4a', bg: 'rgba(194,124,74,.12)',  border: 'rgba(194,124,74,.3)',  chipLabel: 'Local food'    },
  photo_detour:       { icon: 'camera',          color: '#fbbf24', bg: 'rgba(251,191,36,.12)',  border: 'rgba(251,191,36,.3)',  chipLabel: 'Photo spot'    },
  famous_spots:       { icon: 'account_balance', color: '#7b9fcf', bg: 'rgba(123,159,207,.12)', border: 'rgba(123,159,207,.3)', chipLabel: 'Landmark'      },
  category_diversity: { icon: 'grid_view',       color: '#8b9e6a', bg: 'rgba(139,158,106,.12)', border: 'rgba(139,158,106,.3)', chipLabel: 'Variety'       },
  density_sparse:     { icon: 'explore',         color: '#8b9e6a', bg: 'rgba(139,158,106,.12)', border: 'rgba(139,158,106,.3)', chipLabel: 'Add a stop'    },
  live_event:         { icon: 'event',           color: '#c27c4a', bg: 'rgba(194,124,74,.12)',  border: 'rgba(194,124,74,.3)',  chipLabel: 'Live event'    },
};

const PRICE_DOTS: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const GOLD = '#d4a853';

export function ReelRecoCard({ card, active, archetype, existingPlaceIds, onInteract }: Props) {
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.rest;
  const { places, loading, photoUrl } = useReelRecommendations(
    card, archetype, existingPlaceIds, active, TRIGGER_CATEGORY[card.trigger],
  );

  const place  = places[0] ?? null;
  const photo  = photoUrl ?? card.anchorPhotoUrl ?? null;
  const isDone = !loading;

  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const panelTouchY = useRef(0);

  const setExpandedSync = (v: boolean) => { expandedRef.current = v; setExpanded(v); };

  const onPanelTouchStart = (e: React.TouchEvent) => { panelTouchY.current = e.touches[0].clientY; };
  const onPanelTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - panelTouchY.current;
    if (Math.abs(dy) < 24) return;
    e.preventDefault();
    if (dy < 0) setExpandedSync(true);
    if (dy > 0) setExpandedSync(false);
  };

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // No place found after load — remove from snap scroll entirely
  if (isDone && !place) return null;

  return (
    <div className="reel-card" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden', background: '#0c0d0e' }}>

      {/* Full-bleed photo */}
      {photo && (
        <img
          src={photo} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: place ? 0.52 : 0.25 }}
        />
      )}

      {/* Gradient scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(12,13,14,0.15) 0%, rgba(12,13,14,0.45) 35%, rgba(12,13,14,0.96) 72%)' }} />

      {/* Trigger chip — top left */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 18px)',
        left: 20,
        opacity: active ? 1 : 0, transition: 'opacity .35s ease',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, backdropFilter: 'blur(8px)' }}>
          <span className="ms fill" style={{ fontSize: 13, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: cfg.color }}>{cfg.chipLabel}</span>
        </div>
      </div>

      {/* Panel — same structure as stop card */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(8,9,16,.97)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,.07)', borderBottom: 'none',
          overflow: 'hidden',
          touchAction: expanded ? 'none' : 'pan-y',
          height: expanded ? '86dvh' : 'auto',
          transition: 'height 0.44s cubic-bezier(.22,1,.36,1)',
          display: 'flex', flexDirection: 'column',
        }}
        onTouchStart={onPanelTouchStart}
        onTouchEnd={onPanelTouchEnd}
      >
        {/* Drag handle */}
        <div
          onClick={(e) => { e.stopPropagation(); setExpandedSync(!expandedRef.current); }}
          style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '10px 0 6px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.22)' }} />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

          {/* COLLAPSED */}
          <div
            style={{ display: expanded ? 'none' : 'block', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
            onClick={(e) => { e.stopPropagation(); setExpandedSync(true); }}
          >
            {/* Trigger label row */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: cfg.color, marginBottom: 8 }}>
              {cfg.chipLabel} suggestion
            </div>

            {loading ? (
              <>
                <div style={{ height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.1)', marginBottom: 8, width: '68%', animation: 'pulse 1.6s ease-in-out infinite' }} />
                <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.07)', width: '50%', animation: 'pulse 1.6s ease-in-out infinite' }} />
              </>
            ) : place ? (
              <>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 27, fontWeight: 700, color: '#f5f0ea', lineHeight: 1.15, margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {place.name}
                </h2>
                {place.matchReasons.length > 0 && (
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(242,237,230,.52)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {place.matchReasons.join(' · ')}
                  </p>
                )}
              </>
            ) : null}
          </div>

          {/* EXPANDED */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? 'auto' : 'none',
            transition: 'opacity 0.22s ease 0.16s',
          }}>
            {/* Meta strip */}
            <div style={{ flexShrink: 0, padding: '4px 20px 13px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: cfg.color }}>
                {cfg.chipLabel} suggestion
              </span>
            </div>

            {/* Scroll area */}
            <div
              className="no-scrollbar"
              style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y', padding: '18px 20px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
            >
              {place && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: '#f5f0ea', lineHeight: 1.14, margin: '0 0 10px' }}>
                    {place.name}
                  </h2>

                  {/* Meta: rating + distance + price + city */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    {place.rating != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600, color: GOLD }}>
                        <span className="ms fill" style={{ fontSize: 13 }}>star</span>
                        {place.rating.toFixed(1)}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.42)' }}>
                      {place.distanceM < 1000 ? `${place.distanceM}m away` : `${(place.distanceM / 1000).toFixed(1)}km away`}
                    </span>
                    {place.priceLevel != null && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{PRICE_DOTS[place.priceLevel]}</span>
                    )}
                    {card.nearbyCity && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{card.nearbyCity}</span>
                    )}
                  </div>

                  {/* Match reason chips */}
                  {place.matchReasons.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                      {place.matchReasons.slice(0, 3).map(r => (
                        <span key={r} style={{
                          fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                          background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
                        }}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
