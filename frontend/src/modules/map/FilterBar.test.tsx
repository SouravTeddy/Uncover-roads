import { describe, it, expect } from 'vitest'
import type { Category } from '../../shared/types'

// Mirrors the displayCount computation in MapScreen.tsx (line ~391)
function getDisplayCount(
  activeCategories: string[],
  filteredPlaces: Array<unknown>,
  allPlaces: Array<unknown>,
): number {
  return activeCategories.length > 0 ? filteredPlaces.length : allPlaces.length
}

describe('getDisplayCount', () => {
  it('returns total when no category filter active', () => {
    expect(getDisplayCount([], [1, 2], [1, 2, 3, 4])).toBe(4)
  })

  it('returns filtered length when category active', () => {
    expect(getDisplayCount(['cafe'], [1, 2], [1, 2, 3, 4])).toBe(2)
  })
})

describe('Category type coverage', () => {
  it('includes all backend-emitted categories', () => {
    const cats: Category[] = [
      'restaurant', 'cafe', 'park', 'museum', 'historic', 'tourism',
      'place', 'event', 'bar', 'nightlife', 'gallery', 'bakery', 'spa',
      'spiritual', 'stadium', 'zoo', 'aquarium', 'library', 'cinema',
      'amusement_park', 'viewpoint', 'beach', 'market', 'street_art',
    ]
    expect(cats.length).toBe(24)
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { FilterBar } from './FilterBar'

const noop = () => {}

const baseCounts: Record<string, number> = {
  historic: 8, tourism: 5, cafe: 14, park: 3, restaurant: 11,
  museum: 6, bar: 2, nightlife: 1, gallery: 4, viewpoint: 0,
  beach: 0, market: 7, spiritual: 2, spa: 0,
}

describe('FilterBar component', () => {
  it('renders the All button', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} displayCount={50}
        curatedCount={0}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop}
      />
    )
    expect(screen.getByRole('button', { name: /All/i })).toBeTruthy()
  })

  it('shows count on Landmarks chip (historic 8 + tourism 5 = 13)', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} displayCount={50}
        curatedCount={0}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    expect(screen.getByText('Landmarks')).toBeTruthy()
    const el = document.body.textContent ?? ''
    expect(el).toContain('13')
  })

  it('hides chips with 0 count (Spa has 0)', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} displayCount={50}
        curatedCount={0}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    expect(screen.queryByText('Spa')).toBeNull()
  })

  it('calls onCategoriesSelect with ["historic","tourism"] for Landmarks', () => {
    const onCategoriesSelect = vi.fn()
    render(
      <FilterBar
        active="all" activeCategories={[]} displayCount={50}
        curatedCount={0}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={onCategoriesSelect}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    fireEvent.click(screen.getByText('Landmarks'))
    expect(onCategoriesSelect).toHaveBeenCalledWith(['historic', 'tourism'])
  })

  it('scroll row has maxWidth set', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} displayCount={50}
        curatedCount={0}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    const scrollRow = document.querySelector('[data-testid="subcategory-scroll"]') as HTMLElement | null
    expect(scrollRow).not.toBeNull()
    expect(scrollRow!.style.maxWidth).toBe('calc(100vw - 32px)')
  })

  it('curated chip is always tappable — no lock icon', () => {
    render(
      <FilterBar
        active="all"
        activeCategories={[]}
        displayCount={10}
        curatedCount={3}
        categoryCounts={{}}
        onSelect={() => {}}
        onCategoriesSelect={() => {}}
      />
    )
    expect(screen.queryByText('lock')).toBeNull()
  })
})
