import { useState, useEffect } from 'react'
import type { HardBlocker } from './useHardBlockers'

interface Props {
  blockers: HardBlocker[]
  onFix: () => void
  onBuildAnyway: () => void
}

export function BlockerSheet({ blockers, onFix, onBuildAnyway }: Props) {
  const [visible, setVisible] = useState(false)

  // Slide-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const conflictCount = blockers.length
  const conflictLabel = conflictCount === 1 ? 'conflict' : 'conflicts'

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          background: 'rgba(0,0,0,.35)',
          cursor: 'pointer',
        }}
        onClick={onFix}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.48s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            padding: '10px 0 2px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--color-border-m)',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            padding: '8px 16px 12px',
          }}
        >
          <span
            className="ms fill"
            style={{
              color: '#fbbf24',
              fontSize: '20px',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            warning
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--color-text-1)',
                margin: '0 0 2px',
              }}
            >
              Heads up before you build
            </p>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-3)',
                margin: 0,
              }}
            >
              {conflictCount} {conflictLabel} before you build
            </p>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'var(--color-border)',
          }}
        />

        {/* Blocker rows */}
        <div
          style={{
            maxHeight: '35vh',
            overflowY: 'auto',
          }}
        >
          {blockers.map((blocker, index) => (
            <div
              key={blocker.placeId}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                padding: '12px 16px',
                borderTop: index > 0 ? '1px solid var(--color-border)' : undefined,
              }}
            >
              <span
                className="ms fill"
                style={{
                  color: '#f87171',
                  fontSize: '18px',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                block
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--color-text-1)',
                    margin: '0 0 2px',
                  }}
                >
                  {blocker.placeTitle}
                </p>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-3)',
                    margin: 0,
                  }}
                >
                  {blocker.reason}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Note line */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <p
            style={{
              fontSize: '0.72rem',
              fontStyle: 'italic',
              color: 'var(--color-text-3)',
              margin: 0,
            }}
          >
            Soft suggestions (pacing, sequence, weather) appear in your itinerary — not here.
          </p>
        </div>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '12px 16px 0',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <button
            aria-label="I'll fix it"
            onClick={onFix}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid var(--color-border-m)',
              borderRadius: '8px',
              color: 'var(--color-text-2)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            I'll fix it
          </button>
          <button
            aria-label="Build anyway"
            onClick={onBuildAnyway}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #d4a853, #b8893a)',
              border: 'none',
              borderRadius: '8px',
              color: '#0c0c0e',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Build anyway
          </button>
        </div>
      </div>
    </>
  )
}
