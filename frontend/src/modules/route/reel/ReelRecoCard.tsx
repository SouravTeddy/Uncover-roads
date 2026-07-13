import { useEffect } from 'react';
import type { ReelRecoCard as ReelRecoCardType } from './types';
import { useReelRecommendations } from './useReelRecommendations';

interface Props {
  card: ReelRecoCardType;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
  onMapNavigate?: (lat: number, lon: number, places: import('../../../shared/types').Place[]) => void;
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

export function ReelRecoCard({ card, active, archetype, existingPlaceIds, onInteract, onMapNavigate }: Props) {
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.rest;
  const { places, loading, photoUrl } = useReelRecommendations(
    card, archetype, existingPlaceIds, active, TRIGGER_CATEGORY[card.trigger],
  );

  const place  = places[0] ?? null;
  const photo  = photoUrl ?? card.anchorPhotoUrl ?? null;
  const isDone = !loading;

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // No place found after load — render invisible placeholder so snap scroll stays intact
  if (isDone && !place) {
    return <div className="reel-card" style={{ width: '100%', height: '100dvh', background: '#0c0d0e' }} />;
  }

  return (
    <div className="reel-card" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden', background: '#0c0d0e' }}>

      {/* Full-bleed photo */}
      {photo && (
        <img
          src={photo} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: place ? 0.52 : 0.25 }}
        />
      )}

      {/* Gradient — heavier at bottom so text is always legible */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(12,13,14,0.15) 0%, rgba(12,13,14,0.45) 35%, rgba(12,13,14,0.96) 72%)' }} />

      {/* Top badges */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 18px)',
        left: 20, right: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: active ? 1 : 0, transition: 'opacity .35s ease',
      }}>
        {/* Trigger chip */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, backdropFilter: 'blur(8px)' }}>
          <span className="ms fill" style={{ fontSize: 13, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: cfg.color }}>{cfg.chipLabel}</span>
        </div>

        {/* Our Pick badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: 'rgba(212,168,83,0.14)', border: '1px solid rgba(212,168,83,0.4)', backdropFilter: 'blur(8px)' }}>
          <span className="ms fill" style={{ fontSize: 12, color: '#d4a853' }}>star</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#d4a853' }}>Our Pick</span>
        </div>
      </div>

      {/* Loading shimmer */}
      {loading && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 120px' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 14, width: '35%', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.1)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '55%', marginBottom: 28, animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ height: 50, borderRadius: 12, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.6s ease-in-out infinite' }} />
        </div>
      )}

      {/* Place content */}
      {place && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 24px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        }}>

          {/* Meta row: rating + distance + price */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity .38s .08s ease, transform .38s .08s ease',
          }}>
            {place.rating != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600, color: '#d4a853' }}>
                <span className="ms fill" style={{ fontSize: 13 }}>star</span>
                {place.rating.toFixed(1)}
              </span>
            )}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              {place.distanceM < 1000 ? `${place.distanceM}m away` : `${(place.distanceM / 1000).toFixed(1)}km away`}
            </span>
            {place.priceLevel != null && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{PRICE_DOTS[place.priceLevel]}</span>
            )}
          </div>

          {/* Place name */}
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 32, fontWeight: 700, color: '#f5f0ea', lineHeight: 1.1,
            margin: '0 0 6px',
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity .45s .15s ease, transform .45s .15s ease',
          }}>
            {place.name}
          </h2>

          {/* City */}
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 14px',
            opacity: active ? 1 : 0, transition: 'opacity .4s .22s ease',
          }}>
            {card.nearbyCity}
          </p>

          {/* Match reason chips */}
          {place.matchReasons.length > 0 && (
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18,
              opacity: active ? 1 : 0, transition: 'opacity .4s .28s ease',
            }}>
              {place.matchReasons.slice(0, 3).map(r => (
                <span key={r} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                  background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.25)', color: '#d4a853',
                }}>
                  {r}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => {
              onInteract?.('tapped');
              if (onMapNavigate && card.stopLat != null && card.stopLon != null) {
                onMapNavigate(card.stopLat, card.stopLon, [{
                  id: place.placeId,
                  title: place.name,
                  category: place.category as import('../../../shared/types').Category,
                  lat: place.lat,
                  lon: place.lon,
                  place_id: place.placeId,
                  rating: place.rating ?? undefined,
                }]);
              }
            }}
            style={{
              width: '100%', padding: '15px 20px', borderRadius: 13,
              border: '1px solid rgba(212,168,83,0.45)',
              background: 'rgba(212,168,83,0.12)',
              color: '#d4a853', fontSize: 14, fontWeight: 700,
              letterSpacing: '0.03em', cursor: 'pointer',
              opacity: active ? 1 : 0, transition: 'opacity .4s .33s ease',
            }}
          >
            See on map →
          </button>
        </div>
      )}
    </div>
  );
}
