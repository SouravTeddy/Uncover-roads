import { useEffect, useRef, useMemo, useState, memo } from 'react';
import type { ReelStopCard as ReelStopCardType } from './types';
import { ReelImg } from './ReelImg';
import { getPlacePhotoUrl, fetchPlaceDetails } from '../../../shared/api';
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
  isJustAdjusted?: boolean;
  onExplore?: () => void;
  onRemove?: () => void;
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
  // Type scale — optimised for real-phone legibility
  fsXs:    12,   // chip labels, footnotes
  fsSm:    15,   // location, meta, secondary text
  fsMd:    17,   // body copy, logistics rows
  fsTitle: 40,   // stop name (Playfair Display)
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

function visitHours(weekdayText: string[] | null, visitDate: string | null): string | null {
  if (!weekdayText?.length) return null;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = visitDate ? new Date(visitDate) : new Date();
  const dayName = days[date.getDay()];
  const entry = weekdayText.find(t => t.startsWith(dayName));
  if (!entry) return null;
  if (entry.toLowerCase().includes('closed')) return `Closed on ${dayName}`;
  const match = entry.match(/–\s*(.+)/);
  return match ? `Open until ${match[1].trim()}` : null;
}

function priceLabel(level: number | null | undefined): string | null {
  if (level == null) return null;
  if (level === 0) return 'Free';
  return '$'.repeat(Math.min(level, 4));
}

const CAT_LABEL: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Café', park: 'Park', museum: 'Museum',
  historic: 'Historic site', tourism: 'Attraction', place: 'Place',
  bar: 'Bar', nightlife: 'Nightlife', gallery: 'Gallery', bakery: 'Bakery',
  spa: 'Spa', spiritual: 'Spiritual', stadium: 'Stadium', zoo: 'Zoo',
  aquarium: 'Aquarium', library: 'Library', cinema: 'Cinema',
  amusement_park: 'Amusement park', viewpoint: 'Viewpoint', beach: 'Beach',
  market: 'Market', street_art: 'Street art',
};

function categoryLabel(cat: string): string {
  return CAT_LABEL[cat] ?? cat.replace(/_/g, ' ');
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function fmtVisitDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
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
      <div style={{ position: 'absolute', right: '-15%', top: '-25%', width: '80%', height: '75%', background: 'radial-gradient(ellipse at top right,rgba(255,210,120,.72),rgba(255,210,120,0) 58%)', filter: 'blur(4px)', animation: 'sunGlow 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: '100%', height: '55%', background: 'radial-gradient(ellipse at 75% 0%,rgba(255,220,140,.28),rgba(255,220,140,0) 65%)', filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '90%', height: '180%', transformOrigin: 'top right', animation: 'rayRotate 80s linear infinite' }}>
        <div style={{ position: 'absolute', top: 0, left: '40%', width: 90, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.42),rgba(255,225,160,0) 60%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', top: 0, left: '56%', width: 50, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.52),rgba(255,235,180,0) 55%)', transform: 'rotate(13deg)', transformOrigin: 'top center', filter: 'blur(6px)' }} />
        <div style={{ position: 'absolute', top: 0, left: '30%', width: 30, height: '100%', background: 'linear-gradient(180deg,rgba(255,245,200,.28),rgba(255,245,200,0) 45%)', transform: 'rotate(24deg)', transformOrigin: 'top center', filter: 'blur(14px)' }} />
      </div>
    </div>
  );
}

// ── Shared chip style ─────────────────────────────────────────
// All stk-body badge chips use this base — override color/bg/border per variant
const chipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', borderRadius: 6,
  fontSize: T.fsXs, fontWeight: 700,
  letterSpacing: '.07em', textTransform: 'uppercase',
  backdropFilter: 'blur(8px)',
};

