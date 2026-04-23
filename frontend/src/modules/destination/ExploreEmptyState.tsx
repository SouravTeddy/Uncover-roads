export function ExploreEmptyState() {
  return (
    <div
      className="mx-4 mt-4 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(20,16,36,0.9)',
        border: '1px solid rgba(176,108,255,0.12)',
      }}
    >
      <div className="flex flex-col items-center gap-2.5 px-5 py-8">
        <span className="text-4xl" style={{ opacity: 0.2 }}>🗺️</span>
        <p className="font-heading font-semibold text-white/40 text-sm text-center">
          No trips in progress
        </p>
        <p className="text-white/25 text-xs text-center leading-relaxed max-w-[180px]">
          Search for a city or place above to start building your next adventure.
        </p>
      </div>
    </div>
  );
}
