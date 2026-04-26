import { useState } from 'react';
import { api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { SwapCard } from './SwapCard';
import type { SavedItinerary, SwapCard as SwapCardType } from '../../shared/types';

interface Props {
  trip: SavedItinerary;
}

export function RecalibrationStack({ trip }: Props) {
  const { dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<SwapCardType[]>(trip.pendingSwapCards ?? []);

  const unresolved = cards.filter(c => !c.resolved);
  const allDone    = cards.length > 0 && unresolved.length === 0;

  async function runRecalibration() {
    if (!trip.itinerary?.itinerary || loading) return;
    setLoading(true);
    try {
      const now     = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const result = await api.recalibrate({
        stops:       trip.itinerary.itinerary,
        currentTime: timeStr,
        persona:     trip.persona?.archetype ?? 'explorer',
        pace:        trip.persona?.pace ?? 'balanced',
        city:        trip.city,
        lat:         trip.cityLat ?? 0,
        lon:         trip.cityLon ?? 0,
        travelDate:  trip.travelDate ?? '',
      });

      const newCards: SwapCardType[] = (result.swap_cards ?? []).map(c => ({
        ...c,
        resolved: false,
        choice: null,
      }));

      setCards(newCards);
      dispatch({
        type: 'UPDATE_SAVED_ITINERARY',
        id: trip.id,
        patch: { pendingSwapCards: newCards },
      });
    } catch (err) {
      console.error('Recalibration error', err);
    } finally {
      setLoading(false);
    }
  }

  function handleResolve(cardId: string, choice: 'new' | 'original') {
    const updated = cards.map(c =>
      c.id === cardId ? { ...c, resolved: true, choice } : c
    );
    setCards(updated);
    dispatch({
      type: 'UPDATE_SAVED_ITINERARY',
      id: trip.id,
      patch: { pendingSwapCards: updated },
    });

    // If 'new', update the stop in the itinerary
    if (choice === 'new') {
      const card = cards.find(c => c.id === cardId);
      if (card && trip.itinerary) {
        const stops = [...trip.itinerary.itinerary];
        if (stops[card.stopIdx]) {
          stops[card.stopIdx] = {
            ...stops[card.stopIdx],
            time: card.suggestedSummary,
            tip: card.suggestedNote,
          };
          dispatch({
            type: 'UPDATE_SAVED_ITINERARY',
            id: trip.id,
            patch: {
              itinerary: { ...trip.itinerary, itinerary: stops },
            },
          });
        }
      }
    }
  }

  function handleDone() {
    dispatch({
      type: 'UPDATE_SAVED_ITINERARY',
      id: trip.id,
      patch: { pendingSwapCards: [] },
    });
    setCards([]);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 mt-3 text-white/40 text-xs">
        <span className="ms fill animate-spin text-sm">autorenew</span>
        Checking your itinerary for today…
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="mt-3">
      {unresolved.length > 0 && (
        <p className="text-indigo-400 text-[10px] uppercase tracking-widest font-bold mb-3">
          Last-minute suggestions · {unresolved.length} to review
        </p>
      )}

      {cards.map(card => (
        <SwapCard key={card.id} card={card} onResolve={handleResolve} />
      ))}

      {allDone && (
        <>
          <p className="text-green-400 text-xs text-center mb-3">All suggestions reviewed ✓</p>
          <button
            onClick={handleDone}
            className="w-full py-3 rounded-2xl font-bold text-white text-sm bg-primary"
          >
            Done ✓
          </button>
        </>
      )}

      {!allDone && unresolved.length > 0 && (
        <p className="text-white/25 text-[10px] text-center mt-2">
          Resolve {unresolved.length} suggestion{unresolved.length !== 1 ? 's' : ''} to continue
        </p>
      )}
    </div>
  );
}

// Export runRecalibration for external trigger from ArrivalBanner integration
export type RecalibrationHandle = { run: () => void };
