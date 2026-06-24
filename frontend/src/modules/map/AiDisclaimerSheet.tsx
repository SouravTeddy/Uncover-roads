import { useEffect, useState } from 'react';

const LS_KEY = 'ur_ai_disclaimer_shown';

interface Props {
  onContinue: () => void;
}

export function AiDisclaimerSheet({ onContinue }: Props) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) {
      onContinue();
    }
  }, [onContinue]);

  if (localStorage.getItem(LS_KEY)) return null;

  function handleContinue() {
    localStorage.setItem(LS_KEY, '1');
    onContinue();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%', background: 'var(--color-surface)',
          borderRadius: '24px 24px 0 0',
          borderTop: '1px solid rgba(212,168,83,.2)',
          padding: '20px 20px 32px',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.12)', margin: '0 auto 20px' }} />

        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
          A heads up
        </h2>

        <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.65, marginBottom: 20 }}>
          Some information in your itinerary — like venue descriptions and visit tips — may be
          AI-generated. Always verify opening hours and prices before heading out.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
          />
          <div style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: checked ? 'none' : '1.5px solid rgba(255,255,255,.2)',
            background: checked ? 'var(--color-primary)' : 'rgba(255,255,255,.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}>
            {checked && (
              <span className="ms fill" style={{ fontSize: 14, color: 'var(--color-bg)', fontVariationSettings: "'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24" }}>
                check
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>
            I understand some content is AI-generated and may need verification
          </span>
        </label>

        <button
          onClick={handleContinue}
          disabled={!checked}
          style={{
            width: '100%', height: 48, borderRadius: 14,
            background: checked ? 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dk))' : 'rgba(255,255,255,.08)',
            border: 'none',
            fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700,
            color: checked ? 'var(--color-bg)' : 'rgba(255,255,255,.25)',
            cursor: checked ? 'pointer' : 'not-allowed',
            transition: 'all .2s',
          }}
        >
          Continue
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 10 }}>
          Won't show again after this
        </p>
      </div>
    </div>
  );
}
