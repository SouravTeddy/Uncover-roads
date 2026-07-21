import { useId, useState, useEffect, useRef } from 'react';
import type { ReelScenicCard as ReelScenicCardType } from './types';
import { api } from '../../../shared/api';
import {
  WalkSpineScene, SelfDriveScene, CoastalScene,
  RidgeScene, CrowdFreeScene, ForestScene,
} from './ReelScenicScenes';

interface Props { card: ReelScenicCardType; active: boolean }

// ── Material Symbols icon names ──────────────────────────────────────────────
const MS: Record<string, string> = {
  walk: 'directions_walk', car: 'directions_car', twilight: 'wb_twilight',
  terrain: 'terrain', forest: 'forest', person_off: 'person_off',
  store: 'storefront', camera: 'photo_camera', waves: 'waves',
  cloud: 'cloud', eq: 'graphic_eq', thermostat: 'thermostat',
  more: 'more_horiz', expand_more: 'expand_more', place: 'place',
};

function msName(key: string): string { return MS[key] ?? key; }

// ── Dimension → icon/color map ────────────────────────────────────────────────
const DIMENSION_MAP: Record<string, { icon: string; color: string }> = {
  natural:    { icon: 'park',            color: '#6b9470' },
  viewpoint:  { icon: 'visibility',      color: '#4f8fab' },
  historic:   { icon: 'account_balance', color: '#d4a853' },
  vibrant:    { icon: 'nightlife',       color: 'rgba(212,168,83,1)' },
  photogenic: { icon: 'photo_camera',    color: '#4f8fab' },
  waterfront: { icon: 'water',           color: '#4f8fab' },
  local:      { icon: 'storefront',      color: '#c0b0a4' },
};

// ── "Along the way" — plain English sentence per dimension ────────────────────
const DIMENSION_TEXT: Record<string, { emoji: string; text: string }> = {
  natural:    { emoji: '🌿', text: 'Tree-lined streets, shaded for most of the walk' },
  viewpoint:  { emoji: '🔭', text: 'Open views and good vantage points along the route' },
  historic:   { emoji: '🏛️', text: 'Ancient ruins and monuments visible from the street' },
  vibrant:    { emoji: '✨', text: 'Lively area with local shops and street life' },
  photogenic: { emoji: '📷', text: 'Several good photo spots along the route' },
  waterfront: { emoji: '🌊', text: 'Walk along the water with open views' },
  local:      { emoji: '🏘️', text: 'Quiet neighbourhood streets, away from tourist crowds' },
};

