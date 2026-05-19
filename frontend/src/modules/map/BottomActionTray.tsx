import type { Place } from '../../shared/types'

interface Props {
  startDate: string | null
  endDate: string | null
  cities: string[]
  onDateTap: () => void
  itineraryPlaces: Place[]
  buildLoading: boolean
  onBuild: () => void
  hasBlockers: boolean
  onBlockerTap: () => void
}

const MIN_PLACES = 2

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BottomActionTray({
  startDate, endDate, cities, onDateTap,
  itineraryPlaces, buildLoading, onBuild,
  hasBlockers, onBlockerTap,
}: Props) {
  const count = itineraryPlaces.length
  const canBuild = count >= MIN_PLACES
  const hasItinerary = count > 0
  const hasDates = !!(startDate && endDate)

  const travelParts: string[] = hasDates
    ? [
        `${formatDate(startDate!)} – ${formatDate(endDate!)}`,
        ...(cities.length > 1 ? [`${cities.length} cities`] : []),
      ]
    : []

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        padding: '10px 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', pointerEvents: 'auto' }}>

        {/* Dot-stack bar — shown when ≥ 1 place is selected */}
        {hasItinerary && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(15,20,30,.92)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 16,
              padding: '10px 14px',
            }}
          >
            {/* Dot stack — up to 5 dots, decreasing opacity */}
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: (hasBlockers && i === Math.min(count, 5) - 1) ? '#f59e0b' : '#d4a853',
                    opacity: 1 - i * 0.15,
                    marginLeft: i === 0 ? 0 : -5,
                    border: '2.5px solid var(--color-surface)',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Count label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1 }}>
                {count}
              </p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-3)', lineHeight: 1.2 }}>
                {count === 1 ? 'place added' : 'places added'}
              </p>
            </div>

            {/* CTA button with optional blocker badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                disabled={!canBuild || buildLoading}
                onClick={canBuild && !buildLoading ? (hasBlockers ? onBlockerTap : onBuild) : undefined}
                style={{
                  padding: '9px 16px', borderRadius: 12,
                  border: 'none', cursor: canBuild ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem', fontWeight: 700,
                  background: canBuild
                    ? 'linear-gradient(135deg, #d4a853, #b8893a)'
                    : 'var(--color-border)',
                  color: canBuild ? '#0c0c0e' : 'var(--color-text-3)',
                  opacity: canBuild ? 1 : 0.7,
                  boxShadow: canBuild ? '0 4px 20px rgba(212,168,83,.25)' : 'none',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {buildLoading ? 'Building…' : 'Build itinerary →'}
              </button>

              {/* Amber blocker badge */}
              {hasBlockers && canBuild && (
                <button
                  onClick={onBlockerTap}
                  aria-label="View conflicts"
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#f59e0b', border: '2px solid var(--color-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                    fontSize: '0.7rem', fontWeight: 900, color: '#0c0c0e',
                  }}
                >
                  !
                </button>
              )}
            </div>
          </div>
        )}

        {/* "Add one more" hint */}
        {hasItinerary && !canBuild && (
          <p style={{ textAlign: 'center', margin: '0 0 2px', fontSize: '0.68rem', color: 'var(--color-text-3)' }}>
            Add one more place to build
          </p>
        )}

        {/* Date pill — left side, only when dates are set */}
        {hasDates ? (
          <button
            onClick={onDateTap}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 999,
              background: 'rgba(15,20,30,0.88)', border: '1px solid var(--color-border-m)',
              backdropFilter: 'blur(12px)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <span className="ms text-primary" style={{ fontSize: 14 }}>calendar_today</span>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-1)', letterSpacing: '0.01em' }}>
              {travelParts.join(' · ')}
            </span>
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
