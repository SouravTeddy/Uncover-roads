import { createPortal } from 'react-dom'
import type { Place } from '../../shared/types'

interface Props {
  itineraryPlaces: Place[]
  days: number
  onBuild: () => void
  loading?: boolean
}

/**
 * Sticky bottom bar shown when user has ≥1 place in their itinerary.
 * days=0 means dates not selected — still shows pin count.
 */
export function BuildItineraryBar({ itineraryPlaces, days, onBuild, loading = false }: Props) {
  if (itineraryPlaces.length === 0) return null

  const pinWord = itineraryPlaces.length === 1 ? 'place' : 'places'
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const label = loading
    ? 'Building itinerary…'
    : `Build itinerary · ${itineraryPlaces.length} ${pinWord}${dayPart}`

  const bg = loading
    ? 'linear-gradient(135deg, #6b9470, #3d6642)'
    : 'linear-gradient(135deg, #e07854, #c4613d)'

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
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 14,
          background: bg,
          border: 'none',
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '0.01em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: loading ? 0.85 : 1,
        }}
        onClick={onBuild}
      >
        {loading && (
          <span className="ms animate-spin" style={{ fontSize: 18 }}>autorenew</span>
        )}
        {label} {!loading && '→'}
      </button>
    </div>
  )

  return createPortal(bar, document.body)
}
