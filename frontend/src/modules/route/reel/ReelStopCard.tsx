import { useEffect, useRef, useMemo, useState } from 'react';
import type { ReelStopCard as ReelStopCardType } from './types';
import { ReelImg } from './ReelImg';
import { getPlacePhotoUrl } from '../../../shared/api';
import {
  REEL_SCRIM,
  todDotColor, todLabel, skyTintForCondition,
  RAIN_COUNT, RAIN_SEED, RAIN_WIDTH, RAIN_LEN_MIN, RAIN_LEN_RANGE,
  RAIN_DUR_MIN, RAIN_DUR_RANGE, RAIN_DELAY_RANGE, RAIN_OPACITY_MIN, RAIN_OPACITY_RANGE, RAIN_BG,
  THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR,
  SNOW_COUNT, SNOW_SEED,
  makeRng, WEATHER_ICON,
} from './reel-constants';

interface Props {
  card: ReelStopCardType;
  active: boolean;
  archetype?: string;
  weather?: { condition: string; temp: number } | null;
  primaryCity?: string;
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered') => void;
}

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:       '#0f0d0c',
  gold:     '#d4a853',
  goldBg:   'rgba(212,168,83,0.14)',
  goldBdr:  'rgba(212,168,83,0.25)',
  sage:     '#6b9470',
  sageBg:   'rgba(107,148,112,0.07)',
  sageBdr:  'rgba(107,148,112,0.14)',
  sky:      '#4f8fab',
  skyBg:    'rgba(79,143,171,0.10)',
  skyBdr:   'rgba(79,143,171,0.20)',
  text1:    '#f5f0ea',
  text2:    'rgba(255,255,255,0.68)',
  text3:    'rgba(255,255,255,0.42)',
  pillBg:   'rgba(0,0,0,0.68)',
  pillBdr:  'rgba(255,255,255,0.18)',
  pillClr:  'rgba(255,255,255,0.90)',
  ctrBg:    'rgba(0,0,0,0.68)',
};

// ── Helpers ───────────────────────────────────────────────────
function wxIcon(condition: string): string {
  const c = condition.toLowerCase();
  return WEATHER_ICON[c] ?? WEATHER_ICON[c.split(' ')[0]] ?? 'wb_sunny';
}

function crowdNote(
  category: string | undefined,
  hour: number,
): { note: string; timing: 'before' | 'during' } | null {
  const cat = (category || '').toLowerCase();

  const landmarks =
    cat.includes('museum') || cat.includes('attraction') ||
    cat.includes('landmark') || cat.includes('temple') || cat.includes('shrine') ||
    cat.includes('castle') || cat.includes('historic') || cat.includes('gallery');
  const food =
    cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe');
  const market = cat.includes('market') || cat.includes('shopping');
  const park   = cat.includes('park') || cat.includes('garden');
  const beach  = cat.includes('beach');
  const viewpoint = cat.includes('viewpoint');
  const bar    = cat.includes('bar') || cat.includes('nightlife');
  const spa    = cat.includes('spa') || cat.includes('wellness') || cat.includes('massage');

  if (landmarks) {
    if (hour >= 10 && hour <= 15)
      return { note: 'Crowd peak now · allow extra time to explore', timing: 'during' };
    if (hour >= 8 && hour < 10)
      return { note: "Crowd peaks 10AM–3PM here. You're arriving early — good window.", timing: 'before' };
    if (hour >= 16)
      return { note: 'Late afternoon visit — crowds thinning out.', timing: 'before' };
  }
  if (food) {
    if (hour >= 12 && hour <= 14)
      return { note: 'Lunch rush now · expect 15–20 min wait', timing: 'during' };
    if (hour >= 19 && hour <= 21)
      return { note: 'Dinner peak hours · reservation recommended', timing: 'during' };
    if (hour >= 7 && hour < 10)
      return { note: 'Quiet morning window — good for a slow breakfast.', timing: 'before' };
  }
  if (market) {
    if (hour >= 11 && hour <= 15)
      return { note: 'Busiest midday · quieter before 10AM or after 4PM', timing: 'during' };
    if (hour >= 9 && hour < 11)
      return { note: 'Gets busy after 11AM. Good time to browse.', timing: 'before' };
  }
  if (park && hour >= 9 && hour < 11)
    return { note: 'Morning is the best window here — good light, fewer people.', timing: 'before' };
  if (beach) {
    if (hour >= 10 && hour <= 15)
      return { note: 'Peak beach hours · busiest now', timing: 'during' };
    if (hour < 9)
      return { note: 'Early morning beach visit — quiet and good light.', timing: 'before' };
    if (hour >= 17)
      return { note: 'Late afternoon — crowds drop off, good for a walk.', timing: 'before' };
  }
  if (viewpoint) {
    if (hour < 9)
      return { note: 'Great time for a viewpoint — soft morning light.', timing: 'before' };
    if (hour >= 17)
      return { note: 'Golden hour window — best light of the day.', timing: 'before' };
    if (hour >= 10 && hour <= 15)
      return { note: 'Busiest hours for viewpoints. Expect company.', timing: 'during' };
  }
  if (bar) {
    if (hour < 17)
      return { note: 'Opens later — check hours before heading over.', timing: 'before' };
    if (hour >= 21)
      return { note: 'Peak bar hours now · lively tonight.', timing: 'during' };
  }
  if (spa) {
    if (hour >= 12 && hour <= 15)
      return { note: 'Mid-afternoon slot — typically the quietest booking window.', timing: 'before' };
    if (hour >= 10 && hour < 12)
      return { note: 'Morning sessions fill fast — worth booking ahead.', timing: 'before' };
  }
  return null;
}

