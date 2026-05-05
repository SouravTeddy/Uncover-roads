import { createPortal } from 'react-dom'
import type { Place } from '../../shared/types'

interface Props {
  itineraryPlaces: Place[]
  days: number
  onBuild: () => void
}

const ACCENT = '#3b82f6'

/**
 * Sticky bottom bar shown when user has ≥1 place in their itinerary.
 * days=0 means dates not selected — still shows pin count.
 */
export function BuildItineraryBar({ itineraryPlaces, days, onBuild }: Props) {
  if (itineraryPlaces.length === 0) return null

  const pinWord = itineraryPlaces.length === 1 ? 'place' : 'places'
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const label = `Build itinerary · ${itineraryPlaces.length} ${pinWord}${dayPart}`

  const bar = (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        padding: '12px 16px',
        background: 'rgba(10,14,23,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <button
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 14,
          backgroundColor: ACCENT,
          border: 'none',
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.01em',
        }}
        onClick={onBuild}
      >
        {label} →
      </button>
    </div>
  )

  return createPortal(bar, document.body)
}
