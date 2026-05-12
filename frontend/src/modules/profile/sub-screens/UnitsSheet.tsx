import { useAppStore } from '../../../shared/store';

export function UnitsSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppStore();

  function select(units: 'km' | 'miles') {
    dispatch({ type: 'SET_UNITS', units });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 50 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-md rounded-t-3xl px-6 pt-6 pb-10 bg-[var(--color-surface)] border border-[var(--color-border)]"
        style={{ borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--color-border)] mx-auto mb-6" />

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 mb-4">
          <button
            className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
            onClick={onClose}
          >
            <span className="ms text-[var(--color-text-2)]">arrow_back</span>
          </button>
          <h2 className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">
            Distance Units
          </h2>
        </div>

        {/* Settings card */}
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
          {(['km', 'miles'] as const).map((unit, i) => (
            <button
              key={unit}
              onClick={() => select(unit)}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all ${i > 0 ? 'border-t border-[var(--color-divider)]' : ''}`}
              style={{
                background: state.units === unit ? 'rgba(var(--color-primary-rgb, 249,115,22),.08)' : 'transparent',
              }}
            >
              <span className="text-[14px] text-[var(--color-text-1)]">
                {unit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}
              </span>
              {state.units === unit
                ? <span className="ms fill text-[var(--color-primary)]">check_circle</span>
                : <span className="ms text-[var(--color-text-3)]">chevron_right</span>
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
