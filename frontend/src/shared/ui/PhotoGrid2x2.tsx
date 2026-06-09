interface PhotoOption {
  value: string;
  label: string;
  sublabel?: string;
  imageUrl: string;
  color?: string;   // accent color for selected ring; defaults to primary
}

interface Props {
  options: PhotoOption[];
  selected: string | string[] | null;
  multi?: boolean;
  onSelect: (value: string) => void;
}

const DEFAULT_COLOR = 'var(--color-primary)';

export function PhotoGrid2x2({ options, selected, multi = false, onSelect }: Props) {
  function isSelected(v: string) {
    if (!selected) return false;
    return Array.isArray(selected) ? selected.includes(v) : selected === v;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      padding: '0 12px',
    }}>
      {options.map(opt => {
        const sel = isSelected(opt.value);
        const color = opt.color ?? DEFAULT_COLOR;
        // When another option is selected (single-select), dim unselected
        const dimmed = !multi && selected !== null && !sel;

        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              position: 'relative',
              height: 130,
              borderRadius: 18,
              overflow: 'hidden',
              border: sel ? `2.5px solid ${color}` : '2.5px solid transparent',
              boxShadow: sel ? `0 0 0 0px ${color}, 0 8px 28px rgba(0,0,0,.5)` : 'none',
              transform: sel ? 'scale(1.03)' : dimmed ? 'scale(.97)' : 'scale(1)',
              opacity: dimmed ? 0.52 : 1,
              transition: 'all .2s cubic-bezier(.25,0,0,1)',
              cursor: 'pointer',
              padding: 0,
              background: 'transparent',
            }}
          >
            {/* Photo */}
            <img
              src={opt.imageUrl}
              alt={opt.label}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: sel
                ? 'linear-gradient(to bottom, rgba(0,0,0,.05) 0%, rgba(0,0,0,.55) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,.20) 0%, rgba(0,0,0,.72) 100%)',
            }} />

            {/* Color glow overlay when selected */}
            {sel && (
              <div style={{
                position: 'absolute', inset: 0,
                background: `${color}18`,
              }} />
            )}

            {/* Label */}
            <div style={{
              position: 'absolute', bottom: 10, left: 10, right: 10,
              background: 'rgba(0,0,0,.28)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              borderRadius: 10,
              padding: '6px 8px',
            }}>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 18, fontWeight: 700,
                color: '#fff', lineHeight: 1.1,
              }}>{opt.label}</div>
              {opt.sublabel && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{opt.sublabel}</div>
              )}
            </div>

            {/* Check badge — top-right */}
            {sel && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 24, height: 24, borderRadius: multi ? 7 : '50%',
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'dotPop .25s cubic-bezier(.16,1,.3,1)',
              }}>
                <span className="ms fill" style={{ fontSize: 14, color: 'var(--color-bg)' }}>check</span>
              </div>
            )}

            {/* Empty checkbox for multi-select unselected */}
            {multi && !sel && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 22, height: 22, borderRadius: 6,
                border: '1.5px solid rgba(255,255,255,.35)',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