// ── "Along the way" pills (used by non-walk scenic cards) ─────────────────────
function AlongTheWay({ dims }: { dims: Record<string, number> }) {
  const top = Object.entries(dims)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
  if (!top.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 7 }}>Along the way</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {top.map(dim => {
          const meta = DIMENSION_MAP[dim] ?? { icon: 'explore', color: '#c0b0a4' };
          const label = dim.charAt(0).toUpperCase() + dim.slice(1);
          return (
            <div key={dim} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
              <span className="ms" style={{ fontSize: 13, color: meta.color, lineHeight: 1 }}>{meta.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Small shared atoms ────────────────────────────────────────────────────────
const LF: React.CSSProperties = { fontFamily: "'DM Sans',sans-serif" };

function VizCard({ label, value, accent, children }: { label: string; value: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 16, padding: '12px 14px 13px',
      background: 'rgba(242,237,230,.045)', border: '1px solid rgba(242,237,230,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ ...LF, fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: 'rgba(242,237,230,.45)' }}>{label}</span>
        <span style={{ ...LF, fontSize: 12, fontWeight: 700, color: accent }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

// ── Signature visuals ─────────────────────────────────────────────────────────
function WalkCorridorViz({ accent, from, to, detourKm, detourMin }: { accent: string; from: string; to: string; detourKm?: number; detourMin?: number }) {
  const distLabel = detourKm != null
    ? (detourKm < 1 ? `${Math.round(detourKm * 1000)} m` : `${detourKm.toFixed(1)} km`)
    : null;
  const dot = (filled: boolean) => (
    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
      background: filled ? accent : 'transparent', border: `2px solid ${accent}`,
      boxShadow: filled ? `0 0 10px ${accent}88` : 'none' }} />
  );
  return (
    <VizCard label="WALK" value={distLabel ? `${distLabel} on foot` : 'walkable stretch'} accent={accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {dot(true)}
        <div style={{ flex: 1, position: 'relative', height: 2, background: `${accent}33`, borderRadius: 99 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 99,
            background: `repeating-linear-gradient(90deg, ${accent} 0 6px, transparent 6px 11px)` }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99,
            background: '#13131a', border: `1px solid ${accent}55` }}>
            <span className="ms fill" style={{ fontSize: 13, color: accent, lineHeight: 1 }}>directions_walk</span>
            {detourMin != null && <span style={{ ...LF, fontSize: 11, fontWeight: 700, color: '#f2ede6' }}>{detourMin} min</span>}
          </div>
        </div>
        {dot(false)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
        <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.5)' }}>{from}</span>
        <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.5)' }}>{to}</span>
      </div>
    </VizCard>
  );
}

function RouteOverviewViz({ accent, from, to }: { accent: string; from: string; to: string }) {
  return (
    <VizCard label="DAY ROUTE" value="47 km · 3 viewpoints" accent={accent}>
      <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 4, right: 4, top: '50%', height: 2, transform: 'translateY(-50%)',
          background: `linear-gradient(90deg, ${accent}, ${accent}55)`, borderRadius: 99 }} />
        {/* origin */}
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 10, height: 10, borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}aa` }} />
        {/* viewpoints */}
        {[28, 52, 74].map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p}%`, top: '50%',
            transform: 'translate(-50%,-50%) rotate(45deg)',
            width: 8, height: 8, background: '#13131a', border: `2px solid ${accent}` }} />
        ))}
        {/* destination */}
        <span className="ms fill" style={{ position: 'absolute', right: -2, top: '50%',
          transform: 'translateY(-50%)', fontSize: 16, color: accent, lineHeight: 1 }}>place</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.5)' }}>{from}</span>
        <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.5)' }}>{to}</span>
      </div>
    </VizCard>
  );
}

function SunsetDialViz({ accent }: { accent: string }) {
  return (
    <VizCard label="GOLDEN HOUR" value="water at midpoint" accent={accent}>
      <div style={{ position: 'relative', height: 14, borderRadius: 99, overflow: 'hidden',
        background: 'linear-gradient(90deg, #2a3a55 0%, #c87a4e 48%, #f4c478 64%, #6a4a6e 100%)' }}>
        <div style={{ position: 'absolute', left: '52%', width: '22%', top: 0, bottom: 0,
          border: '1.5px solid #fff', borderRadius: 4, boxShadow: '0 0 10px rgba(255,255,255,.4)' }} />
      </div>
      <div style={{ position: 'relative', marginTop: 6, height: 12 }}>
        {[['5 PM', '6%'], ['6 PM', '50%'], ['7 PM', '92%']].map(([t, l], i) => (
          <span key={i} style={{ ...LF, position: 'absolute', left: l, transform: 'translateX(-50%)',
            fontSize: 10, color: i === 1 ? accent : 'rgba(242,237,230,.45)', fontWeight: i === 1 ? 700 : 400 }}>{t}</span>
        ))}
      </div>
    </VizCard>
  );
}

function ElevationViz({ accent, from }: { accent: string; from: string; to: string }) {
  const gId = `elev-${useId().replace(/:/g, '')}`;
  return (
    <VizCard label="ELEVATION" value="2,640 m peak" accent={accent}>
      <svg viewBox="0 0 280 56" style={{ width: '100%', height: 48, display: 'block' }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 0 48 L 0 40 Q 70 36 120 12 Q 145 0 168 14 Q 220 44 280 38 L 280 48 Z" fill={`url(#${gId})`} />
        <path d="M 0 40 Q 70 36 120 12 Q 145 0 168 14 Q 220 44 280 38" fill="none" stroke={accent} strokeWidth="2" />
        <circle cx="146" cy="6" r="3.5" fill={accent} stroke="#0a0a0d" strokeWidth="1.5" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.5)' }}>{from}</span>
        <span style={{ ...LF, fontSize: 11, fontWeight: 700, color: accent }}>+340 m gain</span>
      </div>
    </VizCard>
  );
}

