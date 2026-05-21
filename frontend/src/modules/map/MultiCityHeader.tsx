import type { CityFootprint } from '../../shared/types'

interface Props {
  cityFootprints: CityFootprint[]
  activeCityIdx: number
  travelStartDate: string | null
  travelEndDate: string | null
  onCityTap: (idx: number) => void
  onDateTap: () => void
}

export function MultiCityHeader({ cityFootprints, activeCityIdx, travelStartDate, travelEndDate, onCityTap, onDateTap }: Props) {
  const startFmt = travelStartDate
    ? new Date(travelStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const endFmt = travelEndDate
    ? new Date(travelEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const totalDays = (travelStartDate && travelEndDate)
    ? Math.round((new Date(travelEndDate + 'T00:00:00').getTime() - new Date(travelStartDate + 'T00:00:00').getTime()) / 86400000) + 1
    : null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,20,30,.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* City tab strip */}
      <div
        className="flex items-center gap-2 px-3 pt-3 pb-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {cityFootprints.map((f, idx) => {
          const isActive = idx === activeCityIdx
          return (
            <button
              key={f.city}
              onClick={() => onCityTap(idx)}
              className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isActive ? 'var(--color-primary)' : 'var(--color-surface2)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: isActive ? '#fff' : 'var(--color-text-2)',
              }}
            >
              <span style={{ fontSize: 14 }}>{f.emoji}</span>
              <span>{f.city}</span>
              <span style={{ opacity: 0.65, fontWeight: 400 }}>· {f.pinCount}</span>
            </button>
          )
        })}
      </div>

      {/* Date line */}
      {startFmt && endFmt && totalDays && (
        <button
          onClick={onDateTap}
          style={{
            display: 'block',
            background: 'none',
            border: 'none',
            padding: '0 12px 10px 13px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-text-3)',
            textAlign: 'left',
            width: '100%',
          }}
        >
          {startFmt} – {endFmt} · {totalDays} day{totalDays === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}
