import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary } from '../../shared/types';
import { TripCountdown, getDaysUntilTravel } from './TripCountdown';
import { SmartUpdates } from './SmartUpdates';
import { ArrivalBanner } from './ArrivalBanner';
import { RecalibrationStack } from './RecalibrationStack';
import { ARCHETYPE_COLORS, ARCHETYPE_EMOJI, ARCHETYPE_SHORT } from '../persona/types';

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

function TripCard({ item, index }: { item: SavedItinerary; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [autoRunRecalibration, setAutoRunRecalibration] = useState(false);

  const archetypeKey  = item.persona?.archetype ?? '';
  const archetypeColors = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#60a5fa', glow: 'rgba(96,165,250,.22)' };
  const archetypeEmoji  = ARCHETYPE_EMOJI[archetypeKey]  ?? '◆';
  const archetypeName   = ARCHETYPE_SHORT[archetypeKey]  ?? (item.persona?.archetype_name ?? archetypeKey);

  const archetype = {
    primary: archetypeColors.primary,
    glow:    archetypeColors.glow,
    emoji:   archetypeEmoji,
    name:    archetypeName,
  };

  const stops     = item.itinerary?.itinerary ?? [];
  const preview   = stops.slice(0, 3);
  const remaining = stops.length - preview.length;

  const days           = getDaysUntilTravel(item.travelDate);
  const isToday        = days === 0;
  const isPast         = days !== null && days < 0;
  const hasUnresolved  = (item.pendingSwapCards ?? []).some(c => !c.resolved);

  const forceExpanded  = isToday && hasUnresolved;
  const effectiveOpen  = forceExpanded || expanded;

  // Background image from first selectedPlace with imageUrl
  const coverImage = item.selectedPlaces?.find(p => p.imageUrl)?.imageUrl ?? null;

  const cityName = item.city;
  const country  = item.persona?.archetype_name ?? archetypeKey;
  const date     = item.travelDate ? formatDate(item.travelDate) : formatDate(item.date);

  function handleToggle() {
    if (forceExpanded) return;
    setExpanded(e => !e);
  }

  function handleArrivalCheck() {
    setExpanded(true);
    setAutoRunRecalibration(true);
  }

  return (
    <div>
      {/* Image card header */}
      <button
        className="w-full text-left"
        onClick={handleToggle}
      >
        <div
          className="relative h-[145px] rounded-[22px] overflow-hidden"
          style={{ animation: `cardEntry 0.4s ease ${index * 0.09}s both` }}
        >
          {/* Background image */}
          {coverImage ? (
            <img
              src={coverImage}
              alt={cityName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, rgba(20,16,12,.9) 0%, ${archetypeColors.glow} 100%)` }}
            />
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, rgba(20,16,12,.22) 0%, rgba(20,16,12,.8) 100%)' }}
          />

          {/* Top-left: city + meta */}
          <div className="absolute top-3 left-4">
            <div className="font-[family-name:var(--font-heading)] text-white text-[22px] font-bold leading-tight">
              {cityName}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">{date} · {stops.length} stops{isPast ? ' · Completed' : ''}</div>
          </div>

          {/* Top-right: archetype badge */}
          <div
            className="absolute top-3 right-4 flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: archetype.glow, border: `1px solid ${archetype.primary}40` }}
          >
            <span className="text-[12px]">{archetype.emoji}</span>
            <span className="text-[10px] font-bold" style={{ color: archetype.primary }}>{archetype.name}</span>
          </div>

          {/* Bottom-left: Continue pill */}
          <div
            className="absolute bottom-3 left-4 flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}
          >
            <span className="ms text-white text-[16px]">play_arrow</span>
            <span className="text-white text-[12px] font-semibold">Continue trip</span>
          </div>

          {/* Bottom-right: expand chevron */}
          {!forceExpanded && (
            <div className="absolute bottom-3 right-4">
              <span className={`ms text-white/50 text-base transition-transform ${effectiveOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          )}
          {forceExpanded && (
            <p className="absolute bottom-3 right-4 text-amber-400/60 text-[10px]">
              Review ↓
            </p>
          )}
        </div>
      </button>

      {/* Countdown strip */}
      <div className="px-1 mt-1">
        <TripCountdown travelDate={item.travelDate} />
      </div>

      {/* Expandable detail section */}
      {effectiveOpen && (
        <div
          className="rounded-[18px] overflow-hidden mt-1 border border-white/6"
          style={{ background: 'rgba(255,255,255,.03)' }}
        >
          <div className="px-4 py-3">

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
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: i === 0 ? archetypeColors.primary : 'rgba(255,255,255,.2)' }} />
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

            {/* Stop previews */}
            {stops.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {preview.map((stop, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: archetypeColors.primary }} />
                    <span className="text-white/60 text-[10px] truncate max-w-[100px]">{stop.place}</span>
                  </div>
                ))}
                {remaining > 0 && <span className="text-white/30 text-[10px] px-1">+{remaining} more</span>}
              </div>
            )}

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
        <h1 className="font-[family-name:var(--font-heading)] text-[16px] font-bold text-[var(--color-text-1)]">My Journeys</h1>
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
              <p className="text-white/25 text-xs mt-1">Explore a city and build your itinerary.<br />Your trips are saved automatically.</p>
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
                <p className="font-[family-name:var(--font-heading)] text-[16px] font-bold text-[var(--color-text-1)] mb-3 px-1">
                  {group.label}
                </p>
                <div className="flex flex-col gap-4">
                  {group.items.map((item, idx) => (
                    <TripCard key={item.id} item={item} index={idx} />
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
