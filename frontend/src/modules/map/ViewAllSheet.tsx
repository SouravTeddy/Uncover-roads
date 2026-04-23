import type { SearchResult } from './useSearchMode';
import { CATEGORY_LABELS, CATEGORY_ICONS } from './types';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

interface Props {
  results: SearchResult[];
  addedIds: Set<string>;
  onSelect: (index: number) => void;
  onAdd: (result: SearchResult) => void;
  onClose: () => void;
  queryLabel: string;
}

export function ViewAllSheet({ results, addedIds, onSelect, onAdd, onClose, queryLabel }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 28, background: 'rgba(0,0,0,.4)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-2xl overflow-hidden"
        style={{
          zIndex: 29,
          background: 'rgba(13,17,23,.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,.1)',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle + title */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-white/8">
          <div
            className="w-8 h-1 rounded-full mx-auto mb-3"
            style={{ background: 'rgba(255,255,255,.2)' }}
          />
          <div className="flex items-center justify-between">
            <p className="text-text-1 font-semibold text-sm capitalize">{queryLabel}</p>
            <button onClick={onClose}>
              <span className="ms text-text-3" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {results.map((place, index) => {
            const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
            const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place';
            const added = addedIds.has(place.id);
            return (
              <button
                key={place.id}
                onClick={() => { onSelect(index); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                style={{ borderTop: index > 0 ? '1px solid rgba(255,255,255,.06)' : undefined }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: added ? 'rgba(52,199,89,.12)' : 'rgba(59,130,246,.12)' }}
                >
                  <span
                    className="ms fill"
                    style={{ fontSize: 14, color: added ? '#34c759' : '#3b82f6' }}
                  >
                    {added ? 'check' : icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm truncate"
                    style={{ color: added ? '#34c759' : 'rgba(255,255,255,.9)' }}
                  >
                    {index + 1}. {place.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-text-3" style={{ fontSize: 10 }}>{categoryLabel}</span>
                    {place.rating != null && (
                      <span className="text-text-3" style={{ fontSize: 10 }}>⭐ {place.rating.toFixed(1)}</span>
                    )}
                    {place.price_level != null && (
                      <span className="text-text-3" style={{ fontSize: 10 }}>{PRICE_LABELS[place.price_level]}</span>
                    )}
                  </div>
                </div>
                {added ? (
                  <span className="text-xs font-medium" style={{ color: '#34c759', flexShrink: 0 }}>Added</span>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); onAdd(place); }}
                    className="px-2.5 h-7 rounded-lg text-white font-semibold flex-shrink-0"
                    style={{ fontSize: 11, background: '#3b82f6' }}
                  >
                    + Add
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />
      </div>
    </>
  );
}
