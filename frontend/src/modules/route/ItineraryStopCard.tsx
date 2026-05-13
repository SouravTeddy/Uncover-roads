import type { EngineItineraryStop } from '../../shared/types'

const PRICE_LABEL: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${mStr}${suffix}`
}

interface Props {
  stop: EngineItineraryStop
  stopNumber: number
  onRemove: (id: string) => void
}

export function ItineraryStopCard({ stop, stopNumber, onRemove }: Props) {
  return (
    <div className="mx-4 mb-3 rounded-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header row */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(224,120,84,.14)', padding: '2px 8px', borderRadius: 999, display: 'inline-block', marginBottom: 4 }}>
            Stop {stopNumber} · {formatTime(stop.time)}
          </span>
          <p className="font-[family-name:var(--font-heading)] mt-0.5 leading-tight" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)' }}>
            {stop.title}
          </p>
          <p className="text-[12px] text-[var(--color-text-3)] mt-0.5">{stop.area}</p>
        </div>
        <button
          aria-label="Remove stop"
          onClick={() => onRemove(stop.id)}
          className="ml-3 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-3)]"
        >
          <span className="ms text-[16px]">remove_circle_outline</span>
        </button>
      </div>

      {/* Meta pills */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        <span className="text-[11px] text-[var(--color-text-3)] bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
          {stop.durationMin} min
        </span>
        {stop.rating !== null && (
          <span className="text-[11px] text-[var(--color-text-3)] bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span>★</span>
            <span>{stop.rating}</span>
          </span>
        )}
        {stop.priceLevel !== null && (
          <span className="text-[11px] text-[var(--color-text-3)] bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
            {PRICE_LABEL[stop.priceLevel] ?? ''}
          </span>
        )}
      </div>

      {/* Conflict tags */}
      {stop.tags && stop.tags.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
          {stop.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--color-text-3)',
                whiteSpace: 'nowrap',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Why for you */}
      <div className="px-4 pb-3">
        <p className="text-[12px] text-[var(--color-text-2)] leading-relaxed">
          <span className="text-[var(--color-primary)] mr-1 font-semibold">✦</span>
          {stop.whyForYou}
        </p>
      </div>

      {/* Local tip */}
      {stop.localTip && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-[10px] bg-[var(--color-primary-bg)] border border-[var(--color-border)]">
          <p className="text-[11px] text-[var(--color-text-3)] italic leading-relaxed">{stop.localTip}</p>
        </div>
      )}

      {/* Links */}
      {(stop.googleMapsUrl || stop.website) && (
        <div className="flex gap-2 px-4 pb-4">
          {stop.googleMapsUrl && (
            <a
              href={stop.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-[var(--color-primary)] flex items-center gap-1"
            >
              <span className="ms text-[14px]">map</span>
              Google Maps
            </a>
          )}
          {stop.website && (
            <a
              href={stop.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-[var(--color-primary)] flex items-center gap-1"
            >
              <span className="ms text-[14px]">language</span>
              Website
            </a>
          )}
        </div>
      )}
    </div>
  )
}