function whatToDo(category: string | undefined): { icon: string; text: string }[] {
  const cat = (category || '').toLowerCase();
  if (cat.includes('museum')) return [
    { icon: 'photo_camera', text: 'Start with the permanent collection — skip the gift shop for now' },
    { icon: 'schedule',     text: 'Budget 90–120 min; audio guides add 30 min' },
  ];
  if (cat.includes('gallery')) return [
    { icon: 'explore',      text: 'Walk the full space before lingering — get the layout first' },
    { icon: 'photo_camera', text: 'Natural light is best — check window-side works' },
  ];
  if (cat.includes('temple') || cat.includes('shrine')) return [
    { icon: 'photo_camera', text: 'Walk through the main gate and into the courtyard' },
    { icon: 'self_improvement', text: 'Early morning has a different quality to it — quieter and atmospheric' },
  ];
  if (cat.includes('castle') || cat.includes('historic') || cat.includes('landmark')) return [
    { icon: 'explore',   text: 'Walk the perimeter before going inside' },
    { icon: 'schedule',  text: 'Guided visits add real depth — check times at the entrance' },
  ];
  if (cat.includes('viewpoint')) return [
    { icon: 'photo_camera',    text: 'Give yourself 15 min for the view to land' },
    { icon: 'directions_walk', text: 'Walk the full platform before picking your angle' },
  ];
  if (cat.includes('market')) return [
    { icon: 'payments', text: 'Bring cash — most stalls are cash only' },
    { icon: 'schedule', text: 'First pass to scout, second pass to buy' },
  ];
  if (cat.includes('park') || cat.includes('garden')) return [
    { icon: 'directions_walk', text: 'Walk the outer path first to get a feel for the space' },
    { icon: 'photo_camera',    text: 'Best light at the edges, not the centre' },
  ];
  if (cat.includes('beach')) return [
    { icon: 'directions_walk', text: 'Walk the full length first — assess before settling' },
    { icon: 'schedule',        text: 'Morning light is the most flattering here' },
  ];
  if (cat.includes('restaurant') || cat.includes('food')) return [
    { icon: 'restaurant', text: 'Ask what the kitchen is proud of today' },
    { icon: 'schedule',   text: 'Dinner reservations fill early in popular spots' },
  ];
  if (cat.includes('cafe') || cat.includes('coffee')) return [
    { icon: 'local_cafe',   text: 'Single origin if available — worth asking' },
    { icon: 'photo_camera', text: 'Best seats are usually near the window or counter' },
  ];
  if (cat.includes('bar') || cat.includes('nightlife')) return [
    { icon: 'local_bar',  text: 'Ask the bartender for a house recommendation' },
    { icon: 'schedule',   text: 'Fills up after 9PM — earlier visit is more relaxed' },
  ];
  if (cat.includes('shopping') || cat.includes('store')) return [
    { icon: 'payments',     text: 'Check for tax-free options if visiting from abroad' },
    { icon: 'explore',      text: 'Side streets near here often have better finds' },
  ];
  if (cat.includes('spa') || cat.includes('wellness') || cat.includes('massage')) return [
    { icon: 'self_improvement', text: 'Arrive 15 min early — rushing in defeats the point' },
    { icon: 'schedule',         text: 'Ask about add-ons when booking, not on arrival' },
  ];
  if (cat.includes('theater') || cat.includes('concert') || cat.includes('performance')) return [
    { icon: 'confirmation_number', text: 'Check the programme at the door for running time' },
    { icon: 'schedule',            text: 'Doors close promptly — plan for 20 min arrival buffer' },
  ];
  return [
    { icon: 'explore',      text: 'Take your time — notice what most people walk past' },
    { icon: 'photo_camera', text: 'Best angles are usually off the main path' },
  ];
}

