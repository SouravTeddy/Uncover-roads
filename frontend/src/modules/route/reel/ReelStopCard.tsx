import { useEffect, useRef, useMemo } from 'react';
import type { ReelStopCard as ReelStopCardType } from './types';
import { getPlacePhotoUrl } from '../../../shared/api';
import {
  REEL_SCRIM,
  todGradient, todDotColor, todLabel, skyTintForCondition,
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
  pillBg:   'rgba(0,0,0,0.48)',
  pillBdr:  'rgba(255,255,255,0.12)',
  pillClr:  'rgba(255,255,255,0.68)',
  ctrBg:    'rgba(0,0,0,0.45)',
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
    cat.includes('landmark') || cat.includes('temple') || cat.includes('shrine');
  const food =
    cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe');
  const market = cat.includes('market') || cat.includes('shopping');
  const park   = cat.includes('park') || cat.includes('garden');

  if (landmarks) {
    if (hour >= 10 && hour <= 15)
      return { note: 'Crowd peak now · allow extra time to explore', timing: 'during' };
    if (hour >= 8 && hour < 10)
      return { note: "Crowd peaks 10AM–3PM here. You're arriving early — good window.", timing: 'before' };
  }
  if (food) {
    if (hour >= 12 && hour <= 14)
      return { note: 'Lunch rush now · expect 15–20 min wait', timing: 'during' };
    if (hour >= 19 && hour <= 21)
      return { note: 'Dinner peak hours · reservation recommended', timing: 'during' };
  }
  if (market) {
    if (hour >= 11 && hour <= 15)
      return { note: 'Busiest midday · quieter before 10AM or after 4PM', timing: 'during' };
    if (hour >= 9 && hour < 11)
      return { note: 'Gets busy after 11AM. Good time to browse.', timing: 'before' };
  }
  if (park && hour >= 9 && hour < 11) {
    return { note: 'Morning peak for this type of spot. Still good light.', timing: 'before' };
  }
  return null;
}

