import { useState, useEffect } from 'react'
import type { MapFilter } from '../../shared/types'

const SUB_CHIPS: { categories: string[]; label: string; icon: string }[] = [
  // Attractions
  { categories: ['historic', 'tourism'], label: 'Landmarks',   icon: 'account_balance' },
  { categories: ['museum'],              label: 'Museums',      icon: 'museum' },
  { categories: ['amusement_park'],      label: 'Theme Parks',  icon: 'attractions' },
  { categories: ['gallery'],             label: 'Art',          icon: 'palette' },
  { categories: ['market'],              label: 'Markets',      icon: 'storefront' },
  { categories: ['spiritual'],           label: 'Spiritual',    icon: 'temple_buddhist' },
  // Outdoors
  { categories: ['park'],                label: 'Parks',        icon: 'park' },
  { categories: ['beach'],               label: 'Beaches',      icon: 'beach_access' },
  { categories: ['viewpoint'],           label: 'Views',        icon: 'landscape' },
  // Food & Drink
  { categories: ['restaurant'],          label: 'Dining',       icon: 'restaurant' },
  { categories: ['cafe'],                label: 'Cafes',        icon: 'local_cafe' },
  { categories: ['bar'],                 label: 'Bars',         icon: 'local_bar' },
  { categories: ['nightlife'],           label: 'Nightlife',    icon: 'nightlife' },
  // Wellness
  { categories: ['spa'],                 label: 'Spa',          icon: 'spa' },
]

export const QUICK_PICKS: { label: string; categories: string[]; icon: string }[] = [
  { label: 'Best eateries', categories: ['restaurant', 'cafe'],               icon: 'restaurant' },
  { label: 'Best parks',    categories: ['park'],                              icon: 'park' },
  { label: 'Top stops',     categories: ['museum', 'tourism', 'historic'],    icon: 'museum' },
  { label: 'Nightlife',     categories: ['bar', 'nightlife'],                  icon: 'nightlife' },
  { label: 'Best views',    categories: ['viewpoint'],                         icon: 'landscape' },
  { label: 'Cafes',         categories: ['cafe'],                              icon: 'local_cafe' },
]

// Animated counter — slides up when value changes
function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (value !== display) {
      setDisplay(value)
      setAnimKey(k => k + 1)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span
      key={animKey}
      style={{
        display: 'inline-block',
        animation: animKey > 0 ? 'countFlip 0.18s ease-out both' : 'none',
      }}
    >
      {display}
    </span>
  )
}

interface Props {
  active?: MapFilter
  activeCategories: string[]
  displayCount?: number
  curatedCount?: number
  categoryCounts: Record<string, number>
  activeQuickPickLabel?: string | null
  onSelect?: (filter: MapFilter) => void
  onCategoriesSelect: (categories: string[]) => void
  onQuickPickSelect: (label: string | null, cats: string[]) => void
}

export function FilterBar({
  activeCategories, categoryCounts, onCategoriesSelect,
}: Props) {
  function chipCount(cats: string[]): number {
    return cats.reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0)
  }

  const activeChip = SUB_CHIPS.find(c =>
    c.categories.length === activeCategories.length &&
    c.categories.every(cat => activeCategories.includes(cat))
  )

  const anyActive = activeCategories.length > 0

  return (
    <>
      <style>{`
        @keyframes countFlip {
          from { transform: translateY(4px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <div
          data-testid="subcategory-scroll"
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
            maxWidth: 'calc(100vw - 32px)',
            scrollbarWidth: 'none',
          }}
        >
          {SUB_CHIPS.map(chip => {
            const isActive   = activeChip?.label === chip.label
            const isDisabled = anyActive && !isActive
            const count      = chipCount(chip.categories)

            if (count === 0 && !isActive) return null

            return (
              <button
                key={chip.label}
                onClick={() => onCategoriesSelect(isActive ? [] : chip.categories)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '0 14px', height: 44, borderRadius: 999,
                  background: isActive ? 'rgba(212,168,83,.15)' : 'var(--color-surface2)',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  color: isActive ? 'var(--color-primary-text)' : 'var(--color-text-2)',
                  opacity: isDisabled ? 0.4 : 1,
                  fontSize: '0.875rem', fontWeight: 600,
                  backdropFilter: 'blur(8px)', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.15s ease, border-color 0.12s ease, background 0.12s ease',
                }}
              >
                <span className="ms" style={{ fontSize: 14 }}>{chip.icon}</span>
                {chip.label}
                <span style={{ opacity: isActive ? 0.8 : 0.55, fontSize: '0.74rem' }}>
                  · <AnimatedCount value={count} />
                </span>
                {isActive && (
                  <span className="ms" style={{ fontSize: 11, marginLeft: 1, opacity: 0.7 }}>
                    close
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