function QuietMeterViz({ accent }: { accent: string }) {
  return (
    <VizCard label="TRAFFIC · LIVE" value="0 vehicles" accent={accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
          {[6, 11, 5, 14, 7, 4, 9].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: accent, opacity: .85,
              transformOrigin: 'center bottom',
              animation: `eqBar ${1.2 + i * 0.1}s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ position: 'relative', height: 5, borderRadius: 99, background: 'rgba(242,237,230,.1)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4%', borderRadius: 99,
              background: accent, boxShadow: `0 0 8px ${accent}` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ ...LF, fontSize: 10, color: accent, fontWeight: 700 }}>EMPTY</span>
            <span style={{ ...LF, fontSize: 10, color: 'rgba(242,237,230,.4)' }}>BUSY</span>
          </div>
        </div>
      </div>
    </VizCard>
  );
}

function CanopyViz({ accent }: { accent: string }) {
  const bar = (label: string, pct: number, val: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.6)' }}>{label}</span>
        <span style={{ ...LF, fontSize: 11, fontWeight: 700, color: accent }}>{val}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(242,237,230,.1)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99,
          background: accent, boxShadow: `0 0 8px ${accent}88` }} />
      </div>
    </div>
  );
  return (
    <VizCard label="CANOPY" value="8 km shaded" accent={accent}>
      {bar('Overhead cover', 100, '100%')}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ ...LF, fontSize: 11, color: 'rgba(242,237,230,.6)' }}>Temp inside</span>
          <span style={{ ...LF, fontSize: 11, fontWeight: 700, color: accent }}>−4–5 °C</span>
        </div>
        <div style={{ height: 5, borderRadius: 99,
          background: 'linear-gradient(90deg, #d98a6e, #5a8a6e)' }} />
      </div>
    </VizCard>
  );
}

function VizFor({ card }: { card: ReelScenicCardType }) {
  switch (card.vizType) {
    case 'corridor':
      // Drive cards get the route overview; walk cards get the corridor animation
      return card.modeIcon === 'car'
        ? <RouteOverviewViz accent={card.accent} from={card.from} to={card.to} />
        : <WalkCorridorViz accent={card.accent} from={card.from} to={card.to} detourKm={card.detourKm} detourMin={card.detourMin} />;
    case 'route':     return <RouteOverviewViz accent={card.accent} from={card.from} to={card.to} />;
    case 'sunset':    return <SunsetDialViz accent={card.accent} />;
    case 'elevation': return <ElevationViz accent={card.accent} from={card.from} to={card.to} />;
    case 'quiet':     return <QuietMeterViz accent={card.accent} />;
    case 'canopy':    return <CanopyViz accent={card.accent} />;
    default:          return null;
  }
}

function SceneFor({ card }: { card: ReelScenicCardType }) {
  switch (card.sceneType) {
    case 'walk':    return <WalkSpineScene card={card} />;
    case 'drive':   return <SelfDriveScene photoUrl={card.photoUrl} />;
    case 'coastal': return <CoastalScene />;
    case 'ridge':   return <RidgeScene />;
    case 'crowd':   return <CrowdFreeScene />;
    case 'forest':  return <ForestScene />;
    default:        return null;
  }
}

// ── Walk corridor card — matches proto Card 4 / Card 5 ───────────────────────

function getTransitLabel(type: string | null | undefined, lineName: string | null | undefined): string {
  const name = lineName ?? '';
  switch (type) {
    case 'SUBWAY': return name || 'metro';
    case 'BUS': return name ? `Bus ${name}` : 'bus';
    case 'TRAM': return name || 'tram';
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN': return name || 'train';
    case 'FERRY': return 'ferry';
    default: return name || 'transit';
  }
}

function WalkCorridorCard({ card }: { card: ReelScenicCardType; active: boolean }) {
  const isHighWalk = card.persona.includes('walk') || card.persona.includes('hike') || card.persona.includes('slow');

  const ti = card.transitInfo;
  const hasRealTransit = ti?.has_transit === true;

  // Prefer real Google Directions walking data; fall back to haversine estimates
  const realDistM   = ti?.walk_distance_m ?? null;
  const realWalkMin = ti?.walk_duration_min ?? null;

  const distValue = realDistM !== null
    ? (realDistM < 1000 ? `${realDistM} m` : `${(realDistM / 1000).toFixed(1)} km`)
    : card.metaRight.replace(/\s*walk$/i, '').trim();

  const walkMins = realWalkMin !== null
    ? realWalkMin
    : (() => { const m = card.sensory.match(/~?(\d+)\s*min/i); return m ? parseInt(m[1], 10) : 15; })();

  const transitLabel = hasRealTransit
    ? getTransitLabel(ti!.transit_type, ti!.line_name)
    : null;
  const transitMins = hasRealTransit ? ti!.duration_min : null;

  // Lazy-fetch photos from placeId when originPhotoUrl/destPhotoUrl are absent
  const [fallbackOriginUrl, setFallbackOriginUrl] = useState<string | null>(null);
  const [fallbackDestUrl, setFallbackDestUrl] = useState<string | null>(null);
  const fetchAttempted = useRef(false);

  // Prefetch on mount (not gated on active) so photo is ready when card scrolls into view
  useEffect(() => {
    const needsOrigin = !card.originPhotoUrl && (!!card.originPlaceId || !!card.from);
    const needsDest = !card.destPhotoUrl && (!!card.destPlaceId || !!card.to);
    if (!needsOrigin && !needsDest) return;
    if (fetchAttempted.current) return;
    fetchAttempted.current = true;
    if (needsOrigin) {
      api.placeImage(card.from, '', card.originPlaceId ?? undefined)
        .then(url => { if (url) setFallbackOriginUrl(url); })
        .catch(() => {});
    }
    if (needsDest) {
      api.placeImage(card.to, '', card.destPlaceId ?? undefined)
        .then(url => { if (url) setFallbackDestUrl(url); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Destination image is always preferred — origin is only a fallback
  const photoUrl = (card.destPhotoUrl ?? fallbackDestUrl) ?? (card.originPhotoUrl ?? fallbackOriginUrl) ?? card.photoUrl;

  // Parse distance into number + unit for big stat display
  const [distNum, distUnit] = (() => {
    if (realDistM !== null) {
      return realDistM < 1000
        ? [`${realDistM}`, 'm']
        : [`${(realDistM / 1000).toFixed(1)}`, 'km'];
    }
    const m = distValue.match(/^([0-9.]+)\s*(km|m)$/i);
    return m ? [m[1], m[2].toLowerCase()] : [distValue, ''];
  })();

  return (
    <div style={{ width: '100%', height: '100dvh', overflow: 'hidden', position: 'relative', background: '#0a0a0d' }}>
      {/* Background photo */}
      {photoUrl && (
        <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0 }} />
      )}
      {/* Dark scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.55) 50%,rgba(0,0,0,.82) 100%)', zIndex: 1 }} />

      {/* Topbar: mode pill + side-trip badge */}
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 52px)', left: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.09)', fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: card.accent, boxShadow: `0 0 5px ${card.accent}` }} />
          <span>{card.modeIcon === 'walk' ? 'Walk' : 'Drive'}</span>
        </div>
        {!isHighWalk && card.detourMin > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(14px)', border: `1px solid ${card.accent}45`, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: card.accent }}>
            <span className="ms" style={{ fontSize: 13, lineHeight: 1 }}>fork_right</span>
            Side trip · +{card.detourMin} min
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 5 }}>
        <div style={{ flex: 1 }} />
        {/* Panel — no drag handle (walk cards don't expand) */}
        <div style={{ background: 'rgba(8,9,16,.97)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,.07)', borderBottom: 'none', padding: '20px 20px calc(88px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Route name */}
          {card.routeLabel && (
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: '#f5f0ea', lineHeight: 1.12, margin: 0 }}>
              {card.routeLabel}
            </h2>
          )}

          {/* Route line: from → dashed + walk pill → to */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: card.accent, boxShadow: `0 0 8px ${card.accent}88` }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(242,237,230,.55)', maxWidth: 90, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'] }}>{card.from}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', marginTop: -1 }}>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 26 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: `repeating-linear-gradient(90deg,${card.accent}55 0 5px,transparent 5px 10px)` }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 999, background: 'rgba(8,9,16,.97)', border: `1px solid ${card.accent}45`, fontSize: 12, fontWeight: 700, color: card.accent, position: 'relative', zIndex: 1 }}>
                  <span className="ms" style={{ fontSize: 14, lineHeight: 1 }}>directions_walk</span>
                  {walkMins} min
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'transparent', border: `2px solid ${card.accent}60` }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(242,237,230,.55)', maxWidth: 90, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'] }}>{card.to}</div>
            </div>
          </div>

          {/* 2 stat blocks — time + distance only */}
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '13px 8px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '10px 0 0 10px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f5f0ea', letterSpacing: '-.5px', lineHeight: 1 }}>{walkMins}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(242,237,230,.35)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>min walk</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '13px 8px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderLeft: 'none', borderRadius: '0 10px 10px 0' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f5f0ea', letterSpacing: '-.5px', lineHeight: 1 }}>{distNum}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(242,237,230,.35)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{distUnit || 'km'}</div>
            </div>
          </div>

          {/* Skip row — only shown when real transit data is available */}
          {hasRealTransit && transitMins != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }} role="note">
              <span className="ms" style={{ fontSize: 18, color: 'rgba(255,255,255,.35)', flexShrink: 0 }}>bolt</span>
              <span style={{ fontSize: 14, color: 'rgba(242,237,230,.6)', lineHeight: 1.4 }}>
                Skip the walk — <strong style={{ color: '#f5f0ea', fontWeight: 700 }}>
                  <span className="ms" style={{ fontSize: 13, verticalAlign: 'middle' }}>subway</span>{' '}
                  {transitMins} min {transitLabel}
                </strong>
              </span>
            </div>
          )}

          {/* Why */}
          {card.why && (
            <p style={{ fontSize: 14, color: 'rgba(242,237,230,.65)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
              {card.why}
            </p>
          )}

          {/* Along the way — plain English sentences per dimension */}
          {card.characterDimensions && !Array.isArray(card.characterDimensions) && (() => {
            const top = Object.entries(card.characterDimensions)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([key]) => key)
              .filter(key => DIMENSION_TEXT[key]);
            if (!top.length) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(242,237,230,.35)' }}>Along the way</div>
                {top.map(key => {
                  const d = DIMENSION_TEXT[key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }}>{d.emoji}</span>
                      <span style={{ fontSize: 14, color: 'rgba(242,237,230,.6)', lineHeight: 1.45 }}>{d.text}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Condition note */}
          {card.conditionNote && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: 'rgba(212,168,83,.8)', background: 'rgba(212,168,83,.07)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(212,168,83,.15)' }}>
              <span className="ms" style={{ fontSize: 14, flexShrink: 0 }}>wb_sunny</span>
              <span>{card.conditionNote}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export default function ReelScenicCard({ card, active }: Props) {
  if (card.sceneType === 'walk') {
    return <WalkCorridorCard card={card} active={active} />;
  }

  const a = card.accent;
  const { pos, total } = card;

  return (
    <div style={{ width: '100%', height: '100dvh', background: '#0a0a0d', overflow: 'hidden', position: 'relative' }}>

      {/* Scene — top 45% */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%' }}>
        <SceneFor card={card} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, transparent 0%, transparent 58%, rgba(10,10,13,.65) 84%, #0a0a0d 100%)' }} />
      </div>

      {/* Floating header — gradient scrim + more button */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, padding: '18px 16px 14px',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0))' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)' }}>
          <span className="ms" style={{ fontSize: 18, color: '#fff', lineHeight: 1 }}>more_horiz</span>
        </div>
      </div>

      {/* Right-edge scenic position dots */}
      <div style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', zIndex: 6,
        display: 'flex', flexDirection: 'column', gap: 7 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ width: 4, height: i === pos - 1 ? 20 : 4, borderRadius: 99,
            background: i === pos - 1 ? a : 'rgba(255,255,255,.26)',
            transition: 'height .3s, background .3s' }} />
        ))}
      </div>

      {/* Info block */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '41.5%', bottom: 0,
        padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ ...LF, fontSize: 11, fontWeight: 700, letterSpacing: '.16em', color: a }}>{card.cardType}</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(242,237,230,.1)' }} />
          <span style={{ ...LF, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(242,237,230,.45)' }}>
            {String(pos).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>

        {/* Timing row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 99,
            background: `${a}1a`, border: `1px solid ${a}3a` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: a, boxShadow: `0 0 6px ${a}` }} />
            <span style={{ ...LF, fontSize: 13, fontWeight: 600, color: '#f2ede6' }}>{card.timing}</span>
          </div>
          <span style={{ ...LF, fontSize: 13, fontWeight: 600, color: 'rgba(242,237,230,.55)' }}>{card.metaRight}</span>
        </div>

        {/* Headline + route */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, fontWeight: 700,
            lineHeight: 1.08, margin: 0, color: '#f2ede6', letterSpacing: '-.005em' }}>{card.routeLabel ?? card.place}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="ms fill" style={{ fontSize: 15, color: a, lineHeight: 1 }}>{msName(card.modeIcon)}</span>
            <span style={{ ...LF, fontSize: 13, color: 'rgba(242,237,230,.7)' }}>{card.from}</span>
            <span style={{ color: a, fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 16 }}>→</span>
            <span style={{ ...LF, fontSize: 13, color: 'rgba(242,237,230,.7)' }}>{card.to}</span>
            <span style={{ ...LF, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
              color: a, border: `1px solid ${a}40`, marginLeft: 2 }}>{card.tag}</span>
          </div>
        </div>

        {/* Signature visual */}
        <VizFor card={card} />

        {/* Why this road · persona */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 12,
          background: `${a}14`, border: `1px solid ${a}33` }}>
          <span className="ms fill" style={{ fontSize: 16, color: a, lineHeight: 1, marginTop: 1 }}>{msName(card.personaIcon)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ ...LF, fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: a }}>
              WHY THIS ROAD · {card.personaDisplay.toUpperCase()}
            </span>
            <p style={{ ...LF, fontSize: 13, lineHeight: 1.5, color: 'rgba(242,237,230,.86)', margin: 0 }}>{card.why}</p>
          </div>
        </div>

        {/* One sensory line */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <span className="ms" style={{ fontSize: 16, color: 'rgba(242,237,230,.5)', lineHeight: 1, marginTop: 1 }}>{msName(card.sensoryIcon)}</span>
          <p style={{ ...LF, fontSize: 13, lineHeight: 1.5, color: 'rgba(242,237,230,.62)', margin: 0 }}>{card.sensory}</p>
        </div>

        {/* Along the way — characterDimensions pills */}
        {card.characterDimensions && !Array.isArray(card.characterDimensions) && (
          <AlongTheWay dims={card.characterDimensions} />
        )}

        {/* Landmark peek */}
        {card.landmarkPeek && card.landmarkPeek.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 12, color: 'rgba(79,143,171,.85)' }}>
            <span className="ms" style={{ fontSize: 14, flexShrink: 0 }}>visibility</span>
            <span>
              {card.landmarkPeek.slice(0, 2).map((lm, i) => (
                <span key={lm}>
                  {i > 0 && <span style={{ color: 'rgba(255,255,255,.25)', margin: '0 4px' }}>·</span>}
                  Glimpse of {lm}
                </span>
              ))}
              <span style={{ color: '#726559', marginLeft: 5 }}>✦</span>
            </span>
          </div>
        )}

        {/* Condition note */}
        {card.conditionNote && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: 'rgba(212,168,83,.8)', background: 'rgba(212,168,83,.07)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(212,168,83,.15)' }}>
            <span className="ms" style={{ fontSize: 14, flexShrink: 0 }}>wb_sunny</span>
            <span>{card.conditionNote}</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{ ...LF, fontSize: 11, fontWeight: 600, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'rgba(242,237,230,.34)' }}>
            Reel · {card.reelPos}
          </span>
          {pos < total && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(242,237,230,.4)',
              animation: 'scrollHint 1.8s ease-in-out infinite' }}>
              <span style={{ ...LF, fontSize: 11, letterSpacing: '.04em' }}>swipe</span>
              <span className="ms" style={{ fontSize: 18, lineHeight: 1 }}>expand_more</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
