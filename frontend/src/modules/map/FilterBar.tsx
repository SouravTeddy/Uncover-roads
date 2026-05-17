import { useState } from 'react';
import type { MapFilter } from '../../shared/types';

const SUB_CHIPS = [
  { key: 'all',       label: 'All',       icon: 'layers' },
  { key: 'historic',  label: 'Landmarks', icon: 'account_balance' },
  { key: 'cafe',      label: 'Cafes',     icon: 'local_cafe' },
  { key: 'park',      label: 'Parks',     icon: 'park' },
  { key: 'restaurant',label: 'Dining',    icon: 'restaurant' },
  { key: 'museum',    label: 'Galleries', icon: 'palette' },
];

interface Props {
  active: MapFilter;
  activeCategory: string | null;
  allCount: number;
  curatedCount: number;
  curatedLocked: boolean;
  onSelect: (filter: MapFilter) => void;
  onCategorySelect: (category: string | null) => void;
  onLockedTap: () => void;
}

export function FilterBar({
  active, activeCategory, allCount, curatedCount, curatedLocked,
  onSelect, onCategorySelect, onLockedTap,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const isAllMode = active === 'all';
  const allLabel = activeCategory
    ? (SUB_CHIPS.find(c => c.key === activeCategory)?.label ?? 'All')
    : 'All';

  function handleAllTap() {
    if (!isAllMode) {
      onSelect('all');
      onCategorySelect(null);
      setExpanded(false);
      return;
    }
    setExpanded(e => !e);
  }

  function handleSubChip(key: string) {
    onCategorySelect(key === 'all' ? null : key);
    setExpanded(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      {/* Main chips row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* All chip */}
        <button
          onClick={handleAllTap}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: isAllMode ? 'var(--color-primary)' : 'rgba(15,20,30,.82)',
            border: isAllMode ? '1px solid var(--color-primary)' : '1px solid var(--color-border-m)',
            color: isAllMode ? '#0c0c0e' : 'var(--color-text-2)',
            fontSize: '0.75rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
          }}
        >
          {allLabel}
          {allCount > 0 && (
            <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>· {allCount}</span>
          )}
          <span className="ms" style={{ fontSize: 13, opacity: 0.7, marginLeft: 1 }}>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {/* Curated chip */}
        <button
          onClick={() => { curatedLocked ? onLockedTap() : onSelect('curated'); setExpanded(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: active === 'curated' ? 'var(--color-primary-bg)' : 'rgba(15,20,30,.82)',
            border: active === 'curated'
              ? '1px solid var(--color-primary)'
              : curatedLocked
              ? '1px solid var(--color-border)'
              : '1px solid rgba(212,168,83,.3)',
            color: active === 'curated'
              ? 'var(--color-primary)'
              : curatedLocked
              ? 'var(--color-text-3)'
              : 'var(--color-primary-text)',
            fontSize: '0.75rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            opacity: curatedLocked ? 0.75 : 1,
          }}
        >
          <span style={{ fontSize: 11 }}>✦</span>
          Curated
          {!curatedLocked && curatedCount > 0 && (
            <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>· {curatedCount}</span>
          )}
          {curatedLocked && (
            <span className="ms" style={{ fontSize: 12, marginLeft: 1 }}>lock</span>
          )}
        </button>
      </div>

      {/* Sub-category row — shown when All is expanded */}
      {expanded && isAllMode && (
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
          scrollbarWidth: 'none',
          animation: 'springUp .25s cubic-bezier(.16,1,.3,1)',
        }}>
          {SUB_CHIPS.map(chip => {
            const isActive = chip.key === 'all' ? activeCategory === null : activeCategory === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => handleSubChip(chip.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  padding: '4px 10px', height: 26, borderRadius: 999,
                  background: isActive ? 'rgba(212,168,83,.15)' : 'rgba(15,20,30,.75)',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  color: isActive ? 'var(--color-primary-text)' : 'var(--color-text-2)',
                  fontSize: '0.72rem', fontWeight: 600,
                  backdropFilter: 'blur(8px)', cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.12s ease',
                }}
              >
                <span className="ms" style={{ fontSize: 12 }}>{chip.icon}</span>
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
