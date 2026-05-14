import { usePWAInstall } from './usePWAInstall';

/**
 * Android/Chrome only — iOS users install via the App Store.
 * Rendered in App.tsx just above <BottomNav />.
 * Shows a card overlay above the bottom nav when the user is eligible.
 */
export function InstallPrompt() {
  const { canPrompt, triggerInstall, dismiss } = usePWAInstall();

  if (!canPrompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Uncover Roads"
      style={{
        position: 'fixed',
        bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 8px)',
        left: 12,
        right: 12,
        zIndex: 50,
        borderRadius: 20,
        background: 'linear-gradient(160deg, rgba(17,17,17,0.97), rgba(10,10,10,0.99))',
        border: '1px solid rgba(196,97,61,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(224,120,84,0.08)',
        padding: '16px 16px 14px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(196,97,61,0.7)',
          marginBottom: 6,
        }}
      >
        Your journey deserves a shortcut
      </p>

      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 17,
          fontWeight: 600,
          color: '#f5e6d6',
          marginBottom: 4,
        }}
      >
        Take Uncover Roads everywhere
      </h2>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: 'rgba(245,230,214,0.5)',
          marginBottom: 16,
        }}
      >
        Add to your home screen for instant access — even when you're offline.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={triggerInstall}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #d4a853, #b8893a)',
            color: '#fff8f0',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(212,168,83,0.25)',
          }}
        >
          Add to home screen
        </button>

        <button
          onClick={dismiss}
          style={{
            height: 44,
            padding: '0 16px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(245,230,214,0.45)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