function whatToDo(category: string | undefined): { icon: string; text: string }[] {
  const cat = (category || '').toLowerCase();
  if (cat.includes('museum')) return [
    { icon: 'photo_camera', text: 'Check the main collection first' },
    { icon: 'schedule',     text: 'Allow 1.5–2 hrs for a full visit' },
  ];
  if (cat.includes('temple') || cat.includes('shrine')) return [
    { icon: 'photo_camera', text: 'Walk through the main gate and courtyard' },
    { icon: 'schedule',     text: 'Best light in early morning' },
  ];
  if (cat.includes('market')) return [
    { icon: 'payments', text: 'Bring cash — most stalls are cash only' },
    { icon: 'schedule',  text: 'Go early for freshest picks' },
  ];
  if (cat.includes('park') || cat.includes('garden')) return [
    { icon: 'photo_camera',    text: 'Find the main viewpoint first' },
    { icon: 'directions_walk', text: 'Loop trail takes about 30 min' },
  ];
  if (cat.includes('restaurant') || cat.includes('food')) return [
    { icon: 'restaurant', text: 'Try the house specialty' },
    { icon: 'schedule',   text: 'Check if reservations are needed for dinner' },
  ];
  if (cat.includes('cafe') || cat.includes('coffee')) return [
    { icon: 'photo_camera', text: 'Window seat has the best street views' },
    { icon: 'restaurant',   text: 'Try the seasonal menu' },
  ];
  if (cat.includes('shopping') || cat.includes('store')) return [
    { icon: 'payments', text: 'Check for tax-free options at the counter' },
    { icon: 'schedule', text: 'Busiest midday — plan for 20 extra minutes' },
  ];
  return [
    { icon: 'explore',      text: 'Take your time exploring the space' },
    { icon: 'photo_camera', text: 'Check for guided tours at the entrance' },
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

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active, onInteract]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active, onInteract]);

  // Content logic
  const crowd          = crowdNote(stop.category, hour);
  const todos          = whatToDo(stop.category);
  const hasEngineContent = !!(card.orderReason || card.orderConsequence || stop.whyForYou);
  const showTodos      = !hasEngineContent;
  const hoursStr       = todayHours(stop.weekdayText);
  const reasonText     = card.orderReason ?? stop.whyForYou ?? card.orderConsequence ?? null;

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>

      {/* Photo z-index:0 */}
      {photoUrl && (
        <img
          src={photoUrl}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', zIndex: 0 }}
          alt=""
        />
      )}

      {/* TOD badge — top-left, z-index:11 */}
      <div style={{ position: 'absolute', top: 48, left: 13, zIndex: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', maxWidth: 170, overflow: 'hidden' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {todLabel(hour)} · {fmt12h(stop.time)}
        </span>
      </div>

      {/* Weather chip — top-right, z-index:10 */}
      {card.weather && (
        <div style={{ position: 'absolute', top: 48, right: 13, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: T.skyBg, border: `1px solid ${T.skyBdr}`, borderRadius: 20, padding: '3px 10px' }}>
          <span className="ms" style={{ fontSize: 12, color: T.sky }}>{wxIcon(card.weather.condition)}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text1 }}>{Math.round(card.weather.temp)}°</span>
          <span style={{ fontSize: 10, color: T.text3 }}>{card.weather.condition.split(' ').slice(0, 2).join(' ')}</span>
        </div>
      )}

      {/* Sky tint z-index:2 */}
      <SkyTintLayers condition={condition} />

      {/* Scrim z-index:3 */}
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

      {/* ── stk-body: content zone, z-index:10 ─────────────────── */}
      <div className="stk-body" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 15px 24px', zIndex: 10 }}>

        {/* Row 1: counter pill + rescheduled pill */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 7, marginBottom: 6 }}>
          <div style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 5, background: T.ctrBg, backdropFilter: 'blur(6px)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.pillClr }}>
              Stop {card.stopNumber} of {card.totalStops}
            </span>
          </div>
          {card.movedFrom != null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
              <span style={{ fontSize: 10 }}>↕</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.gold }}>Rescheduled</span>
            </div>
          )}
        </div>

        {/* Time row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 6, padding: '3px 9px', borderRadius: 6, background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(6px)' }}>
          <span className="ms" style={{ fontSize: 11, color: T.text3 }}>schedule</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text1 }}>{fmt12h(stop.time)}</span>
          <span style={{ color: T.text3 }}>·</span>
          <span style={{ fontSize: 12, color: T.text3 }}>{fmtDuration(stop.durationMin)}</span>
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: T.text1, lineHeight: 1.05, margin: 0, marginBottom: 7, textShadow: '0 1px 5px rgba(0,0,0,.85),0 2px 14px rgba(0,0,0,.5)' }}>
          {stop.title}
        </h2>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 9 }}>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: 10, color: T.pillClr, backdropFilter: 'blur(8px)' }}>
            {stop.area}
          </span>
          {stop.rating != null && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: 10, color: T.pillClr }}>
              {stop.rating} ★
            </span>
          )}
          {priceLabel(stop.priceLevel) && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: T.sageBg, border: `1px solid ${T.sageBdr}`, fontSize: 10, color: T.sage }}>
              {priceLabel(stop.priceLevel)}
            </span>
          )}
          {stop.tags && stop.tags.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: 10, color: T.pillClr }}>
              {stop.tags[0]}
            </span>
          )}
        </div>

        {/* Crowd note */}
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

        {/* What-to-do — only when engine has no content */}
        {showTodos && (
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
        )}

        {/* Footer row: hours chip + reason chip */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hoursStr && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: T.sageBg, border: `1px solid ${T.sageBdr}`, flexShrink: 0 }}>
              <span className="ms" style={{ fontSize: 11, color: T.sage }}>schedule</span>
              <span style={{ fontSize: 11, color: T.sage }}>{hoursStr}</span>
            </div>
          )}
          {reasonText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: T.goldBg, border: `1px solid ${T.goldBdr}`, flex: 1, minWidth: 0 }}>
              <span className="ms" style={{ fontSize: 11, color: T.gold, flexShrink: 0 }}>star</span>
              <span style={{ fontSize: 11, color: T.gold, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reasonText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
