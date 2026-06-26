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

export interface PanelControl {
  expand:     () => void;
  collapse:   () => void;
  isExpanded: () => boolean;
}

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
  onRegisterPanelControl?: (ctrl: PanelControl | null) => void;
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
  fsXs:    13,   // chip labels, footnotes
  fsSm:    16,   // location, meta, secondary text
  fsMd:    18,   // body copy, logistics rows
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

// ── Pill types ────────────────────────────────────────────────
interface CardPill {
  icon: string;
  label: string;
  urgent: boolean;            // amber vs neutral
  detail: { title: string; body: string } | null;
  // Optional explicit color overrides (for stage/identity pills)
  color?: string;
  bg?: string;
  border?: string;
}

// ── Main component ────────────────────────────────────────────
export const ReelStopCard = memo(function ReelStopCard({ card, active, onInteract, isJustAdjusted, onExplore, onRemove, onRegisterPanelControl }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const [pillDetail, setPillDetail] = useState<{ title: string; body: string } | null>(null);
  const [activePillEl, setActivePillEl] = useState<HTMLElement | null>(null);

  // Keep expandedRef in sync so PanelControl.isExpanded() always reads current value
  const setExpandedSync = (v: boolean) => { expandedRef.current = v; setExpanded(v); };

  // Register expand/collapse handles with the parent (ItineraryReelScreen gesture handler)
  useEffect(() => {
    onRegisterPanelControl?.({
      expand:     () => setExpandedSync(true),
      collapse:   () => { setPillDetail(null); setActivePillEl(null); setExpandedSync(false); },
      isExpanded: () => expandedRef.current,
    });
    return () => onRegisterPanelControl?.(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterPanelControl]);
  const { stop } = card;
  // Use stop.time for visit-time-based crowd notes — NOT current system clock
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

  // ── Build pill list (ordered by priority) ─────────────────
  const allPills: CardPill[] = [];

  if (stageLabel) {
    allPills.push({ icon: stageLabel.icon, label: stageLabel.text, urgent: false, detail: null, color: stageLabel.color, bg: stageLabel.bg, border: `1px solid ${stageLabel.bdr}` });
  }

  if (card.timingAdjustment?.isClosingConflict) {
    allPills.push({ icon: 'warning', label: card.timingAdjustment.consequenceNote ?? 'Closing conflict', urgent: true, detail: { title: 'Timing conflict', body: card.timingAdjustment.consequenceNote ?? '' } });
  }
  if (crowdRow?.isBusy) {
    allPills.push({ icon: crowdRow.icon, label: crowdRow.text, urgent: true, detail: { title: 'Crowd level', body: crowdRow.text } });
  }
  if (card.timingAdjustment?.consequenceNote && !card.timingAdjustment.isClosingConflict) {
    allPills.push({ icon: 'schedule', label: card.timingAdjustment.consequenceNote, urgent: false, detail: { title: 'Timing note', body: card.timingAdjustment.consequenceNote } });
  }
  if (crowdRow && !crowdRow.isBusy) {
    allPills.push({ icon: crowdRow.icon, label: crowdRow.text, urgent: false, detail: { title: 'Crowd & timing', body: crowdRow.text } });
  }
  if (transitSig) {
    if (hasConflict) {
      allPills.push({ icon: 'umbrella', label: 'Alt. transport · rain conflict', urgent: true, detail: { title: 'Getting here', body: `Rain detected. ${transitSig.text} — consider alternative transport.` } });
    } else {
      allPills.push({ icon: transitSig.icon ?? 'directions_walk', label: transitSig.text, urgent: false, detail: { title: 'Getting here', body: transitSig.text } });
    }
  }
  if (hoursStr) {
    allPills.push({ icon: 'door_open', label: hoursStr, urgent: false, detail: null });
  }
  if (stop.durationMin) {
    const durLabel = stop.durationMin >= 60 ? `${(stop.durationMin / 60).toFixed(1).replace(/\.0$/, '')} hr` : `${stop.durationMin} min`;
    allPills.push({ icon: 'timer', label: durLabel, urgent: false, detail: null });
  }
  if (stop.rating != null && stop.rating > 0) {
    allPills.push({ icon: 'star', label: `${stop.rating} ★`, urgent: false, detail: null });
  }
  const price = priceLabel(stop.priceLevel);
  if (price) {
    allPills.push({ icon: 'attach_money', label: price, urgent: false, detail: null });
  }

  const collapsedPills = allPills.slice(0, 2);

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Pill click ─────────────────────────────────────────────
  const handlePillClick = (pill: CardPill, el: HTMLElement) => {
    if (!pill.detail) return;
    if (!expanded) {
      setExpandedSync(true);
      setTimeout(() => { setPillDetail(pill.detail); setActivePillEl(el); }, 420);
    } else {
      if (pillDetail === pill.detail) {
        setPillDetail(null); setActivePillEl(null);
      } else {
        if (activePillEl) activePillEl.setAttribute('data-open', 'false');
        setPillDetail(pill.detail); setActivePillEl(el);
      }
    }
  };

  // ── Pill renderer ──────────────────────────────────────────
  const renderPill = (pill: CardPill, idx: number) => {
    const clickable = !!pill.detail;
    const isOpen = pillDetail === pill.detail && pillDetail !== null;
    const base: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 999,
      fontSize: 15, fontWeight: 600,
      maxWidth: '100%', overflow: 'hidden',
      userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      cursor: clickable ? 'pointer' : 'default',
      transition: 'background .12s',
    };
    const style: React.CSSProperties = pill.color
      ? { ...base, background: pill.bg ?? 'rgba(255,255,255,.06)', border: pill.border ?? '1px solid rgba(255,255,255,.12)', color: pill.color }
      : clickable
      ? { ...base, background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.22)', color: 'rgba(255,255,255,.88)' }
      : { ...base, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', color: 'rgba(255,255,255,.42)' };
    return (
      <div
        key={idx}
        style={style}
        onClick={clickable ? (e) => { e.stopPropagation(); handlePillClick(pill, e.currentTarget as HTMLElement); } : (e) => e.stopPropagation()}
      >
        <span className="ms" style={{ fontSize: 15, flexShrink: 0 }}>{pill.icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pill.label}</span>
        {clickable && <span className="ms" style={{ fontSize: 12, opacity: 0.5, marginLeft: 1, flexShrink: 0 }}>{isOpen ? 'expand_less' : 'expand_more'}</span>}
      </div>
    );
  };

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>

      {/* Photo */}
      <ReelImg
        src={photoUrl}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', zIndex: 0 }}
      />

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

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 44, left: 14, right: 14, zIndex: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: TOD + date + day */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99, background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.10)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 5px ${dotColor}`, flexShrink: 0 }} />
            <span style={{ fontSize: T.fsXs, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>{todLabel(hour)}</span>
            {visitDateLabel && <>
              <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,.15)', margin: '0 2px' }} />
              <span style={{ fontSize: T.fsXs, fontWeight: 600, color: 'rgba(255,255,255,.55)' }}>{visitDateLabel}</span>
            </>}
            {card.totalDays > 1 && <>
              <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,.15)', margin: '0 2px' }} />
              <span style={{ fontSize: T.fsXs, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>Day {card.day}/{card.totalDays}</span>
            </>}
          </div>
        </div>
        {/* Right: weather only */}
        {card.weather && (() => {
          const wxCond = (card.weather!.condition ?? '').toLowerCase();
          const wxIsRain = wxCond.includes('rain') || wxCond.includes('drizzle') || wxCond.includes('thunder');
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: wxIsRain ? 'rgba(79,120,171,.18)' : 'rgba(0,0,0,.28)', border: `1px solid ${wxIsRain ? 'rgba(79,120,171,.35)' : 'rgba(255,255,255,.10)'}`, borderRadius: 20, padding: '5px 11px', backdropFilter: 'blur(12px)' }}>
              <span className="ms" style={{ fontSize: T.fsSm, color: wxIsRain ? '#5d9bc9' : '#f5a623' }}>{wxIcon(card.weather!.condition ?? '')}</span>
              <span style={{ fontSize: T.fsSm, fontWeight: 700, color: T.text1 }}>{card.weather!.temp != null ? Math.round(card.weather!.temp) : '--'}°</span>
            </div>
          );
        })()}
      </div>

      {/* ── Panel ───────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(7,9,15,.9)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,.07)', borderBottom: 'none',
          overflow: 'hidden',
          touchAction: 'none',
          maxHeight: expanded ? '72dvh' : 'none',
          transition: 'max-height .4s cubic-bezier(.22,1,.36,1)',
        }}
        ref={panelRef}
        data-panel="true"
        onClick={(e) => { e.stopPropagation(); if (!expanded) setExpandedSync(true); }}
      >
        {/* Handle + stop counter — tap to toggle expanded */}
        <div
          onClick={() => { if (expanded) { setPillDetail(null); setActivePillEl(null); } setExpandedSync(!expandedRef.current); }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 4px', cursor: 'pointer' }}
        >
          <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.15)', marginBottom: 8 }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.28)' }}>Stop {card.stopNumber} of {card.totalStops}</span>
            {onRemove && (
              <button onClick={onRemove} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}>
                <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.22)' }}>delete_outline</span>
              </button>
            )}
          </div>
        </div>

        {/* Time + name */}
        <div style={{ padding: '0 18px 6px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
            <span className="ms" style={{ fontSize: T.fsSm, color: T.text3 }}>schedule</span>
            {isJustAdjusted && card.timingAdjustment ? (
              <>
                <span style={{ fontSize: T.fsSm, color: 'rgba(255,255,255,0.32)', textDecoration: 'line-through' }}>~{fmt12h(card.timingAdjustment.originalTime)}</span>
                <span style={{ fontSize: T.fsMd, fontWeight: 700, color: T.gold }}>~{fmt12h(stop.time)}</span>
              </>
            ) : (
              <span style={{ fontSize: T.fsMd, fontWeight: 700, color: T.text1 }}>~{fmt12h(stop.time)}</span>
            )}
            <span style={{ fontSize: T.fsSm, color: T.text3 }}>→ leave ~{addMinutes(stop.time, stop.durationMin)}</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: T.text1, lineHeight: 1.18, margin: 0, marginBottom: 6 }}>
            {stop.title}
          </h2>
          {/* Area */}
          {(() => {
            const areaLabel = stop.area?.includes(',') ? null : stop.area;
            return (areaLabel || stop.city) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,.30)' }}>location_on</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,.30)' }}>{areaLabel && stop.city ? `${areaLabel} · ${stop.city}` : (areaLabel || stop.city)}</span>
              </div>
            ) : null;
          })()}
        </div>

        {/* Tags + website — always visible */}
        {((stop.tags && stop.tags.length > 0) || stop.website) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 18px 8px' }}>
            {stop.tags?.map((tag, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', fontSize: T.fsXs, fontWeight: 600, color: 'rgba(255,255,255,.38)' }}>
                {categoryLabel(tag)}
              </span>
            ))}
            {stop.website && (
              <a
                href={stop.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 999, background: T.skyBg, border: `1px solid ${T.skyBdr}`, fontSize: T.fsXs, fontWeight: 600, color: T.sky, textDecoration: 'none' }}
              >
                <span className="ms" style={{ fontSize: 13 }}>language</span>
                {extractDomain(stop.website)}
              </a>
            )}
          </div>
        )}

        {/* Collapsed content */}
        {!expanded && (
          <>
            {/* Identity chips */}
            {(stageLabel || stop.isUserAdded || stop.isEngineAdded || card.movedFrom != null || card.arrivalNote || card.departureNote) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 18px 8px' }}>
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
                  <div style={{ ...chipBase, background: 'rgba(232,160,48,.12)', border: '1px solid rgba(232,160,48,.25)' }}>
                    <span className="ms" style={{ fontSize: T.fsXs, color: '#e8a030' }}>swap_horiz</span>
                    <span style={{ color: '#e8a030' }}>Moved from #{card.movedFrom}</span>
                  </div>
                )}
                {card.arrivalNote && (
                  <div style={{ ...chipBase, background: T.skyBg, border: `1px solid ${T.skyBdr}` }}>
                    <span className="ms" style={{ fontSize: T.fsXs, color: T.sky }}>flight_land</span>
                    <span style={{ color: T.sky }}>{card.arrivalNote}</span>
                  </div>
                )}
                {card.departureNote && (
                  <div style={{ ...chipBase, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
                    <span className="ms" style={{ fontSize: T.fsXs, color: T.gold }}>flight_takeoff</span>
                    <span style={{ color: T.gold }}>{card.departureNote}</span>
                  </div>
                )}
              </div>
            )}

            {/* Description 2-line */}
            {(descriptionText || reasonText) && (
              <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,.5)', padding: '0 18px 12px', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {descriptionText || reasonText}
              </p>
            )}

            {/* 2 pills */}
            {collapsedPills.length > 0 && (
              <div style={{ padding: '0 18px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
                  {collapsedPills.map((pill, i) => (
                    <div key={i} style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
                      {renderPill(pill, i)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next-leg footer */}
            {card.nextLeg && (() => {
              const leg = card.nextLeg!;
              const isWalk = leg.mode === 'walk';
              const distStr = leg.distKm < 1 ? `${Math.round(leg.distKm * 1000)} m` : `${leg.distKm} km`;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px 10px', color: 'rgba(255,255,255,.28)', fontSize: 14, fontWeight: 500 }}>
                  <span className="ms" style={{ fontSize: 15 }}>{isWalk ? 'directions_walk' : 'directions_car'}</span>
                  Then <span style={{ color: 'rgba(255,255,255,.55)', fontWeight: 600, marginLeft: 3 }}>{distStr} · ~{leg.durationMin} min</span>
                  <span style={{ marginLeft: 2 }}>to {leg.nextStopTitle}</span>
                  <span className="ms" style={{ fontSize: 14, marginLeft: 2 }}>arrow_forward</span>
                </div>
              );
            })()}

            {/* Accordion hint */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 calc(env(safe-area-inset-bottom,0px) + 72px)' }}>
              <span className="ms" style={{ fontSize: 22, color: 'rgba(255,255,255,.18)' }}>keyboard_arrow_down</span>
            </div>
          </>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="no-scrollbar" style={{ overflowY: 'auto', maxHeight: 'calc(72dvh - 160px)', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
            <div style={{ padding: '0 18px calc(env(safe-area-inset-bottom,0px) + 84px)' }}>

              {/* Identity chips row */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
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
                  <div style={{ ...chipBase, background: 'rgba(232,160,48,.12)', border: '1px solid rgba(232,160,48,.25)' }}>
                    <span className="ms" style={{ fontSize: T.fsXs, color: '#e8a030' }}>swap_horiz</span>
                    <span style={{ color: '#e8a030' }}>Moved from #{card.movedFrom}</span>
                  </div>
                )}
                {card.arrivalNote && (
                  <div style={{ ...chipBase, background: T.skyBg, border: `1px solid ${T.skyBdr}` }}>
                    <span className="ms" style={{ fontSize: T.fsXs, color: T.sky }}>flight_land</span>
                    <span style={{ color: T.sky }}>{card.arrivalNote}</span>
                  </div>
                )}
                {card.departureNote && (
                  <div style={{ ...chipBase, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
                    <span className="ms" style={{ fontSize: T.fsXs, color: T.gold }}>flight_takeoff</span>
                    <span style={{ color: T.gold }}>{card.departureNote}</span>
                  </div>
                )}
              </div>

              {/* Why this stop */}
              {stop.isEngineAdded && card.orderReason && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <span className="ms" style={{ fontSize: 13, color: 'rgba(91,155,213,.45)' }}>subdirectory_arrow_right</span>
                  <span style={{ fontSize: 13, color: 'rgba(106,180,245,.75)', fontStyle: 'italic', lineHeight: 1.45 }}>
                    We thought: {card.orderReason}
                  </span>
                </div>
              )}
              {(reasonText || descriptionText) && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(212,168,83,.7)', marginBottom: 8 }}>Why this stop</div>
                  <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(212,168,83,0.10)', borderLeft: '2px solid rgba(212,168,83,.55)' }}>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', lineHeight: 1.58 }}>{reasonText || descriptionText}</span>
                  </div>
                </>
              )}
              {descriptionText && reasonText && (
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.55, margin: 0, marginBottom: 14 }}>
                  {descriptionText}
                </p>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '4px 0 14px' }} />

              {/* At a glance — all pills */}
              {allPills.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 9 }}>At a glance</div>
                  {crowdRow && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8, padding: '3px 10px', borderRadius: 999, background: crowdRow.isBusy ? 'rgba(200,80,50,.14)' : 'rgba(107,148,112,.12)', border: `1px solid ${crowdRow.isBusy ? 'rgba(200,80,50,.28)' : 'rgba(107,148,112,.22)'}` }}>
                      <span className="ms" style={{ fontSize: 12, color: crowdRow.isBusy ? '#e07060' : T.sage }}>{crowdRow.isBusy ? 'person_raised_hand' : 'sentiment_satisfied'}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: crowdRow.isBusy ? '#e07060' : T.sage }}>{crowdRow.isBusy ? 'Busy period' : 'Good window'}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {allPills.map((pill, i) => renderPill(pill, i))}
                  </div>
                </>
              )}

              {/* Pill detail inline sheet */}
              {pillDetail && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.32)', marginBottom: 6 }}>{pillDetail.title}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,.82)' }}>{pillDetail.body}</div>
                </div>
              )}

              {/* Hotel anchor */}
              {card.hotelAnchor && (() => {
                const anchor = card.hotelAnchor!;
                const bg = anchor.isBlue ? 'rgba(91,155,213,.09)' : anchor.isWarning ? 'rgba(232,160,48,.09)' : 'rgba(212,168,83,.08)';
                const border = anchor.isBlue ? 'rgba(91,155,213,.2)' : anchor.isWarning ? 'rgba(232,160,48,.2)' : 'rgba(212,168,83,.2)';
                const textColor = anchor.isBlue ? 'rgba(91,155,213,.85)' : anchor.isWarning ? 'rgba(232,160,48,.85)' : 'rgba(212,168,83,.85)';
                const iconColor = anchor.isBlue ? '#5b9bd5' : anchor.isWarning ? '#e8a030' : T.gold;
                return (
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                    <span className="ms fill" style={{ fontSize: T.fsMd, color: iconColor, flexShrink: 0 }}>{anchor.icon}</span>
                    <span style={{ fontSize: T.fsSm, color: textColor, flex: 1, lineHeight: 1.3 }}>{anchor.text}</span>
                  </div>
                );
              })()}

              {/* Next-leg in expanded */}
              {card.nextLeg && (() => {
                const leg = card.nextLeg!;
                const isWalk = leg.mode === 'walk';
                const distStr = leg.distKm < 1 ? `${Math.round(leg.distKm * 1000)} m` : `${leg.distKm} km`;
                return (
                  <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, background: isWalk ? 'rgba(79,143,171,.07)' : 'rgba(0,0,0,.35)', border: `1px solid ${isWalk ? 'rgba(79,143,171,.2)' : 'rgba(255,255,255,.07)'}` }}>
                    <span className="ms fill" style={{ fontSize: T.fsMd, color: isWalk ? T.sky : 'rgba(180,180,220,.5)', flexShrink: 0 }}>{isWalk ? 'directions_walk' : 'directions_car'}</span>
                    <span style={{ fontSize: T.fsSm, color: 'rgba(255,255,255,.38)', flex: 1, lineHeight: 1.3 }}>
                      {distStr} · ~{leg.durationMin} min {isWalk ? 'walk' : 'ride'} to{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>{leg.nextStopTitle}</span>
                    </span>
                  </div>
                );
              })()}

              {/* Explore nearby CTA */}
              {onExplore && (
                <button
                  onClick={onExplore}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 7, padding: '13px 16px', borderRadius: 14,
                    border: 'none', background: `linear-gradient(135deg, ${T.gold}, #c4903d)`,
                    cursor: 'pointer', color: '#0f0d0c',
                    fontSize: T.fsMd, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                    marginBottom: 8,
                  }}
                >
                  <span className="ms" style={{ fontSize: T.fsMd }}>explore</span>
                  Explore nearby
                </button>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
});
