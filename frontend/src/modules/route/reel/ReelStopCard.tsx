import { useEffect, useRef, useMemo, useState, memo } from 'react';
import type { ReelStopCard as ReelStopCardType, TransitInfo } from './types';
import { ReelImg } from './ReelImg';
import { getPlacePhotoUrl, fetchPlaceDetails, BASE, api } from '../../../shared/api';
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
  cityPhotoUrl?: string | null;
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered') => void;
  isJustAdjusted?: boolean;
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
  text3:    'rgba(255,255,255,0.65)',
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

const CAT_EMOJI: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', park: '🌿', museum: '🏛️',
  historic: '🏛️', tourism: '📍', place: '📍', bar: '🍸',
  nightlife: '🌙', gallery: '🖼️', bakery: '🥐', spa: '💆',
  spiritual: '🕌', stadium: '🏟️', zoo: '🐘', aquarium: '🐠',
  library: '📚', cinema: '🎬', amusement_park: '🎡',
  viewpoint: '🔭', beach: '🏖️', market: '🛍️', street_art: '🎨',
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

// ── Description sanitizer ─────────────────────────────────────
// Suppresses LLM-generated text that describes the wrong category context
// (e.g. meal descriptions on scenic viewpoints, or walk descriptions on restaurants).
const FOOD_CATS_SET = new Set(['restaurant', 'cafe', 'bar', 'nightlife', 'market', 'bakery']);
const MEAL_TERMS = ['meal', 'eat ', 'eating', 'dinner', 'lunch', 'food', 'dine', 'dining', 'dish', 'bite ', 'bites', 'hungry', 'restaurant', 'café'];
const OUTDOOR_WALK_TERMS = ['walking trail', 'hike', 'trekking', 'nature walk', 'forest trail'];

function sanitizeReasonText(text: string | null | undefined, category: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (!FOOD_CATS_SET.has(category) && MEAL_TERMS.some(t => lower.includes(t))) return null;
  if (FOOD_CATS_SET.has(category) && OUTDOOR_WALK_TERMS.some(t => lower.includes(t))) return null;
  return text;
}

// ── Shared chip style ─────────────────────────────────────────
// All stk-body badge chips use this base — override color/bg/border per variant
const chipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 13px', borderRadius: 8,
  fontSize: 14, fontWeight: 700,
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
  // If set, pill renders as an <a> link (opens Google Maps / external URL)
  href?: string;
}

