import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary } from '../../shared/types';
import { TripCountdown, getDaysUntilTravel } from './TripCountdown';
import { SmartUpdates } from './SmartUpdates';
import { ArrivalBanner } from './ArrivalBanner';
import { RecalibrationStack } from './RecalibrationStack';

const ARCHETYPE_COLORS: Record<string, { primary: string; bg: string }> = {
  historian:     { primary: '#fbbf24', bg: 'rgba(251,191,36,.12)'  },
  epicurean:     { primary: '#f87171', bg: 'rgba(248,113,113,.12)' },
  wanderer:      { primary: '#34d399', bg: 'rgba(52,211,153,.12)'  },
  voyager:       { primary: '#60a5fa', bg: 'rgba(96,165,250,.12)'  },
  explorer:      { primary: '#86efac', bg: 'rgba(134,239,172,.12)' },
  slowtraveller: { primary: '#c4b5fd', bg: 'rgba(196,181,253,.12)' },
  pulse:         { primary: '#f9a8d4', bg: 'rgba(249,168,212,.12)' },
};

const ARCHETYPE_ICONS: Record<string, string> = {
  historian:     'account_balance',
  epicurean:     'restaurant',
  wanderer:      'explore',
  voyager:       'flight',
  explorer:      'terrain',
  slowtraveller: 'spa',
  pulse:         'nightlife',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByMonth(items: SavedItinerary[]): { label: string; items: SavedItinerary[] }[] {
  const map = new Map<string, SavedItinerary[]>();
  for (const item of items) {
    const key = new Date(item.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

function TripCard({ item }: { item: SavedItinerary }) {
  const [expanded, setExpanded] = useState(false);
  const [autoRunRecalibration, setAutoRunRecalibration] = useState(false);

  const archetype = item.persona?.archetype ?? '';
  const colors    = ARCHETYPE_COLORS[archetype] ?? { primary: '#60a5fa', bg: 'rgba(96,165,250,.12)' };
  const icon      = ARCHETYPE_ICONS[archetype]  ?? 'explore';
  const stops     = item.itinerary?.itinerary ?? [];
  const preview   = stops.slice(0, 3);
  const remaining = stops.length - preview.length;

  const days           = getDaysUntilTravel(item.travelDate);
  const isToday        = days === 0;
  const isPast         = days !== null && days < 0;
  const hasUnresolved  = (item.pendingSwapCards ?? []).some(c => !c.resolved);

  // When card is today and has pending swap cards, force expanded and lock it
  const forceExpanded  = isToday && hasUnresolved;
  const effectiveOpen  = forceExpanded || expanded;

  function handleToggle() {
    if (forceExpanded) return; // locked
    setExpanded(e => !e);
  }

  function handleArrivalCheck() {
    setExpanded(true);
    setAutoRunRecalibration(true);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/8"
      style={{ background: 'rgba(255,255,255,.03)' }}
    >
      {/* Card header */}
      <button className="w-full text-left px-4 pt-4 pb-3" onClick={handleToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-white text-lg leading-tight truncate">
              {item.city}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-white/40 text-xs">{formatDate(item.date)}</span>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/40 text-xs">{stops.length} stops</span>
              {isPast && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase"
                  style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)' }}
                >Completed</span>
              )}
            </div>
            {/* Countdown */}
            <TripCountdown travelDate={item.travelDate} />
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: colors.bg, border: `1px solid ${colors.primary}30` }}
          >
            <span className="ms fill" style={{ fontSize: 13, color: colors.primary }}>{icon}</span>
            <span className="font-semibold capitalize" style={{ fontSize: 10, color: colors.primary }}>
              {item.persona?.archetype_name ?? archetype}
            </span>
          </div>
        </div>

        {/* Stop previews */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {preview.map((stop, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.primary }} />
              <span className="text-white/60 text-[10px] truncate max-w-[100px]">{stop.place}</span>
            </div>
          ))}
          {remaining > 0 && <span className="text-white/30 text-[10px] px-1">+{remaining} more</span>}
        </div>

        {/* Expand toggle — hidden when locked */}
        {!forceExpanded && (
          <div className="flex items-center justify-end mt-2">
            <span className={`ms text-white/30 text-base transition-transform ${effectiveOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </div>
        )}
        {forceExpanded && (
          <p className="text-amber-400/60 text-[10px] text-right mt-2">
            Review suggestions to close ↓
          </p>
        )}
      </button>

      {effectiveOpen && (
        <div className="border-t border-white/6 px-4 py-3">

          {/* Arrival banner — only on travel day, only before recalibration */}
          {isToday && !hasUnresolved && (
            <ArrivalBanner
              tripId={item.id}
              travelDate={item.travelDate}
              city={item.city}
              onCheckNow={handleArrivalCheck}
            />
          )}

          {/* Smart updates chip + cards — only for future trips */}
          {!isToday && !isPast && item.travelDate && (
            <SmartUpdates trip={item} />
          )}

          {/* Recalibration stack — pending swap cards (day-of) */}
          {isToday && (
            <RecalibrationStack trip={item} autoRun={autoRunRecalibration} />
          )}

          {/* Full stop list */}
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-3 mt-4">
            Full Itinerary
          </p>
          <div className="flex flex-col gap-0">
            {stops.map((stop, i) => (
              <div key={i} className="flex gap-3 py-2">
                <div className="flex flex-col items-center" style={{ width: 20 }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: i === 0 ? colors.primary : 'rgba(255,255,255,.2)' }} />
                  {i < stops.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,.08)', minHeight: 16 }} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-white/80 text-sm font-semibold leading-snug">{stop.place}</p>
                  {stop.duration && <p className="text-white/30 text-[10px] mt-0.5">{stop.duration}</p>}
                  {stop.time && <p className="text-white/25 text-[10px]">{stop.time}</p>}
                </div>
              </div>
            ))}
          </div>

          {item.itinerary?.summary?.pro_tip && (
            <div
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.1)' }}
            >
              <span className="ms fill text-amber-400 flex-shrink-0" style={{ fontSize: 12 }}>lightbulb</span>
              <p className="text-amber-200/60 text-[10px] leading-relaxed">{item.itinerary.summary.pro_tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TripsScreen() {
  const { state, dispatch } = useAppStore();
  const { savedItineraries } = state;

  const sorted  = [...savedItineraries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const grouped = groupByMonth(sorted);

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {/* Header */}
      <div
        className="flex-shrink-0 px-5 border-b border-white/6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}
      >
        <h1 className="font-heading font-bold text-white text-xl">My Journeys</h1>
        <p className="text-white/40 text-sm mt-0.5">{sorted.length} trip{sorted.length !== 1 ? 's' : ''} saved</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {sorted.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <span className="ms text-white/20 text-3xl">route</span>
            </div>
            <div className="text-center">
              <p className="text-white/50 font-semibold text-sm">No trips saved yet</p>
              <p className="text-white/25 text-xs mt-1">Explore a city, build your itinerary,<br />and tap Save to record your journey.</p>
            </div>
            <button
              onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm"
            >
              Start exploring
            </button>
          </div>
        ) : (
          /* Grouped trip list */
          <div className="pt-4">
            {grouped.map(group => (
              <div key={group.label} className="mb-6">
                {/* Month label */}
                <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3 px-1">
                  {group.label}
                </p>
                <div className="flex flex-col gap-3">
                  {group.items.map(item => (
                    <TripCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
