import { useState } from 'react'

interface Props {
  disabled?: boolean
  onSurprise: () => Promise<void>
}

const ACCENT = '#8b5cf6'

/**
 * "Surprise Me" button — builds a full itinerary from scratch using the engine.
 * Counts as 1 generation. Single-city only.
 */
export function SurpriseMeButton({ disabled, onSurprise }: Props) {
  const [loading, setLoading] = useState(false)

  async function handlePress() {
    if (loading || disabled) return
    setLoading(true)
    try {
      await onSurprise()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      disabled={loading || disabled}
      onClick={handlePress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 16px',
        borderRadius: 999,
        backgroundColor: 'rgba(10,14,23,0.88)',
        border: `1px solid ${ACCENT}`,
        color: loading ? 'rgba(193,198,215,0.5)' : '#c4b5fd',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.15s ease',
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ fontSize: 13 }}>✦</span>
      {loading ? 'Building…' : 'Surprise Me'}
    </button>
  )
}
