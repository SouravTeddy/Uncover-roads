import { useState } from 'react';
import { useAppStore } from '../../shared/store';

const TEXT3  = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

export function JourneyAdvisorThread() {
  const { state } = useAppStore();
  const { advisorMessages } = state;
  const [open, setOpen] = useState(false);

  if (advisorMessages.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Handle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', height: 36,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,.03)', border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '0 14px', cursor: 'pointer',
        }}
      >
        <span className="ms fill" style={{ fontSize: 15, color: TEXT3 }}>psychology</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: TEXT3, flex: 1, textAlign: 'left' }}>
          Why is my trip shaped this way?
        </span>
        <span className="ms" style={{ fontSize: 14, color: TEXT3, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>

      {/* Thread */}
      {open && (
        <div
          className="bg-[var(--color-sage-bg)] border border-[var(--color-sage-bdr)] rounded-[20px] p-4"
          style={{
            marginTop: 6, overflow: 'hidden',
            maxHeight: 280, overflowY: 'auto',
            animation: 'springUp 0.4s ease both',
          }}
        >
          {advisorMessages.map((msg, i) => (
            <div
              key={msg.id}
              style={{
                padding: '12px 16px',
                borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
              }}
            >
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-1)', lineHeight: 1.55, margin: 0 }}>
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
