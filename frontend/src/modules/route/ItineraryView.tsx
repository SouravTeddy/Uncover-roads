import type { ItineraryStop, ItinerarySummary, Place, TripContext, Persona } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../map/types';

interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  allPlaces: Place[];
  tripContext: TripContext;
  summary?: ItinerarySummary;
  persona?: Persona | null;
  startTime?: string;
  onRemove: (idx: number) => void;
  onAddMeal: () => void;
  onAddSuggestion: (place: Place) => void;
}

// ── Time helpers ───────────────────────────────────────────────

function parseTimeLabel(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${(h % 12) || 12}:${m < 10 ? '0' : ''}${m} ${ap}`;
}

function parseDurationMins(s?: string): number {
  if (!s) return 60;
  const hm = s.match(/(\d+\.?\d*)\s*h/i);
  const mm = s.match(/(\d+)\s*min/i);
  return (hm ? parseFloat(hm[1]) * 60 : 0) + (mm ? parseInt(mm[1]) : 0) || 60;
}

function parseTransitMins(s?: string): number {
  if (!s) return 10;
  const mm = s.match(/(\d+)\s*min/i);
  const hh = s.match(/(\d+)\s*h/i);
  return (mm ? parseInt(mm[1]) : 0) + (hh ? parseInt(hh[1]) * 60 : 0) || 10;
}

// ── Conflict chip parser ───────────────────────────────────────

interface ConflictChip { icon: string; label: string; color: string; bg: string }

function parseConflictChips(notes: string): ConflictChip[] {
  const chips: ConflictChip[] = [];
  if (/ramadan/i.test(notes))               chips.push({ icon: 'nights_stay',        label: 'Ramadan',        color: '#c084fc', bg: 'rgba(168,85,247,.12)' });
  if (/heat|hot/i.test(notes))              chips.push({ icon: 'thermometer',         label: 'Heat',           color: '#fbbf24', bg: 'rgba(245,158,11,.12)' });
  if (/jet.?lag|long.?haul/i.test(notes))   chips.push({ icon: 'flight',              label: 'Jet lag',        color: '#818cf8', bg: 'rgba(99,102,241,.12)' });
  if (/altitude|elevation/i.test(notes))    chips.push({ icon: 'landscape',           label: 'Altitude',       color: '#2dd4bf', bg: 'rgba(20,184,166,.12)' });
  if (/late|rest.*tomorrow|evening.*arrival|night/i.test(notes)) chips.push({ icon: 'bedtime', label: 'Late arrival', color: '#94a3b8', bg: 'rgba(148,163,184,.12)' });
  if (/tight|packed|busy|rush/i.test(notes)) chips.push({ icon: 'timer',             label: 'Tight schedule', color: '#fb923c', bg: 'rgba(251,146,60,.12)' });
  if (/dress|modest|religious/i.test(notes)) chips.push({ icon: 'checkroom',          label: 'Dress code',     color: '#a78bfa', bg: 'rgba(167,139,250,.12)' });
  if (/alcohol|dry city|no.*bar/i.test(notes)) chips.push({ icon: 'no_drinks',        label: 'Dry city',       color: '#6b7280', bg: 'rgba(107,114,128,.12)' });
  if (/walkab|transit|metro/i.test(notes))   chips.push({ icon: 'directions_transit', label: 'Use transit',    color: '#38bdf8', bg: 'rgba(56,189,248,.12)' });
  return chips;
}

// ── Per-stop tag styles ────────────────────────────────────────

function tagStyle(tag: string): { bg: string; color: string; icon: string; label: string } {
  switch (tag) {
    case 'heat':     return { bg: 'rgba(245,158,11,.12)',  color: '#fbbf24', icon: 'thermometer', label: 'Heat' };
    case 'jetlag':   return { bg: 'rgba(99,102,241,.12)',  color: '#818cf8', icon: 'flight',       label: 'Jet lag' };
    case 'ramadan':  return { bg: 'rgba(168,85,247,.12)',  color: '#c084fc', icon: 'nights_stay',  label: 'Ramadan' };
    case 'altitude': return { bg: 'rgba(20,184,166,.12)',  color: '#2dd4bf', icon: 'landscape',    label: 'Altitude' };
    default:         return { bg: 'rgba(255,255,255,.06)', color: '#9ca3af', icon: 'label',        label: tag };
  }
}

// ── Persona match note ─────────────────────────────────────────

function personaMatchNote(archetype: string | undefined, category: string | null): string | null {
  const a = (archetype ?? '').toLowerCase();
  if (!category) return null;
  if (a === 'historian'     && (category === 'historic' || category === 'museum'))  return 'Matched to your love of history';
  if (a === 'epicurean'     && (category === 'restaurant' || category === 'cafe'))  return 'Matched to your love of food';
  if (a === 'wanderer'      && (category === 'place' || category === 'park'))       return 'Perfect for your wandering spirit';
  if (a === 'voyager'       && (category === 'museum' || category === 'tourism'))   return 'Curated for your travel style';
  if (a === 'explorer'      && (category === 'park' || category === 'tourism'))     return 'Fuels your explorer spirit';
  if (a === 'slowtraveller' && (category === 'cafe' || category === 'park'))        return 'Perfect for slow travel';
  if (a === 'pulse'         && (category === 'restaurant' || category === 'place')) return "Right in the city's pulse";
  return null;
}

// ── Reorder reason detection ───────────────────────────────────
// Returns a reason string only when the persona + conflict context makes it meaningful.
// Returns null when we can't give a clear, honest reason.

function detectReorderReason(
  stop: ItineraryStop,
  itineraryIdx: number,
  selectedPlaces: Place[],
  archetype: string | undefined,
  style: string | null | undefined,
  tMins: number,
): string | null {
  const nameLower = (stop.place ?? '').toLowerCase();
  const originalIdx = selectedPlaces.findIndex(p => {
    const t = p.title.toLowerCase();
    return t === nameLower || nameLower.includes(t.slice(0, 8)) || t.includes(nameLower.slice(0, 8));
  });
  if (originalIdx === -1 || originalIdx === itineraryIdx) return null;

  const matchedPlace = selectedPlaces[originalIdx];
  const category = matchedPlace?.category ?? null;
  const a = (archetype ?? '').toLowerCase();
  const s = (style ?? '').toLowerCase();
  const tags = stop.tags ?? [];
  const hasHeat = tags.includes('heat');
  const stopName = (stop.place ?? '').toLowerCase();

  const isMorning      = tMins < 660;   // before 11 AM
  const isMidday       = tMins >= 660  && tMins <= 840;   // 11 AM–2 PM
  const isLateAfternoon = tMins >= 960 && tMins < 1080;   // 4–6 PM
  const isEvening      = tMins >= 1080; // after 6 PM

  // Outdoor stop moved to morning due to heat conflict
  if (hasHeat && isMorning && (category === 'park' || category === 'tourism' || category === 'place')) {
    return 'Morning · before peak heat';
  }

  // Museum/historic moved to morning
  // Only valid for personas who benefit from quieter spaces.
  // NOT for: local style (want local life), wanderer/pulse (want atmosphere), slowtraveller (pace is intentional)
  if (isMorning && (category === 'museum' || category === 'historic')) {
    if (s === 'local' || a === 'wanderer' || a === 'pulse' || a === 'slowtraveller') return null;
    return 'Morning · more space to take it in';
  }

  // Viewpoint/scenic moved to late afternoon
  // Only meaningful for personas who care about light/atmosphere
  if (isLateAfternoon && (category === 'tourism' || category === 'park')) {
    if (a === 'voyager' || a === 'explorer' || a === 'wanderer') {
      return 'Afternoon · golden hour light';
    }
    return null;
  }

  // Restaurant/cafe moved to midday
  if (isMidday && (category === 'restaurant' || category === 'cafe')) {
    if (a === 'epicurean') return 'Lunch hour · prime time for food';
    return 'Midday · keeps energy up';
  }

  // Nightlife/bar placed in evening (name-based, no category for bars)
  const isNightlifeByName = /\b(bar|pub|club|lounge|cocktail|rooftop)\b/i.test(stopName);
  if (isEvening && isNightlifeByName) {
    if (a === 'pulse') return 'Evening · when the city comes alive';
    return 'Moved to evening atmosphere';
  }

  // Market/street moved to morning — only meaningful for wanderer/pulse who want local vibe
  const isMarketByName = /\b(market|bazaar|souk|street food)\b/i.test(stopName);
  if (isMorning && isMarketByName) {
    if (a === 'wanderer' || a === 'pulse' || s === 'local') return 'Morning · when locals are out';
    return null;
  }

  // No clear reason we can honestly state
  return null;
}

// ── Timeline builder ───────────────────────────────────────────

const FOOD_KEYWORDS = ['restaurant','café','cafe','lunch','dinner','eat','food','bistro','pub','bar','brasserie','diner','kitchen'];

interface StopWithTime {
  stop: ItineraryStop;
  index: number;
  startMins: number;
  endMins: number;
  isFoodStop: boolean;
  matchedCategory: string | null;
}

interface MealGap { label: string; insertAfterIndex: number; timeRange: string }

function buildTimeline(stops: ItineraryStop[], startMins: number, selectedPlaces: Place[]): StopWithTime[] {
  let running = startMins;
  return stops.map((stop, i) => {
    if (i > 0) {
      const prev = stops[i - 1];
      running += Math.max(30, parseDurationMins(prev.duration));
      running += parseTransitMins(prev.transit_to_next);
    }
    const endMins = running + parseDurationMins(stop.duration);
    const nameLower = (stop.place ?? '').toLowerCase();
    const matchedPlace = selectedPlaces.find(p => {
      const t = p.title.toLowerCase();
      return t === nameLower || nameLower.includes(t.slice(0, 8)) || t.includes(nameLower.slice(0, 8));
    });
    const isFoodStop =
      (matchedPlace != null && (matchedPlace.category === 'restaurant' || matchedPlace.category === 'cafe')) ||
      FOOD_KEYWORDS.some(kw => nameLower.includes(kw));
    return { stop, index: i, startMins: running, endMins, isFoodStop, matchedCategory: matchedPlace?.category ?? null };
  });
}

function detectMealGaps(timeline: StopWithTime[]): MealGap[] {
  const gaps: MealGap[] = [];
  const lunchStart = 720, lunchEnd = 840;
  // Use a 40-min buffer: a cafe ending at 11:40 counts as covering lunch
  const hasLunch = timeline.some(t => t.isFoodStop && t.startMins < lunchEnd && t.endMins > lunchStart - 40);
  if (!hasLunch) {
    const beforeLunch = timeline.filter(t => t.startMins < lunchEnd);
    const insertAfter = beforeLunch.length > 0 ? beforeLunch[beforeLunch.length - 1].index : -1;
    const spansLunch = timeline.some(t => t.startMins <= lunchStart) && timeline.some(t => t.endMins >= lunchEnd);
    if (spansLunch) gaps.push({ label: 'Lunch', insertAfterIndex: insertAfter, timeRange: '12:00 – 2:00 PM' });
  }
  const dinnerStart = 1110, dinnerEnd = 1230;
  const hasDinner = timeline.some(t => t.isFoodStop && t.startMins < dinnerEnd && t.endMins > dinnerStart - 40);
  if (!hasDinner) {
    const beforeDinner = timeline.filter(t => t.startMins < dinnerEnd);
    const insertAfter = beforeDinner.length > 0 ? beforeDinner[beforeDinner.length - 1].index : -1;
    const spansDinner = timeline.some(t => t.startMins <= dinnerStart) && timeline.some(t => t.endMins >= dinnerEnd);
    if (spansDinner) gaps.push({ label: 'Dinner', insertAfterIndex: insertAfter, timeRange: '6:30 – 9:00 PM' });
  }
  return gaps;
}

// ── Suggestion slot builder ────────────────────────────────────

interface SuggestionSlot {
  place: Place;
  insertAfterIndex: number; // -1 = after last stop (early finish section)
  triggerType: 'meal_gap' | 'early_finish' | 'enroute' | 'variety' | 'persona' | 'fallback';
  detail?: string; // context string: meal label+time, next stop name, end time, variety category, etc.
}

// Returns a filter for the pool that matches the persona's preferred categories.
// Falls back to undefined (= no filter) for wanderer who benefits from any suggestion.
function personaCategoryFilter(archetype: string | undefined): ((p: Place) => boolean) | undefined {
  const a = (archetype ?? '').toLowerCase();
  if (a === 'historian')     return p => p.category === 'museum' || p.category === 'historic';
  if (a === 'epicurean')     return p => p.category === 'restaurant' || p.category === 'cafe';
  if (a === 'explorer')      return p => p.category === 'park' || p.category === 'tourism';
  if (a === 'slowtraveller') return p => p.category === 'cafe' || p.category === 'park';
  if (a === 'voyager')       return p => p.category === 'museum' || p.category === 'historic' || p.category === 'tourism';
  if (a === 'pulse')         return p => p.category === 'restaurant' || p.category === 'place';
  return undefined; // wanderer: no filter — organic discovery
}

// Evenly spaced between-stop positions across the itinerary (0 = after stop 0, etc.)
function evenPositions(stopCount: number, desiredCount: number): number[] {
  const maxPos = stopCount - 2; // last valid between-stop index
  if (maxPos < 0 || desiredCount === 0) return [];
  if (desiredCount === 1) return [Math.floor(maxPos / 2)];
  const step = maxPos / (desiredCount - 1);
  return Array.from({ length: desiredCount }, (_, i) => Math.round(step * i))
    .filter((v, i, a) => a.indexOf(v) === i); // dedupe
}

function buildSuggestions(
  stops: ItineraryStop[],
  timeline: StopWithTime[],
  selectedPlaces: Place[],
  allPlaces: Place[],
  mealGaps: MealGap[],
  endMins: number,
  archetype: string | undefined,
): { slots: SuggestionSlot[]; coveredMealGapPositions: Set<number> } {
  const selectedIds = new Set(selectedPlaces.map(p => p.id));
  const stopNames   = new Set(stops.map(s => (s.place ?? '').toLowerCase()));

  const pool = allPlaces.filter(p => {
    if (selectedIds.has(p.id)) return false;
    const t = p.title.toLowerCase();
    // Use 12-char prefix to avoid false-positives like "Tokyo Museum" vs "Tokyo Tower"
    return !Array.from(stopNames).some(n => {
      if (n === t) return true;
      const prefix = Math.min(t.length, n.length, 12);
      return prefix >= 6 && (n.startsWith(t.slice(0, prefix)) || t.startsWith(n.slice(0, prefix)));
    });
  });

  const usedPlaceIds            = new Set<string>();
  const takenPositions          = new Set<number>();
  const coveredMealGapPositions = new Set<number>();
  const slots: SuggestionSlot[] = [];

  const personaFilter = personaCategoryFilter(archetype);
  const a = (archetype ?? '').toLowerCase();

  function pick(filter?: (p: Place) => boolean): Place | undefined {
    return pool.find(p => !usedPlaceIds.has(p.id) && (!filter || filter(p)));
  }

  // Pick persona-preferred first, fall back to any unselected place
  function pickPersona(): Place | undefined {
    return (personaFilter ? pick(personaFilter) : undefined) ?? pick();
  }

  function addSlot(slot: SuggestionSlot) {
    usedPlaceIds.add(slot.place.id);
    takenPositions.add(slot.insertAfterIndex);
    slots.push(slot);
  }

  // ── 1. Meal gaps ─────────────────────────────────────────────
  // Only suggest food if neither the stop at that position nor the next stop is already food.
  // This prevents "cafe → pizza bar suggestion" situations.
  for (const gap of mealGaps) {
    const prevEntry = timeline.find(t => t.index === gap.insertAfterIndex);
    const nextEntry = timeline.find(t => t.index === gap.insertAfterIndex + 1);
    if (prevEntry?.isFoodStop || nextEntry?.isFoodStop) {
      // Existing food stop nearby — no suggestion needed, just suppress MealGapCard
      coveredMealGapPositions.add(gap.insertAfterIndex);
      continue;
    }
    const foodPlace = pick(p => p.category === 'restaurant' || p.category === 'cafe');
    if (foodPlace) {
      const reason = a === 'epicurean'
        ? `Your food-focused day needs a ${gap.label.toLowerCase()} stop`
        : `No ${gap.label.toLowerCase()} stop · ${gap.timeRange}`;
      addSlot({ place: foodPlace, insertAfterIndex: gap.insertAfterIndex, triggerType: 'meal_gap', detail: reason });
      coveredMealGapPositions.add(gap.insertAfterIndex);
    }
  }

  // ── 2. Variety — only for wanderer / voyager / pulse ─────────
  // Historians with all-museum stops chose that intentionally. Don't fight their persona.
  const varietyArchetypes = ['wanderer', 'voyager', 'pulse'];
  const cats = selectedPlaces.map(p => p.category);
  const uniqueCats = new Set(cats);
  if (uniqueCats.size === 1 && cats.length >= 3 && varietyArchetypes.includes(a)) {
    const dominantCat = cats[0];
    const varietyPlace = pick(p => p.category !== dominantCat);
    if (varietyPlace) {
      // Place at the midpoint of the trip, away from meal-gap positions
      const mid = Math.floor((stops.length - 2) / 2);
      const pos = takenPositions.has(mid) ? mid + 1 : mid;
      if (pos < stops.length - 1) {
        const catLabel = (CATEGORY_LABELS[dominantCat] ?? dominantCat).toLowerCase();
        addSlot({ place: varietyPlace, insertAfterIndex: pos, triggerType: 'variety', detail: `Only ${catLabel} stops so far · adds variety` });
      }
    }
  }

  // ── 3. Persona-matched suggestions — evenly distributed ──────
  // Number of between-stop suggestions: 1 for short trips, 2 for longer
  const betweenDesired = stops.length >= 4 ? 2 : 1;
  const targetPositions = evenPositions(stops.length, betweenDesired);

  for (const targetPos of targetPositions) {
    // Find the nearest free position to the target
    let pos = targetPos;
    let found = false;
    for (let offset = 0; offset <= 2; offset++) {
      if (!takenPositions.has(targetPos + offset) && targetPos + offset < stops.length - 1) {
        pos = targetPos + offset; found = true; break;
      }
      if (offset > 0 && !takenPositions.has(targetPos - offset) && targetPos - offset >= 0) {
        pos = targetPos - offset; found = true; break;
      }
    }
    if (!found || takenPositions.has(pos)) continue;

    const prevEntry = timeline.find(t => t.index === pos);
    const nextEntry = timeline.find(t => t.index === pos + 1);
    const adjacentIsFood = prevEntry?.isFoodStop || nextEntry?.isFoodStop;

    // For enroute (transit > 45 min): prefer persona category, use enroute trigger
    const transitMins = parseTransitMins(prevEntry?.stop.transit_to_next);
    const nextStop = stops[pos + 1];

    if (transitMins >= 45) {
      // Avoid suggesting food when adjacent stop is already food
      const p = adjacentIsFood
        ? pick(p => p.category !== 'restaurant' && p.category !== 'cafe')
        : pickPersona();
      if (p) addSlot({ place: p, insertAfterIndex: pos, triggerType: 'enroute', detail: nextStop?.place });
    } else {
      // Avoid food suggestion adjacent to food stop (unless epicurean)
      const p = (adjacentIsFood && a !== 'epicurean')
        ? pick(p => p.category !== 'restaurant' && p.category !== 'cafe')
        : pickPersona();
      if (p) addSlot({ place: p, insertAfterIndex: pos, triggerType: 'persona' });
    }
  }

  // ── 4. Early finish — persona-preferred suggestions after last stop ──
  const EARLY_FINISH = 17 * 60; // 5 PM
  if (endMins < EARLY_FINISH) {
    const endLabel = parseTimeLabel(endMins);
    const extraCount = endMins < 15 * 60 ? 2 : 1;
    const lastEntry = timeline[timeline.length - 1];
    for (let i = 0; i < extraCount; i++) {
      // Don't suggest food right after the last stop if it's already food
      const p = (lastEntry?.isFoodStop && a !== 'epicurean')
        ? pick(p => p.category !== 'restaurant' && p.category !== 'cafe')
        : pickPersona();
      if (p) addSlot({ place: p, insertAfterIndex: -1, triggerType: 'early_finish', detail: endLabel });
    }
  }

  return { slots, coveredMealGapPositions };
}

// Derives display reason from slot context
function slotReason(slot: SuggestionSlot, archetype: string | undefined, place: Place): string {
  const label = CATEGORY_LABELS[place.category] ?? 'Place';
  switch (slot.triggerType) {
    case 'meal_gap':    return slot.detail ?? 'Missing a meal stop here';
    case 'enroute':     return slot.detail ? `On the way to ${slot.detail}` : 'Fits your route';
    case 'variety':     return slot.detail ?? 'Adds variety to your day';
    case 'early_finish':return slot.detail ? `Day ends at ${slot.detail} · room for one more` : 'Room to add more';
    case 'persona':     return personaMatchNote(archetype, place.category) ?? `Nearby ${label}`;
    default:            return `Nearby ${label}`;
  }
}

// ── Starting point meta ────────────────────────────────────────

const START_ICONS: Record<string, string>    = { hotel:'meeting_room', airport:'flight_land', pin:'place', station:'train', airbnb:'home' };
const START_SUBTEXTS: Record<string, string> = { hotel:'Check-in', airport:'Landing', pin:'Starting here', station:'Arriving', airbnb:'Check-in' };

// ── Sub-components ─────────────────────────────────────────────

function TripSummaryBar({
  startMins, endMins, stopCount, summary, allTags,
}: {
  startMins: number; endMins: number; stopCount: number;
  summary?: ItinerarySummary; allTags: string[];
}) {
  const durationH = Math.round((endMins - startMins) / 60 * 10) / 10;
  const durationLabel = durationH >= 1 ? `${durationH}h` : `${Math.round(endMins - startMins)}m`;
  const uniqueTags = [...new Set(allTags)];

  return (
    <div className="px-4 py-3 border-b border-white/6" style={{ background: 'rgba(255,255,255,.025)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="ms fill text-primary" style={{ fontSize: 13 }}>schedule</span>
          <span className="text-text-1 font-bold" style={{ fontSize: 13 }}>{parseTimeLabel(startMins)}</span>
          <span className="ms text-text-3" style={{ fontSize: 14 }}>arrow_forward</span>
          <span className="text-text-1 font-bold" style={{ fontSize: 13 }}>{parseTimeLabel(endMins)}</span>
          <span className="text-text-3" style={{ fontSize: 11 }}>({durationLabel})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="ms fill text-text-3" style={{ fontSize: 13 }}>location_on</span>
          <span className="text-text-2 font-semibold" style={{ fontSize: 12 }}>{stopCount} stops</span>
        </div>
      </div>
      {(summary?.best_transport || uniqueTags.length > 0) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {summary?.best_transport && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,.1)' }}>
              <span className="ms fill text-sky-400" style={{ fontSize: 11 }}>directions_transit</span>
              <span className="text-sky-400 font-medium" style={{ fontSize: 10 }}>{summary.best_transport}</span>
            </div>
          )}
          {uniqueTags.map(tag => {
            const s = tagStyle(tag);
            return (
              <div key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: s.bg }}>
                <span className="ms fill" style={{ fontSize: 11, color: s.color }}>{s.icon}</span>
                <span className="font-medium" style={{ fontSize: 10, color: s.color }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConflictNotices({ notes, proTip }: { notes?: string; proTip?: string }) {
  if (!notes && !proTip) return null;
  const chips = notes ? parseConflictChips(notes) : [];
  const showRawNote = notes && chips.length === 0;
  return (
    <div className="border-b border-white/6">
      {chips.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
          <span className="ms fill text-text-3" style={{ fontSize: 13 }}>tune</span>
          {chips.map((c, i) => (
            <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: c.bg }}>
              <span className="ms fill" style={{ fontSize: 12, color: c.color }}>{c.icon}</span>
              <span className="font-semibold" style={{ fontSize: 11, color: c.color }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {showRawNote && (
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="ms fill text-orange-400 flex-shrink-0" style={{ fontSize: 13 }}>info</span>
          <p className="text-text-3 text-xs leading-snug line-clamp-2">{notes}</p>
        </div>
      )}
      {proTip && (
        <div className="flex items-start gap-2 px-4 py-2.5" style={{ background: chips.length > 0 ? undefined : 'rgba(251,191,36,.04)' }}>
          <span className="ms fill text-amber-400 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }}>lightbulb</span>
          <p className="text-text-2 text-xs leading-snug">{proTip}</p>
        </div>
      )}
    </div>
  );
}

function MealGapCard({ label, timeRange, onAdd }: { label: string; timeRange: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6" style={{ background: 'rgba(249,115,22,.05)' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,.12)' }}>
        <span className="ms text-orange-400 text-base">restaurant</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-sm font-semibold">No {label.toLowerCase()} planned</p>
        <p className="text-text-3 text-xs">No food stop between {timeRange}</p>
      </div>
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border"
        style={{ background: 'rgba(249,115,22,.12)', color: '#fb923c', borderColor: 'rgba(249,115,22,.2)' }}
      >
        Add
      </button>
    </div>
  );
}

function SuggestionCard({
  slot, isSelected, archetype, onAdd,
}: {
  slot: SuggestionSlot; isSelected: boolean; archetype?: string; onAdd: () => void;
}) {
  const { place } = slot;
  const icon   = CATEGORY_ICONS[place.category] ?? 'location_on';
  const reason = slotReason(slot, archetype, place);

  // Icon for the reason context
  const reasonIcon =
    slot.triggerType === 'meal_gap'     ? 'restaurant' :
    slot.triggerType === 'enroute'      ? 'route' :
    slot.triggerType === 'variety'      ? 'shuffle' :
    slot.triggerType === 'early_finish' ? 'add_circle' :
    'auto_awesome';

  return (
    <div className="mx-4 my-2 flex items-center gap-3 px-3 py-3 rounded-xl border border-primary/15" style={{ background: 'rgba(59,130,246,.06)' }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,.12)' }}>
        <span className="ms fill text-primary text-base">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-xs font-semibold truncate">{place.title}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="ms fill" style={{ fontSize: 10, color: 'rgba(96,165,250,.65)' }}>{reasonIcon}</span>
          <p style={{ fontSize: 10, color: 'rgba(96,165,250,.75)', fontWeight: 500 }}>{reason}</p>
        </div>
      </div>
      <button
        onClick={onAdd}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isSelected ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-primary text-white'
        }`}
      >
        {isSelected ? 'Added' : '+ Add'}
      </button>
    </div>
  );
}

