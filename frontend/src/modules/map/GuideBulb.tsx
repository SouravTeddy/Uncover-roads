import { useEffect, useRef, useState } from 'react'
import type { GuideMessage } from './useGuideMessages'

export interface GuideBulbProps {
  messages: GuideMessage[]
  hasUnread: boolean
  onRead: () => void
  onPlaceAction?: (placeId: string) => void
}

const KIND_ICON: Record<GuideMessage['kind'], string> = {
  area:      'explore',
  event:     'event',
  exploring: 'route',
}

const KIND_COLOR: Record<GuideMessage['kind'], string> = {
  area:      '#60a5fa',
  event:     '#a5b4fc',
  exploring: '#4ade80',
}

// Inject keyframe animations once
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
    @keyframes guideDotBlink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
    @keyframes guideRingPulse {
      0%, 100% { transform: scale(1); opacity: .35; }
      50%       { transform: scale(1.18); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

export function GuideBulb({ messages, hasUnread, onRead, onPlaceAction }: GuideBulbProps) {
  const [open, setOpen] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)
  const prevCountRef = useRef(0)
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger blink animation whenever new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      prevCountRef.current = messages.length
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
      setIsBlinking(true)
      blinkTimerRef.current = setTimeout(() => setIsBlinking(false), 3000)
    }
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
    }
  }, [messages.length])

  function handleOpen() {
    const wasOpen = open
    setOpen(o => !o)
    if (!wasOpen) {
      onRead()
    }
  }

  const showDot = hasUnread && !open
  // Newest messages at top
  const sorted = [...messages].reverse()

  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      {/* Glow ring — shown when unread and not open */}
      {showDot && !isBlinking && (
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
        onClick={handleOpen}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open
            ? 'rgba(212,168,83,.25)'
            : hasUnread
            ? 'rgba(212,168,83,.12)'
            : 'rgba(15,20,30,.72)',
          border: open
            ? '1.5px solid rgba(212,168,83,.6)'
            : hasUnread
            ? '1.5px solid rgba(212,168,83,.3)'
            : '1px solid rgba(255,255,255,.1)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        <span
          className="ms fill"
          style={{
            fontSize: 22,
            color: open || hasUnread ? '#d4a853' : 'var(--color-text-3)',
          }}
        >
          lightbulb
        </span>
      </button>

      {/* Notification dot */}
      {showDot && (
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
            animation: isBlinking
              ? 'guideDotBounceIn 0.35s cubic-bezier(.22,1,.36,1) both, guideDotBlink 0.4s ease-in-out 0.35s 7 both'
              : 'none',
          }}
        />
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 272,
            background: 'rgba(15,20,30,.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 16,
            overflow: 'hidden',
            animation: 'none',
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-3)' }}>close</span>
            </button>
          </div>

          {/* Message history — newest first */}
          {sorted.length === 0 ? (
            <p style={{ margin: '12px', fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
              No suggestions yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px 10px' }}>
              {sorted.map((msg, i) => (
                <div
                  key={msg.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,.04)',
                    border: `1px solid ${KIND_COLOR[msg.kind]}22`,
                    animation: `guideMsgIn 0.25s cubic-bezier(.22,1,.36,1) ${i * 60}ms both`,
                  }}
                >
                  <style>{`
                    @keyframes guideMsgIn {
                      from { opacity: 0; transform: translateY(10px); }
                      to   { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      className="ms fill"
                      style={{ fontSize: 15, color: KIND_COLOR[msg.kind], marginTop: 1, flexShrink: 0 }}
                    >
                      {KIND_ICON[msg.kind]}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--color-text-1)',
                          lineHeight: 1.4,
                        }}
                      >
                        {msg.text}
                      </p>
                      {msg.actionPlaceId && onPlaceAction && (
                        <button
                          onClick={() => { onPlaceAction(msg.actionPlaceId!); setOpen(false) }}
                          style={{
                            marginTop: 8,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'rgba(212,168,83,.12)',
                            border: '1px solid rgba(212,168,83,.3)',
                            color: '#d4a853',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <span className="ms fill" style={{ fontSize: 12 }}>location_on</span>
                          Show on map
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
