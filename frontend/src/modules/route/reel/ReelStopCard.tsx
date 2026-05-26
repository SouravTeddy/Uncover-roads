import { useEffect, useRef, useState } from 'react';
import type { ReelStopCard } from './types';
import { getPlacePhotoUrl } from '../../../shared/api';
import { CATEGORY_LABELS } from '../../map/types';

interface Props {
  card: ReelStopCard;
  active: boolean;
  onRemove: (stopId: string) => void;
}

const REASON_ICONS: Record<string, string> = {
  opening_hours: 'schedule',
  golden_hour:   'wb_sunny',
  walking:       'directions_walk',
  crowd:         'groups',
  meal:          'restaurant',
  default:       'auto_fix_high',
};

function inferReasonIcon(reason: string | null): string {
  if (!reason) return REASON_ICONS.default;
  if (/hour|open|clos/i.test(reason)) return REASON_ICONS.opening_hours;
  if (/light|golden|sunset|sunrise/i.test(reason)) return REASON_ICONS.golden_hour;
  if (/walk|distance|km/i.test(reason)) return REASON_ICONS.walking;
  if (/crowd|busy|quiet/i.test(reason)) return REASON_ICONS.crowd;
  return REASON_ICONS.default;
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface TimeOfDay {
  label: string;
  range: string;
  color: string;
}

function timeOfDay(hhmm: string): TimeOfDay {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m;
  if (total >= 4 * 60 && total < 6 * 60)   return { label: 'Dawn',          range: '04:00–06:00', color: '#e88f88' };
  if (total >= 6 * 60 && total < 8 * 60)   return { label: 'Early morning', range: '06:00–08:00', color: '#f0a079' };
  if (total >= 8 * 60 && total < 11 * 60)  return { label: 'Morning',       range: '08:00–11:00', color: '#f0b878' };
  if (total >= 11 * 60 && total < 16 * 60) return { label: 'Afternoon',     range: '11:00–16:00', color: '#e8d292' };
  if (total >= 16 * 60 && total < 18 * 60) return { label: 'Evening',       range: '16:00–18:00', color: '#e09060' };
  if (total >= 18 * 60 && total < 20 * 60) return { label: 'Dusk',          range: '18:00–20:00', color: '#d4706a' };
  return { label: 'Night', range: '20:00+', color: '#6a82c8' };
}

function weatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return 'thunderstorm';
  if (c.includes('snow') || c.includes('blizzard') || c.includes('sleet')) return 'ac_unit';
  if (c.includes('hail')) return 'grain';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'rainy';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'foggy';
  if (c.includes('cloud') && c.includes('part')) return 'partly_cloudy_day';
  if (c.includes('cloud') || c.includes('overcast')) return 'cloud';
  if (c.includes('wind')) return 'air';
  return 'wb_sunny';
}

interface TrendBadge {
  icon: string;
  label: string;
  color: string;
  bg: string;
}

const TREND_BADGE_CFG: Record<string, TrendBadge> = {
  trending: {
    icon: 'trending_up',
    label: 'Trending · visit early',
    color: '#d4a853',
    bg: 'rgba(212,168,83,.12)',
  },
  hidden_gem: {
    icon: 'explore',
    label: 'Hidden gem · most visitors miss this',
    color: '#6b9470',
    bg: 'rgba(107,148,112,.12)',
  },
  getting_busy: {
    icon: 'trending_up',
    label: 'Getting busy · visit this trip',
    color: '#4f8fab',
    bg: 'rgba(79,143,171,.12)',
  },
};

