import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../../shared/store';
import type { ReelDayIntelCard as ReelDayIntelCardType, DayIntelObservation } from './types';
import type { Place, Category } from '../../../shared/types';
import { api } from '../../../shared/api';

interface Props {
  card: ReelDayIntelCardType;
  active: boolean;
  selectedPlaces: Place[];
  onInteract?: (action: 'viewed' | 'tapped' | 'lingered') => void;
  onMapNavigate?: (lat: number, lon: number, places: Place[]) => void;
}

// ── Tokens ─────────────────────────────────────────────────────
const T = {
  bg:       '#0f0d0c',
  gold:     '#d4a853',
  goldBg:   'rgba(212,168,83,0.12)',
  goldBdr:  'rgba(212,168,83,0.26)',
  sage:     '#6b9470',
  sageBg:   'rgba(107,148,112,0.08)',
  sageBdr:  'rgba(107,148,112,0.18)',
  alert:    '#e07050',
  alertBg:  'rgba(224,112,80,0.10)',
  alertBdr: 'rgba(224,112,80,0.22)',
  purple:   '#a87fd4',
  purpBg:   'rgba(168,127,212,0.10)',
  purpBdr:  'rgba(168,127,212,0.22)',
  t1: '#f5f0ea',
  t2: 'rgba(255,255,255,0.68)',
  t3: 'rgba(255,255,255,0.38)',
  t4: 'rgba(255,255,255,0.18)',
  obsBg:  'rgba(255,255,255,0.025)',
  obsBdr: 'rgba(255,255,255,0.07)',
  okBg:   'rgba(107,148,112,0.08)',
  okBdr:  'rgba(107,148,112,0.18)',
  disBdr: 'rgba(107,148,112,0.22)',
  disBg:  'rgba(107,148,112,0.03)',
  disClr: 'rgba(255,255,255,0.28)',
  retryBg:  'rgba(255,255,255,0.05)',
  retryBdr: 'rgba(255,255,255,0.10)',
  retryClr: 'rgba(255,255,255,0.38)',
  disCta:    'rgba(255,255,255,0.04)',
  disCtaBdr: 'rgba(255,255,255,0.08)',
  disCtaClr: 'rgba(255,255,255,0.24)',
  eyebrow:   'rgba(212,168,83,0.5)',
  div:       'rgba(255,255,255,0.06)',
  chipBg:    'rgba(12,14,22,0.55)',
  chipBdr:   'rgba(255,255,255,0.09)',
  chipClr:   'rgba(255,255,255,0.72)',
  navBg:     'rgba(15,13,12,0.95)',
  navBdr:    'rgba(255,255,255,0.06)',
};

// Trigger → icon + color palette key
const OBS_STYLE: Record<string, { icon: string; bg: string; bdr: string; color: string }> = {
  lunch:            { icon: 'restaurant',      bg: T.goldBg,  bdr: T.goldBdr,  color: T.gold   },
  dinner:           { icon: 'dinner_dining',   bg: T.purpBg,  bdr: T.purpBdr,  color: T.purple },
  evening:          { icon: 'nightlight',      bg: T.purpBg,  bdr: T.purpBdr,  color: T.purple },
  culture:          { icon: 'museum',          bg: T.alertBg, bdr: T.alertBdr, color: T.alert  },
  rest:             { icon: 'local_cafe',      bg: T.purpBg,  bdr: T.purpBdr,  color: T.purple },
  walking_gap:      { icon: 'directions_walk', bg: T.sageBg,  bdr: T.sageBdr,  color: T.sage   },
  hidden_gem:       { icon: 'auto_awesome',    bg: T.sageBg,  bdr: T.sageBdr,  color: T.sage   },
  crowd_peak:       { icon: 'groups',          bg: T.alertBg, bdr: T.alertBdr, color: T.alert  },
  density_excess:   { icon: 'schedule',        bg: T.goldBg,  bdr: T.goldBdr,  color: T.gold   },
  density_sparse:   { icon: 'explore',         bg: T.sageBg,  bdr: T.sageBdr,  color: T.sage   },
  geo_efficiency:   { icon: 'route',           bg: T.sageBg,  bdr: T.sageBdr,  color: T.sage   },
  time_balance:     { icon: 'balance',         bg: T.purpBg,  bdr: T.purpBdr,  color: T.purple },
  category_diversity: { icon: 'grid_view',     bg: T.sageBg,  bdr: T.sageBdr,  color: T.sage   },
  social_gap:       { icon: 'people',          bg: T.sageBg,  bdr: T.sageBdr,  color: T.sage   },
  budget_mismatch:  { icon: 'payments',        bg: T.goldBg,  bdr: T.goldBdr,  color: T.gold   },
  live_event:       { icon: 'event',           bg: T.alertBg, bdr: T.alertBdr, color: T.alert  },
};
const DEFAULT_OBS_STYLE = { icon: 'info', bg: T.obsBg, bdr: T.obsBdr, color: T.t3 };

