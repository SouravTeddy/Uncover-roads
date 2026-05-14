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
  const archetypeColors = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' };
  const archetypeEmoji  = ARCHETYPE_EMOJI[archetypeKey]  ?? '◆';
  const archetypeName   = ARCHETYPE_SHORT[archetypeKey]  ?? (item.persona?.archetype_name ?? archetypeKey);

  const days    = getDaysUntilTravel(item.travelDate);
  const isToday = days === 0;
  const isPast  = days !== null && days < 0;
  const hasUnresolved = (item.pendingSwapCards ?? []).some(c => !c.resolved);

  const stops = (item.itinerary as any)?.days?.flatMap((d: any) => d.stops) ?? item.itinerary?.itinerary ?? [];
  const cityName  = item.city;
  const country   = (item as any).country ?? '';
  const date      = item.travelDate ? formatDate(item.travelDate) : formatDate(item.date);

  // Pick the first stop with a photo for the card background
  const heroPhoto = stops.find((s: any) => s.imageUrl)?.imageUrl ?? null;

  function handlePlay() {
    dispatch({ type: 'SET_REEL_SAVED_ID', id: item.id });
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
  }

  function handleArrivalCheck() {
    setExpanded(true);
    setAutoRunRecalibration(true);
  }

  const cardStyle = {
    position: 'relative' as const,
    height: 145,
    borderRadius: 22,
    overflow: 'hidden' as const,
    marginBottom: 4,
    cursor: 'pointer' as const,
    animation: `cardEntry 0.4s ease ${index * 0.09}s both`,
    background: heroPhoto
      ? `url('${heroPhoto}') center/cover no-repeat`
      : `linear-gradient(135deg, ${archetypeColors.glow}, rgba(20,16,12,1))`,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Main card */}
      <div style={cardStyle} onClick={() => setExpanded(e => !e)}>
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(20,16,12,.22) 0%, rgba(20,16,12,.80) 100%)',
        }} />

        {/* Top-left: city + caption */}
        <div style={{ position: 'absolute', top: 14, left: 16 }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700,
            color: '#fff', lineHeight: 1.1, marginBottom: 3,
          }}>
            {cityName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 500 }}>
            {[country, date, `${stops.length} stops${isPast ? ' · Completed' : ''}`].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Top-right: archetype badge */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 9px', borderRadius: 999,
          fontSize: 10, fontWeight: 700,
          background: archetypeColors.glow,
          border: `1px solid ${archetypeColors.primary}66`,
          color: archetypeColors.primary,
          backdropFilter: 'blur(6px)',
        }}>
          {archetypeEmoji} {archetypeName}
        </div>

        {/* Bottom-left: continue pill */}
        <div style={{
          position: 'absolute', bottom: 14, left: 16,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(255,255,255,.12)',
          backdropFilter: 'blur(8px)',
          fontSize: 11, fontWeight: 600, color: 'var(--color-text-1)',
          border: '1px solid rgba(255,255,255,.15)',
          cursor: 'pointer',
        }} onClick={e => { e.stopPropagation(); handlePlay(); }}>
          <span className="ms fill" style={{ fontSize: 14 }}>play_arrow</span>
          Continue trip
        </div>
      </div>

      {/* Expandable drawer */}
      {expanded && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '12px 16px 16px',
          animation: 'springUp 0.3s ease both',
        }}>
          <TripCountdown travelDate={item.travelDate} />
          {isToday && !hasUnresolved && (
            <ArrivalBanner tripId={item.id} travelDate={item.travelDate} city={item.city} onCheckNow={handleArrivalCheck} />
          )}
          {!isToday && !isPast && item.travelDate && <SmartUpdates trip={item} />}
          {isToday && <RecalibrationStack trip={item} autoRun={autoRunRecalibration} />}

          {/* Stop list */}
          <div style={{ marginTop: 10 }}>
            {stops.map((stop: any, i: number) => {
              const moved = stop.movedFrom !== null && stop.movedFrom !== undefined;
              return (
                <div key={stop.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                  borderBottom: i < stops.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-primary-bg)',
                    border: '1px solid rgba(212,168,83,.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                      {stop.title ?? stop.place}
                      {moved && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', border: '1px solid rgba(212,168,83,.18)', padding: '1px 5px', borderRadius: 999 }}>↑ moved</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{stop.time ?? ''}</div>
                </div>
              );
            })}
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
        className="flex-shrink-0 px-5 border-b border-[var(--color-divider)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}
      >
        <h1 className="font-[family-name:var(--font-heading)] text-[16px] font-bold text-[var(--color-text-1)]">My Journeys</h1>
        <p className="text-[var(--color-text-3)] text-sm mt-0.5">{sorted.length} trip{sorted.length !== 1 ? 's' : ''} saved</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {sorted.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <span className="ms text-[var(--color-text-4)] text-3xl">route</span>
            </div>
            <div className="text-center">
              <p className="text-[var(--color-text-2)] font-semibold text-sm">No trips saved yet</p>
              <p className="text-[var(--color-text-4)] text-xs mt-1">Explore a city and build your itinerary.<br />Your trips are saved automatically.</p>
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