// ── Main component ────────────────────────────────────────────
export const ReelStopCard = memo(function ReelStopCard({ card, active, onInteract, isJustAdjusted, onExplore, onRemove }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { stop } = card;
  const hour      = stop.time ? parseInt(stop.time.split(':')[0], 10) : new Date().getHours();
  const dotColor  = todDotColor(hour);
  const wxOverride = import.meta.env.DEV
    ? (localStorage.getItem('wxOverride') ?? null)
    : null;
  const condition = (wxOverride ?? card.weather?.condition ?? 'clear').toLowerCase();
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

  const [fallbackPhotoRef, setFallbackPhotoRef] = useState<string | null>(null);
  const photoFetchAttempted = useRef(false);
  const photoUrl = stop.imageUrl
    ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800, 1200) : null)
    ?? (fallbackPhotoRef ? getPlacePhotoUrl(fallbackPhotoRef, 800, 1200) : null);

  useEffect(() => {
    if (!active || stop.imageUrl || stop.photoRef || !stop.placeId) return;
    if (photoFetchAttempted.current) return;
    photoFetchAttempted.current = true;
    fetchPlaceDetails(stop.placeId).then(details => {
      if (details?.photo_ref) setFallbackPhotoRef(details.photo_ref);
    }).catch(() => {});
  }, [active, stop.imageUrl, stop.photoRef, stop.placeId]);

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
  const hoursStr       = visitHours(stop.weekdayText, card.visitDate);
  const reasonText     = (stop.isEngineAdded && card.orderReason)
    ? (card.orderConsequence ?? (stop.whyForYou || null))
    : (card.orderReason ?? card.orderConsequence ?? (stop.whyForYou || null));

  const contentSig   = serverSignals.find(s => s.type === 'content');
  const crowdSig     = serverSignals.find(s => s.type === 'crowd');
  const timingSig    = serverSignals.find(s => s.type === 'timing');
  const transitSig   = serverSignals.find(s => s.type === 'transit');
  const rawDescriptionText = stop.localTip ?? contentSig?.text ?? (card.orderReason || card.orderConsequence ? null : stop.whyForYou || null);
  const descriptionText = rawDescriptionText && rawDescriptionText !== reasonText ? rawDescriptionText : null;

  const isRaining = condition.includes('rain') || condition.includes('drizzle') || isThunder;
  const walkSig = transitSig?.text?.toLowerCase().includes('walk') ? transitSig : null;
  const hasConflict = isRaining && !!walkSig;

  const stageLabel = stop.stage === 'hidden_gem'
    ? { text: 'Hidden gem',   icon: 'diamond',      color: T.sage,                 bg: T.sageBg,                   bdr: T.sageBdr }
    : stop.stage === 'rising' && (stop.velocityRatio ?? 0) >= 2.0
    ? { text: 'Trending now', icon: 'trending_up',  color: '#e07050',              bg: 'rgba(212,100,50,0.12)',     bdr: 'rgba(212,100,50,0.28)' }
    : stop.stage === 'rising'
    ? { text: 'Rising',       icon: 'north_east',   color: T.gold,                 bg: T.goldBg,                   bdr: T.goldBdr }
    : stop.stage === 'mainstream'
    ? { text: 'Popular here', icon: 'groups',       color: 'rgba(255,255,255,.5)', bg: 'rgba(255,255,255,.06)',     bdr: 'rgba(255,255,255,.10)' }
    : null;

  const crowdRow: { text: string; icon: string; isBusy: boolean } | null =
    crowdSig ? { text: crowdSig.text, icon: crowdSig.icon ?? 'groups', isBusy: crowdSig.text.toLowerCase().includes('peak') || crowdSig.text.toLowerCase().includes('busy') || crowdSig.text.toLowerCase().includes('rush') }
    : timingSig ? { text: timingSig.text, icon: timingSig.icon ?? 'schedule', isBusy: false }
    : crowd ? { text: crowd.note, icon: 'schedule', isBusy: crowd.timing === 'during' }
    : null;

  const visitDateLabel = fmtVisitDate(card.visitDate);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>

      {/* Photo */}
      <ReelImg
        src={photoUrl}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', zIndex: 0 }}
      />

      {/* Top-left: TOD badge + day badge */}
      <div style={{ position: 'absolute', top: 44, left: 14, zIndex: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
          <span style={{ fontSize: T.fsXs, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)' }}>
            {todLabel(hour)}
          </span>
        </div>
        {card.totalDays > 1 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)' }}>
            <span style={{ fontSize: T.fsXs, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>
              Day {card.day} of {card.totalDays}
            </span>
          </div>
        )}
      </div>

      {/* Weather chip — top-right */}
      {card.weather && (() => {
        const wxCond = (card.weather!.condition ?? '').toLowerCase();
        const wxIsRain = wxCond.includes('rain') || wxCond.includes('drizzle') || wxCond.includes('thunder');
        const wxBg    = wxIsRain ? 'rgba(79,120,171,.15)' : 'rgba(245,166,35,.1)';
        const wxBdr   = wxIsRain ? 'rgba(79,120,171,.3)' : 'rgba(245,166,35,.2)';
        const wxClr   = wxIsRain ? '#5d9bc9' : '#f5a623';
        return (
          <div style={{ position: 'absolute', top: 44, right: 14, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: wxBg, border: `1px solid ${wxBdr}`, borderRadius: 20, padding: '5px 11px' }}>
            <span className="ms" style={{ fontSize: T.fsSm, color: wxClr }}>{wxIcon(card.weather!.condition ?? '')}</span>
            <span style={{ fontSize: T.fsSm, fontWeight: 700, color: T.text1 }}>{card.weather!.temp != null ? Math.round(card.weather!.temp) : '--'}°</span>
            <span style={{ fontSize: T.fsXs, color: T.text3 }}>{(card.weather!.condition ?? '').split(' ').slice(0, 2).join(' ')}</span>
          </div>
        );
      })()}

      {/* Sky tint */}
      <SkyTintLayers condition={condition} />

      {/* Scrim */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* Sun rays */}
      {isSunny && <SunRays />}

      {/* Weather particles */}
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

      {/* ── stk-body: frosted content panel ─────────────────────── */}
      <div className="stk-body no-scrollbar" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '72dvh', overflowY: 'auto', padding: '18px 16px calc(88px + env(safe-area-inset-bottom, 0px))', zIndex: 10, background: 'rgba(10,10,14,0.52)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderRadius: '20px 20px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Row 1: counter pill + identity chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ ...chipBase, background: T.ctrBg }}>
            <span style={{ color: T.pillClr }}>Stop {card.stopNumber} of {card.totalStops}</span>
          </div>
          {stageLabel && (
            <div style={{ ...chipBase, background: stageLabel.bg, border: `1px solid ${stageLabel.bdr}` }}>
              <span className="ms" style={{ fontSize: T.fsXs, color: stageLabel.color }}>{stageLabel.icon}</span>
              <span style={{ color: stageLabel.color }}>{stageLabel.text}</span>
            </div>
          )}
          {stop.isUserAdded && (
            <div style={{ ...chipBase, background: 'rgba(212,168,83,.22)', border: '1px solid rgba(212,168,83,.35)' }}>
              <span className="ms" style={{ fontSize: T.fsXs, color: '#d4a853' }}>bookmark</span>
              <span style={{ color: '#d4a853' }}>Your pick</span>
            </div>
          )}
          {stop.isEngineAdded && (
            <div style={{ ...chipBase, background: 'rgba(91,155,213,.18)', border: '1px solid rgba(91,155,213,.30)' }}>
              <span className="ms" style={{ fontSize: T.fsXs, color: '#6ab4f5' }}>auto_awesome</span>
              <span style={{ color: '#6ab4f5' }}>We added this</span>
            </div>
          )}
          {card.movedFrom != null && (
            <div style={{ ...chipBase, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' }}>
              <span className="ms" style={{ fontSize: T.fsXs, color: 'rgba(255,255,255,.7)' }}>swap_vert</span>
              <span style={{ color: 'rgba(255,255,255,.7)' }}>Moved</span>
            </div>
          )}
        </div>

        {/* Engine-added reason line */}
        {stop.isEngineAdded && card.orderReason && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <span className="ms" style={{ fontSize: T.fsXs, color: 'rgba(91,155,213,.45)' }}>subdirectory_arrow_right</span>
            <span style={{ fontSize: T.fsSm, color: 'rgba(106,180,245,.75)', fontStyle: 'italic' }}>
              We thought: {card.orderReason}
            </span>
          </div>
        )}

        {/* Arrival context */}
        {card.arrivalNote && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 6, padding: '4px 10px', borderRadius: 6, background: T.skyBg, border: `1px solid ${T.skyBdr}` }}>
            <span className="ms fill" style={{ fontSize: T.fsSm, color: T.sky }}>flight_land</span>
            <span style={{ fontSize: T.fsSm, color: T.sky, fontWeight: 600 }}>{card.arrivalNote}</span>
          </div>
        )}

        {/* Departure context */}
        {card.departureNote && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 6, padding: '4px 10px', borderRadius: 6, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
            <span className="ms fill" style={{ fontSize: T.fsSm, color: T.gold }}>flight_takeoff</span>
            <span style={{ fontSize: T.fsSm, color: T.gold, fontWeight: 600 }}>{card.departureNote}</span>
          </div>
        )}

        {/* Time row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(10px)' }}>
          <span className="ms" style={{ fontSize: T.fsSm, color: T.text3 }}>schedule</span>
          {isJustAdjusted && card.timingAdjustment ? (
            <>
              <span style={{ fontSize: T.fsSm, color: 'rgba(255,255,255,0.32)', textDecoration: 'line-through' }}>~{fmt12h(card.timingAdjustment.originalTime)}</span>
              <span style={{ fontSize: T.fsMd, fontWeight: 700, color: '#d4a853' }}>~{fmt12h(stop.time)}</span>
            </>
          ) : (
            <span style={{ fontSize: T.fsMd, fontWeight: 700, color: T.text1 }}>~{fmt12h(stop.time)}</span>
          )}
          <span style={{ fontSize: T.fsSm, color: T.text3 }}>→ leave ~{addMinutes(stop.time, stop.durationMin)}</span>
          <span style={{ fontSize: T.fsXs, color: T.text3, letterSpacing: '.04em', opacity: 0.7 }}>suggested</span>
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: T.fsTitle, fontWeight: 600, color: T.text1, lineHeight: 1.0, margin: 0, marginBottom: 3, textShadow: '0 1px 6px rgba(0,0,0,.9),0 2px 16px rgba(0,0,0,.5)' }}>
          {stop.title}
        </h2>

        {/* Area / city */}
        {(() => {
          const areaLabel = stop.area?.includes(',') ? null : stop.area;
          return (areaLabel || stop.city) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <span className="ms" style={{ fontSize: T.fsSm, color: 'rgba(255,255,255,.35)' }}>location_on</span>
              <span style={{ fontSize: T.fsSm, color: 'rgba(255,255,255,.35)' }}>
                {areaLabel && stop.city ? `${areaLabel} · ${stop.city}` : (areaLabel || stop.city)}
              </span>
            </div>
          ) : <div style={{ marginBottom: 8 }} />;
        })()}

        {/* Meta row: rating + price + tags + website */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 9, alignItems: 'center' }}>
          {stop.rating != null && stop.rating > 0 && (
            <span style={{ padding: '3px 9px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: T.fsXs, color: T.pillClr, backdropFilter: 'blur(10px)' }}>
              {stop.rating} ★
            </span>
          )}
          {priceLabel(stop.priceLevel) != null && (
            <span style={{ padding: '3px 9px', borderRadius: 99, background: T.sageBg, border: `1px solid ${T.sageBdr}`, fontSize: T.fsXs, color: T.sage }}>
              {priceLabel(stop.priceLevel)}
            </span>
          )}
          {(stop.tags?.length ? stop.tags : [categoryLabel(stop.category)]).map((tag, i) => {
            const hasEmoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(tag);
            return hasEmoji ? (
              <span key={i} style={{ padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)', fontSize: T.fsXs, color: 'rgba(255,255,255,.45)' }}>
                {tag}
              </span>
            ) : (
              <span key={i} style={{ padding: '3px 9px', borderRadius: 99, background: T.pillBg, border: `1px solid ${T.pillBdr}`, fontSize: T.fsXs, color: T.pillClr, backdropFilter: 'blur(10px)' }}>
                {tag}
              </span>
            );
          })}
          {stop.website && (() => {
            const domain = extractDomain(stop.website);
            return domain ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 9px', borderRadius: 99, background: T.skyBg, border: `1px solid ${T.skyBdr}`, fontSize: T.fsXs, color: T.sky }}>
                <span className="ms" style={{ fontSize: T.fsXs }}>language</span>{domain}
              </span>
            ) : null;
          })()}
        </div>

        {/* Narrative */}
        {hasConflict ? (
          <div style={{ marginBottom: 9, padding: '9px 12px', borderRadius: 8, background: 'rgba(79,120,171,.12)', borderLeft: '2px solid rgba(79,120,171,.5)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span className="ms" style={{ fontSize: T.fsMd, color: '#5d9bc9', flexShrink: 0, marginTop: 1 }}>rainy</span>
            <span style={{ fontSize: T.fsMd, color: 'rgba(200,220,255,.85)', lineHeight: 1.5, fontStyle: 'italic' }}>
              {reasonText ?? "We'd skip the walk today — rain all morning. The stop itself is still worth it; the weather actually keeps the crowds away."}
            </span>
          </div>
        ) : reasonText ? (
          <div style={{ marginBottom: 9, padding: '10px 13px', borderRadius: 8, background: 'rgba(212,168,83,0.14)', borderLeft: `2px solid ${T.gold}`, backdropFilter: 'blur(8px)' }}>
            <span style={{ fontSize: T.fsMd, color: 'rgba(255,255,255,.88)', lineHeight: 1.55 }}>{reasonText}</span>
          </div>
        ) : null}

        {/* Venue description */}
        {descriptionText && (
          <p style={{ fontSize: T.fsMd, color: 'rgba(255,255,255,.82)', lineHeight: 1.55, margin: 0, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {descriptionText}
          </p>
        )}

        {/* Logistics bar */}
        {(crowdRow || transitSig || hoursStr) && (
          <div style={{ borderRadius: 9, background: 'rgba(0,0,0,.52)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(16px)', overflow: 'hidden' }}>
            {crowdRow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderBottom: (transitSig || hoursStr) ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                <span className="ms" style={{ fontSize: T.fsMd, color: crowdRow.isBusy ? '#e07050' : 'rgba(255,255,255,.32)', flexShrink: 0 }}>{crowdRow.icon}</span>
                <span style={{ fontSize: T.fsMd, color: 'rgba(255,255,255,.82)', lineHeight: 1.3, flex: 1 }}>{crowdRow.text}</span>
                <span style={{ fontSize: T.fsXs, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: crowdRow.isBusy ? 'rgba(212,100,50,0.12)' : 'rgba(107,148,112,.15)', color: crowdRow.isBusy ? '#e07050' : T.sage, flexShrink: 0 }}>
                  {crowdRow.isBusy ? 'Busy period' : 'Good window'}
                </span>
              </div>
            )}
            {transitSig && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderBottom: hoursStr ? '1px solid rgba(255,255,255,.06)' : 'none', background: hasConflict ? 'rgba(79,120,171,.08)' : 'transparent' }}>
                <span className="ms" style={{ fontSize: T.fsMd, color: hasConflict ? 'rgba(79,143,171,.7)' : 'rgba(255,255,255,.32)', flexShrink: 0 }}>{hasConflict ? 'directions_bus' : (transitSig.icon ?? 'directions_walk')}</span>
                <span style={{ fontSize: T.fsMd, color: 'rgba(255,255,255,.82)', lineHeight: 1.3, flex: 1 }}>
                  {hasConflict ? (
                    <>
                      <s style={{ color: 'rgba(255,255,255,.28)' }}>{transitSig.text}</s><br />
                      <span style={{ color: 'rgba(170,200,240,.7)' }}>Alternative transport — rain all morning</span>
                    </>
                  ) : transitSig.text}
                </span>
                <span style={{ fontSize: T.fsXs, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: hasConflict ? 'rgba(79,120,171,.15)' : 'rgba(255,255,255,.08)', color: hasConflict ? '#5d9bc9' : 'rgba(255,255,255,.45)', flexShrink: 0 }}>
                  {hasConflict ? 'Rain detour' : visitDateLabel}
                </span>
              </div>
            )}
            {hoursStr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px' }}>
                <span className="ms" style={{ fontSize: T.fsMd, color: 'rgba(255,255,255,.32)', flexShrink: 0 }}>door_open</span>
                <span style={{ fontSize: T.fsMd, color: 'rgba(255,255,255,.82)', flex: 1 }}>{hoursStr}</span>
                {visitDateLabel && (
                  <span style={{ fontSize: T.fsXs, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.45)', flexShrink: 0 }}>
                    {visitDateLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timing adjustment notes */}
        {card.timingAdjustment?.isClosingConflict && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, background: 'rgba(212,100,50,.10)', border: '1px solid rgba(212,100,50,.22)' }}>
            <span className="ms fill" style={{ fontSize: T.fsMd, color: '#e07050', flexShrink: 0 }}>warning</span>
            <span style={{ fontSize: T.fsSm, color: 'rgba(255,220,200,.85)', lineHeight: 1.35 }}>{card.timingAdjustment.consequenceNote}</span>
          </div>
        )}
        {card.timingAdjustment?.consequenceNote && !card.timingAdjustment.isClosingConflict && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, background: 'rgba(212,168,83,.08)', border: '1px solid rgba(212,168,83,.20)' }}>
            <span className="ms" style={{ fontSize: T.fsMd, color: 'rgba(212,168,83,.7)', flexShrink: 0 }}>schedule</span>
            <span style={{ fontSize: T.fsSm, color: 'rgba(255,235,180,.75)', lineHeight: 1.35 }}>{card.timingAdjustment.consequenceNote}</span>
          </div>
        )}

        {/* Next-leg transit row */}
        {card.nextLeg && (() => {
          const leg = card.nextLeg!;
          const isWalk = leg.mode === 'walk';
          const distStr = leg.distKm < 1 ? `${Math.round(leg.distKm * 1000)} m` : `${leg.distKm} km`;
          return (
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 12px', borderRadius: 8,
              background: isWalk ? 'rgba(79,143,171,.07)' : 'rgba(0,0,0,.35)',
              border: `1px solid ${isWalk ? 'rgba(79,143,171,.2)' : 'rgba(255,255,255,.07)'}`,
            }}>
              <span className="ms fill" style={{ fontSize: T.fsMd, color: isWalk ? T.sky : 'rgba(180,180,220,.5)', flexShrink: 0 }}>
                {isWalk ? 'directions_walk' : 'directions_car'}
              </span>
              <span style={{ fontSize: T.fsSm, color: 'rgba(255,255,255,.38)', flex: 1, lineHeight: 1.3 }}>
                {distStr} · ~{leg.durationMin} min {isWalk ? 'walk' : 'ride'} to{' '}
                <span style={{ color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>{leg.nextStopTitle}</span>
              </span>
              <span style={{ fontSize: T.fsXs, fontWeight: 600, color: 'rgba(255,255,255,.2)', flexShrink: 0 }}>Next →</span>
            </div>
          );
        })()}

        {/* Hotel anchor row */}
        {card.hotelAnchor && (() => {
          const anchor = card.hotelAnchor!;
          const bg = anchor.isBlue
            ? 'rgba(91,155,213,.09)'
            : anchor.isWarning
              ? 'rgba(232,160,48,.09)'
              : 'rgba(212,168,83,.08)';
          const border = anchor.isBlue
            ? 'rgba(91,155,213,.2)'
            : anchor.isWarning
              ? 'rgba(232,160,48,.2)'
              : 'rgba(212,168,83,.2)';
          const textColor = anchor.isBlue
            ? 'rgba(91,155,213,.85)'
            : anchor.isWarning
              ? 'rgba(232,160,48,.85)'
              : 'rgba(212,168,83,.85)';
          const iconColor = anchor.isBlue
            ? '#5b9bd5'
            : anchor.isWarning
              ? '#e8a030'
              : T.gold;
          return (
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 12px', borderRadius: 8,
              background: bg, border: `1px solid ${border}`,
            }}>
              <span className="ms fill" style={{ fontSize: T.fsMd, color: iconColor, flexShrink: 0 }}>
                {anchor.icon}
              </span>
              <span style={{ fontSize: T.fsSm, color: textColor, flex: 1, lineHeight: 1.3 }}>
                {anchor.text}
              </span>
            </div>
          );
        })()}

        {/* Action row: Explore nearby + Remove stop */}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {onExplore && (
            <button
              onClick={onExplore}
              style={{
                flex: 1, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7, padding: '11px 16px',
                borderRadius: 12, border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.07)', backdropFilter: 'blur(10px)',
                cursor: 'pointer', color: 'rgba(255,255,255,.75)',
                fontSize: T.fsMd, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                transition: 'background .15s',
              }}
            >
              <span className="ms" style={{ fontSize: T.fsMd }}>explore</span>
              Explore nearby
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              title="Remove stop"
              style={{
                width: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', borderRadius: 12,
                border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.07)', backdropFilter: 'blur(10px)',
                cursor: 'pointer', transition: 'background .15s',
              }}
            >
              <span className="ms" style={{ fontSize: 18, color: 'rgba(255,255,255,.45)' }}>delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
