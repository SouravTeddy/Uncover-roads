import { useState } from 'react';
import { getDaysUntilTravel } from './TripCountdown';

const DISMISSED_KEY = 'ur_arrival_dismissed'; // value: JSON Record<tripId, ISO datetime>

function getDismissedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}');
  } catch { return {}; }
}

function setDismissed(tripId: string) {
  const map = getDismissedMap();
  map[tripId] = new Date().toISOString();
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function isDismissedToday(tripId: string): boolean {
  const map = getDismissedMap();
  const iso = map[tripId];
  if (!iso) return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso.startsWith(today);
}

interface Props {
  tripId: string;
  travelDate: string | null;
  city: string;
  onCheckNow: () => void;
}

export function ArrivalBanner({ tripId, travelDate, city, onCheckNow }: Props) {
  const [dismissed, setDismissedState] = useState(() => isDismissedToday(tripId));

  const days = getDaysUntilTravel(travelDate);
  if (days !== 0 || dismissed) return null;

  function handleNotYet() {
    setDismissed(tripId);
    setDismissedState(true);
  }

  function handleYes() {
    setDismissed(tripId);
    setDismissedState(true);
    onCheckNow();
  }

  return (
    <div
      className="rounded-2xl p-4 border mt-3"
      style={{
        background: 'rgba(34,197,94,.06)',
        borderColor: 'rgba(34,197,94,.2)',
      }}
    >
      <div className="flex items-start gap-2 mb-3">
        <span className="text-lg leading-none flex-shrink-0">✈️</span>
        <div>
          <p className="text-white/80 text-sm font-semibold leading-snug">
            You're heading to {city} today
          </p>
          <p className="text-white/40 text-xs mt-0.5">Want a last-minute itinerary check?</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleYes}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: 'rgba(34,197,94,.25)', border: '1px solid rgba(34,197,94,.3)' }}
        >
          Yes, check now
        </button>
        <button
          onClick={handleNotYet}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)' }}
        >
          Not yet
        </button>
      </div>
    </div>
  );
}
