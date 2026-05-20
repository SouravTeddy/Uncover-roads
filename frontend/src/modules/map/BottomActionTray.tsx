import type { Place } from '../../shared/types'

interface Props {
  startDate: string | null
  endDate: string | null
  cities: string[]
  onDateTap: () => void
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  onBuild: () => void
}

const MIN_PLACES = 2

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BottomActionTray({
  startDate, endDate, cities, onDateTap,
  itineraryPlaces, days, buildLoading, onBuild,
}: Props) {
  const count = itineraryPlaces.length
  const canBuild = count >= MIN_PLACES
  const hasItinerary = count > 0
  const hasDates = !!(startDate && endDate)

  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const buildLabel = buildLoading
    ? 'Building…'
    : `Build itinerary · ${count} place${count === 1 ? '' : 's'}${dayPart}`

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
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', pointerEvents: 'auto' }}>

        {/* Build itinerary button — only when places are selected */}
        {hasItinerary && (
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

        {/* Date pill */}
        {hasDates && (
          <button
            onClick={onDateTap}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 999,
              background: 'rgba(15,20,30,0.88)', border: '1px solid var(--color-border-m)',
              backdropFilter: 'blur(12px)', cursor: 'pointer', whiteSpace: 'nowrap',
              alignSelf: 'flex-start',
            }}
          >
            <span className="ms text-primary" style={{ fontSize: 14 }}>calendar_today</span>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-1)', letterSpacing: '0.01em' }}>
              {travelParts.join(' · ')}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
