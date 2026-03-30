import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import type { StartType } from '../../shared/types';

interface Props {
  onClose: () => void;
}

const START_TYPES: { value: StartType; icon: string; label: string }[] = [
  { value: 'hotel',   icon: 'hotel',    label: 'Hotel' },
  { value: 'airport', icon: 'flight',   label: 'Airport' },
  { value: 'station', icon: 'train',    label: 'Station' },
  { value: 'airbnb',  icon: 'cottage',  label: 'Airbnb' },
];

export function TripSheet({ onClose }: Props) {
  const { state, dispatch } = useAppStore();
  const ctx = state.tripContext;

  const [date, setDate] = useState(ctx.date);
  const [startType, setStartType] = useState<StartType>(ctx.startType);
  const [arrivalTime, setArrivalTime] = useState(ctx.arrivalTime ?? '');
  const [days, setDays] = useState(ctx.days);
  const [dayNumber, setDayNumber] = useState(ctx.dayNumber);

  const needsArrival = startType === 'airport' || startType === 'station';
  const canGenerate = date && startType;

  function handleGenerate() {
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date,
        startType,
        arrivalTime: needsArrival && arrivalTime ? arrivalTime : null,
        days,
        dayNumber: Math.min(dayNumber, days),
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 25, background: 'rgba(0,0,0,.5)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-surface flex flex-col"
        style={{
          zIndex: 26,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
          maxHeight: '85dvh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="overflow-y-auto px-5 pb-2">
          <h2 className="font-heading font-bold text-text-1 text-lg mb-1">Trip details</h2>
          <p className="text-text-3 text-sm mb-5">Help us build the perfect itinerary for you</p>

          {/* Travel date */}
          <label className="block mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Travel date
            </span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
              style={{ colorScheme: 'dark' }}
            />
          </label>

          {/* Starting point */}
          <div className="mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Starting from
            </span>
            <div className="grid grid-cols-4 gap-2">
              {START_TYPES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStartType(s.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    startType === s.value
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-bg border-white/10 text-text-3'
                  }`}
                >
                  <span className="ms text-xl">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Arrival time — only for airport / station */}
          {needsArrival && (
            <label className="block mb-4">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Arrival time
              </span>
              <input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
                style={{ colorScheme: 'dark' }}
              />
            </label>
          )}

          {/* Days */}
          <div className="mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Trip length
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDays(d => Math.max(1, d - 1))}
                className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
              >−</button>
              <span className="text-text-1 font-semibold text-sm flex-1 text-center">
                {days} {days === 1 ? 'day' : 'days'}
              </span>
              <button
                onClick={() => setDays(d => Math.min(14, d + 1))}
                className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
              >+</button>
            </div>
          </div>

          {/* Day number */}
          {days > 1 && (
            <div className="mb-4">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Planning for day
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDayNumber(d => Math.max(1, d - 1))}
                  className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                >−</button>
                <span className="text-text-1 font-semibold text-sm flex-1 text-center">
                  Day {Math.min(dayNumber, days)} of {days}
                </span>
                <button
                  onClick={() => setDayNumber(d => Math.min(days, d + 1))}
                  className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <div className="px-5 pt-3 flex-shrink-0">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-14 rounded-2xl bg-orange font-heading font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span className="ms fill text-base">auto_fix</span>
            Generate Itinerary
          </button>
        </div>
      </div>
    </>
  );
}
