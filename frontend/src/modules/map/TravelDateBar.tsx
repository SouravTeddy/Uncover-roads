interface Props {
  startDate: string | null
  endDate: string | null
  cities: string[]
  onTap: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

export function TravelDateBar({ startDate, endDate, cities, onTap }: Props) {
  if (!startDate || !endDate) return null

  const days = computeDays(startDate, endDate)
  const travelDays = Math.max(0, cities.length - 1)
  const parts: string[] = [
    `${formatDate(startDate)} – ${formatDate(endDate)}`,
    `${days} days`,
    ...(travelDays > 0 ? [`${travelDays} travel`] : []),
    ...(cities.length > 1 ? [`${cities.length} cities`] : []),
  ]

  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 999,
        background: 'rgba(15,20,30,0.88)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="ms text-primary" style={{ fontSize: 14 }}>calendar_today</span>
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-1)', letterSpacing: '0.01em' }}>
        {parts.join(' · ')}
      </span>
    </button>
  )
}