function makeRainStreaks(count: number, color: string) {
  return Array.from({ length: count }, (_, i) => {
    const left = (i * 7.3) % 95;
    const dur = 0.55 + (i % 4) * 0.1;
    const delay = (i * 0.31) % 1.5;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${left}%`,
          top: 0,
          width: 1,
          height: 28,
          background: color,
          borderRadius: 1,
          animation: `precip ${dur}s linear ${delay}s infinite`,
        }}
      />
    );
  });
}

function PriceLevel({ level }: { level: number }) {
  const signs = '$'.repeat(Math.min(level, 4));
  return (
    <span style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(8px)', fontSize: 11, color: 'rgba(212,168,83,.85)' }}>
      {signs}
    </span>
  );
}

export function ReelStopCard({ card, active, onRemove }: Props) {
  const [visible, setVisible] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active]);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -120));
  }
  function onTouchEnd() {
    setSwiping(false);
    if (swipeX < -80) {
      onRemove(card.stop.id);
    } else {
      setSwipeX(0);
    }
  }

  const { stop, stopNumber, totalStops, orderReason, orderConsequence, movedFrom, weather } = card;
  const imageUrl = stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800) : null);
  const categoryLabel = CATEGORY_LABELS[stop.category] ?? stop.category;
  const tod = timeOfDay(stop.time);
  const safeAreaTop = 'calc(env(safe-area-inset-top, 0px) + 14px)';
  const trendBadges = (stop.tags ?? []).map(t => TREND_BADGE_CFG[t]).filter(Boolean);

  // ── Atmospheric overlays ──────────────────────────────────────────────────
  const hour = parseInt(stop.time.slice(0, 2), 10);
  const condition = (weather?.condition ?? '').toLowerCase();

  // Sky tint (z-index 2)
  let skyTint = 'rgba(0,0,0,.15)';
  if (condition.includes('rain') || condition.includes('drizzle')) skyTint = 'rgba(25,38,62,.32)';
  else if (condition.includes('thunderstorm'))                      skyTint = 'rgba(85,40,125,.30)';
  else if (condition.includes('snow'))                              skyTint = 'rgba(200,215,240,.14)';
  else if (condition.includes('fog') || condition.includes('mist')) skyTint = 'rgba(180,185,195,.22)';
  else if (condition.includes('clear') || condition.includes('sunny')) skyTint = 'rgba(255,210,140,.12)';
  else if (condition.includes('cloud') || condition.includes('overcast') || condition.includes('partly')) skyTint = 'rgba(140,150,165,.18)';

  // Time-of-day gradient (z-index 4)
  let todGradient: string | null = null;
  if (hour >= 6 && hour < 8)   todGradient = 'linear-gradient(180deg, rgba(255,210,180,.08) 0%, rgba(255,180,140,.18) 40%, rgba(250,150,110,.40) 72%, rgba(228,118,86,.62) 92%, rgba(212,98,68,.68) 100%)';
  else if (hour >= 8 && hour < 11)  todGradient = 'linear-gradient(180deg, rgba(255,225,180,.05) 0%, rgba(255,205,140,.16) 50%, rgba(238,168,100,.40) 78%, rgba(216,138,80,.62) 100%)';
  else if (hour >= 11 && hour < 16) todGradient = 'linear-gradient(180deg, rgba(180,210,235,.14) 0%, rgba(220,225,210,.08) 35%, rgba(245,225,170,.24) 70%, rgba(232,205,150,.40) 92%, rgba(218,188,130,.50) 100%)';
  else if (hour >= 18 && hour < 20) todGradient = 'linear-gradient(180deg, rgba(80,55,120,.18) 0%, rgba(180,70,110,.28) 38%, rgba(200,80,90,.44) 60%, rgba(160,55,110,.60) 82%, rgba(95,40,130,.68) 100%)';
  else if (hour >= 20)               todGradient = 'linear-gradient(180deg, rgba(20,28,55,.24) 0%, rgba(35,50,98,.36) 45%, rgba(40,55,110,.52) 75%, rgba(22,32,72,.68) 100%)';

  const isSunnyClear = condition.includes('clear') || condition.includes('sunny');
  const isDaytime = hour >= 8 && hour < 18;
  const showSun = isSunnyClear && isDaytime;

  return (
    <div
      className="reel-card"
      style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {imageUrl
        ? <img src={imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${swipeX * 0.1}px)`, transition: swiping ? 'none' : 'transform .3s ease' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #111114, #1a1420)' }} />
      }

      {/* z-index 2: Sky tint */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: skyTint, pointerEvents: 'none' }} />

      {/* z-index 3: Legibility scrim (always present) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'linear-gradient(180deg, transparent 0%, transparent 35%, rgba(0,0,0,.45) 65%, rgba(0,0,0,.85) 90%, rgba(10,10,13,.95) 100%)', pointerEvents: 'none' }} />

      {/* z-index 4: Time-of-day gradient + sun */}
      {todGradient && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient, pointerEvents: 'none' }} />
      )}
      {showSun && (
        <>
          {/* Sun rays */}
          <div style={{
            position: 'absolute', zIndex: 4,
            top: '-40%', left: '50%',
            width: '200%', height: '200%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,220,100,.18) 0%, transparent 65%)',
            animation: 'rayRotate 18s linear infinite',
            pointerEvents: 'none',
            opacity: 0.5,
          }} />
          {/* Sun glow */}
          <div style={{
            position: 'absolute', zIndex: 4,
            top: '-10%', left: '50%',
            width: '60%', height: '40%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse at 50% 30%, rgba(255,230,120,.35) 0%, transparent 70%)',
            animation: 'sunGlow 4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        </>
      )}

      {/* z-index 5: Weather particles */}
      {(condition.includes('rain') || condition.includes('drizzle')) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {makeRainStreaks(18, 'rgba(180,210,240,.55)')}
        </div>
      )}
      {condition.includes('thunderstorm') && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {makeRainStreaks(24, 'rgba(230,220,255,.85)')}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 25%, rgba(230,220,255,.95), rgba(180,150,230,.5) 32%, rgba(120,80,180,0) 70%)',
            mixBlendMode: 'screen',
            animation: 'flashFlicker 3.4s ease-out -1.3s infinite',
          }} />
        </div>
      )}
      {condition.includes('snow') && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 16 }, (_, i) => {
            const left = (i * 6.4) % 95;
            const size = i % 2 === 0 ? 4 : 6;
            const dur = 3.5 + (i % 5) * 0.6;
            const delay = (i * 0.43) % 2.5;
            const swayVariant = 1 + (i % 3);
            const swayDur = 2.5 + (i % 3) * 0.8;
            const swayDelay = (i * 0.27) % 1.8;
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${left}%`,
                top: `-${size}px`,
                pointerEvents: 'none',
                animation: `snowSway${swayVariant} ${swayDur}s ease-in-out ${swayDelay}s infinite`,
              }}>
                <div style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,.85)',
                  animation: `snowFall ${dur}s linear ${delay}s infinite`,
                }} />
              </div>
            );
          })}
        </div>
      )}
      {(condition.includes('fog') || condition.includes('mist')) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {/* Fog layer 1 */}
          <div style={{
            position: 'absolute',
            top: '20%', left: '-50%',
            width: '200%', height: '60%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(200,205,215,.55) 30%, rgba(210,215,225,.65) 50%, rgba(200,205,215,.55) 70%, transparent 100%)',
            animation: 'fogDriftL 8s ease-in-out infinite',
          }} />
          {/* Fog layer 2 */}
          <div style={{
            position: 'absolute',
            top: '35%', left: '-50%',
            width: '200%', height: '50%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(205,210,220,.50) 35%, rgba(215,218,228,.60) 50%, rgba(205,210,220,.50) 65%, transparent 100%)',
            animation: 'fogDriftR 11s ease-in-out 2s infinite',
            opacity: 0.8,
          }} />
        </div>
      )}

      {/* Time-of-day badge — top-left */}
      <div style={{
        position: 'absolute', top: safeAreaTop, left: 13, zIndex: 11,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 999,
        background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,.12)',
        maxWidth: 170, overflow: 'hidden',
        opacity: visible ? 1 : 0, transition: 'opacity .4s',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tod.color, boxShadow: `0 0 6px ${tod.color}`, flexShrink: 0 }} />
        <span className="reel-meta" style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.80)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {tod.label} · {tod.range}
        </span>
      </div>

      {/* Weather pill — top-right */}
      {weather && (
        <div style={{
          position: 'absolute', top: safeAreaTop, right: 13, zIndex: 11,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(9,12,22,.82)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.10)',
          opacity: visible ? 1 : 0, transition: 'opacity .4s',
        }}>
          <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.80)' }}>{weatherIcon(weather.condition)}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>
            {Math.round(weather.temp)}°
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{weather.condition}</span>
        </div>
      )}

      {/* Delete reveal */}
      <div style={{
        position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
        opacity: Math.min(1, Math.abs(swipeX) / 80),
        transition: swiping ? 'none' : 'opacity .3s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ fontSize: 22, color: '#ef4444' }}>delete</span>
        </div>
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Remove</span>
      </div>

      {/* Card content */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, transform: `translateX(${swipeX}px)`, transition: swiping ? 'none' : 'transform .3s cubic-bezier(.25,0,0,1)' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 15px 26px' }}>

          {/* Stop counter — frosted glass pill */}
          <div style={{ marginBottom: 8, opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
            <span className="reel-meta" style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: 5,
              background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(6px)',
              fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.50)',
            }}>
              Stop {stopNumber} of {totalStops}
            </span>
          </div>

          {/* Time + duration row — frosted glass pill */}
          <div style={{ marginBottom: 10, opacity: visible ? 1 : 0, transition: 'opacity .4s .06s' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 9px', borderRadius: 6,
              background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(6px)',
            }}>
              <span className="ms reel-meta" style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>schedule</span>
              <span className="reel-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>
                {formatTime(stop.time)}
              </span>
              <span className="reel-meta" style={{ color: 'rgba(255,255,255,.30)' }}>·</span>
              <span className="reel-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,.50)' }}>
                {formatDuration(stop.durationMin)}
              </span>
              {movedFrom !== null && (
                <span style={{ fontSize: 11, color: '#d4a853', fontWeight: 700 }}>↑ rescheduled</span>
              )}
            </span>
          </div>

          {/* Title */}
          <h2 className="reel-h1" style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginBottom: 12, animation: visible ? 'fadeUp .5s .12s both' : 'none' }}>
            {stop.title}
          </h2>

          {/* Metadata pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, animation: visible ? 'fadeUp .5s .2s both' : 'none' }}>
            <span className="reel-meta" style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(8px)', fontSize: 11, color: 'rgba(255,255,255,.72)' }}>
              {categoryLabel}
            </span>
            {stop.area && (
              <span className="reel-meta" style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(8px)', fontSize: 11, color: 'rgba(255,255,255,.72)' }}>
                <span className="ms" style={{ fontSize: 10, verticalAlign: 'middle', marginRight: 3 }}>place</span>
                {stop.area}
              </span>
            )}
            {stop.rating != null && (
              <span className="reel-meta" style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(212,168,83,.2)', background: 'rgba(212,168,83,.08)', backdropFilter: 'blur(8px)', fontSize: 11, color: '#d4a853', fontWeight: 600 }}>
                {stop.rating.toFixed(1)} ★
              </span>
            )}
            {stop.priceLevel != null && stop.priceLevel > 0 && (
              <PriceLevel level={stop.priceLevel} />
            )}
          </div>

          {/* Trend velocity badges */}
          {trendBadges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, animation: visible ? 'fadeUp .5s .22s both' : 'none' }}>
              {trendBadges.map(badge => (
                <span key={badge.label} className="reel-meta" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 999,
                  border: `1px solid ${badge.color}33`,
                  background: badge.bg,
                  fontSize: 11, color: badge.color, fontWeight: 600,
                }}>
                  <span className="ms" style={{ fontSize: 12 }}>{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          {/* Scheduling intelligence — reason strip */}
          {orderReason && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: orderConsequence ? 6 : 12, background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', padding: '10px 12px', borderRadius: 12, animation: visible ? 'fadeUp .5s .25s both' : 'none' }}>
              <span className="ms reel-meta" style={{ fontSize: 14, color: 'rgba(212,168,83,.7)', flexShrink: 0, marginTop: 1 }}>{inferReasonIcon(orderReason)}</span>
              <span className="reel-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.55 }}>
                {orderReason}
              </span>
            </div>
          )}

          {/* Scheduling intelligence — consequence strip */}
          {orderConsequence && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, background: 'rgba(0,0,0,.22)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.06)', padding: '8px 12px', borderRadius: 12, animation: visible ? 'fadeUp .5s .28s both' : 'none' }}>
              <span className="ms reel-meta" style={{ fontSize: 14, color: 'rgba(255,255,255,.30)', flexShrink: 0, marginTop: 1 }}>arrow_forward</span>
              <span className="reel-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.55 }}>
                {orderConsequence}
              </span>
            </div>
          )}

          {/* Why for you */}
          {stop.whyForYou && (
            <p className="reel-meta" style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.65, marginBottom: stop.localTip ? 8 : 0, animation: visible ? 'fadeUp .5s .3s both' : 'none' }}>
              <span style={{ color: '#d4a853', marginRight: 6 }}>✦</span>
              {stop.whyForYou}
            </p>
          )}

          {/* Local tip */}
          {stop.localTip && (
            <p className="reel-meta" style={{ fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.6, animation: visible ? 'fadeUp .5s .36s both' : 'none' }}>
              {stop.localTip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