function EarlyFinishSection({
  slots, selectedIds, archetype, onAdd,
}: {
  slots: SuggestionSlot[]; selectedIds: Set<string>; archetype?: string; onAdd: (place: Place) => void;
}) {
  if (slots.length === 0) return null;
  const endLabel = slots[0].detail ?? 'early';
  return (
    <div className="border-t border-white/6 pt-2 pb-1">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="ms fill text-primary/60" style={{ fontSize: 13 }}>add_circle</span>
        <p className="text-text-3 font-semibold" style={{ fontSize: 11 }}>
          Day wraps at {endLabel} · you have time to add more
        </p>
      </div>
      {slots.map((slot, i) => (
        <SuggestionCard
          key={i}
          slot={slot}
          isSelected={selectedIds.has(slot.place.id)}
          archetype={archetype}
          onAdd={() => onAdd(slot.place)}
        />
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────

export function ItineraryView({
  stops, selectedPlaces, allPlaces, tripContext, summary, persona, startTime,
  onRemove, onAddMeal, onAddSuggestion,
}: Props) {
  // Use AI-suggested start time if provided, otherwise compute from arrival
  const aiStartTime = summary?.suggested_start_time;
  const resolvedStart = tripContext.arrivalTime ?? startTime ?? '9:00';
  const [startH, startM] = resolvedStart.split(':').map(Number);
  const arrivalMins = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM);

  // Smart rest buffer: for overnight arrivals (midnight–5:59 AM), rest until 8 AM
  // For early morning arrivals (6–8:59 AM), add 60 min. Otherwise standard buffer.
  const isOvernightArrival = arrivalMins < 6 * 60;
  const isEarlyMorning     = arrivalMins >= 6 * 60 && arrivalMins < 9 * 60;
  const hasBase = tripContext.startType === 'hotel' || tripContext.startType === 'airport';

  let startMins: number;
  if (aiStartTime) {
    // Parse "9:00 AM" / "14:00" / "9:00" formats
    const m24 = aiStartTime.match(/^(\d{1,2}):(\d{2})$/);
    const m12 = aiStartTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m12) {
      let h = parseInt(m12[1]); const min = parseInt(m12[2]); const ampm = m12[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      startMins = h * 60 + min;
    } else if (m24) {
      startMins = parseInt(m24[1]) * 60 + parseInt(m24[2]);
    } else {
      startMins = 9 * 60; // fallback
    }
  } else if (isOvernightArrival && hasBase) {
    startMins = 8 * 60; // rest until 8 AM
  } else if (isEarlyMorning && hasBase) {
    startMins = arrivalMins + 60;
  } else if (hasBase) {
    startMins = arrivalMins + 30;
  } else {
    startMins = arrivalMins;
  }

  const restBuffer = startMins - arrivalMins; // kept for display purposes

  const timeline = buildTimeline(stops, startMins, selectedPlaces);
  const mealGaps = detectMealGaps(timeline);
  const lastStop = timeline[timeline.length - 1];
  const endMins  = lastStop ? lastStop.endMins : startMins + 60;
  const allTags  = stops.flatMap(s => s.tags ?? []);

  const archetype = persona?.archetype;
  const style     = persona?.style;

  const { slots, coveredMealGapPositions } = buildSuggestions(
    stops, timeline, selectedPlaces, allPlaces, mealGaps, endMins, archetype,
  );

  const selectedIds = new Set(selectedPlaces.map(p => p.id));

  // Separate early-finish slots from between-stop slots
  const betweenSlots  = slots.filter(s => s.insertAfterIndex >= 0);
  const afterLastSlots = slots.filter(s => s.insertAfterIndex === -1);

  // Reorder banner: if any stop has a reorder reason, show a subtle chip at top
  const hasAnyReorder = timeline.some(({ stop, index, startMins: tMins }) =>
    detectReorderReason(stop, index, selectedPlaces, archetype, style, tMins) !== null
  );

  const startIcon    = START_ICONS[tripContext.startType]    ?? 'place';
  const startSubtext = START_SUBTEXTS[tripContext.startType] ?? 'Starting here';
  const locationLabel = tripContext.locationName || startSubtext;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-surface/50" style={{ margin: '0 4px 8px' }}>

      {/* ── Trip summary bar ── */}
      <TripSummaryBar
        startMins={startMins}
        endMins={endMins}
        stopCount={stops.length}
        summary={summary}
        allTags={allTags}
      />

      {/* ── Conflict notices + pro tip ── */}
      <ConflictNotices notes={summary?.conflict_notes} proTip={summary?.pro_tip} />

      {/* ── Reorder banner (only when stops were reordered for a clear reason) ── */}
      {hasAnyReorder && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6" style={{ background: 'rgba(99,102,241,.06)' }}>
          <span className="ms fill text-indigo-400 flex-shrink-0" style={{ fontSize: 13 }}>edit_road</span>
          <p className="text-indigo-300 font-medium" style={{ fontSize: 11 }}>
            Stops reordered for a better flow
          </p>
        </div>
      )}

      {/* ── Starting point ── */}
      <div className="flex gap-3 px-4 py-4 border-b border-white/6">
        <div className="flex flex-col items-center" style={{ width: 52 }}>
          <span className="font-semibold leading-tight text-center" style={{ fontSize: 11, color: 'rgb(45,212,191)' }}>
            {parseTimeLabel(startMins)}
          </span>
          <div className="w-3 h-3 rounded-full mt-1 mb-1 flex-shrink-0" style={{ background: 'rgb(45,212,191)' }} />
          <div className="w-px flex-1 bg-white/10 min-h-[24px]" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="ms fill text-teal-400" style={{ fontSize: 13 }}>{startIcon}</span>
            <span className="text-text-3 font-bold uppercase tracking-wider" style={{ fontSize: 10 }}>{startSubtext}</span>
          </div>
          <div className="font-heading font-bold text-text-1 text-sm">{locationLabel}</div>
          {tripContext.arrivalTime && restBuffer > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="ms fill" style={{ fontSize: 11, color: 'rgba(45,212,191,.55)' }}>
                {isOvernightArrival ? 'bedtime' : 'timelapse'}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(45,212,191,.55)' }}>
                {isOvernightArrival
                  ? `Arrived ${tripContext.arrivalTime} · resting until ${parseTimeLabel(startMins)}`
                  : `Arrived ${tripContext.arrivalTime} · settling in`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Itinerary stops ── */}
      {timeline.map(({ stop, index, startMins: tMins, matchedCategory }) => {
        const timeLabel    = parseTimeLabel(tMins);
        const isLast       = index === stops.length - 1;
        const transit      = stop.transit_to_next;
        const matchNote    = personaMatchNote(archetype, matchedCategory);
        const reorderReason = detectReorderReason(stop, index, selectedPlaces, archetype, style, tMins);

        // Meal gap cards at this position (only if not covered by a suggestion slot)
        const gapAfter = mealGaps.filter(g =>
          g.insertAfterIndex === index && !coveredMealGapPositions.has(index)
        );

        // Between-stop suggestion at this position
        const suggAfter = !isLast ? betweenSlots.find(s => s.insertAfterIndex === index) : undefined;

        return (
          <div key={index}>
            <div className="flex gap-3 px-4 py-4 border-b border-white/6">
              {/* Spine */}
              <div className="flex flex-col items-center" style={{ width: 52 }}>
                <span className="text-text-3 font-semibold" style={{ fontSize: 11 }}>{timeLabel}</span>
                <div className="w-3 h-3 rounded-full bg-primary mt-1 mb-1 flex-shrink-0" />
                {!isLast && <div className="w-px flex-1 bg-white/10 min-h-[24px]" />}
              </div>

              {/* Card body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-heading font-bold text-text-1 text-sm leading-snug">{stop.place}</div>
                  <button onClick={() => onRemove(index)} className="ms text-text-3 flex-shrink-0" style={{ fontSize: 18 }}>close</button>
                </div>

                {/* Reorder reason pill */}
                {reorderReason && (
                  <div
                    className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,.12)' }}
                  >
                    <span className="ms fill" style={{ fontSize: 10, color: '#818cf8' }}>swap_vert</span>
                    <span style={{ fontSize: 10, color: '#818cf8', fontWeight: 600 }}>{reorderReason}</span>
                  </div>
                )}

                {/* Insider tip */}
                {stop.tip && (
                  <div className="mt-1.5 px-2.5 py-1.5 rounded-lg border-l-2 border-primary/50" style={{ background: 'rgba(59,130,246,.06)' }}>
                    <p className="text-text-2 text-xs leading-relaxed">{stop.tip}</p>
                  </div>
                )}

                {/* Persona match + duration + transit */}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {matchNote && (
                    <div className="flex items-center gap-1">
                      <span className="ms fill" style={{ fontSize: 11, color: 'rgba(96,165,250,.6)' }}>auto_awesome</span>
                      <span style={{ fontSize: 10, color: 'rgba(96,165,250,.7)', fontWeight: 500 }}>{matchNote}</span>
                    </div>
                  )}
                  {stop.duration && (
                    <div className="flex items-center gap-1">
                      <span className="ms text-text-3" style={{ fontSize: 11 }}>schedule</span>
                      <span className="text-text-3" style={{ fontSize: 10 }}>{stop.duration}</span>
                    </div>
                  )}
                  {!isLast && transit && (
                    <div className="flex items-center gap-1">
                      <span className="ms text-text-3" style={{ fontSize: 11 }}>directions_walk</span>
                      <span className="text-text-3" style={{ fontSize: 10 }}>{transit}</span>
                    </div>
                  )}
                </div>

                {/* Conflict tags */}
                {stop.tags && stop.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {stop.tags.map(tag => {
                      const s = tagStyle(tag);
                      return (
                        <div key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: s.bg }}>
                          <span className="ms fill" style={{ fontSize: 10, color: s.color }}>{s.icon}</span>
                          <span className="font-medium" style={{ fontSize: 10, color: s.color }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Meal gap fallback (no food place in pool) */}
            {gapAfter.map(gap => (
              <MealGapCard key={gap.label} label={gap.label} timeRange={gap.timeRange} onAdd={onAddMeal} />
            ))}

            {/* Between-stop suggestion */}
            {suggAfter && (
              <SuggestionCard
                slot={suggAfter}
                isSelected={selectedIds.has(suggAfter.place.id)}
                archetype={archetype}
                onAdd={() => onAddSuggestion(suggAfter.place)}
              />
            )}
          </div>
        );
      })}

      {/* ── Early finish suggestions (after last stop) ── */}
      <EarlyFinishSection
        slots={afterLastSlots}
        selectedIds={selectedIds}
        archetype={archetype}
        onAdd={onAddSuggestion}
      />
    </div>
  );
}
