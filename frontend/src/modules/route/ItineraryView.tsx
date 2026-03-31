import type { ItineraryStop, ItinerarySummary, Place, TripContext } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../map/types';

interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  allPlaces: Place[];
  tripContext: TripContext;
  summary?: ItinerarySummary;
  startTime?: string;
  onRemove: (idx: number) => void;
  onAddMeal: () => void;
  onAddSuggestion: (place: Place) => void;
}

// ── Helpers ────────────────────────────────────────────────────

function tagStyle(tag: string): { bg: string; text: string; label: string } {
  switch (tag) {
    case 'heat':     return { bg: 'bg-amber-100',  text: 'text-amber-800',  label: '🌡 heat' };
    case 'jetlag':   return { bg: 'bg-indigo-100', text: 'text-indigo-800', label: '✈️ jetlag' };
    case 'ramadan':  return { bg: 'bg-purple-100', text: 'text-purple-800', label: '🌙 ramadan' };
    case 'altitude': return { bg: 'bg-teal-100',   text: 'text-teal-800',   label: '⛰ altitude' };
    default:         return { bg: 'bg-zinc-100',   text: 'text-zinc-600',   label: tag };
  }
}

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

const FOOD_KEYWORDS = ['restaurant', 'café', 'cafe', 'lunch', 'dinner', 'eat', 'food', 'bistro', 'pub', 'bar', 'brasserie', 'diner', 'kitchen'];

interface StopWithTime {
  stop: ItineraryStop;
  index: number;
  startMins: number;
  endMins: number;
  isFoodStop: boolean;
}

interface MealGap {
  label: string;
  insertAfterIndex: number;
}

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
    return { stop, index: i, startMins: running, endMins, isFoodStop };
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
    if (spansLunch) gaps.push({ label: 'Lunch', insertAfterIndex: insertAfter });
  }
  const dinnerStart = 1110, dinnerEnd = 1230;
  const hasDinner = timeline.some(t => t.isFoodStop && t.startMins < dinnerEnd && t.endMins > dinnerStart);
  if (!hasDinner) {
    const beforeDinner = timeline.filter(t => t.startMins < dinnerEnd);
    const insertAfter = beforeDinner.length > 0 ? beforeDinner[beforeDinner.length - 1].index : -1;
    const spansDinner = timeline.some(t => t.startMins <= dinnerStart) && timeline.some(t => t.endMins >= dinnerEnd);
    if (spansDinner) gaps.push({ label: 'Dinner', insertAfterIndex: insertAfter });
  }
  return gaps;
}

// ── Starting point meta ────────────────────────────────────────

const START_ICONS: Record<string, string> = {
  hotel:   'meeting_room',
  airport: 'flight_land',
  pin:     'place',
  station: 'train',
  airbnb:  'home',
};

const START_SUBTEXTS: Record<string, string> = {
  hotel:   'Check-in',
  airport: 'Landing',
  pin:     'Starting here',
  station: 'Arriving at station',
  airbnb:  'Check-in',
};

// ── Sub-components ─────────────────────────────────────────────

function MealGapCard({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6 bg-orange/5">
      <div className="w-8 h-8 rounded-full bg-orange/15 flex items-center justify-center flex-shrink-0">
        <span className="ms text-orange text-base">restaurant</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-sm font-semibold">No {label.toLowerCase()} stop planned</p>
        <p className="text-text-3 text-xs">Your schedule has a gap during {label.toLowerCase()} time</p>
      </div>
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-orange/15 text-orange text-xs font-semibold border border-orange/20"
      >
        Add
      </button>
    </div>
  );
}

