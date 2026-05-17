import { createPortal } from 'react-dom';
import type { Place } from '../../shared/types';

interface Props {
  itineraryPlaces: Place[];
  days: number;
  onBuild: () => void;
}

const MIN_PLACES = 2;

export function BuildItineraryBar({ itineraryPlaces, days, onBuild }: Props) {
  if (itineraryPlaces.length === 0) return null;

  const count = itineraryPlaces.length;
  const canBuild = count >= MIN_PLACES;
  const pinWord = count === 1 ? 'place' : 'places';
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : '';
  const label = `Build itinerary · ${count} ${pinWord}${dayPart}`;

  const bar = (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        padding: '12px 16px',
        background: 'rgba(12,12,14,.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <button
        disabled={!canBuild}
        onClick={canBuild ? onBuild : undefined}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: 'none', cursor: canBuild ? 'pointer' : 'not-allowed',
          fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.01em',
          background: canBuild
            ? 'linear-gradient(135deg, #d4a853, #b8893a)'
            : 'var(--color-border)',
          color: canBuild ? '#0c0c0e' : 'var(--color-text-3)',
          opacity: canBuild ? 1 : 0.7,
          boxShadow: canBuild ? '0 6px 28px rgba(212,168,83,.25)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        {label} →
      </button>
      {!canBuild && (
        <p style={{
          textAlign: 'center', marginTop: 6,
          fontSize: '0.68rem', color: 'var(--color-text-3)',
        }}>
          Add one more place to build
        </p>
      )}
    </div>
  );

  return createPortal(bar, document.body);
}
