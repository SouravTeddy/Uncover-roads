import type { Place } from '../../shared/types'

interface Props {
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  isBuildingActive?: boolean
  onBuild: () => void
}

const MIN_PLACES = 2

export function BottomActionTray({ itineraryPlaces, days, buildLoading, isBuildingActive, onBuild }: Props) {
  const count = itineraryPlaces.length
  const canBuild = count >= MIN_PLACES
  const hasItinerary = count > 0
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''

  if (!hasItinerary) return null;

  const isActive = canBuild && !buildLoading && !isBuildingActive

  const label = isBuildingActive
    ? 'Building in progress'
    : buildLoading
    ? 'Building…'
    : `Build itinerary · ${count} place${count === 1 ? '' : 's'}${dayPart}`

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        padding: '10px 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <button
          disabled={!isActive}
          onClick={isActive ? onBuild : undefined}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 14,
            border: 'none', cursor: isActive ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.01em',
            background: isActive
              ? 'linear-gradient(135deg, #d4a853, #b8893a)'
              : 'var(--color-border)',
            color: isActive ? '#0c0c0e' : 'var(--color-text-3)',
            opacity: isActive ? 1 : 0.6,
            boxShadow: isActive ? '0 6px 28px rgba(212,168,83,.25)' : 'none',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.15s ease',
          }}
        >
          {label} →
        </button>
        {!canBuild && (
          <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--color-text-3)' }}>
            Add one more place to build
          </p>
        )}
      </div>
    </div>
  )
}