function SuggestionCard({
  place,
  isSelected,
  onAdd,
}: {
  place: Place;
  isSelected: boolean;
  onAdd: () => void;
}) {
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const label = CATEGORY_LABELS[place.category] ?? 'Place';
  return (
    <div
      className="mx-4 my-2 flex items-center gap-3 px-3 py-3 rounded-xl border border-primary/15"
      style={{ background: 'rgba(59,130,246,.06)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(59,130,246,.12)' }}
      >
        <span className="ms fill text-primary text-base">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-xs font-semibold truncate">{place.title}</p>
        <p className="text-text-3 text-[10px]">Nearby · {label}</p>
      </div>
      <button
        onClick={onAdd}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isSelected
            ? 'bg-primary/15 text-primary border border-primary/20'
            : 'bg-primary text-white'
        }`}
      >
        {isSelected ? 'Added' : '+ Add'}
      </button>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────

export function ItineraryView({
  stops,
  selectedPlaces,
  allPlaces,
  tripContext,
  summary,
  startTime,
  onRemove,
  onAddMeal,
  onAddSuggestion,
}: Props) {
  // Resolve start time: use tripContext.arrivalTime if available, else startTime param, else 9:00
  const resolvedStartTime = tripContext.arrivalTime ?? startTime ?? '9:00';
  const [startH, startM] = resolvedStartTime.split(':').map(Number);
  const arrivalMins = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM);
  // Hotel/airport: add 1 hr buffer so user can rest/settle before first stop
  const restBuffer = (tripContext.startType === 'hotel' || tripContext.startType === 'airport') ? 60 : 0;
  const startMins = arrivalMins + restBuffer;

  const timeline = buildTimeline(stops, startMins, selectedPlaces);
  const mealGaps = detectMealGaps(timeline);

  // Build suggestion list: unselected places, not already in stops by name
  const selectedIds = new Set(selectedPlaces.map(p => p.id));
  const stopNames = new Set(stops.map(s => (s.place ?? '').toLowerCase()));
  const suggestions = allPlaces
    .filter(p => {
      if (selectedIds.has(p.id)) return false;
      const t = p.title.toLowerCase();
      return !Array.from(stopNames).some(n => n.includes(t.slice(0, 8)) || t.includes(n.slice(0, 8)));
    })
    .slice(0, 4);

  // Decide which stops get a suggestion after them
  const suggestionSlots = new Map<number, Place>();
  if (suggestions.length > 0 && stops.length > 1) suggestionSlots.set(0, suggestions[0]);
  if (suggestions.length > 1 && stops.length > 3) suggestionSlots.set(2, suggestions[1]);
  if (suggestions.length > 2 && stops.length > 5) suggestionSlots.set(4, suggestions[2]);

  const startIcon = START_ICONS[tripContext.startType] ?? 'place';
  const startSubtext = START_SUBTEXTS[tripContext.startType] ?? 'Starting here';
  const locationLabel = tripContext.locationName || startSubtext;

  // pro_tip card
  const proTip = summary?.pro_tip;

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/8 bg-surface/50"
      style={{ margin: '0 4px 8px' }}
    >
      {/* ── Starting point ── */}
      <div className="flex gap-3 px-4 py-4 border-b border-white/6">
        <div className="flex flex-col items-center" style={{ width: 52 }}>
          <span className="text-teal-400 text-xs font-semibold leading-tight text-center">
            {tripContext.arrivalTime ?? 'Start'}
          </span>
          <div
            className="w-3 h-3 rounded-full mt-1 mb-1 flex-shrink-0"
            style={{ background: 'rgb(45,212,191)' }}
          />
          <div className="w-px flex-1 bg-white/10 min-h-[24px]" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="ms fill text-teal-400" style={{ fontSize: 13 }}>{startIcon}</span>
            <span className="text-text-3 font-bold uppercase tracking-wider" style={{ fontSize: 10 }}>
              {startSubtext}
            </span>
          </div>
          <div className="font-heading font-bold text-text-1 text-sm">{locationLabel}</div>
          {restBuffer > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="ms fill text-teal-400/60" style={{ fontSize: 11 }}>bedtime</span>
              <span className="text-teal-400/60 text-[10px]">
                Rest & settle in · adventure starts at {parseTimeLabel(startMins)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Pro tip card (if any) ── */}
      {proTip && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 border-b border-white/6"
          style={{ background: 'rgba(251,191,36,.06)' }}
        >
          <span className="ms fill text-amber-400 text-sm mt-0.5 flex-shrink-0">lightbulb</span>
          <p className="text-text-2 text-xs leading-relaxed">{proTip}</p>
        </div>
      )}

      {/* ── Itinerary stops ── */}
      {timeline.map(({ stop, index, startMins: tMins }) => {
        const timeLabel = parseTimeLabel(tMins);
        const isLast = index === stops.length - 1;
        const transit = stop.transit_to_next;
        const gapAfter = mealGaps.filter(g => g.insertAfterIndex === index);
        const suggestionAfter = suggestionSlots.get(index);

        return (
          <div key={index}>
            <div className="flex gap-3 px-4 py-4 border-b border-white/6">
              <div className="flex flex-col items-center" style={{ width: 52 }}>
                <span className="text-text-3 text-xs font-semibold">{timeLabel}</span>
                <div className="w-3 h-3 rounded-full bg-primary mt-1 mb-1 flex-shrink-0" />
                {!isLast && <div className="w-px flex-1 bg-white/10 min-h-[24px]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="font-heading font-bold text-text-1 text-sm">{stop.place}</div>
                  <button onClick={() => onRemove(index)} className="ms text-text-3 text-base ml-2 flex-shrink-0">close</button>
                </div>
                {stop.tip && (
                  <div className="mt-1.5 px-2.5 py-2 rounded-lg border-l-2 border-primary/60 bg-primary/6">
                    <p className="text-text-2 text-xs leading-relaxed">{stop.tip}</p>
                  </div>
                )}
                {stop.duration && (
                  <span className="text-text-3 text-xs mt-1.5 inline-block">{stop.duration}</span>
                )}
                {!isLast && transit && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="ms text-text-3 text-xs">directions_transit</span>
                    <span className="text-text-3 text-xs">{transit}</span>
                  </div>
                )}
                {stop.tags && stop.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stop.tags.map(tag => {
                      const s = tagStyle(tag);
                      return (
                        <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Meal gap cards */}
            {gapAfter.map(gap => (
              <MealGapCard key={gap.label} label={gap.label} onAdd={onAddMeal} />
            ))}

            {/* Between-stop suggestion card */}
            {!isLast && suggestionAfter && (
              <SuggestionCard
                place={suggestionAfter}
                isSelected={selectedIds.has(suggestionAfter.id)}
                onAdd={() => onAddSuggestion(suggestionAfter)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