function todayHours(weekdayText: string[] | null): string | null {
  if (!weekdayText?.length) return null;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = days[new Date().getDay()];
  const entry = weekdayText.find(t => t.startsWith(todayName));
  if (!entry) return null;
  const match = entry.match(/–\s*(.+)/);
  return match ? `Open until ${match[1].trim()}` : null;
}

function priceLabel(level: number | null | undefined): string | null {
  if (!level) return null;
  return '$'.repeat(Math.min(level, 4));
}

function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}:00 ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function addMinutes(time: string, min: number): string {
  const [h, m] = time.split(':').map(Number);
  return fmt12h(`${Math.floor((h * 60 + m + min) / 60) % 24}:${String((m + min) % 60).padStart(2, '0')}`);
}

// ── Particle factories ────────────────────────────────────────
function makeRainParticles(count: number, seedVal: number, lenMin: number, lenRange: number, color: string) {
  const rng = makeRng(seedVal);
  return Array.from({ length: count }, () => ({
    position: 'absolute' as const,
    left: `${rng() * 100}%`,
    top: '-15%',
    width: RAIN_WIDTH,
    height: `${lenMin + rng() * lenRange}px`,
    background: color === 'rain' ? RAIN_BG : `linear-gradient(to bottom,transparent,${color})`,
    opacity: RAIN_OPACITY_MIN + rng() * RAIN_OPACITY_RANGE,
    animation: `precip ${RAIN_DUR_MIN + rng() * RAIN_DUR_RANGE}s linear ${-rng() * RAIN_DELAY_RANGE}s infinite`,
  }));
}

function makeSnowParticles(seedVal: number) {
  const rng = makeRng(seedVal);
  return Array.from({ length: SNOW_COUNT }, (_, i) => {
    const size = 3 + rng() * 3;
    return {
      outer: { position: 'absolute' as const, left: `${rng() * 100}%`, top: '-10%', animation: `snowSway${(i % 3) + 1} ${2.5 + rng() * 2}s ease-in-out ${-rng() * 3}s infinite, snowFall ${3 + rng() * 4}s linear ${-rng() * 6}s infinite` } as React.CSSProperties,
      inner: { width: size, height: size, borderRadius: '50%', background: 'rgba(220,235,255,0.85)', filter: 'blur(0.5px)' } as React.CSSProperties,
    };
  });
}

// ── Sub-components ────────────────────────────────────────────
function SkyTintLayers({ condition }: { condition: string }) {
  const result = skyTintForCondition(condition);
  if ('double' in result) {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.double, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.double, opacity: 0.6, pointerEvents: 'none' }} />
      </>
    );
  }
  return <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.single, pointerEvents: 'none' }} />;
}

