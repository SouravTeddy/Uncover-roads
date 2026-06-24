import type { Place } from '../../shared/types'

interface Props {
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  fromReel?: boolean
  onBuild: () => void
  onBackToReel?: () => void
}

const MIN_PLACES = 2

export function BottomActionTray({ itineraryPlaces, days, buildLoading, fromReel, onBuild, onBackToReel }: Props) {
  const count = itineraryPlaces.length
  const canBuild = count >= MIN_PLACES
  const hasItinerary = count > 0
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const buildLabel = buildLoading
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', pointerEvents: 'auto' }}>
        {fromReel && onBackToReel && (
          <button
            onClick={onBackToReel}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              border: '1px solid rgba(212,168,83,.35)', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.01em',
              background: 'rgba(212,168,83,.1)',
              color: 'var(--color-primary)',
              boxShadow: 'none',
              backdropFilter: 'blur(16px)',
              transition: 'all 0.15s ease',
            }}
          >
            ← Back to your plan
          </button>
        )}
        {hasItinerary && !fromReel && (
          <>
            <button
              disabled={!canBuild || buildLoading}
              onClick={canBuild && !buildLoading ? onBuild : undefined}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: 'none', cursor: canBuild ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.01em',
                background: canBuild
                  ? 'linear-gradient(135deg, #d4a853, #b8893a)'
                  : 'var(--color-border)',
                color: canBuild ? '#0c0c0e' : 'var(--color-text-3)',
                opacity: canBuild ? 1 : 0.7,
                boxShadow: canBuild ? '0 6px 28px rgba(212,168,83,.25)' : 'none',
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
            >
              {buildLabel} →
            </button>
            {!canBuild && (
              <p style={{ textAlign: 'center', margin: '0 0 2px', fontSize: '0.68rem', color: 'var(--color-text-3)' }}>
                Add one more place to build
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
