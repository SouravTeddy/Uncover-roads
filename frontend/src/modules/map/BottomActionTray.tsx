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
  surpriseDisabled: boolean
  surpriseLoading: boolean
  onSurprise: () => void
}

const MIN_PLACES = 2

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BottomActionTray({
  startDate, endDate, cities, onDateTap,
  itineraryPlaces, days, buildLoading, onBuild,
  surpriseDisabled, surpriseLoading, onSurprise,
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
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
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

        {/* Bottom row: date pill + Surprise Me */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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

          {/* Surprise Me — right side */}
          <button
            disabled={surpriseLoading || surpriseDisabled}
            onClick={surpriseLoading || surpriseDisabled ? undefined : onSurprise}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 999,
              backgroundColor: 'rgba(10,14,23,0.88)', border: '1px solid #8b5cf6',
              color: surpriseLoading ? 'var(--color-text-2)' : '#c4b5fd',
              fontSize: '0.78rem', fontWeight: 700,
              cursor: surpriseLoading || surpriseDisabled ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(12px)', transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ fontSize: 13 }}>✦</span>
            {surpriseLoading ? 'Building…' : 'Surprise Me'}
          </button>
        </div>
      </div>
    </div>
  )
}
