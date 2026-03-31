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

// ── Helpers ────────────────────────────────────────────────────

function parseTimeLabel(startMins: number): string {
  const h = Math.floor(startMins / 60) % 24;
  const m = Math.round(startMins % 60);
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

// ── Conflict tag styles (matching ip_engine conflict categories) ──

function tagStyle(tag: string): { bg: string; color: string; icon: string; label: string } {
  switch (tag) {
    case 'heat':     return { bg: 'rgba(245,158,11,.12)',  color: '#fbbf24', icon: 'thermometer',  label: 'Heat advisory' };
    case 'jetlag':   return { bg: 'rgba(99,102,241,.12)',  color: '#818cf8', icon: 'flight',        label: 'Jet lag — take it easy' };
    case 'ramadan':  return { bg: 'rgba(168,85,247,.12)',  color: '#c084fc', icon: 'nights_stay',   label: 'Ramadan hours' };
    case 'altitude': return { bg: 'rgba(20,184,166,.12)',  color: '#2dd4bf', icon: 'landscape',     label: 'High altitude' };
    default:         return { bg: 'rgba(255,255,255,.06)', color: '#9ca3af', icon: 'label',         label: tag };
  }
}

// ── Persona match note per stop ────────────────────────────────

function personaMatchNote(archetype: string | undefined, category: string | null): string | null {
  const a = (archetype ?? '').toLowerCase();
  if (!category) return null;
  if (a === 'historian'     && (category === 'historic' || category === 'museum'))  return 'Matched to your love of history';
  if (a === 'epicurean'     && (category === 'restaurant' || category === 'cafe'))  return 'Matched to your love of food';
  if (a === 'wanderer'      && (category === 'place' || category === 'park'))       return 'Perfect for your wandering spirit';
  if (a === 'voyager'       && (category === 'museum' || category === 'tourism'))   return 'Curated for your travel style';
  if (a === 'explorer'      && (category === 'park' || category === 'tourism'))     return 'Fuels your explorer spirit';
  if (a === 'slowtraveller' && (category === 'cafe' || category === 'park'))        return 'Perfect for your slow travel pace';
  if (a === 'pulse'         && (category === 'restaurant' || category === 'place')) return "Right in the city's pulse";
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
  const hasLunch = timeline.some(t => t.isFoodStop && t.startMins < lunchEnd && t.endMins > lunchStart);
  if (!hasLunch) {
    const beforeLunch = timeline.filter(t => t.startMins < lunchEnd);
    const insertAfter = beforeLunch.length > 0 ? beforeLunch[beforeLunch.length - 1].index : -1;
    const spansLunch = timeline.some(t => t.startMins <= lunchStart) && timeline.some(t => t.endMins >= lunchEnd);
    if (spansLunch) gaps.push({ label: 'Lunch', insertAfterIndex: insertAfter, timeRange: '12:00 – 2:00 PM' });
  }
  const dinnerStart = 1110, dinnerEnd = 1230;
  const hasDinner = timeline.some(t => t.isFoodStop && t.startMins < dinnerEnd && t.endMins > dinnerStart);
  if (!hasDinner) {
    const beforeDinner = timeline.filter(t => t.startMins < dinnerEnd);
    const insertAfter = beforeDinner.length > 0 ? beforeDinner[beforeDinner.length - 1].index : -1;
    const spansDinner = timeline.some(t => t.startMins <= dinnerStart) && timeline.some(t => t.endMins >= dinnerEnd);
    if (spansDinner) gaps.push({ label: 'Dinner', insertAfterIndex: insertAfter, timeRange: '6:30 – 9:00 PM' });
  }
  return gaps;
}

// ── Starting point meta ────────────────────────────────────────

const START_ICONS: Record<string, string>    = { hotel:'meeting_room', airport:'flight_land', pin:'place', station:'train', airbnb:'home' };
const START_SUBTEXTS: Record<string, string> = { hotel:'Check-in',     airport:'Landing',     pin:'Starting here', station:'Arriving', airbnb:'Check-in' };

// ── Sub-components ─────────────────────────────────────────────

function MealGapCard({ label, timeRange, onAdd }: { label: string; timeRange: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6" style={{ background: 'rgba(249,115,22,.05)' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,.12)' }}>
        <span className="ms text-orange-400 text-base">restaurant</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-sm font-semibold">No {label.toLowerCase()} planned</p>
        <p className="text-text-3 text-xs">Your route has no food stop between {timeRange}</p>
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

function SuggestionCard({ place, isSelected, onAdd }: { place: Place; isSelected: boolean; onAdd: () => void }) {
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const label = CATEGORY_LABELS[place.category] ?? 'Place';
  return (
    <div className="mx-4 my-2 flex items-center gap-3 px-3 py-3 rounded-xl border border-primary/15" style={{ background: 'rgba(59,130,246,.06)' }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,.12)' }}>
        <span className="ms fill text-primary text-base">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-xs font-semibold truncate">{place.title}</p>
        <p className="text-text-3 text-[10px]">Nearby · {label}</p>
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

// ── Main ───────────────────────────────────────────────────────

export function ItineraryView({ stops, selectedPlaces, allPlaces, tripContext, summary, persona, startTime, onRemove, onAddMeal, onAddSuggestion }: Props) {
  const resolvedStart = tripContext.arrivalTime ?? startTime ?? '9:00';
  const [startH, startM] = resolvedStart.split(':').map(Number);
  const arrivalMins = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM);
  // Hotel/airport: 60-min rest buffer so user can settle in before first stop
  const restBuffer = (tripContext.startType === 'hotel' || tripContext.startType === 'airport') ? 60 : 0;
  const startMins = arrivalMins + restBuffer;

  const timeline = buildTimeline(stops, startMins, selectedPlaces);
  const mealGaps = detectMealGaps(timeline);

  // Between-stop suggestions: unselected places not already in the route
  const selectedIds = new Set(selectedPlaces.map(p => p.id));
  const stopNames = new Set(stops.map(s => (s.place ?? '').toLowerCase()));
  const suggestions = allPlaces
    .filter(p => {
      if (selectedIds.has(p.id)) return false;
      const t = p.title.toLowerCase();
      return !Array.from(stopNames).some(n => n.includes(t.slice(0, 8)) || t.includes(n.slice(0, 8)));
    })
    .slice(0, 4);

  const suggestionSlots = new Map<number, Place>();
  if (suggestions.length > 0 && stops.length > 1) suggestionSlots.set(0, suggestions[0]);
  if (suggestions.length > 1 && stops.length > 3) suggestionSlots.set(2, suggestions[1]);
  if (suggestions.length > 2 && stops.length > 5) suggestionSlots.set(4, suggestions[2]);

  const startIcon    = START_ICONS[tripContext.startType]    ?? 'place';
  const startSubtext = START_SUBTEXTS[tripContext.startType] ?? 'Starting here';
  const locationLabel = tripContext.locationName || startSubtext;
  const archetype = persona?.archetype;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-surface/50" style={{ margin: '0 4px 8px' }}>

      {/* ── Starting point ── */}
      <div className="flex gap-3 px-4 py-4 border-b border-white/6">
        <div className="flex flex-col items-center" style={{ width: 52 }}>
          <span className="font-semibold leading-tight text-center" style={{ fontSize: 11, color: 'rgb(45,212,191)' }}>
            {tripContext.arrivalTime ?? 'Start'}
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
          {restBuffer > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="ms fill" style={{ fontSize: 11, color: 'rgba(45,212,191,.55)' }}>bedtime</span>
              <span style={{ fontSize: 10, color: 'rgba(45,212,191,.55)' }}>
                Rest & settle in · adventure starts at {parseTimeLabel(startMins)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Conflict notes (AI synthesis of all adaptations made) ── */}
      {summary?.conflict_notes && (
        <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/6" style={{ background: 'rgba(251,146,60,.06)' }}>
          <span className="ms fill text-orange-400 flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>info</span>
          <div>
            <p className="text-orange-300 font-semibold mb-0.5" style={{ fontSize: 11 }}>Itinerary adapted for your trip</p>
            <p className="text-text-2 text-xs leading-relaxed">{summary.conflict_notes}</p>
          </div>
        </div>
      )}

      {/* ── Pro tip ── */}
      {summary?.pro_tip && (
        <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/6" style={{ background: 'rgba(251,191,36,.06)' }}>
          <span className="ms fill text-amber-400 flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>lightbulb</span>
          <p className="text-text-2 text-xs leading-relaxed">{summary.pro_tip}</p>
        </div>
      )}

      {/* ── Stops ── */}
      {timeline.map(({ stop, index, startMins: tMins, matchedCategory }) => {
        const timeLabel = parseTimeLabel(tMins);
        const isLast    = index === stops.length - 1;
        const transit   = stop.transit_to_next;
        const gapAfter  = mealGaps.filter(g => g.insertAfterIndex === index);
        const suggAfter = suggestionSlots.get(index);
        const matchNote = personaMatchNote(archetype, matchedCategory);

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

                {/* Insider tip */}
                {stop.tip && (
                  <div className="mt-1.5 px-2.5 py-1.5 rounded-lg border-l-2 border-primary/50" style={{ background: 'rgba(59,130,246,.06)' }}>
                    <p className="text-text-2 text-xs leading-relaxed">{stop.tip}</p>
                  </div>
                )}

                {/* Persona match */}
                {matchNote && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="ms fill" style={{ fontSize: 12, color: 'rgba(96,165,250,.6)' }}>auto_awesome</span>
                    <span style={{ fontSize: 10, color: 'rgba(96,165,250,.7)', fontWeight: 500 }}>{matchNote}</span>
                  </div>
                )}

                {/* Duration */}
                {stop.duration && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="ms text-text-3" style={{ fontSize: 12 }}>schedule</span>
                    <span className="text-text-3 text-xs">{stop.duration}</span>
                  </div>
                )}

                {/* Transit to next */}
                {!isLast && transit && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="ms text-text-3" style={{ fontSize: 12 }}>directions_walk</span>
                    <span className="text-text-3 text-xs">{transit}</span>
                  </div>
                )}

                {/* Conflict tags: heat / jetlag / ramadan / altitude */}
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

            {/* Meal gap cards */}
            {gapAfter.map(gap => (
              <MealGapCard key={gap.label} label={gap.label} timeRange={gap.timeRange} onAdd={onAddMeal} />
            ))}

            {/* Between-stop suggestion */}
            {!isLast && suggAfter && (
              <SuggestionCard
                place={suggAfter}
                isSelected={selectedIds.has(suggAfter.id)}
                onAdd={() => onAddSuggestion(suggAfter)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