// ── Main component ────────────────────────────────────────────
export const ReelStopCard = memo(function ReelStopCard({ card, active, cityPhotoUrl, onInteract, isJustAdjusted, onRemove: _onRemove, onRegisterPanelControl }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const [pillDetail, setPillDetail] = useState<{ title: string; body: string } | null>(null);
  const [activePillEl, setActivePillEl] = useState<HTMLElement | null>(null);
  const [placeRatingCount, setPlaceRatingCount] = useState<number | null>(null);
  const [placeReviewSummary, setPlaceReviewSummary] = useState<string | null>(null);
  const placeDetailsFetchDone = useRef(false);

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

  // Lazy-fetch full TransitInfo from transit corridor cache when card is expanded
  const [fetchedTransit, setFetchedTransit] = useState<TransitInfo | null>(null);
  const [transitLoading, setTransitLoading] = useState(false);
  useEffect(() => {
    if (!expanded || !card.prevStopLat || !card.prevStopLon || fetchedTransit) return;
    if (card.transitInfo !== null && card.transitInfo !== undefined) return; // already have data
    setTransitLoading(true);
    fetch(
      `${BASE}/transit-corridor?origin_lat=${card.prevStopLat}&origin_lon=${card.prevStopLon}&dest_lat=${stop.lat}&dest_lon=${stop.lon}`
    )
      .then(r => r.json())
      .then((data: TransitInfo) => { setFetchedTransit(data); setTransitLoading(false); })
      .catch(() => { setTransitLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, card.prevStopLat, card.prevStopLon, stop.lat, stop.lon]);

  const [fallbackPhotoRef, setFallbackPhotoRef] = useState<string | null>(null);
  const [placeImageUrl, setPlaceImageUrl] = useState<string | null>(null);
  const photoFetchAttempted = useRef(false);
  const placeImageAttempted = useRef(false);
  const photoUrl = placeImageUrl
    ?? stop.imageUrl
    ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800, 1200) : null)
    ?? (fallbackPhotoRef ? getPlacePhotoUrl(fallbackPhotoRef, 800, 1200) : null)
    ?? cityPhotoUrl
    ?? null;

  useEffect(() => {
    if (!active || stop.imageUrl || stop.photoRef || !stop.placeId) return;
    if (photoFetchAttempted.current) return;
    photoFetchAttempted.current = true;
    placeDetailsFetchDone.current = true;
    fetchPlaceDetails(stop.placeId).then(details => {
      if (details?.photo_ref) setFallbackPhotoRef(details.photo_ref);
      if (details?.rating_count != null) setPlaceRatingCount(details.rating_count);
      if (details?.review_summary) setPlaceReviewSummary(details.review_summary);
    }).catch(() => {});
  }, [active, stop.imageUrl, stop.photoRef, stop.placeId]);

  // Fetch rating_count + review_summary on expand when photo was already available (so photo-fetch above was skipped)
  useEffect(() => {
    if (!expanded || !stop.placeId || placeDetailsFetchDone.current) return;
    placeDetailsFetchDone.current = true;
    fetchPlaceDetails(stop.placeId).then(details => {
      if (details?.photo_ref && !fallbackPhotoRef) setFallbackPhotoRef(details.photo_ref);
      if (details?.rating_count != null) setPlaceRatingCount(details.rating_count);
      if (details?.review_summary) setPlaceReviewSummary(details.review_summary);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, stop.placeId]);

  const handlePhotoFinalError = () => {
    if (placeImageAttempted.current) return;
    placeImageAttempted.current = true;
    const city = stop.city ?? '';
    if (!stop.title || !city) return;
    api.placeImage(stop.title, city, stop.placeId ?? undefined)
      .then(url => { if (url) setPlaceImageUrl(url); })
      .catch(() => {});
  };

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

  const rawReasonText  = (stop.isEngineAdded && card.orderReason)
    ? (card.orderConsequence ?? (stop.whyForYou || null))
    : (card.orderReason ?? card.orderConsequence ?? (stop.whyForYou || null));
  const reasonText     = sanitizeReasonText(rawReasonText, stop.category);

  const contentSig   = serverSignals.find(s => s.type === 'content');
  const crowdSig     = serverSignals.find(s => s.type === 'crowd');
  const timingSig    = serverSignals.find(s => s.type === 'timing');
  const transitSig   = serverSignals.find(s => s.type === 'transit');
  const rawDescriptionText = sanitizeReasonText(contentSig?.text ?? null, stop.category);
  const descriptionText = rawDescriptionText && rawDescriptionText !== reasonText ? rawDescriptionText : null;

  const isRaining = condition.includes('rain') || condition.includes('drizzle') || isThunder;
  const walkSig = transitSig?.text?.toLowerCase().includes('walk') ? transitSig : null;
  const hasConflict = isRaining && !!walkSig;

  const stageLabel = stop.stage === 'hidden_gem'
    ? { text: 'Off the beaten path',           icon: 'diamond',      color: T.sage,                 bg: T.sageBg,                   bdr: T.sageBdr }
    : stop.stage === 'rising' && (stop.velocityRatio ?? 0) >= 2.0
    ? { text: 'Getting noticed',               icon: 'trending_up',  color: '#e07050',              bg: 'rgba(212,100,50,0.12)',     bdr: 'rgba(212,100,50,0.28)' }
    : stop.stage === 'rising'
    ? { text: 'People are noticing this',      icon: 'north_east',   color: T.gold,                 bg: T.goldBg,                   bdr: T.goldBdr }
    : stop.stage === 'mainstream'
    ? { text: 'Well-loved spot',               icon: 'groups',       color: 'rgba(255,255,255,.5)', bg: 'rgba(255,255,255,.06)',     bdr: 'rgba(255,255,255,.10)' }
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
    allPills.push({ icon: 'warning', label: 'Closing conflict', urgent: true, detail: { title: 'Timing conflict', body: card.timingAdjustment.consequenceNote ?? '' } });
  }
  if (crowdRow?.isBusy) {
    allPills.push({ icon: crowdRow.icon, label: 'Busy period', urgent: true, detail: { title: 'Crowd level', body: crowdRow.text } });
  }
  if (card.timingAdjustment?.consequenceNote && !card.timingAdjustment.isClosingConflict) {
    allPills.push({ icon: 'schedule', label: 'Timing note', urgent: false, detail: { title: 'Timing note', body: card.timingAdjustment.consequenceNote } });
  }
  // "Good window" is already shown as the inline crowd-note badge above the pills — don't duplicate it here
  if (transitSig) {
    if (hasConflict) {
      allPills.push({ icon: 'umbrella', label: 'Rain conflict', urgent: true, detail: { title: 'Getting here', body: `Rain detected. ${transitSig.text} — consider alternative transport.` } });
    } else {
      allPills.push({ icon: transitSig.icon ?? 'directions_walk', label: 'Transit info', urgent: false, detail: { title: 'Getting here', body: transitSig.text } });
    }
  }
  if (hoursStr) {
    allPills.push({ icon: 'door_open', label: hoursStr, urgent: false, detail: { title: 'Opening hours', body: hoursStr } });
  }
  if (stop.durationMin) {
    const durLabel = stop.durationMin >= 60 ? `${(stop.durationMin / 60).toFixed(1).replace(/\.0$/, '')} hr` : `${stop.durationMin} min`;
    allPills.push({ icon: 'timer', label: durLabel, urgent: false, detail: null });
  }
  // Rating shown as full-width tappable row in expanded view — not as a pill
  const price = priceLabel(stop.priceLevel);
  if (price) {
    allPills.push({ icon: 'attach_money', label: price, urgent: false, detail: null });
  }

  const panelRef = useRef<HTMLDivElement>(null);
  const panelTouchY = useRef(0);

  // ── Panel swipe — drag up to expand, drag down to collapse ─
  const onPanelTouchStart = (e: React.TouchEvent) => {
    panelTouchY.current = e.touches[0].clientY;
  };
  const onPanelTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - panelTouchY.current;
    if (Math.abs(dy) < 24) return; // too small — let click fire normally
    // Only intercept when expanded — when collapsed, let the scroll container handle pan-y
    if (!expandedRef.current) return;
    e.preventDefault(); // prevent the subsequent synthetic click
    if (dy < 0) setExpandedSync(true);
    if (dy > 0) { setPillDetail(null); setActivePillEl(null); setExpandedSync(false); }
  };

  // ── Pill click ─────────────────────────────────────────────
  const handlePillClick = (pill: CardPill, el: HTMLElement) => {
    if (!pill.detail) return;
    if (!expanded) {
      setExpandedSync(true);
      setTimeout(() => { setPillDetail(pill.detail); setActivePillEl(el); }, 420);
    } else {
      // Compare by title (string) not by reference — allPills is rebuilt each render
      if (pillDetail?.title === pill.detail?.title) {
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
      textDecoration: 'none',
      cursor: clickable || pill.href ? 'pointer' : 'default',
      transition: 'background .12s',
    };
    const style: React.CSSProperties = pill.color
      ? { ...base, background: pill.bg ?? 'rgba(255,255,255,.06)', border: pill.border ?? '1px solid rgba(255,255,255,.12)', color: pill.color }
      : clickable
      ? { ...base, background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.22)', color: 'rgba(255,255,255,.88)' }
      : { ...base, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', color: 'rgba(255,255,255,.42)' };
    const inner = (
      <>
        <span className="ms" style={{ fontSize: 15, flexShrink: 0 }}>{pill.icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pill.label}</span>
        {pill.href && <span className="ms" style={{ fontSize: 11, opacity: 0.4, marginLeft: 1, flexShrink: 0 }}>open_in_new</span>}
        {clickable && <span className="ms" style={{ fontSize: 12, opacity: 0.5, marginLeft: 1, flexShrink: 0 }}>{isOpen ? 'expand_less' : 'expand_more'}</span>}
      </>
    );
    if (pill.href) {
      return (
        <a key={idx} href={pill.href} target="_blank" rel="noopener noreferrer" style={style} onClick={(e) => e.stopPropagation()}>
          {inner}
        </a>
      );
    }
    return (
      <div
        key={idx}
        style={style}
        onClick={clickable ? (e) => { e.stopPropagation(); handlePillClick(pill, e.currentTarget as HTMLElement); } : (e) => e.stopPropagation()}
      >
        {inner}
      </div>
    );
  };

  const grpSep: React.CSSProperties = { paddingTop: 14, paddingBottom: 14, borderTop: '1px solid rgba(255,255,255,.06)' };
  const grpLabel = (accent: string = 'rgba(255,255,255,.28)'): React.CSSProperties => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
    color: accent, marginBottom: 10,
  });

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>
      <style>{`
        @keyframes badgePopOrange {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(224,120,64,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(224,120,64,0.28); }
        }
        @keyframes badgePopBlue {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(91,155,213,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(91,155,213,0.24); }
        }
        @keyframes badgePopSage {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(107,148,112,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(107,148,112,0.24); }
        }
      `}</style>

      {/* Photo */}
      <ReelImg
        src={photoUrl}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', zIndex: 0 }}
        onFinalError={handlePhotoFinalError}
      />

      {/* Loading image indicator — shown while photo is still being fetched */}
      {!photoUrl && (
        <div style={{ position: 'absolute', top: 54, left: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(8px)' }}>
          <span className="ms" style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', animation: 'spin 1.5s linear infinite' }}>autorenew</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.60)', letterSpacing: '.02em' }}>Loading image</span>
        </div>
      )}

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
              <span style={{ fontSize: T.fsSm, fontWeight: 700, color: T.text1 }}>{card.weather!.temp != null ? Math.round(card.weather!.temp) : '--'}°C</span>
            </div>
          );
        })()}
      </div>

      {/* ── Panel — matches proto-stop-card-v2 architecture ───────── */}
      <div
        ref={panelRef}
        data-panel="true"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(8,9,16,.97)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,.07)', borderBottom: 'none',
          overflow: 'hidden',
          touchAction: expanded ? 'none' : 'pan-y',
          // Expanded: fixed 86dvh; collapsed: auto so content dictates height
          height: expanded ? '86dvh' : 'auto',
          transition: 'height 0.44s cubic-bezier(.22,1,.36,1)',
          display: 'flex', flexDirection: 'column',
        }}
        onTouchStart={onPanelTouchStart}
        onTouchEnd={onPanelTouchEnd}
      >
        {/* ── Always-visible drag handle — tap collapses/expands ──── */}
        <div
          onClick={(e) => { e.stopPropagation(); if (expanded) { setPillDetail(null); setActivePillEl(null); } setExpandedSync(!expandedRef.current); }}
          style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '10px 0 6px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.22)' }} />
        </div>

        {/* ── Content wrapper — collapsed and expanded overlap here ── */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

        {/* ── COLLAPSED — hidden when expanded (not absolute, so panel auto-sizes) ── */}
        <div style={{
          display: expanded ? 'none' : 'block',
          padding: '0 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
        }}
          onClick={(e) => { e.stopPropagation(); setExpandedSync(true); }}
        >
          {/* Stop counter */}
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.28)', marginBottom: 10 }}>
            Stop {card.stopNumber} of {card.totalStops}
          </span>

          {/* Badge row: place type + provenance */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {stop.category && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>
                <span>{CAT_EMOJI[stop.category] ?? '📍'}</span>
                <span>{categoryLabel(stop.category)}</span>
              </div>
            )}
            {stop.isUserAdded && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, background: T.goldBg, border: `1px solid ${T.goldBdr}`, fontSize: 12, fontWeight: 700, color: T.gold }}>
                <span className="ms" style={{ fontSize: 12 }}>bookmark</span> You added this
              </div>
            )}
            {stop.isEngineAdded && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, background: T.skyBg, border: `1px solid ${T.skyBdr}`, fontSize: 12, fontWeight: 700, color: T.sky }}>
                <span className="ms" style={{ fontSize: 12 }}>auto_awesome</span> Our pick
              </div>
            )}
          </div>

          {/* Title */}
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 27, fontWeight: 700, color: T.text1, lineHeight: 1.15, margin: '0 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stop.title}
          </h2>

          {/* Time row */}
          {stop.time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600, color: T.text1, marginBottom: 5 }}>
              <span className="ms" style={{ fontSize: 15, color: T.text3 }}>schedule</span>
              <span>~{fmt12h(stop.time)}</span>
              <span style={{ color: T.text3, fontWeight: 400, fontSize: 12 }}>→</span>
              <span style={{ color: T.text3, fontWeight: 400, fontSize: 13 }}>leave ~{addMinutes(stop.time, stop.durationMin)}</span>
            </div>
          )}

          {/* Location */}
          {(stop.area || stop.city) && (() => {
            const areaLabel = stop.area?.includes(',') ? null : stop.area;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'rgba(255,255,255,.30)', marginBottom: 12 }}>
                <span className="ms" style={{ fontSize: 14 }}>location_on</span>
                {areaLabel && stop.city ? `${areaLabel} · ${stop.city}` : (areaLabel || stop.city)}
              </div>
            );
          })()}

          {/* Expand hint */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'rgba(255,255,255,.28)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <span className="ms" style={{ fontSize: 17, lineHeight: 1 }}>expand_more</span>
            See details
          </div>
        </div>

        {/* ── EXPANDED — fades in on expand ────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? 'auto' : 'none',
          transition: 'opacity 0.22s ease 0.16s',
        }}>
          {/* Meta strip: stop counter */}
          <div style={{ flexShrink: 0, padding: '4px 20px 13px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.30)' }}>Stop {card.stopNumber} of {card.totalStops}</span>
          </div>

          {/* Scroll area — everything below meta strip scrolls */}
          <div
            className="no-scrollbar"
            style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'], padding: '18px 20px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Title */}
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: T.text1, lineHeight: 1.14, margin: '0 0 7px' }}>
              {stop.title}
            </h2>

            {/* Provenance label */}
            {stop.isUserAdded && (
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'rgba(212,168,83,.72)' }}>
                <span className="ms" style={{ fontSize: 14 }}>bookmark</span>
                You added this
              </div>
            )}
            {stop.isEngineAdded && (
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'rgba(79,143,171,.72)' }}>
                <span className="ms" style={{ fontSize: 14 }}>auto_awesome</span>
                Our pick
              </div>
            )}

            {/* Time row — arrival → departure, with adjustment callout */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
              <span className="ms" style={{ fontSize: 13, color: T.text3 }}>schedule</span>
              {isJustAdjusted && card.timingAdjustment ? (
                <>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.28)', textDecoration: 'line-through' }}>~{fmt12h(card.timingAdjustment.originalTime)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>~{fmt12h(stop.time)}</span>
                </>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>~{fmt12h(stop.time)}</span>
              )}
              <span style={{ fontSize: 13, color: T.text3 }}>→ leave ~{addMinutes(stop.time, stop.durationMin)}</span>
            </div>

            {/* Location + website on same row */}
            {(() => {
              const areaLabel = stop.area?.includes(',') ? null : stop.area;
              const hasLocation = !!(areaLabel || stop.city);
              const displayWebsite = stop.website;
              return (hasLocation || displayWebsite) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  {hasLocation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'rgba(255,255,255,.30)' }}>
                      <span className="ms" style={{ fontSize: 13 }}>location_on</span>
                      {areaLabel && stop.city ? `${areaLabel} · ${stop.city}` : (areaLabel || stop.city)}
                    </div>
                  )}
                  {displayWebsite && (
                    <a href={displayWebsite} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, background: T.skyBg, border: `1px solid ${T.skyBdr}`, fontSize: 12, fontWeight: 500, color: T.sky, textDecoration: 'none' }}>
                      <span className="ms" style={{ fontSize: 13 }}>language</span>
                      {extractDomain(displayWebsite)}
                    </a>
                  )}
                </div>
              ) : null;
            })()}

            {/* Category tags */}
            {stop.tags && stop.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 13 }}>
                {stop.tags.map((tag, i) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.03em' }}>
                    {categoryLabel(tag)}
                  </span>
                ))}
              </div>
            )}

            {/* Identity chips: category type, stage, movement notes */}
            {(stop.category || stageLabel || card.movedFrom != null || card.arrivalNote || card.departureNote) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {stop.category && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>
                    <span>{CAT_EMOJI[stop.category] ?? '📍'}</span>
                    <span>{categoryLabel(stop.category)}</span>
                  </div>
                )}
                {stageLabel && (<div style={{ ...chipBase, background: stageLabel.bg, border: `1px solid ${stageLabel.bdr}` }}><span className="ms" style={{ fontSize: T.fsXs, color: stageLabel.color }}>{stageLabel.icon}</span><span style={{ color: stageLabel.color }}>{stageLabel.text}</span></div>)}
                {card.movedFrom != null && (<div style={{ ...chipBase, background: 'rgba(232,160,48,.12)', border: '1px solid rgba(232,160,48,.25)' }}><span className="ms" style={{ fontSize: T.fsXs, color: '#e8a030' }}>swap_horiz</span><span style={{ color: '#e8a030' }}>Moved from #{card.movedFrom}</span></div>)}
                {card.arrivalNote && (<div style={{ ...chipBase, background: T.skyBg, border: `1px solid ${T.skyBdr}` }}><span className="ms" style={{ fontSize: T.fsXs, color: T.sky }}>flight_land</span><span style={{ color: T.sky }}>{card.arrivalNote}</span></div>)}
                {card.departureNote && (<div style={{ ...chipBase, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}><span className="ms" style={{ fontSize: T.fsXs, color: T.gold }}>flight_takeoff</span><span style={{ color: T.gold }}>{card.departureNote}</span></div>)}
              </div>
            )}

            {/* Place description from Google (review_summary via fetchPlaceDetails on expand) */}
            {placeReviewSummary && (
              <div style={{ ...grpSep }}>
                <p style={{ fontSize: 15, lineHeight: 1.68, color: 'rgba(242,237,230,.58)', margin: 0 }}>
                  {placeReviewSummary}
                </p>
              </div>
            )}

            {/* ── Group 1: Getting here ───────────────────────── */}
            <div data-group="getting-here" style={grpSep}>
              <div style={grpLabel('rgba(79,143,171,.5)')}>Getting here</div>
              {card.prevStopTitle ? (
                <>
                  {/* Walk row — show real data after lazy fetch, or a fallback line */}
                  {fetchedTransit?.walk_distance_m != null ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: T.text2 }}>
                      <span className="ms" style={{ fontSize: 16, color: T.sky, flexShrink: 0 }}>directions_walk</span>
                      <span>
                        {fetchedTransit.walk_duration_min} min walk from {card.prevStopTitle},{' '}
                        {fetchedTransit.walk_distance_m >= 1000
                          ? `${(fetchedTransit.walk_distance_m / 1000).toFixed(1)} km`
                          : `${fetchedTransit.walk_distance_m} m`}
                        {fetchedTransit.walk_via?.length
                          ? ` via ${fetchedTransit.walk_via.slice(0, 2).join(' and ')}`
                          : ''}
                      </span>
                    </div>
                  ) : (
                    <>
                      {expanded && transitLoading && (
                        <div style={{ height: 16, borderRadius: 4, background: 'rgba(255,255,255,.08)', margin: '4px 0', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      )}
                      <div style={{ fontSize: 13, color: T.text3, marginBottom: 8 }}>
                        From {card.prevStopTitle}
                        {stop.transitFromPrev?.distanceKm != null
                          ? ` · ~${stop.transitFromPrev.distanceKm} km`
                          : ''}
                      </div>
                    </>
                  )}
                  {/* Transit row */}
                  {fetchedTransit?.has_transit && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: T.text2 }}>
                      <span className="ms" style={{ fontSize: 16, color: T.sky, flexShrink: 0 }}>subway</span>
                      <span>
                        {fetchedTransit.duration_min} min ·{' '}
                        {fetchedTransit.transit_type?.toLowerCase().replace('_', ' ') ?? 'transit'} ·{' '}
                        board at {fetchedTransit.departure_stop}
                      </span>
                    </div>
                  )}
                  {/* Off-route note for engine-added detour stops */}
                  {stop.isEngineAdded && (card.detourKm ?? 0) > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: T.text3 }}>
                      <span className="ms" style={{ fontSize: 16, flexShrink: 0 }}>fork_right</span>
                      <span>{card.detourKm} km off your direct route</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: T.text3 }}>Starting point for this day.</div>
              )}
            </div>

            {/* ── Group 2: At this stop ───────────────────────── */}
            <div data-group="at-this-stop" style={grpSep}>
              <div style={grpLabel()}>At this stop</div>

              {/* Pills: visit time, timing notes, transit, hours — not rating (shown as row below) */}
              {allPills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                  {allPills.filter(p => p.label !== stageLabel?.text).map((pill, i) => renderPill(pill, i))}
                </div>
              )}

              {/* Full-width rating row — links to Google Maps */}
              {stop.rating != null && stop.rating > 0 && (
                <a
                  href={stop.googleMapsUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${stop.rating.toFixed(1)} stars${placeRatingCount ? `, ${placeRatingCount.toLocaleString()} reviews` : ''} — open in Google Maps`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', marginBottom: 12, borderTop: '1px solid rgba(255,255,255,.07)', borderBottom: '1px solid rgba(255,255,255,.07)', textDecoration: 'none', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: T.text1, letterSpacing: '-.5px', lineHeight: 1 }}>{stop.rating.toFixed(1)}</span>
                    <div>
                      <div style={{ fontSize: 15, color: T.gold, marginBottom: 3, letterSpacing: 1 }}>{'★'.repeat(Math.min(5, Math.round(stop.rating)))}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>
                        {placeRatingCount ? `${placeRatingCount.toLocaleString()} reviews · Google` : 'Google'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 20, color: T.gold }} aria-hidden="true">↗</span>
                </a>
              )}

              {/* Crowd tip — inline plain language, no "GOOD WINDOW" jargon */}
              {crowdRow && (() => {
                const cleanNote = crowdRow.text.replace(/ [—–] /g, '. ').replace(/^[—–] /, '').trim();
                return (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{crowdRow.isBusy ? '⚠️' : '🕗'}</span>
                    <span style={{ fontSize: 14, color: 'rgba(242,237,230,.65)', lineHeight: 1.5 }}>
                      <strong style={{ color: crowdRow.isBusy ? '#e07060' : 'rgba(80,210,140,.85)', fontWeight: 700 }}>
                        {crowdRow.isBusy ? 'Busy now' : 'Good timing'}
                      </strong>
                      {' — '}{cleanNote}
                    </span>
                  </div>
                );
              })()}

              {pillDetail && (
                <div style={{ marginTop: 9, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 5 }}>{pillDetail.title}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(242,237,230,.58)' }}>{pillDetail.body}</div>
                </div>
              )}
            </div>

            {/* ── Group 3a: About this place ───────────────────── */}
            {descriptionText && (
              <div data-group="about-this-place" style={grpSep}>
                <div style={grpLabel()}>About this place</div>
                <p style={{ fontSize: 15, lineHeight: 1.68, color: 'rgba(242,237,230,.58)', margin: '0 0 12px' }}>
                  {descriptionText}
                </p>
              </div>
            )}

            {/* ── Group 3b: Local insight ──────────────────────── */}
            {stop.localTip && (
              <div data-group="local-insight" style={grpSep}>
                <div style={grpLabel('rgba(212,168,83,.55)')}>Local insight <span style={{ fontSize: 10 }}>✦</span></div>
                <p style={{ fontSize: 13, lineHeight: 1.72, color: T.text2, margin: '0 0 8px' }}>{stop.localTip}</p>
                {card.hotelAnchor && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, fontSize: 12, color: card.hotelAnchor.isBlue ? T.sky : card.hotelAnchor.isWarning ? T.gold : T.text3 }}>
                    <span className="ms" style={{ fontSize: 14 }}>{card.hotelAnchor.icon}</span>
                    <span>{card.hotelAnchor.text}</span>
                  </div>
                )}
                {card.pairWith && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: T.text3 }}>
                    <span className="ms" style={{ fontSize: 14 }}>link</span>
                    <span>Pairs well with {card.pairWith.title}</span>
                  </div>
                )}
              </div>
            )}

            {/* Hotel anchor fallback — shown when localTip is absent (else shown inline inside Local insight) */}
            {!stop.localTip && card.hotelAnchor && (() => {
              const anchor = card.hotelAnchor!;
              const bg = anchor.isBlue ? 'rgba(91,155,213,.09)' : anchor.isWarning ? 'rgba(232,160,48,.09)' : 'rgba(212,168,83,.08)';
              const border = anchor.isBlue ? 'rgba(91,155,213,.2)' : anchor.isWarning ? 'rgba(232,160,48,.2)' : 'rgba(212,168,83,.2)';
              const textColor = anchor.isBlue ? 'rgba(91,155,213,.85)' : anchor.isWarning ? 'rgba(232,160,48,.85)' : 'rgba(212,168,83,.85)';
              const iconColor = anchor.isBlue ? '#5b9bd5' : anchor.isWarning ? '#e8a030' : T.gold;
              return (
                <div style={{ ...grpSep, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
                  <span className="ms fill" style={{ fontSize: T.fsMd, color: iconColor, flexShrink: 0 }}>{anchor.icon}</span>
                  <span style={{ fontSize: 13, color: textColor, lineHeight: 1.45 }}>{anchor.text}</span>
                </div>
              );
            })()}

            {/* ── Group 3c: Why we added this ──────────────────── */}
            {stop.isEngineAdded && (
              <div data-group="why-added" style={grpSep}>
                <div style={grpLabel('rgba(107,148,112,.55)')}>Why we added this</div>
                {(() => {
                  // whyForYou = rich TOD/persona-aware copy from engine; prefer it over mechanical consequence
                  const whyText = stop.whyForYou || card.orderReason || 'This stop fits well in your day.';
                  return (
                    <>
                      {whyText && (
                        <p style={{ fontSize: 13, lineHeight: 1.72, color: T.text2, margin: '0 0 8px' }}>
                          {whyText}
                        </p>
                      )}
                      {card.timingAdjustment?.consequenceNote && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: T.text3 }}>
                          <span className="ms" style={{ fontSize: 14 }}>schedule</span>
                          <span>{card.timingAdjustment.consequenceNote}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── Group 4: Next stop ───────────────────────────── */}
            <div data-group="next-stop" style={grpSep}>
              <div style={grpLabel('rgba(79,143,171,.5)')}>Next stop</div>
              {card.nextLeg ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="ms" style={{ fontSize: 22, color: 'rgba(79,143,171,.75)', flexShrink: 0 }}>
                    {card.nextLeg.mode === 'walk' ? 'directions_walk' : 'directions_transit'}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{card.nextLeg.nextStopTitle}</div>
                    <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
                      {card.nextLeg.durationMin} min {card.nextLeg.mode === 'walk' ? 'walk' : 'ride'}, {card.nextLeg.distKm} km
                    </div>
                  </div>
                </div>
              ) : card.hotelAnchor ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="ms" style={{ fontSize: 22, color: 'rgba(79,143,171,.75)', flexShrink: 0 }}>hotel</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{card.hotelAnchor.text}</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: T.text3 }}>Last stop of the day.</div>
              )}
            </div>


          </div>
        </div>

        </div>{/* ── end content-wrapper ── */}
      </div>
    </div>
  );
});
