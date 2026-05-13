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
  const { dispatch } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [autoRunRecalibration, setAutoRunRecalibration] = useState(false);

  const archetypeKey    = item.persona?.archetype ?? '';
  const archetypeColors = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#e07854', glow: 'rgba(224,120,84,.22)' };
  const archetypeEmoji  = ARCHETYPE_EMOJI[archetypeKey]  ?? '◆';
  const archetypeName   = ARCHETYPE_SHORT[archetypeKey]  ?? (item.persona?.archetype_name ?? archetypeKey);

  const days          = getDaysUntilTravel(item.travelDate);
  const isToday       = days === 0;
  const isPast        = days !== null && days < 0;
  const hasUnresolved = (item.pendingSwapCards ?? []).some(c => !c.resolved);
  const forceExpanded = isToday && hasUnresolved;

  // Support both old flat itinerary and new engine itinerary (day-based)
  const stops = (item.itinerary as any)?.days?.flatMap((d: any) => d.stops) ?? item.itinerary?.itinerary ?? [];
  const cityName = item.city;
  const date = item.travelDate ? formatDate(item.travelDate) : formatDate(item.date);

  // Up to 3 card images for the fan
  const fanImages: (string | null)[] = stops
    .filter((s: any) => s.imageUrl ?? s.photo_ref)
    .slice(0, 3)
    .map((s: any) => s.imageUrl ?? null);
  while (fanImages.length < 3) fanImages.unshift(null);

  const FAN_ROTATIONS = [-6, -3, 0];
  const FAN_TRANSLATE = [8, 4, 0];

  function handlePlay() {
    dispatch({ type: 'SET_REEL_SAVED_ID', id: item.id });
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
  }

  function handleArrivalCheck() {
    setExpanded(true);
    setAutoRunRecalibration(true);
  }

  return (
    <div style={{ marginBottom: 32, animation: `cardEntry 0.4s ease ${index * 0.09}s both` }}>

      {/* Card fan */}
      <div style={{ position: 'relative', height: 240, marginBottom: 16 }}>
        {fanImages.map((img, i) => (
          <div
            key={i}
            onClick={i === 2 ? handlePlay : undefined}
            style={{
              position: 'absolute',
              width: 220, height: 280,
              top: 0, left: '50%', marginLeft: -110,
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,.7)',
              transform: `rotate(${FAN_ROTATIONS[i]}deg) translateY(${FAN_TRANSLATE[i]}px)`,
              zIndex: i + 1,
              cursor: i === 2 ? 'pointer' : 'default',
              transition: 'transform .4s cubic-bezier(.16,1,.3,1)',
            }}
          >
            {img
              ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${archetypeColors.glow}, rgba(255,255,255,.02))` }} />
            }
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.85))' }} />
            {i === 2 && (
              <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                  Stop 1
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {(stops[0] as any)?.title ?? (stops[0] as any)?.place ?? cityName}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Trip meta */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)' }}>{cityName}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{date} · {stops.length} stops{isPast ? ' · Completed' : ''}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: archetypeColors.glow,
            border: `1px solid ${archetypeColors.primary}40`,
            color: archetypeColors.primary,
          }}>
            {archetypeEmoji} {archetypeName}
          </span>
        </div>
      </div>

      {/* Countdown strip */}
      <div style={{ marginBottom: 12 }}>
        <TripCountdown travelDate={item.travelDate} />
      </div>

      {/* Play button */}
      <button
        onClick={handlePlay}
        style={{
          width: '100%', height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #e07854, #c4613d)',
          color: '#ffffff', fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 28px rgba(224,120,84,.25)',
          marginBottom: 12,
        }}
      >
        <span className="ms fill" style={{ fontSize: 20 }}>play_arrow</span>
        Play Itinerary
      </button>

      {/* Stop list — expandable */}
      <button
        onClick={() => { if (!forceExpanded) setExpanded(e => !e); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-3)' }}>
          {stops.length} stops in order
        </span>
        <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-3)', transform: (forceExpanded || expanded) ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}>
          expand_more
        </span>
      </button>

      {(forceExpanded || expanded) && (
        <div style={{ marginTop: 8 }}>
          {/* Arrival banner */}
          {isToday && !hasUnresolved && (
            <ArrivalBanner tripId={item.id} travelDate={item.travelDate} city={item.city} onCheckNow={handleArrivalCheck} />
          )}
          {/* Smart updates */}
          {!isToday && !isPast && item.travelDate && <SmartUpdates trip={item} />}
          {/* Recalibration */}
          {isToday && <RecalibrationStack trip={item} autoRun={autoRunRecalibration} />}

          {/* Stop list with why+consequence */}
          {stops.map((stop: any, i: number) => {
            const reason = stop.orderReason ?? stop.whyForYou ?? null;
            const consequence = stop.orderConsequence ?? null;
            const moved = stop.movedFrom !== null && stop.movedFrom !== undefined;
            return (
              <div key={stop.id ?? i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: i < stops.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-bg)',
                  border: '1px solid rgba(224,120,84,.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {stop.title ?? stop.place}
                    {moved && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', border: '1px solid rgba(212,168,83,.18)', padding: '1px 5px', borderRadius: 999 }}>↑ moved</span>}
                  </div>
                  {reason && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>
                      {reason}{consequence ? ` · ${consequence}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>{stop.time ?? ''}</div>
                </div>
              </div>
            );
          })}
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
