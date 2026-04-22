import { useRef, useState } from 'react';
import type { SearchResult } from './useSearchMode';
import { CATEGORY_LABELS, CATEGORY_ICONS } from './types';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

interface Props {
  results: SearchResult[];
  activeIndex: number;
  addedIds: Set<string>;
  onNavigate: (index: number) => void;
  onAdd: (result: SearchResult) => void;
  onViewAll: () => void;
}

export function SearchResultCard({
  results, activeIndex, addedIds, onNavigate, onAdd, onViewAll,
}: Props) {
  const place = results[activeIndex];
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);

  if (!place) return null;

  const isAdded = addedIds.has(place.id);
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place';

  function handleAdd() {
    if (isAdded) return;
    onAdd(place);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastText(`✓ ${place.title} added`);
    toastTimer.current = setTimeout(() => setToastText(null), 2500);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50 && activeIndex > 0) onNavigate(activeIndex - 1);
    else if (dx < -50 && activeIndex < results.length - 1) onNavigate(activeIndex + 1);
  }

  return (
    <div
      className="absolute inset-x-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)' }}
      >
        {/* Card header row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59,130,246,.12)' }}
          >
            <span className="ms fill text-primary" style={{ fontSize: 14 }}>{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-1 font-semibold text-sm truncate">
              <span className="text-text-3 mr-1">({activeIndex + 1})</span>
              {place.title}
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
          <div className="flex items-center gap-2">
            {/* Prev / Next */}
            <div className="flex gap-1">
              <button
                onClick={() => onNavigate(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,.08)' }}
              >
                <span className="ms text-text-2" style={{ fontSize: 14 }}>chevron_left</span>
              </button>
              <button
                onClick={() => onNavigate(activeIndex + 1)}
                disabled={activeIndex === results.length - 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,.08)' }}
              >
                <span className="ms text-text-2" style={{ fontSize: 14 }}>chevron_right</span>
              </button>
            </div>
            {/* Add button */}
            <button
              onClick={handleAdd}
              className="h-7 px-3 rounded-lg font-semibold"
              style={{
                fontSize: 11,
                background: isAdded ? 'rgba(52,199,89,.15)' : '#3b82f6',
                color: isAdded ? '#34c759' : 'white',
                border: isAdded ? '1px solid rgba(52,199,89,.3)' : 'none',
              }}
            >
              {isAdded ? '✓ Added' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between px-4 py-2">
          {toastText ? (
            <span className="text-xs font-medium" style={{ color: '#34c759' }}>{toastText}</span>
          ) : (
            <span className="text-text-3" style={{ fontSize: 10 }}>
              {activeIndex + 1} of {results.length} · swipe to browse
            </span>
          )}
          <button
            onMouseDown={onViewAll}
            className="text-xs font-medium"
            style={{ color: '#3b82f6' }}
          >
            View all {results.length} →
          </button>
        </div>
      </div>
    </div>
  );
}
