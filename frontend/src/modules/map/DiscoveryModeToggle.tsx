import type { DiscoveryMode } from '../../shared/types'

interface Props {
  mode: DiscoveryMode
  onChange: (mode: DiscoveryMode) => void
}

const ACCENT = '#3b82f6'
const SURFACE = 'rgba(255,255,255,0.06)'
const BORDER = 'rgba(255,255,255,0.1)'
const TEXT3 = 'rgba(193,198,215,0.7)'

/**
 * Discovery mode toggle — appears on the map after a city is selected.
 * anchor = "★ Essentials" (famous landmarks)
 * deep   = "✦ Local's pick" (hidden gems boosted)
 */
export function DiscoveryModeToggle({ mode, onChange }: Props) {
  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 20,
    fontSize: '0.72rem',
    fontWeight: 700,
    border: `1px solid ${BORDER}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '6px 8px',
        background: 'rgba(10,14,23,0.85)',
        borderRadius: 24,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${BORDER}`,
      }}
    >
      <button
        style={{
          ...btnBase,
          background: mode === 'anchor' ? ACCENT : SURFACE,
          color: mode === 'anchor' ? '#fff' : TEXT3,
          borderColor: mode === 'anchor' ? ACCENT : BORDER,
        }}
        onClick={() => onChange('anchor')}
      >
        ★ Essentials
      </button>
      <button
        style={{
          ...btnBase,
          background: mode === 'deep' ? ACCENT : SURFACE,
          color: mode === 'deep' ? '#fff' : TEXT3,
          borderColor: mode === 'deep' ? ACCENT : BORDER,
        }}
        onClick={() => onChange('deep')}
      >
        ✦ Local's pick
      </button>
    </div>
  )
}
