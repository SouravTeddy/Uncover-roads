import type { CityResult } from '../../shared/types';
import { useCitySearch } from './useCitySearch';

interface Props {
  onSelect: (city: string) => void;
}

export function CitySearch({ onSelect }: Props) {
  const { query, results, loading, onInput, clear } = useCitySearch();

  function handleSelect(result: CityResult) {
    onSelect(result.name);
    clear();
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-surface rounded-2xl px-4 h-14 border border-white/8">
        <span className="ms text-text-3 text-xl">search</span>
        <input
          type="text"
          value={query}
          placeholder="Destinations, cities, vibes..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          onChange={e => onInput(e.target.value)}
          className="flex-1 bg-transparent text-text-1 text-base outline-none placeholder:text-text-3"
        />
        {loading && <span className="ms text-text-3 text-base animate-spin">autorenew</span>}
        {query && !loading && (
          <button onClick={clear} className="ms text-text-3 text-base">close</button>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-2xl overflow-hidden shadow-xl z-30 border border-white/8">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/6 last:border-none hover:bg-surf-hst transition-colors"
            >
              <span className="ms text-text-3 text-base">location_on</span>
              <div>
                <div className="text-text-1 text-sm font-medium">{r.name}</div>
                {r.country && (
                  <div className="text-text-3 text-xs">{r.country}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
