// ReelScenicScenes.tsx — Animated scene backgrounds for the Scenic Road Reel cards.
// Ported from design_handoff_scenic_reel/scenic-scenes.jsx (pure CSS animation, no JS frame loop).
// Sc* prefix avoids collision with transit scene helpers.

import { useId } from 'react';
import type { ReelScenicCard } from './types';
import { ReelImg } from './ReelImg';

// ── Parallax helper ──────────────────────────────────────────────────────────
interface ScParallaxProps {
  dur: number;
  height: string | number;
  top?: string | number;
  bottom?: string | number;
  opacity?: number;
  reverse?: boolean;
  children: React.ReactNode;
}

export function ScParallax({ dur, height, top, bottom, opacity = 1, reverse = false, children }: ScParallaxProps) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, height, top, bottom, overflow: 'hidden', opacity, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '200%', height: '100%', display: 'flex',
        animation: `${reverse ? 'parRev' : 'par'} ${dur}s linear infinite`,
      }}>
        <div style={{ flex: '0 0 50%', position: 'relative' }}>{children}</div>
        <div style={{ flex: '0 0 50%', position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Stars ────────────────────────────────────────────────────────────────────
const SC_STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 137.508) % 100,
  y: (i * 47.13) % 55,
  size: ((i * 7) % 3) + 1,
  o: 0.2 + ((i * 13) % 60) / 100,
  delay: (i % 7) * 0.5,
}));

function ScStars({ count = 30, area = 50 }: { count?: number; area?: number }) {
  return (
    <>
      {SC_STARS.slice(0, count).map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${s.x}%`, top: `${(s.y / 55) * area}%`,
          width: s.size, height: s.size, borderRadius: '50%',
          background: '#f2ede6', opacity: s.o,
          boxShadow: s.size > 1 ? '0 0 4px rgba(242,237,230,.6)' : 'none',
          animation: `twinkle 3.6s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </>
  );
}

// ── Scene pill (top-center glass badge) ─────────────────────────────────────
const MS_SCENE: Record<string, string> = {
  walk: 'directions_walk', car: 'directions_car', twilight: 'wb_twilight',
  terrain: 'terrain', forest: 'forest',
};

export function ScenePill({ icon, code, meta, live = false, accent = '#d4a853' }: {
  icon?: string; code: string; meta: string; live?: boolean; accent?: string;
}) {
  return (
    <div style={{
      position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
      padding: '7px 14px', borderRadius: 99,
      background: 'rgba(12,14,22,.55)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(242,237,230,.10)', zIndex: 4,
    }}>
      {live
        ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent,
            boxShadow: `0 0 8px ${accent}`, animation: 'livePulseGreen 1.8s ease-in-out infinite', flexShrink: 0 }} />
        : icon && (
            <span className="ms" style={{
              fontSize: 13, color: accent, lineHeight: 1,
              fontVariationSettings: "'FILL' 1, 'wght' 400",
            }}>{MS_SCENE[icon] ?? icon}</span>
          )}
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: '#f2ede6', letterSpacing: '.08em' }}>{code}</span>
      <span style={{ width: 1, height: 10, background: 'rgba(242,237,230,.15)', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'rgba(242,237,230,.7)' }}>{meta}</span>
    </div>
  );
}

