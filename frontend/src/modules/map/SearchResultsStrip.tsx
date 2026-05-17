import type { SearchResultPin } from './NumberedPinsLayer'

interface Props {
  results: SearchResultPin[]
  onSelect: (pin: SearchResultPin) => void
  onDismiss: () => void
}

export function SearchResultsStrip({ results, onSelect, onDismiss }: Props) {
  if (results.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        backdropFilter: 'blur(12px)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {results.length} results
        </span>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
        >
          Clear ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px' }}>
        {results.map((pin) => (
          <button
            key={pin.id}
            onClick={() => onSelect(pin)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 12,
              background: 'var(--color-border)',
              border: '1px solid var(--color-border-m)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {pin.number}
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-1)' }}>
              {pin.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
