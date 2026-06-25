import { useId } from 'react';
import type { ReelScenicCard as ReelScenicCardType } from './types';
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
function WalkCorridorViz({ accent, from, to }: { accent: string; from: string; to: string }) {
  const dot = (filled: boolean) => (
    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
      background: filled ? accent : 'transparent', border: `2px solid ${accent}`,
      boxShadow: filled ? `0 0 10px ${accent}88` : 'none' }} />
  );
  return (
    <VizCard label="WALK CORRIDOR" value="650 m connector" accent={accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {dot(true)}
        <div style={{ flex: 1, position: 'relative', height: 2, background: `${accent}33`, borderRadius: 99 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 99,
            background: `repeating-linear-gradient(90deg, ${accent} 0 6px, transparent 6px 11px)` }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99,
            background: '#13131a', border: `1px solid ${accent}55` }}>
            <span className="ms fill" style={{ fontSize: 13, color: accent, lineHeight: 1 }}>directions_walk</span>
            <span style={{ ...LF, fontSize: 11, fontWeight: 700, color: '#f2ede6' }}>9 min</span>
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
    case 'corridor':  return <WalkCorridorViz accent={card.accent} from={card.from} to={card.to} />;
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

function WalkCorridorCard({ card }: { card: ReelScenicCardType }) {
  const isHighWalk = card.persona.includes('walk') || card.persona.includes('hike') || card.persona.includes('slow');

  const ti = card.transitInfo;
  const hasRealTransit = ti?.has_transit === true;

  // Prefer real Google Directions walking data; fall back to haversine estimates
  const realDistM   = ti?.walk_distance_m ?? null;
  const realWalkMin = ti?.walk_duration_min ?? null;
  const viaStreets  = ti?.walk_via?.length ? ti.walk_via : null;

  const distValue = realDistM !== null
    ? (realDistM < 1000 ? `${realDistM} m` : `${(realDistM / 1000).toFixed(1)} km`)
    : card.metaRight.replace(/\s*walk$/i, '').trim();

  const walkMins = realWalkMin !== null
    ? realWalkMin
    : (() => { const m = card.sensory.match(/~?(\d+)\s*min/i); return m ? parseInt(m[1], 10) : 15; })();

  const timeValue = `~${walkMins} min`;
  const rideMins = Math.max(3, Math.round(walkMins * 0.4));
  const transitLabel = hasRealTransit
    ? getTransitLabel(ti!.transit_type, ti!.line_name)
    : null;
  const transitMins = hasRealTransit ? ti!.duration_min : null;
  const transitSubLabel = hasRealTransit && ti!.departure_stop
    ? `board at ${ti!.departure_stop}`
    : hasRealTransit ? 'nearest stop' : null;

  const photoUrl = card.destPhotoUrl ?? card.originPhotoUrl ?? card.photoUrl;

  return (
    <div style={{ width: '100%', height: '100dvh', overflow: 'hidden', position: 'relative', background: isHighWalk ? 'linear-gradient(160deg,#0a1218 0%,#0f1a22 40%,#0c1015 100%)' : 'linear-gradient(160deg,#120a18 0%,#1a0f22 40%,#100c15 100%)' }}>
      {/* Background photo */}
      {photoUrl && (
        <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0 }} />
      )}
      {/* Dark overlay scrim */}
      {photoUrl && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.55) 50%,rgba(0,0,0,.80) 100%)', zIndex: 1 }} />
      )}
      {/* Subtle radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 280px 350px at 50% 35%,${isHighWalk ? 'rgba(79,143,171,.12)' : 'rgba(150,100,210,.08)'},transparent)`, pointerEvents: 'none', zIndex: 2 }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '52px 20px calc(88px + env(safe-area-inset-bottom, 0px))', zIndex: 5 }}>
        {/* Spacer — pushes content to bottom */}
        <div style={{ flex: 1 }} />

        {/* Route title + subtitle */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: isHighWalk ? 'rgba(79,143,171,.8)' : 'rgba(196,181,253,.6)', marginBottom: 5 }}>
            {isHighWalk ? `${distValue} · ${timeValue} on foot` : distValue}
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isHighWalk ? 34 : 28, fontWeight: 600, color: '#f5f0ea', lineHeight: 1.1 }}>
            {card.from}
            <span style={{ fontSize: isHighWalk ? 22 : 18, color: 'rgba(255,255,255,.35)', margin: '0 6px' }}>→</span>
            {card.to}
          </div>
          {!isHighWalk && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>
              {transitLabel
                ? `or ${transitLabel} in ~${transitMins} min`
                : viaStreets
                  ? `via ${viaStreets.slice(0, 2).join(' · ')}`
                  : 'on foot'}
            </div>
          )}
          {!isHighWalk && card.detourMin > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '6px 11px', borderRadius: 99, background: 'rgba(196,181,253,.08)', border: '1px solid rgba(196,181,253,.2)' }}>
              <span className="ms" style={{ fontSize: 15, color: 'rgba(196,181,253,.7)' }}>add_circle</span>
              <span style={{ fontSize: 13, color: 'rgba(196,181,253,.75)' }}>+{card.detourMin} min · adds {card.detourKm} km to your day</span>
            </div>
          )}
        </div>

        {/* Badge — just above description */}
        {!isHighWalk && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8, padding: '4px 10px', borderRadius: 8, background: 'rgba(196,181,253,.1)', border: '1px solid rgba(196,181,253,.25)' }}>
            <span className="ms" style={{ fontSize: 15, color: 'rgba(196,181,253,.8)' }}>directions_walk</span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(196,181,253,.8)' }}>Optional detour</span>
          </div>
        )}

        {/* Why — persona voice */}
        <div style={{ fontSize: isHighWalk ? 15 : 15, color: isHighWalk ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.6)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 10 }}>
          {card.why}
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)', overflow: 'hidden' }}>
          {isHighWalk ? (
            <>
              {/* High-walk: time · distance · path type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1 }}>
                <span className="ms" style={{ fontSize: 15, color: 'rgba(79,143,171,.7)' }}>timer</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f0ea' }}>{timeValue}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>on foot</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <span className="ms" style={{ fontSize: 15, color: 'rgba(79,143,171,.7)' }}>straighten</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f0ea' }}>{distValue}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>flat route</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)', overflow: 'hidden' }}>
                <span className="ms" style={{ fontSize: 15, color: 'rgba(107,148,112,.7)', flexShrink: 0 }}>route</span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f0ea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {viaStreets ? viaStreets[0] : 'local path'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                    {viaStreets && viaStreets.length > 1 ? `via ${viaStreets.slice(1, 3).join(', ')}` : 'on foot'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Walk chip — always shown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: transitLabel ? 1 : 2 }}>
                <span className="ms" style={{ fontSize: 15, color: 'rgba(255,255,255,.25)' }}>directions_walk</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.8)' }}>{timeValue} walk</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>on foot</div>
                </div>
              </div>
              {/* Transit chip — only shown when city has real transit */}
              {transitLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                  <span className="ms" style={{ fontSize: 15, color: 'rgba(255,255,255,.25)' }}>subway</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{transitMins ?? '?'} min {transitLabel}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.28)' }}>{transitSubLabel}</div>
                  </div>
                </div>
              )}
              {/* Rideshare chip — always shown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', flex: 1, borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <span className="ms" style={{ fontSize: 15, color: 'rgba(255,255,255,.25)' }}>local_taxi</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>~{rideMins} min ride</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.28)' }}>rideshare</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export default function ReelScenicCard({ card }: Props) {
  if (card.sceneType === 'walk') {
    return <WalkCorridorCard card={card} />;
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
            lineHeight: 1.08, margin: 0, color: '#f2ede6', letterSpacing: '-.005em' }}>{card.place}</h2>
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
