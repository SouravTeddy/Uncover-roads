import { useState } from 'react'
import type { MapFilter } from '../../shared/types'

const SUB_CHIPS: { categories: string[]; label: string; icon: string }[] = [
  { categories: ['historic', 'tourism'], label: 'Landmarks',  icon: 'account_balance' },
  { categories: ['cafe'],                label: 'Cafes',       icon: 'local_cafe' },
  { categories: ['park'],                label: 'Parks',       icon: 'park' },
  { categories: ['restaurant'],          label: 'Dining',      icon: 'restaurant' },
  { categories: ['museum'],              label: 'Museums',     icon: 'museum' },
  { categories: ['bar'],                 label: 'Bars',        icon: 'local_bar' },
  { categories: ['nightlife'],           label: 'Nightlife',   icon: 'nightlife' },
  { categories: ['gallery'],             label: 'Art',         icon: 'palette' },
  { categories: ['viewpoint'],           label: 'Views',       icon: 'landscape' },
  { categories: ['beach'],               label: 'Beaches',     icon: 'beach_access' },
  { categories: ['market'],              label: 'Markets',     icon: 'storefront' },
  { categories: ['spiritual'],           label: 'Spiritual',   icon: 'temple_buddhist' },
  { categories: ['spa'],                 label: 'Spa',         icon: 'spa' },
]

interface Props {
  active: MapFilter
  activeCategories: string[]
  allCount: number
  curatedCount: number
  curatedLocked: boolean
  categoryCounts: Record<string, number>
  onSelect: (filter: MapFilter) => void
  onCategoriesSelect: (categories: string[]) => void
  onLockedTap: () => void
}

export function FilterBar({
  active, activeCategories, allCount, curatedCount, curatedLocked,
  categoryCounts, onSelect, onCategoriesSelect, onLockedTap,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const isAllMode = active === 'all'

  function chipCount(cats: string[]): number {
    return cats.reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0)
  }

  const activeChip = SUB_CHIPS.find(c =>
    c.categories.length === activeCategories.length &&
    c.categories.every(cat => activeCategories.includes(cat))
  )
  const allLabel = activeChip ? activeChip.label : 'All'

  function handleAllTap() {
    if (!isAllMode) {
      onSelect('all')
      onCategoriesSelect([])
      setExpanded(false)
      return
    }
    setExpanded(e => !e)
  }

  function handleSubChip(cats: string[]) {
    onCategoriesSelect(cats)
    setExpanded(false)
  }

  const visibleChips = SUB_CHIPS.filter(c => chipCount(c.categories) > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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

        <button
          onClick={() => { curatedLocked ? onLockedTap() : onSelect('curated'); setExpanded(false) }}
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

      {expanded && isAllMode && (
        <div
          data-testid="subcategory-scroll"
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
            maxWidth: 'calc(100vw - 32px)',
            scrollbarWidth: 'none',
            animation: 'springUp .25s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <button
            onClick={() => { onCategoriesSelect([]); setExpanded(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              padding: '4px 10px', height: 26, borderRadius: 999,
              background: activeCategories.length === 0 ? 'rgba(212,168,83,.15)' : 'rgba(15,20,30,.75)',
              border: activeCategories.length === 0 ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              color: activeCategories.length === 0 ? 'var(--color-primary-text)' : 'var(--color-text-2)',
              fontSize: '0.72rem', fontWeight: 600,
              backdropFilter: 'blur(8px)', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.12s ease',
            }}
          >
            <span className="ms" style={{ fontSize: 12 }}>layers</span>
            All
          </button>

          {visibleChips.map(chip => {
            const isActive = activeChip?.label === chip.label
            const count = chipCount(chip.categories)
            return (
              <button
                key={chip.label}
                onClick={() => handleSubChip(chip.categories)}
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
                <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>· {count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
