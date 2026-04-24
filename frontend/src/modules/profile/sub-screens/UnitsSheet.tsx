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
        className="relative w-full max-w-md rounded-t-3xl px-6 pt-6 pb-10"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,.08)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />
        <p className="font-heading font-bold text-white text-lg mb-4">Distance Units</p>
        {(['km', 'miles'] as const).map(unit => (
          <button
            key={unit}
            onClick={() => select(unit)}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl mb-2 border transition-all"
            style={{
              background: state.units === unit ? 'rgba(249,115,22,.08)' : 'rgba(255,255,255,.03)',
              borderColor: state.units === unit ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.08)',
            }}
          >
            <span className="text-white font-medium">{unit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}</span>
            {state.units === unit && <span className="ms fill text-primary">check_circle</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
