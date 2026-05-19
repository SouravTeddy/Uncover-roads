import { useState } from 'react'
import type { GuideMessage } from './useGuideMessages'

export interface GuideBulbProps {
  message: GuideMessage | null
  onConflictTap: () => void
}

const KIND_ICON: Record<GuideMessage['kind'], string> = {
  area: 'explore',
  event: 'event',
  conflict: 'warning',
  exploring: 'route',
}

const KIND_COLOR: Record<GuideMessage['kind'], string> = {
  area: '#60a5fa',
  event: '#a5b4fc',
  conflict: '#fbbf24',
  exploring: '#4ade80',
}

// Inject keyframe animations once on module load
const STYLE_ID = 'guide-bulb-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes guideDotBounceIn {
      0%   { transform: scale(0); }
      70%  { transform: scale(1.35); }
      100% { transform: scale(1); }
    }
    @keyframes guideGlowPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(212,168,83,0); }
      50%       { box-shadow: 0 0 0 8px rgba(212,168,83,.25); }
    }
    @keyframes guideRingPulse {
      0%, 100% { transform: scale(1); opacity: .35; }
      50%       { transform: scale(1.18); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

export function GuideBulb({ message, onConflictTap }: GuideBulbProps) {
  const [open, setOpen] = useState(false)
  const hasMessage = message !== null

  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      {/* Glow ring — shown when hasMessage && !open */}
      {hasMessage && !open && (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            border: '2px solid rgba(212,168,83,.4)',
            animation: 'guideRingPulse 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Bulb button */}
      <button
        aria-label="Guide"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open ? 'rgba(212,168,83,.25)' : hasMessage ? 'rgba(212,168,83,.12)' : 'rgba(15,20,30,.72)',
          border: open ? '1.5px solid rgba(212,168,83,.6)' : hasMessage ? '1.5px solid rgba(212,168,83,.3)' : '1px solid rgba(255,255,255,.1)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          animation: hasMessage && !open ? 'guideGlowPulse 2.8s ease-in-out infinite' : undefined,
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        <span
          className="ms fill"
          style={{
            fontSize: 22,
            color: open || hasMessage ? '#d4a853' : 'var(--color-text-3)',
          }}
        >
          lightbulb
        </span>
      </button>

      {/* Notification dot — shown when hasMessage && !open */}
      {hasMessage && !open && (
        <span
          data-testid="guide-dot"
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#d4a853',
            border: '1.5px solid var(--color-surface)',
            animation: 'guideDotBounceIn 0.35s cubic-bezier(.22,1,.36,1) both',
          }}
        />
      )}

      {/* Panel — shown when open && message !== null */}
      {open && message && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 260,
            background: 'rgba(15,20,30,.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px 0',
            }}
          >
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--color-text-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Guide
            </span>
            <button
              aria-label="Close panel"
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                lineHeight: 1,
                padding: 2,
              }}
            >
              <span
                className="ms"
                style={{
                  fontSize: 16,
                  color: 'var(--color-text-3)',
                }}
              >
                close
              </span>
            </button>
          </div>

          {/* Message card */}
          <div
            style={{
              margin: '8px 10px 10px',
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${KIND_COLOR[message.kind]}22`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <span
                className="ms fill"
                style={{
                  fontSize: 16,
                  color: KIND_COLOR[message.kind],
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {KIND_ICON[message.kind]}
              </span>
              <div style={{ flex: 1 }}>
                {message.kind === 'conflict' ? (
                  <button
                    aria-label="View conflict details"
                    onClick={onConflictTap}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--color-text-1)',
                      lineHeight: 1.4,
                    }}
                  >
                    {message.text}
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        color: '#fbbf24',
                        marginTop: 2,
                      }}
                    >
                      Tap to see details →
                    </span>
                  </button>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--color-text-1)',
                      lineHeight: 1.4,
                    }}
                  >
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
