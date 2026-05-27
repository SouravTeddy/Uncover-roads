import { useEffect, useRef, useMemo } from 'react';
import type { ReelIntroCard as ReelIntroCardType } from './types';
import {
  REEL_SCRIM, REEL_CONTENT_PADDING_INTRO,
  todGradient, skyTintForCondition,
  RAIN_COUNT, RAIN_SEED, RAIN_WIDTH, RAIN_LEN_MIN, RAIN_LEN_RANGE,
  RAIN_DUR_MIN, RAIN_DUR_RANGE, RAIN_DELAY_RANGE, RAIN_OPACITY_MIN, RAIN_OPACITY_RANGE, RAIN_BG,
  THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR,
  SNOW_COUNT, SNOW_SEED,
  INTRO_CITY_FS, INTRO_CITY_MB, INTRO_LABEL_MB, INTRO_PILL_GAP, INTRO_PILL_MB,
  INTRO_STRIP_BR, INTRO_STRIP_GAP, INTRO_TEXT_SHADOW,
  WEATHER_ICON, ENGINE_STRIP_COPY, makeRng,
} from './reel-constants';

interface Props {
  card: ReelIntroCardType;
  active: boolean;
  onInteract?: (action: 'viewed' | 'lingered') => void;
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
      outer: {
        position: 'absolute' as const,
        left: `${rng() * 100}%`,
        top: '-10%',
        animation: `snowSway${(i % 3) + 1} ${2.5 + rng() * 2}s ease-in-out ${-rng() * 3}s infinite, snowFall ${3 + rng() * 4}s linear ${-rng() * 6}s infinite`,
      } as React.CSSProperties,
      inner: {
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(220,235,255,0.85)', filter: 'blur(0.5px)',
      } as React.CSSProperties,
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
      <div style={{ position: 'absolute', right: '-20%', top: '-20%', width: '90%', height: '80%', background: 'radial-gradient(ellipse at top right,rgba(255,215,150,.40),rgba(255,215,150,0) 60%)', filter: 'blur(6px)', animation: 'sunGlow 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '90%', height: '180%', transformOrigin: 'top right', animation: 'rayRotate 80s linear infinite' }}>
        <div style={{ position: 'absolute', top: 0, left: '40%', width: 80, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.25),rgba(255,225,160,0) 65%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(12px)' }} />
        <div style={{ position: 'absolute', top: 0, left: '55%', width: 40, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.35),rgba(255,235,180,0) 65%)', transform: 'rotate(14deg)', transformOrigin: 'top center', filter: 'blur(8px)' }} />
      </div>
    </div>
  );
}

export function ReelIntroCard({ card, active, onInteract }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hour = new Date().getHours();
  const condition = (card.weather?.condition ?? 'clear').toLowerCase();
  const isSunny = condition === 'sunny' || condition === 'clear';
  const isRain = condition === 'rain' || condition === 'drizzle';
  const isThunder = condition.includes('thunder') || condition.includes('storm');
  const isSnow = condition.includes('snow') || condition.includes('blizzard');

  const rainParticles = useMemo(
    () => isThunder
      ? makeRainParticles(THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR)
      : makeRainParticles(RAIN_COUNT, RAIN_SEED, RAIN_LEN_MIN, RAIN_LEN_RANGE, 'rain'),
    [isThunder],
  );
  const snowParticles = useMemo(() => makeSnowParticles(SNOW_SEED), []);

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active, onInteract]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active, onInteract]);

  const dayCount = card.totalDays ?? 1;
  const tripLabel = dayCount === 1 ? 'Your day in' : `Your ${dayCount}-day trip`;

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#0c0c0e' }}>

      {/* City photo z-index:0 */}
      {card.imageUrl && (
        <img src={card.imageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="" />
      )}

      {/* Sky tint z-index:2 */}
      <SkyTintLayers condition={condition} />

      {/* GRADIENT scrim z-index:3 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* ToD gradient z-index:4 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient(hour), pointerEvents: 'none' }} />

      {/* Sun rays z-index:4 (sunny only) */}
      {isSunny && <SunRays />}

      {/* Weather particles z-index:5 */}
      {(isRain || isThunder || isSnow) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {isSnow
            ? snowParticles.map((f, i) => (
                <div key={`snow-${i}`} style={f.outer}><div style={f.inner as React.CSSProperties} /></div>
              ))
            : rainParticles.map((s, i) => <div key={`rain-${i}`} style={s} />)
          }
          {isThunder && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 6, background: 'radial-gradient(ellipse at 50% 25%,rgba(230,220,255,.95),rgba(180,150,230,.5) 32%,rgba(120,80,180,0) 70%)', mixBlendMode: 'screen', pointerEvents: 'none', animation: 'flashFlicker 3.4s ease-out -1.3s infinite' }} />
          )}
        </div>
      )}

      {/* Content z-index:10 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: REEL_CONTENT_PADDING_INTRO }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: INTRO_LABEL_MB }}>
          {tripLabel}
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: INTRO_CITY_FS, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: INTRO_CITY_MB, textShadow: INTRO_TEXT_SHADOW }}>
          {card.city}
        </h1>

        {/* Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: INTRO_PILL_GAP, marginBottom: INTRO_PILL_MB }}>
          <span className="pill pg">
            <span className="ms fill" style={{ fontSize: 11 }}>place</span>
            {card.totalStops} stops
          </span>
          {card.weather && (
            <span className="pill pg">
              <span className="ms fill" style={{ fontSize: 11 }}>{WEATHER_ICON[condition] ?? 'wb_sunny'}</span>
              {card.weather.temp}° · {card.weather.condition}
            </span>
          )}
        </div>

        {/* Engine strips */}
        {card.engineChanges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: INTRO_STRIP_GAP }}>
            {card.engineChanges.slice(0, 2).map((change, i) => {
              const copy = ENGINE_STRIP_COPY[change.type];
              if (!copy) return null;
              return (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: INTRO_STRIP_BR, background: 'rgba(0,0,0,.28)', border: '1px solid var(--color-border)', backdropFilter: 'blur(6px)' }}>
                  <span className="ms" style={{ fontSize: 12, color: 'var(--color-primary)' }}>{copy.icon}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-2)' }}>{copy.text(change.count)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.2)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