// ── Photo placeholder (used by walk/drive when no real photo yet) ────────────
function ScPhotoPlaceholder({ label, sub, tint = '#7c8aa0' }: { label: string; sub?: string; tint?: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0c0e14' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(135deg, ${tint}22 0 2px, transparent 2px 11px)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 38%, ${tint}22, transparent 62%)` }} />
      {/* corner brackets */}
      {(['tl','tr','bl','br'] as const).map((pos) => {
        const base: React.CSSProperties = { position: 'absolute', width: 18, height: 18, borderColor: `${tint}55` };
        const loc: React.CSSProperties =
          pos === 'tl' ? { top: 64, left: 22, borderTop: `1.5px solid`, borderLeft: `1.5px solid` } :
          pos === 'tr' ? { top: 64, right: 22, borderTop: `1.5px solid`, borderRight: `1.5px solid` } :
          pos === 'bl' ? { bottom: 22, left: 22, borderBottom: `1.5px solid`, borderLeft: `1.5px solid` } :
                         { bottom: 22, right: 22, borderBottom: `1.5px solid`, borderRight: `1.5px solid` };
        return <div key={pos} style={{ ...base, ...loc }} />;
      })}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 32px', textAlign: 'center',
      }}>
        <span className="ms" style={{ fontSize: 26, color: `${tint}aa`, lineHeight: 1, fontVariationSettings: "'FILL' 0" }}>image</span>
        <span style={{ fontFamily: "'DM Mono','DM Sans',monospace", fontSize: 11, fontWeight: 500, letterSpacing: '.14em', color: `${tint}cc`, textTransform: 'uppercase' }}>{label}</span>
        {sub && <span style={{ fontFamily: "'DM Mono','DM Sans',monospace", fontSize: 9.5, letterSpacing: '.1em', color: `${tint}88` }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── 1 · WALK SPINE — two photos stacked, gradient overlap, walk connector ───────
export function WalkSpineScene({ card }: { card: ReelScenicCard }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0908', overflow: 'hidden', position: 'relative' }}>

      {/* Origin photo — top half */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        {card.originPhotoUrl
          ? <ReelImg src={card.originPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #1c1a18 0%, #100e0c 100%)' }} />
        }
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to bottom, transparent, #0a0908)' }} />
        <div style={{ position: 'absolute', top: 56, left: 24 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 3 }}>From</div>
          <div style={{ color: '#f5f0ea', fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 600, lineHeight: 1.1 }}>{card.from}</div>
        </div>
      </div>

      {/* Destination photo — bottom half */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        {card.destPhotoUrl
          ? <ReelImg src={card.destPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #100e0c 0%, #1c1a18 100%)' }} />
        }
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to top, transparent, #0a0908)' }} />
        <div style={{ position: 'absolute', bottom: 64, left: 24 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 3 }}>To</div>
          <div style={{ color: '#f5f0ea', fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 600, lineHeight: 1.1 }}>{card.to}</div>
        </div>
      </div>

      {/* Walk connector centred on the dark overlap band */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 1, background: 'repeating-linear-gradient(90deg, rgba(212,168,83,0.45) 0 5px, transparent 5px 10px)' }} />
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(212,168,83,0.1)', border: '1.5px solid rgba(212,168,83,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="ms fill" style={{ fontSize: 20, color: '#d4a853' }}>directions_walk</span>
          </div>
          <div style={{ width: 56, height: 1, background: 'repeating-linear-gradient(90deg, rgba(212,168,83,0.45) 0 5px, transparent 5px 10px)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#d4a853', fontSize: 14, fontWeight: 700 }}>{card.metaRight}</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{card.timing}</span>
        </div>
      </div>

    </div>
  );
}

// ── 2 · SELF-DRIVE DAY — photo scene (real photo or placeholder) ─────────────
export function SelfDriveScene({ photoUrl }: { photoUrl?: string | null }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {photoUrl
        ? <ReelImg src={photoUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <ScPhotoPlaceholder label="Route map" sub="Panaji → Baga · 3 viewpoints" tint="#e0a06a" />
      }
      <ScenePill icon="car" code="SELF-DRIVE" meta="Day 2 · 47 km" accent="#f4c478" />
    </div>
  );
}

// ── 3 · COASTAL ROAD — animated sunset sea cliff ─────────────────────────────
export function CoastalScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(180deg, #11233f 0%, #1f3d5e 24%, #4a5f74 42%, #c87a4e 56%, #ecab5e 63%, #b9824e 67%, #16384a 72%, #0a1a26 100%)' }}>

      <ScStars count={16} area={30} />

      {/* Low sun on horizon */}
      <div style={{
        position: 'absolute', right: '26%', top: '57%', width: 56, height: 56, borderRadius: '50%',
        background: 'radial-gradient(circle, #ffe7b6 0%, #f4c478 50%, rgba(244,196,120,0) 78%)',
        boxShadow: '0 0 80px rgba(244,196,120,.55)',
      }} />

      {/* Cloud streaks */}
      {[{ x: 6, y: 16, w: 110, o: .14 }, { x: 54, y: 11, w: 150, o: .17 }, { x: 24, y: 24, w: 80, o: .1 }].map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: `${c.x}%`, top: `${c.y}%`, width: c.w, height: 6,
          borderRadius: 99, background: 'rgba(255,231,200,1)', opacity: c.o, filter: 'blur(5px)' }} />
      ))}

      {/* Sea + sun reflection */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '63%', bottom: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '26%', top: 0, width: 56, height: '70%', transform: 'translateX(50%)',
          background: 'linear-gradient(180deg, rgba(244,196,120,.5), rgba(244,196,120,.04) 80%, transparent)', filter: 'blur(7px)' }} />
        <ScParallax dur={16} height="36%" top="6%">
          <svg viewBox="0 0 400 30" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M 0 18 Q 25 9 50 18 T 100 18 T 150 18 T 200 18 T 250 18 T 300 18 T 350 18 T 400 18 L 400 30 L 0 30 Z" fill="rgba(40,46,68,.6)" />
          </svg>
        </ScParallax>
        <ScParallax dur={10} height="40%" top="30%" reverse>
          <svg viewBox="0 0 400 30" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M 0 18 Q 18 7 36 18 T 72 18 T 108 18 T 144 18 T 180 18 T 216 18 T 252 18 T 288 18 T 324 18 T 360 18 T 400 18 L 400 30 L 0 30 Z" fill="rgba(28,44,62,.85)" />
          </svg>
        </ScParallax>
        {[16, 34, 50, 66, 80].map((x, i) => (
          <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${18 + (i * 11) % 44}%`, width: 3, height: 1,
            background: '#f4d068', opacity: .6, animation: `twinkle 2.2s ease-in-out ${i * .3}s infinite` }} />
        ))}
      </div>

      {/* Headland + curving coast road */}
      <svg viewBox="0 0 400 230" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '64%' }}>
        <path d="M 0 70 Q 70 40 150 60 Q 250 86 400 64 L 400 230 L 0 230 Z" fill="#0a1620" />
        <path d="M 0 70 Q 70 40 150 60 Q 250 86 400 64" fill="none" stroke="rgba(244,196,120,.25)" strokeWidth="1.5" />
        <path d="M 150 230 Q 150 150 200 120 Q 250 92 330 96 L 372 96 L 372 110 L 332 110 Q 262 106 222 132 Q 184 158 184 230 Z" fill="#171b22" />
        <path d="M 168 230 Q 168 156 214 128 Q 256 104 332 104" fill="none" stroke="rgba(244,196,120,.7)" strokeWidth="2" strokeDasharray="11 12"
          style={{ animation: 'dashFlow 1.4s linear infinite' }} />
      </svg>

      <ScenePill icon="twilight" code="COASTAL · NH-66" meta="Sunset window · 6:10 PM" accent="#f4c478" />
    </div>
  );
}

// ── 4 · RIDGE ROAD — alpine pass, switchback road ────────────────────────────
export function RidgeScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(180deg, #16233f 0%, #2c4068 30%, #5a5e84 50%, #b87a72 64%, #e7a878 74%, #6a5c6e 84%, #20283c 100%)' }}>

      <ScStars count={12} area={22} />

      {/* Dawn sun */}
      <div style={{ position: 'absolute', left: '24%', top: '50%', width: 64, height: 64, borderRadius: '50%',
        background: 'radial-gradient(circle, #ffe2b0 0%, #eaa766 55%, rgba(234,167,102,0) 80%)', filter: 'blur(2px)' }} />

      {/* Far ridge */}
      <ScParallax dur={80} height="26%" top="44%" opacity={0.9}>
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M 0 100 L 50 52 L 92 74 L 140 40 L 188 68 L 236 38 L 286 66 L 336 44 L 400 70 L 400 100 Z" fill="#4a5578" opacity="0.7" />
        </svg>
      </ScParallax>

      {/* Cloud band between ridges */}
      <ScParallax dur={34} height="14%" top="56%" opacity={0.8} reverse>
        <svg viewBox="0 0 400 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <g fill="rgba(232,210,200,.5)">
            <ellipse cx="60" cy="22" rx="70" ry="7" />
            <ellipse cx="220" cy="16" rx="90" ry="6" />
            <ellipse cx="350" cy="24" rx="60" ry="7" />
          </g>
        </svg>
      </ScParallax>

      {/* Mid ridge */}
      <ScParallax dur={46} height="26%" top="58%" opacity={0.95}>
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M 0 100 L 60 44 L 120 76 L 180 36 L 248 70 L 312 40 L 372 72 L 400 58 L 400 100 Z" fill="#2c3553" />
        </svg>
      </ScParallax>

      {/* Near ridge + switchback road */}
      <svg viewBox="0 0 400 180" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '52%' }}>
        <path d="M 0 70 L 90 18 L 170 56 L 260 14 L 340 50 L 400 28 L 400 180 L 0 180 Z" fill="#161b2e" />
        <path d="M 0 70 L 90 18 L 170 56 L 260 14 L 340 50 L 400 28" fill="none" stroke="rgba(234,167,102,.3)" strokeWidth="1.5" />
        <path d="M 40 180 Q 120 150 150 120 Q 175 96 245 104 Q 300 110 300 88" fill="none" stroke="rgba(244,196,120,.65)" strokeWidth="2.4" strokeDasharray="11 12"
          style={{ animation: 'dashFlow 1.6s linear infinite' }} />
      </svg>

      <ScenePill icon="terrain" code="RIDGE · 2,640 m" meta="Morning · +340 m gain" accent="#9ec5ff" />
    </div>
  );
}

// ── 5 · CROWD-FREE — empty pre-dawn road, drifting mist ──────────────────────
export function CrowdFreeScene() {
  const gId = useId().replace(/:/g, '');
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(180deg, #131b33 0%, #243153 28%, #4a4a6e 48%, #8a6a72 60%, #b98a72 67%, #2c3346 76%, #10141f 100%)' }}>

      <ScStars count={20} area={36} />

      {/* Dawn glow */}
      <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translate(-50%,-50%)', width: 200, height: 70,
        background: 'radial-gradient(ellipse, rgba(236,170,120,.4), transparent 70%)', filter: 'blur(8px)' }} />

      {/* Distant treeline */}
      <ScParallax dur={70} height="12%" top="56%" opacity={0.9}>
        <svg viewBox="0 0 400 50" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <g fill="#0e1626">
            {[14, 48, 84, 128, 176, 230, 286, 340, 388].map((x, i) => (
              <ellipse key={i} cx={x} cy="42" rx={11 + (i % 3) * 4} ry={9 + (i % 2) * 3} />
            ))}
          </g>
        </svg>
      </ScParallax>

      {/* Empty road, vanishing point */}
      <svg viewBox="0 0 400 230" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '62%' }}>
        <defs>
          <linearGradient id={`cfRoad-${gId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2030" />
            <stop offset="100%" stopColor="#0a0d16" />
          </linearGradient>
        </defs>
        <polygon points="188,0 212,0 320,230 80,230" fill={`url(#cfRoad-${gId})`} />
        <line x1="200" y1="6" x2="200" y2="230" stroke="rgba(244,196,120,.45)" strokeWidth="3" strokeDasharray="6 26"
          style={{ animation: 'dashSlow 5s linear infinite' }} />
      </svg>

      {/* Drifting mist bands */}
      {[{ t: '60%', d: 26, o: .16 }, { t: '70%', d: 20, o: .2 }, { t: '80%', d: 15, o: .26 }].map((m, i) => (
        <ScParallax key={i} dur={m.d} height="14%" top={m.t} opacity={m.o} reverse={i % 2 === 0}>
          <div style={{ position: 'absolute', left: '4%', right: '4%', top: '40%', height: 18, borderRadius: 99,
            background: 'rgba(226,224,232,1)', filter: 'blur(10px)' }} />
        </ScParallax>
      ))}

      <ScenePill code="0 VEHICLES · 6 AM" meta="Zero-traffic window" live accent="#5cd97a" />
    </div>
  );
}

// ── 6 · FOREST CANOPY — road into trees, dappled light, falling leaves ────────
export function ForestScene() {
  const gId = useId().replace(/:/g, '');
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 46%, #9cae6e 0%, #5c7a48 14%, #2c4a30 38%, #16301e 62%, #0c1c12 100%)' }}>

      {/* Road into forest */}
      <svg viewBox="0 0 400 230" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '60%' }}>
        <defs>
          <linearGradient id={`fRoad-${gId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#48402f" />
            <stop offset="55%" stopColor="#241f17" />
            <stop offset="100%" stopColor="#15120c" />
          </linearGradient>
        </defs>
        <polygon points="190,0 210,0 322,230 78,230" fill={`url(#fRoad-${gId})`} />
        <line x1="200" y1="4" x2="200" y2="230" stroke="rgba(244,224,150,.5)" strokeWidth="3" strokeDasharray="11 12"
          style={{ animation: 'dashFlow 2.4s linear infinite' }} />
      </svg>

      {/* Trunks parallax (forward motion) */}
      <ScParallax dur={9} height="80%" top="6%" opacity={0.96}>
        {[2, 9, 88, 95].map((x, i) => (
          <div key={i} style={{ position: 'absolute', left: `${x}%`, bottom: 0, width: 6 + (i % 2) * 4, height: `${52 + (i % 3) * 14}%`,
            background: 'linear-gradient(180deg, #0c1c12, #08140c)' }} />
        ))}
      </ScParallax>

      {/* Overhead canopy arch */}
      <svg viewBox="0 0 400 150" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: '58%' }}>
        <g fill="#0d2014">
          <path d="M 0 0 L 400 0 L 400 40 Q 320 96 200 78 Q 90 64 0 110 Z" opacity="0.95" />
        </g>
        <g fill="#103018" opacity="0.9">
          {[[40, 44], [96, 60], [150, 50], [210, 66], [268, 50], [320, 60], [368, 44]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx={40 + (i % 3) * 12} ry={26 + (i % 2) * 8} />
          ))}
        </g>
      </svg>

      {/* Dappled light spots */}
      {[{ x: 44, y: 64, s: 22 }, { x: 56, y: 72, s: 16 }, { x: 48, y: 82, s: 26 }, { x: 60, y: 58, s: 14 }, { x: 40, y: 76, s: 12 }].map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s * 0.5, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(244,224,150,.5), transparent 70%)', filter: 'blur(3px)',
          animation: `dappleScene ${3 + i * .6}s ease-in-out ${i * .4}s infinite` }} />
      ))}

      {/* Falling leaves */}
      {[{ x: 22, d: 7, dl: 0 }, { x: 70, d: 9, dl: 1.5 }, { x: 50, d: 8, dl: 3 }, { x: 84, d: 10, dl: 2 }].map((l, i) => (
        <div key={i} style={{ position: 'absolute', left: `${l.x}%`, top: '-6%', width: 7, height: 5, borderRadius: '0 60% 0 60%',
          background: '#c7a24e', opacity: .7, animation: `leafFall ${l.d}s linear ${l.dl}s infinite` }} />
      ))}

      <ScenePill icon="forest" code="CANOPY · 8 KM" meta="Shaded · −4–5 °C" accent="#86efac" />
    </div>
  );
}