function SunRays() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: '-20%', top: '-20%', width: '90%', height: '80%', background: 'radial-gradient(ellipse at top right,rgba(255,215,150,.38),rgba(255,215,150,0) 60%)', filter: 'blur(6px)', animation: 'sunGlow 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '90%', height: '180%', transformOrigin: 'top right', animation: 'rayRotate 80s linear infinite' }}>
        <div style={{ position: 'absolute', top: 0, left: '40%', width: 80, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.25),rgba(255,225,160,0) 65%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(12px)' }} />
        <div style={{ position: 'absolute', top: 0, left: '55%', width: 40, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.35),rgba(255,235,180,0) 65%)', transform: 'rotate(14deg)', transformOrigin: 'top center', filter: 'blur(8px)' }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function ReelStopCard({ card, active, onInteract }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { stop } = card;
  const hour      = stop.time ? parseInt(stop.time.split(':')[0], 10) : new Date().getHours();
  const dotColor  = todDotColor(hour);
  const condition = (card.weather?.condition ?? 'clear').toLowerCase();
  const isSunny   = condition.includes('sunny') || condition.includes('clear');
  const isThunder = condition.includes('thunder') || condition.includes('storm');
  const isSnow    = condition.includes('snow') || condition.includes('blizzard');
  const hasParticles = condition.includes('rain') || condition.includes('drizzle') || isThunder || isSnow;

  const stopSeed     = RAIN_SEED + (stop.day * 100 + card.stopNumber);
  const rainParticles = useMemo(
    () => isThunder
      ? makeRainParticles(THUNDER_COUNT, THUNDER_SEED + stopSeed, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR)
      : makeRainParticles(RAIN_COUNT, stopSeed, RAIN_LEN_MIN, RAIN_LEN_RANGE, 'rain'),
    [isThunder, stopSeed],
  );
  const snowParticles = useMemo(() => makeSnowParticles(SNOW_SEED + stopSeed), [stopSeed]);

  const photoUrl = stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800, 1200) : null);
  const [imgFailed, setImgFailed] = useState(false);

  // Category-based gradient fallback when no photo available or image failed to load
  const noPhotoGradient = (!photoUrl || imgFailed) ? (() => {
    const cat = stop.category ?? '';
    if (cat.includes('cafe') || cat.includes('coffee') || cat.includes('restaurant') || cat.includes('bar'))
      return 'linear-gradient(160deg, #1a120a 0%, #2c1c0f 40%, #0f0d0c 100%)';
    if (cat.includes('museum') || cat.includes('gallery') || cat.includes('heritage'))
      return 'linear-gradient(160deg, #0d1520 0%, #1a2535 40%, #0f0d0c 100%)';
    if (cat.includes('park') || cat.includes('garden') || cat.includes('nature'))
      return 'linear-gradient(160deg, #0a1510 0%, #132112 40%, #0f0d0c 100%)';
    if (cat.includes('temple') || cat.includes('monument') || cat.includes('palace'))
      return 'linear-gradient(160deg, #180e1a 0%, #2a1830 40%, #0f0d0c 100%)';
    return 'linear-gradient(160deg, #141018 0%, #1e1a28 40%, #0f0d0c 100%)';
  })() : null;

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active, onInteract]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active, onInteract]);

  const serverSignals  = stop.signals ?? [];
  const hasServerSignals = serverSignals.length > 0;
  const crowd          = hasServerSignals ? null : crowdNote(stop.category, hour);
  const todos          = whatToDo(stop.category);
  const hoursStr       = todayHours(stop.weekdayText);
  const reasonText     = card.orderReason ?? card.orderConsequence ?? (stop.whyForYou || null);

  // Identity label from discovery stage
  const stageLabel = stop.stage === 'hidden_gem'
    ? { text: 'Hidden gem', icon: 'diamond' }
    : stop.stage === 'rising' && (stop.velocityRatio ?? 0) >= 2.0
    ? { text: 'Trending now', icon: 'trending_up' }
    : stop.stage === 'rising'
    ? { text: 'Rising', icon: 'north_east' }
    : null;

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: noPhotoGradient ?? T.bg }}>

      {/* Photo z-index:0 — shimmer while loading, retry once on error */}
      {!imgFailed && (
        <ReelImg
          src={photoUrl}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', zIndex: 0 }}
          onFallback={() => setImgFailed(true)}
        />
      )}

      {/* TOD badge — top-left, z-index:11 */}
      <div style={{ position: 'absolute', top: 48, left: 13, zIndex: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', maxWidth: 170, overflow: 'hidden' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {todLabel(hour)}
        </span>
      </div>

      {/* Weather chip — top-right, z-index:10 */}
      {card.weather && (
        <div style={{ position: 'absolute', top: 48, right: 13, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: T.skyBg, border: `1px solid ${T.skyBdr}`, borderRadius: 20, padding: '3px 10px' }}>
          <span className="ms" style={{ fontSize: 12, color: T.sky }}>{wxIcon(card.weather.condition ?? '')}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text1 }}>{card.weather.temp != null ? Math.round(card.weather.temp) : '--'}°</span>
          <span style={{ fontSize: 10, color: T.text3 }}>{(card.weather.condition ?? '').split(' ').slice(0, 2).join(' ')}</span>
        </div>
      )}

      {/* Sky tint z-index:2 */}
      <SkyTintLayers condition={condition} />

      {/* Scrim z-index:3 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* ToD gradient removed */}

      {/* Sun rays z-index:4 */}
      {isSunny && <SunRays />}

      {/* Weather particles z-index:5 */}
      {hasParticles && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {isSnow
            ? snowParticles.map((f, i) => <div key={`snow-${i}`} style={f.outer}><div style={f.inner} /></div>)
            : rainParticles.map((s, i) => <div key={`rain-${i}`} style={s} />)
          }
          {isThunder && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 6, background: 'radial-gradient(ellipse at 50% 25%,rgba(230,220,255,.95),rgba(180,150,230,.5) 32%,rgba(120,80,180,0) 70%)', mixBlendMode: 'screen', animation: 'flashFlicker 3.4s ease-out -1.3s infinite', pointerEvents: 'none' }} />
          )}
        </div>
      )}

      {/* ── stk-body: content zone, z-index:10 ─────────────────── */}
      <div className="stk-body" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 15px calc(88px + env(safe-area-inset-bottom, 0px))', zIndex: 10 }}>

        {/* Row 1: counter pill + identity chips */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 5, background: T.ctrBg, backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.pillClr }}>
              Stop {card.stopNumber} of {card.totalStops}
            </span>
          </div>
          {stageLabel && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, background: T.sageBg, border: `1px solid ${T.sageBdr}` }}>
              <span className="ms" style={{ fontSize: 10, color: T.sage }}>{stageLabel.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.sage }}>{stageLabel.text}</span>
            </div>
          )}
          {card.movedFrom != null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
              <span style={{ fontSize: 10 }}>↕</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.gold }}>Rescheduled</span>
            </div>
          )}
        </div>

        {/* Time row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 6, padding: '3px 9px', borderRadius: 6, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(10px)' }}>
          <span className="ms" style={{ fontSize: 11, color: T.text3 }}>schedule</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text1 }}>{fmt12h(stop.time)}</span>
          <span style={{ fontSize: 12, color: T.text3 }}>→ leave {addMinutes(stop.time, stop.durationMin)}</span>
        </div>

        {/* Title + area */}
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: T.text1, lineHeight: 1.05, margin: 0, marginBottom: 4, textShadow: '0 1px 5px rgba(0,0,0,.85),0 2px 14px rgba(0,0,0,.5)' }}>
          {stop.title}
        </h2>
        {(stop.area || stop.city) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9 }}>
            <span className="ms" style={{ fontSize: 11, color: T.text3 }}>location_on</span>
            <span style={{ fontSize: 12, color: T.text3, letterSpacing: '0.03em' }}>
              {stop.area && stop.city ? `${stop.area} · ${stop.city}` : (stop.area || stop.city)}
            </span>
          </div>
        ) : <div style={{ marginBottom: 9 }} />}

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 9 }}>
          {stop.rating != null && stop.rating > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: 10, color: T.pillClr, backdropFilter: 'blur(10px)' }}>
              {stop.rating} ★
            </span>
          )}
          {priceLabel(stop.priceLevel) && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: T.sageBg, border: `1px solid ${T.sageBdr}`, fontSize: 10, color: T.sage }}>
              {priceLabel(stop.priceLevel)}
            </span>
          )}
          {stop.tags && stop.tags.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: 10, color: T.pillClr, backdropFilter: 'blur(10px)' }}>
              {stop.tags[0]}
            </span>
          )}
        </div>

        {/* Narrative — WHY this stop is here. Primary story element. */}
        {reasonText && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(212,168,83,0.08)', borderLeft: `2px solid ${T.gold}` }}>
            <span style={{ fontSize: 13, color: T.text1, lineHeight: 1.55, fontStyle: 'italic', letterSpacing: '0.01em' }}>{reasonText}</span>
          </div>
        )}

        {/* Server-driven signals */}
        {hasServerSignals && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 9 }}>
            {serverSignals.map((sig, i) => {
              const isWarning = sig.type === 'crowd' && sig.text.includes('Peak');
              const isPhoto   = sig.type === 'photo';
              const isContent = sig.type === 'content';
              const bg    = isWarning ? 'rgba(212,100,50,0.12)' : isPhoto ? T.sageBg : isContent ? 'rgba(79,143,171,0.10)' : T.goldBg;
              const bdr   = isWarning ? 'rgba(212,100,50,0.30)' : isPhoto ? T.sageBdr : isContent ? T.skyBdr : T.goldBdr;
              const clr   = isWarning ? '#e07050' : isPhoto ? T.sage : isContent ? T.sky : T.gold;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '7px 11px', borderRadius: 8, background: bg, border: `1px solid ${bdr}`, overflow: 'hidden' }}>
                  <span className="ms" style={{ fontSize: 13, color: clr, flexShrink: 0, marginTop: 1 }}>{sig.icon}</span>
                  <span style={{ fontSize: 12, color: clr, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{sig.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Static crowd note — fallback when server signals absent */}
        {crowd && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 8,
            padding: '8px 12px', borderRadius: 8,
            background: crowd.timing === 'during' ? 'rgba(212,100,50,0.12)' : T.goldBg,
            border: `1px solid ${crowd.timing === 'during' ? 'rgba(212,100,50,0.30)' : T.goldBdr}`,
          }}>
            <span className="ms" style={{ fontSize: 13, color: crowd.timing === 'during' ? '#e07050' : T.gold, flexShrink: 0, marginTop: 1 }}>schedule</span>
            <span style={{ fontSize: 12, color: crowd.timing === 'during' ? '#e07050' : T.gold, lineHeight: 1.45 }}>{crowd.note}</span>
          </div>
        )}

        {/* What-to-do — always shown */}
        <div style={{ marginBottom: 9 }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: T.text3, margin: 0, marginBottom: 5 }}>
            AT THIS STOP
          </p>
          {todos.slice(0, 2).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: i < 1 ? 5 : 0 }}>
              <span className="ms" style={{ fontSize: 13, color: T.text3, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: T.text2, lineHeight: 1.4 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Footer row: hours chip */}
        {hoursStr && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: T.sageBg, border: `1px solid ${T.sageBdr}` }}>
            <span className="ms" style={{ fontSize: 11, color: T.sage }}>schedule</span>
            <span style={{ fontSize: 11, color: T.sage }}>{hoursStr}</span>
          </div>
        )}
      </div>
    </div>
  );
}