// Categories that resolve each trigger type
const TRIGGER_RESOLVE_CATEGORIES: Record<string, Category[]> = {
  lunch:   ['restaurant', 'cafe', 'bakery'],
  dinner:  ['restaurant', 'bar'],
  evening: ['bar', 'nightlife'],
  culture: ['museum', 'gallery', 'historic'],
  rest:    ['cafe', 'spa'],
};

function isResolved(obs: DayIntelObservation, selectedPlaces: Place[]): boolean {
  const cats = TRIGGER_RESOLVE_CATEGORIES[obs.trigger];
  if (!cats) return false;
  return selectedPlaces.some(p => cats.includes(p.category as Category));
}

// ── Individual observation row ─────────────────────────────────
interface ObsRowProps {
  obs: DayIntelObservation;
  dismissed: boolean;
  fetchState: 'idle' | 'loading' | 'ok' | 'fail';
  places: Place[];
  onBrowse: () => void;
  onRetry: () => void;
}

function ObsRow({ obs, dismissed, fetchState, places: _places, onBrowse, onRetry }: ObsRowProps) {
  const style = OBS_STYLE[obs.trigger] ?? DEFAULT_OBS_STYLE;
  const hasCTA = !!(obs.stopLat && obs.stopLon);

  if (dismissed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 12px', borderRadius: 10,
        border: `1px dashed ${T.disBdr}`,
        background: T.disBg, opacity: 0.6,
      }}>
        <span className="ms" style={{ fontSize: 14, color: T.sage }}>check_circle</span>
        <span style={{ fontSize: 10.5, color: T.disClr, fontStyle: 'italic' }}>
          {obs.what} — resolved
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '11px 12px', borderRadius: 10,
      border: `1px solid ${T.obsBdr}`, background: T.obsBg,
    }}>
      {/* Icon badge */}
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: style.bg, border: `1px solid ${style.bdr}`, marginTop: 1,
      }}>
        <span className="ms" style={{ fontSize: 14, color: style.color }}>{style.icon}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.t1, lineHeight: 1.25, marginBottom: 3 }}>
          {obs.what}
        </div>
        {obs.why && (
          <div style={{ fontSize: 10, color: T.t3, fontStyle: 'italic', lineHeight: 1.5, marginBottom: obs.consequence ? 4 : 8 }}>
            {obs.why}
          </div>
        )}
        {obs.consequence && (
          <div style={{ fontSize: 10.5, color: T.t2, lineHeight: 1.45, marginBottom: 8 }}>
            {obs.consequence}
          </div>
        )}

        {/* CTA row */}
        {hasCTA && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {fetchState === 'fail' ? (
              <>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 6,
                  background: T.disCta, border: `1px solid ${T.disCtaBdr}`,
                  fontSize: 9, fontWeight: 700, color: T.disCtaClr, letterSpacing: '.04em',
                }}>
                  <span className="ms" style={{ fontSize: 11 }}>cloud_off</span>
                  Couldn't load nearby
                </div>
                <button
                  onClick={onRetry}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 9px', borderRadius: 6,
                    background: T.retryBg, border: `1px solid ${T.retryBdr}`,
                    fontSize: 9, fontWeight: 700, color: T.retryClr, letterSpacing: '.04em',
                    cursor: 'pointer',
                  }}
                >
                  <span className="ms" style={{ fontSize: 11 }}>refresh</span>
                  Retry
                </button>
              </>
            ) : (
              <button
                onClick={onBrowse}
                disabled={fetchState === 'loading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 6,
                  background: fetchState === 'loading' ? T.disCta : T.goldBg,
                  border: `1px solid ${fetchState === 'loading' ? T.disCtaBdr : T.goldBdr}`,
                  fontSize: 9, fontWeight: 700,
                  color: fetchState === 'loading' ? T.disCtaClr : T.gold,
                  letterSpacing: '.04em', cursor: fetchState === 'loading' ? 'default' : 'pointer',
                }}
              >
                <span className="ms" style={{ fontSize: 11 }}>
                  {fetchState === 'loading' ? 'hourglass_empty' : 'map'}
                </span>
                {obs.ctaLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export function ReelDayIntelCard({ card, active, selectedPlaces, onInteract, onMapNavigate }: Props) {
  const { dispatch } = useAppStore();
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInteractRef = useRef(onInteract);
  useEffect(() => { onInteractRef.current = onInteract; });

  // Per-observation fetch state + places cache
  const [fetchStates, setFetchStates] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'fail'>>({});
  const [placesCache, setPlacesCache] = useState<Record<string, Place[]>>({});

  const fetchForObs = useCallback(async (obs: DayIntelObservation) => {
    if (!obs.stopLat || !obs.stopLon || !obs.searchCategory) return;
    setFetchStates(s => ({ ...s, [obs.id]: 'loading' }));
    try {
      const places = await (api as unknown as Record<string, (o: { lat: number; lon: number; category: string; limit: number }) => Promise<Place[]>>)
        .nearbyPlaces?.({ lat: obs.stopLat, lon: obs.stopLon, category: obs.searchCategory, limit: 8 });
      if (places?.length) {
        setPlacesCache(c => ({ ...c, [obs.id]: places }));
        setFetchStates(s => ({ ...s, [obs.id]: 'ok' }));
      } else {
        setFetchStates(s => ({ ...s, [obs.id]: 'fail' }));
      }
    } catch {
      setFetchStates(s => ({ ...s, [obs.id]: 'fail' }));
    }
  }, []);

  // Pre-fetch all observations when card becomes active
  useEffect(() => {
    if (!active) return;
    for (const obs of card.observations) {
      if (fetchStates[obs.id] || !obs.searchCategory) continue;
      fetchForObs(obs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => { if (active) onInteractRef.current?.('viewed'); }, [active]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteractRef.current?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]);

  const resolvedSet = new Set<string>();
  for (const obs of card.observations) {
    if (isResolved(obs, selectedPlaces)) resolvedSet.add(obs.id);
  }

  const openCount = card.observations.filter(o => !resolvedSet.has(o.id)).length;
  const resolvedCount = resolvedSet.size;

  const title = openCount === 1 ? 'One thing we noticed'
    : openCount > 1 ? 'A few things we noticed'
    : 'All good for this day';

  const subtitle = [
    openCount > 0 ? `${openCount} gap${openCount !== 1 ? 's' : ''}` : null,
    resolvedCount > 0 ? `${resolvedCount} confirmed` : null,
  ].filter(Boolean).join(' · ');

  const fade = (delay: string) => ({
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(6px)',
    transition: `opacity .4s ${delay} ease, transform .4s ${delay} ease`,
  });

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>

      {/* Ambient background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 55% at 85% 95%, rgba(212,168,83,.13) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 10% 5%, rgba(79,143,171,.06) 0%, transparent 55%)',
      }} />

      {/* Top chrome — day badge + city label */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 9px', borderRadius: 99,
          background: T.chipBg, backdropFilter: 'blur(10px)', border: `1px solid ${T.chipBdr}`,
          fontSize: 8, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.chipClr,
        }}>
          <span className="ms" style={{ fontSize: 11, marginRight: 2 }}>calendar_today</span>
          DAY {card.day}{card.totalDays > 1 ? ` OF ${card.totalDays}` : ''}
        </div>
        <span style={{ fontSize: 8.5, color: T.t4, letterSpacing: '.06em' }}>
          Day {card.day} · {card.dayCity}
        </span>
      </div>

      {/* Scrollable body */}
      <div style={{
        position: 'absolute', top: 52, bottom: 0, left: 0, right: 0,
        overflowY: 'auto', padding: '16px 14px 24px',
        display: 'flex', flexDirection: 'column', gap: 10,
        scrollbarWidth: 'none',
      }}>
        {/* Header */}
        <div style={fade('0s')}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.eyebrow, marginBottom: 4 }}>
            Day intelligence
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: T.t1, lineHeight: 1.15 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.div, ...fade('.06s') }} />

        {/* Observations */}
        {card.observations.map((obs, i) => (
          <div key={obs.id} style={fade(`${0.08 + i * 0.06}s`)}>
            <ObsRow
              obs={obs}
              dismissed={resolvedSet.has(obs.id)}
              fetchState={fetchStates[obs.id] ?? 'idle'}
              places={placesCache[obs.id] ?? []}
              onBrowse={() => {
                onInteract?.('tapped');
                const places = placesCache[obs.id] ?? [];
                if (places.length > 0) dispatch({ type: 'SET_RECO_FOCUS_PLACES', places });
                if (obs.stopLat && obs.stopLon) {
                  dispatch({ type: 'SET_CITY_GEO', geo: { lat: obs.stopLat, lon: obs.stopLon, bbox: [obs.stopLat - 0.05, obs.stopLat + 0.05, obs.stopLon - 0.05, obs.stopLon + 0.05] } });
                }
                dispatch({ type: 'SET_FILTER', filter: 'curated' });
                dispatch({ type: 'GO_TO', screen: 'map' });
                onMapNavigate?.(obs.stopLat!, obs.stopLon!, places);
              }}
              onRetry={() => fetchForObs(obs)}
            />
          </div>
        ))}

        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 8, ...fade('.36s') }}>
          <span className="ms" style={{ fontSize: 16, color: 'rgba(255,255,255,.15)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
