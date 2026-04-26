import { useState } from 'react';
import { api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { UpdateCard } from './UpdateCard';
import type { SavedItinerary, TripUpdateCard } from '../../shared/types';

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Returns true if the last check was within the cooldown window. */
export function isOnCooldown(lastCheckIso: string | null): boolean {
  if (!lastCheckIso) return false;
  return Date.now() - new Date(lastCheckIso).getTime() < COOLDOWN_MS;
}

/** Human-readable label for how long ago the check was. */
export function timeSinceLabel(lastCheckIso: string | null): string {
  if (!lastCheckIso) return '';
  const diffMs  = Date.now() - new Date(lastCheckIso).getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffHrs >= 1) return `Checked ${diffHrs}h ago`;
  return `Checked ${diffMin}m ago`;
}

interface Props {
  trip: SavedItinerary;
}

export function SmartUpdates({ trip }: Props) {
  const { dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [updateCards, setUpdateCards] = useState<TripUpdateCard[]>([]);
  const [checked, setChecked] = useState(false);

  const onCooldown = isOnCooldown(trip.lastUpdateCheck);

  async function handleCheck() {
    if (onCooldown || loading) return;
    setLoading(true);
    const now = new Date().toISOString();

    try {
      const cards: TripUpdateCard[] = [];

      // 1. Events
      if (trip.travelDate && trip.cityLat !== null && trip.cityLon !== null) {
        const events = await api.events(
          trip.city,
          trip.travelDate,
          trip.travelDate,
          trip.cityLat,
          trip.cityLon,
        ).catch(() => [] as import('../../shared/types').Place[]);

        events.slice(0, 3).forEach(ev => {
          cards.push({
            id: `event-${ev.id}`,
            kind: 'event',
            tripId: trip.id,
            title: ev.title,
            detail: (ev as any).event_date ? `${(ev as any).event_date}` : '',
            severity: 'info',
            actionLabel: 'View',
          });
        });
      }

      // 2. Hours changes — check each saved place that has weekday_text stored
      trip.selectedPlaces.forEach(place => {
        const snapshot = (place as any).weekday_text_snapshot as string[] | undefined;
        const current  = (place as any).weekday_text as string[] | undefined;
        if (snapshot && current && JSON.stringify(snapshot) !== JSON.stringify(current)) {
          cards.push({
            id: `hours-${place.id}`,
            kind: 'hours_change',
            tripId: trip.id,
            title: `Hours changed · ${place.title}`,
            detail: 'Opening times have been updated since you saved this trip.',
            affectedStop: place.title,
            severity: 'warning',
          });
        }
      });

      // 3. Weather — TODO: add when forecast-by-date endpoint is available

      setUpdateCards(cards);
      setChecked(true);
      dispatch({
        type: 'UPDATE_SAVED_ITINERARY',
        id: trip.id,
        patch: { lastUpdateCheck: now },
      });
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss(cardId: string) {
    setUpdateCards(prev => prev.filter(c => c.id !== cardId));
  }

  function handleAction(card: TripUpdateCard) {
    // View action — stub until deep-link to event is available
  }

  return (
    <div className="mt-3">
      {/* CTA chip */}
      <button
        onClick={handleCheck}
        disabled={onCooldown || loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-opacity"
        style={{
          opacity: onCooldown ? 0.5 : 1,
          cursor: onCooldown ? 'default' : 'pointer',
          background: 'rgba(99,102,241,.08)',
          borderColor: 'rgba(99,102,241,.25)',
          color: '#818cf8',
        }}
      >
        <span className={`ms fill text-xs ${loading ? 'animate-spin' : ''}`}>autorenew</span>
        {loading
          ? 'Checking…'
          : onCooldown
            ? timeSinceLabel(trip.lastUpdateCheck)
            : 'Check for updates'}
      </button>

      {/* Update cards strip */}
      {updateCards.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 mt-3" style={{ scrollbarWidth: 'none' }}>
          {updateCards.map(card => (
            <UpdateCard
              key={card.id}
              card={card}
              onAction={handleAction}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {/* No updates state */}
      {checked && updateCards.length === 0 && !loading && (
        <p className="text-white/25 text-[10px] mt-2">Everything looks good · Checked just now</p>
      )}
    </div>
  );
}
