import { useEffect, useRef, useMemo } from 'react';
import type { ReelStopCard as ReelStopCardType } from './types';
import { getPlacePhotoUrl } from '../../../shared/api';
import {
  REEL_SCRIM, REEL_CONTENT_PADDING_STOP,
  todGradient, todDotColor, todLabel, skyTintForCondition,
  RAIN_COUNT, RAIN_SEED, RAIN_WIDTH, RAIN_LEN_MIN, RAIN_LEN_RANGE,
  RAIN_DUR_MIN, RAIN_DUR_RANGE, RAIN_DELAY_RANGE, RAIN_OPACITY_MIN, RAIN_OPACITY_RANGE, RAIN_BG,
  THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR,
  SNOW_COUNT, SNOW_SEED,
  STOP_H2_FS, STOP_H2_LH, STOP_H2_MB, STOP_H2_TEXT_SHADOW,
  STOP_COUNTER_BR, STOP_COUNTER_PAD, STOP_COUNTER_MB,
  STOP_TIME_ROW_BR, STOP_TIME_ROW_PAD, STOP_TIME_ROW_MB, STOP_META_ROW_MB,
  TOD_BADGE_TOP, TOD_BADGE_LEFT,
  WEATHER_ICON, makeRng,
} from './reel-constants';

interface Props {
  card: ReelStopCardType;
  active: boolean;
  archetype?: string;
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered') => void;
}

function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}:00 ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

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

export function ReelStopCard({ card, active, onInteract }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { stop } = card;
  const hour = new Date().getHours();
  const condition = (card.weather?.condition ?? 'clear').toLowerCase();
  const isSunny = condition === 'sunny' || condition === 'clear';
  const isThunder = condition.includes('thunder') || condition.includes('storm');
  const isSnow = condition.includes('snow') || condition.includes('blizzard');
  const hasParticles = ['rain', 'drizzle'].includes(condition) || isThunder || isSnow;

  // Use stop index as seed variation so each stop has different rain pattern
  const stopSeed = RAIN_SEED + (stop.day * 100 + card.stopNumber);
  const rainParticles = useMemo(
    () => isThunder
      ? makeRainParticles(THUNDER_COUNT, THUNDER_SEED + stopSeed, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR)
      : makeRainParticles(RAIN_COUNT, stopSeed, RAIN_LEN_MIN, RAIN_LEN_RANGE, 'rain'),
    [isThunder, stopSeed],
  );
  const snowParticles = useMemo(() => makeSnowParticles(SNOW_SEED + stopSeed), [stopSeed]);

  const photoUrl = stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800) : null);
  const dotColor = todDotColor(hour);

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active, onInteract]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active, onInteract]);

  const weatherIcon = WEATHER_ICON[condition] ?? 'wb_sunny';
  const weatherColor = isThunder ? '#a78bfa' : condition === 'rain' || condition === 'drizzle' ? '#60a5fa' : '#fbbf24';
  const weatherBg = isThunder ? 'rgba(8,4,18,.88)' : 'rgba(9,12,22,.82)';
  const weatherBorder = isThunder ? '1px solid rgba(124,58,237,.2)' : '1px solid var(--color-border)';

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#0c0c0e' }}>

      {/* Photo z-index:0 */}
      {photoUrl && (
        <img src={photoUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="" />
      )}

      {/* Sky tint z-index:2 */}
      <SkyTintLayers condition={condition} />

      {/* GRADIENT scrim z-index:3 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* ToD gradient z-index:4 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient(hour), pointerEvents: 'none' }} />

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

      {/* ToD badge z-index:11 */}
      <div style={{ position: 'absolute', top: TOD_BADGE_TOP, left: TOD_BADGE_LEFT, zIndex: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', maxWidth: 170, overflow: 'hidden' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todLabel(hour)}</span>
      </div>

      {/* Weather badge z-index:10 */}
      {card.weather && (
        <div style={{ position: 'absolute', top: TOD_BADGE_TOP, right: 13, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: weatherBg, backdropFilter: 'blur(10px)', border: weatherBorder }}>
          <span className="ms fill" style={{ fontSize: 12, color: weatherColor }}>{weatherIcon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{card.weather.temp}°</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>{card.weather.condition}</span>
        </div>
      )}

      {/* Content z-index:10 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: REEL_CONTENT_PADDING_STOP }}>

        {/* Stop counter */}
        <div style={{ display: 'inline-flex', marginBottom: STOP_COUNTER_MB }}>
          <div style={{ padding: STOP_COUNTER_PAD, borderRadius: STOP_COUNTER_BR, background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(6px)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.58)', margin: 0 }}>
              Stop {card.stopNumber} of {card.totalStops}
            </p>
          </div>
        </div>

        {/* Time row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: STOP_TIME_ROW_MB, padding: STOP_TIME_ROW_PAD, borderRadius: STOP_TIME_ROW_BR, background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(6px)' }}>
          <span className="ms" style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>schedule</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.88)', fontWeight: 600 }}>{fmt12h(stop.time)}</span>
          <span style={{ color: 'rgba(255,255,255,.18)' }}>·</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{fmtDuration(stop.durationMin)}</span>
          {card.movedFrom != null && (
            <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700, marginLeft: 3 }}>↑ rescheduled</span>
          )}
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: STOP_H2_FS, fontWeight: 700, color: '#fff', lineHeight: STOP_H2_LH, marginBottom: STOP_H2_MB, textShadow: STOP_H2_TEXT_SHADOW }}>
          {stop.title}
        </h2>

        {/* Metadata row */}
        <div style={{ display: 'flex', gap: 5, marginBottom: STOP_META_ROW_MB, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill" style={{ fontSize: 10, background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.72)' }}>
            {stop.area}
          </span>
          {stop.rating != null && (
            <span className="pill pa" style={{ fontSize: 10 }}>{stop.rating} ★</span>
          )}
        </div>

        {/* Order reason */}
        {card.orderReason && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
            <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, marginTop: 1 }}>schedule</span>
            <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{card.orderReason}</p>
          </div>
        )}

        {/* Order consequence */}
        {card.orderConsequence && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
            <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)', flexShrink: 0, marginTop: 1 }}>check_circle</span>
            <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{card.orderConsequence}</p>
          </div>
        )}

        {/* AI line (whyForYou) */}
        {stop.whyForYou && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--color-primary)', flexShrink: 0 }}>✦</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.55, fontStyle: 'italic' }}>{stop.whyForYou}</p>
          </div>
        )}
      </div>
    </div>
  );
}
