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

export const QUICK_PICKS: { label: string; categories: string[]; icon: string }[] = [
  { label: 'Best eateries', categories: ['restaurant', 'cafe'],               icon: 'restaurant' },
  { label: 'Best parks',    categories: ['park'],                              icon: 'park' },
  { label: 'Top stops',     categories: ['museum', 'tourism', 'historic'],    icon: 'museum' },
  { label: 'Nightlife',     categories: ['bar', 'nightlife'],                  icon: 'nightlife' },
  { label: 'Best views',    categories: ['viewpoint'],                         icon: 'landscape' },
  { label: 'Cafes',         categories: ['cafe'],                              icon: 'local_cafe' },
]

interface Props {
  active: MapFilter
  activeCategories: string[]
  displayCount: number
  curatedCount: number
  categoryCounts: Record<string, number>
  activeQuickPickLabel?: string | null
  onSelect: (filter: MapFilter) => void
  onCategoriesSelect: (categories: string[]) => void
  onQuickPickSelect: (label: string | null, cats: string[]) => void
  empty?: boolean
}

export function FilterBar({
  active, activeCategories, displayCount, curatedCount,
  categoryCounts, activeQuickPickLabel, onSelect, onCategoriesSelect, onQuickPickSelect, empty,
}: Props) {
  const isAllMode = active === 'all'

  function chipCount(cats: string[]): number {
    return cats.reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0)
  }

  const activeChip = SUB_CHIPS.find(c =>
    c.categories.length === activeCategories.length &&
    c.categories.every(cat => activeCategories.includes(cat))
  )

  const visibleChips = SUB_CHIPS.filter(c => chipCount(c.categories) > 0)
  const visibleQuickPicks = QUICK_PICKS.filter(p => chipCount(p.categories) > 0)

  const chipStyle = (isActive: boolean, isEmptyActive = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
    padding: '4px 10px', height: 26, borderRadius: 999,
    background: isEmptyActive ? 'rgba(232,97,90,.14)' : isActive ? 'rgba(212,168,83,.15)' : 'rgba(15,20,30,.75)',
    border: isEmptyActive ? '1.5px solid #e8615a' : isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
    color: isEmptyActive ? '#e8615a' : isActive ? 'var(--color-primary-text)' : 'var(--color-text-2)',
    fontSize: '0.72rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.12s ease',
  })

  // When a quick pick is active: collapse the full FilterBar, show only the active pill
  if (activeQuickPickLabel) {
    const pick = QUICK_PICKS.find(p => p.label === activeQuickPickLabel)
    if (pick) {
      const count = chipCount(pick.categories)
      const isEmptyPick = empty && count === 0
      return (
        <button
          onClick={() => onQuickPickSelect(null, [])}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            padding: '5px 12px', height: 30, borderRadius: 999,
            background: isEmptyPick ? 'rgba(232,97,90,.12)' : 'rgba(212,168,83,.15)',
            border: isEmptyPick ? '1.5px solid #e8615a' : '1.5px solid rgba(212,168,83,.5)',
            color: isEmptyPick ? '#e8615a' : 'var(--color-primary)',
            boxShadow: isEmptyPick ? 'none' : '0 0 0 4px rgba(212,168,83,.06)',
            fontSize: '0.73rem', fontWeight: 700,
            backdropFilter: 'blur(10px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            animation: isEmptyPick ? 'pillPulse 1.3s ease-in-out infinite' : 'none',
          }}
        >
          <span className="ms fill" style={{ fontSize: 14 }}>{pick.icon}</span>
          {pick.label}
          <span style={{ opacity: 0.7, fontSize: '0.68rem', fontWeight: 700 }}>· {count}</span>
          <span
            className="ms"
            style={{
              fontSize: 13, marginLeft: 2, opacity: 0.7,
              animation: isEmptyPick ? 'xBounce 1s ease-in-out infinite' : 'none',
            }}
          >
            close
          </span>
        </button>
      )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>

      {/* Row 1: All + Curated */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => { onSelect('all'); onCategoriesSelect([]) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: isAllMode && activeCategories.length === 0 ? 'var(--color-primary)' : 'rgba(15,20,30,.82)',
            border: isAllMode && activeCategories.length === 0 ? '1px solid var(--color-primary)' : '1px solid var(--color-border-m)',
            color: isAllMode && activeCategories.length === 0 ? '#0c0c0e' : 'var(--color-text-2)',
            fontSize: '0.75rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
          }}
        >
          All
          {displayCount > 0 && (
            <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>· {displayCount}</span>
          )}
        </button>

        <button
          onClick={() => onSelect('curated')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: active === 'curated' ? 'var(--color-primary-bg)' : 'rgba(15,20,30,.82)',
            border: active === 'curated' ? '1px solid var(--color-primary)' : '1px solid rgba(212,168,83,.3)',
            color: active === 'curated' ? 'var(--color-primary)' : 'var(--color-primary-text)',
            fontSize: '0.75rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 11 }}>✦</span>
          Curated
          {curatedCount > 0 && (
            <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>· {curatedCount}</span>
          )}
        </button>
      </div>

      {/* Row 2: Sub-category chips — always visible horizontal scroll */}
      {isAllMode && (
        <div
          data-testid="subcategory-scroll"
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
            maxWidth: 'calc(100vw - 32px)',
            scrollbarWidth: 'none',
          }}
        >
          {visibleChips.map(chip => {
            const isActive = activeChip?.label === chip.label
            const isEmptyActive = isActive && empty
            const count = chipCount(chip.categories)
            return (
              <button
                key={chip.label}
                onClick={() => onCategoriesSelect(isActive ? [] : chip.categories)}
                style={{
                  ...chipStyle(isActive, isEmptyActive),
                  animation: isEmptyActive ? 'pillPulse 1.3s ease-in-out infinite' : 'none',
                }}
              >
                <span className="ms" style={{ fontSize: 12 }}>{chip.icon}</span>
                {chip.label}
                <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>· {count}</span>
                {isActive && (
                  <span className="ms" style={{ fontSize: 11, marginLeft: 1, animation: isEmptyActive ? 'xBounce 1s ease-in-out infinite' : 'none' }}>
                    close
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Row 3: Quick pick pills — curated named shortcuts */}
      {isAllMode && visibleQuickPicks.length > 0 && (
        <div
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
            maxWidth: 'calc(100vw - 32px)',
            scrollbarWidth: 'none',
          }}
        >
          {visibleQuickPicks.map(pick => {
            const count = chipCount(pick.categories)
            return (
              <button
                key={pick.label}
                onClick={() => onQuickPickSelect(pick.label, pick.categories)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '4px 11px', height: 30, borderRadius: 999,
                  background: 'rgba(15,20,30,.86)',
                  border: '1px solid rgba(212,168,83,.22)',
                  color: 'rgba(212,168,83,.8)',
                  fontSize: '0.72rem', fontWeight: 600,
                  backdropFilter: 'blur(10px)', cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.12s ease',
                }}
              >
                <span className="ms fill" style={{ fontSize: 13 }}>{pick.icon}</span>
                {pick.label}
                <span style={{ opacity: 0.55, fontSize: '0.67rem' }}>· {count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
