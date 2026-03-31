interface SearchHereButtonProps {
  onSearch: () => void;
  loading?: boolean;
  empty?: boolean;
}

export function SearchHereButton({ onSearch, loading, empty }: SearchHereButtonProps) {
  const isError = empty && !loading;
  return (
    <button
      onClick={onSearch}
      disabled={loading || empty}
      className="absolute left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5
        px-3 h-8 rounded-full text-xs font-semibold transition-all disabled:cursor-default"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 7.5rem)',
        background: isError ? 'rgba(239,68,68,.18)' : 'rgba(15,20,30,.85)',
        backdropFilter: 'blur(8px)',
        border: isError ? '1px solid rgba(239,68,68,.3)' : '1px solid rgba(255,255,255,.14)',
        color: isError ? '#fca5a5' : 'rgba(255,255,255,.85)',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <span className="w-3 h-3 border-2 border-white/40 border-t-white/90 rounded-full animate-spin" />
      ) : isError ? (
        <span className="ms text-sm" style={{ fontSize: '14px' }}>search_off</span>
      ) : (
        <span className="ms text-sm" style={{ fontSize: '14px' }}>search</span>
      )}
      {loading ? 'Searching…' : isError ? 'No places found' : 'Search here'}
    </button>
  );
}
