interface SearchHereButtonProps {
  onSearch: () => void;
  loading?: boolean;
}

export function SearchHereButton({ onSearch, loading }: SearchHereButtonProps) {
  return (
    <button
      onClick={onSearch}
      disabled={loading}
      className="absolute left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5
        px-3 h-8 rounded-full text-xs font-semibold
        disabled:opacity-50 transition-opacity"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 7.5rem)',
        background: 'rgba(15,20,30,.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,.14)',
        color: 'rgba(255,255,255,.85)',
      }}
    >
      {loading ? (
        <span className="w-3 h-3 border-2 border-white/40 border-t-white/90 rounded-full animate-spin" />
      ) : (
        <span className="ms text-sm" style={{ fontSize: '14px' }}>search</span>
      )}
      Search here
    </button>
  );
}
