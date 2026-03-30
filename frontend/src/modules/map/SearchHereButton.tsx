interface SearchHereButtonProps {
  onSearch: () => void;
  loading?: boolean;
}

export function SearchHereButton({ onSearch, loading }: SearchHereButtonProps) {
  return (
    <button
      onClick={onSearch}
      disabled={loading}
      className="absolute top-[112px] left-1/2 -translate-x-1/2 z-[1000]
        px-4 py-2 rounded-full bg-white shadow-lg border border-zinc-200
        text-sm font-medium text-zinc-800 flex items-center gap-2
        disabled:opacity-60"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      )}
      Search here
    </button>
  );
}
