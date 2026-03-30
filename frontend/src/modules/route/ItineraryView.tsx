import type { ItineraryStop } from '../../shared/types';

interface Props {
  stops: ItineraryStop[];
  startTime?: string; // "HH:MM"
  onRemove: (idx: number) => void;
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

export function ItineraryView({ stops, startTime, onRemove }: Props) {
  const [startH, startM] = (startTime ?? '9:00').split(':').map(Number);
  const startMins = (startH || 9) * 60 + (startM || 0);

  let runningMins = startMins;

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/8 bg-surface/50"
      style={{ margin: '0 4px' }}
    >
      {stops.map((stop, i) => {
        if (i > 0) {
          const prev = stops[i - 1];
          runningMins += Math.max(30, parseDurationMins(prev.duration));
          runningMins += parseTransitMins(prev.transit_to_next);
        }

        const timeLabel = parseTimeLabel(runningMins);
        const isLast = i === stops.length - 1;
        const transit = stop.transit_to_next;

        return (
          <div key={i} className="flex gap-3 px-4 py-4 border-b border-white/6 last:border-none">
            {/* Left: time + line */}
            <div className="flex flex-col items-center" style={{ width: 52 }}>
              <span className="text-text-3 text-xs font-semibold">{timeLabel}</span>
              <div className="w-3 h-3 rounded-full bg-primary mt-1 mb-1 flex-shrink-0" />
              {!isLast && <div className="w-px flex-1 bg-white/10 min-h-[24px]" />}
            </div>

            {/* Right: content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="font-heading font-bold text-text-1 text-sm">{stop.place}</div>
                <button
                  onClick={() => onRemove(i)}
                  className="ms text-text-3 text-base ml-2 flex-shrink-0"
                >
                  close
                </button>
              </div>

              {stop.tip && (
                <p className="text-text-3 text-xs mt-1 leading-relaxed line-clamp-2">{stop.tip}</p>
              )}

              {stop.duration && (
                <span className="text-text-3 text-xs mt-1 inline-block">
                  {stop.duration}
                </span>
              )}

              {!isLast && transit && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="ms text-text-3 text-xs">directions_transit</span>
                  <span className="text-text-3 text-xs">{transit}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
