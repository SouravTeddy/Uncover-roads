# Map Filter Bar Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six bugs in the map filter bar: wrong count when category selected, no counts on subcategory chips, Landmarks filter missing `tourism` pins, horizontal scroll broken, double loading spinner on initial load, and the `Category` TypeScript type being narrower than what the backend actually emits.

**Architecture:** Four surgical edits across four files — no new components, no new abstractions. The `Category` type in `shared/types.ts` gets expanded to match the backend's `_NEARBY_TYPE_TO_CATEGORY` map. `useMap.ts` gains multi-category support for the Landmarks chip. `FilterBar.tsx` accepts a `categoryCounts` prop and a `maxWidth` fix on the scroll row. `MapScreen.tsx` passes the right count, computes `categoryCounts`, and gates the corner spinner behind `!initialLoading`.

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react

---

## Files touched

| File | Change |
|------|--------|
| `frontend/src/shared/types.ts` | Expand `Category` union type |
| `frontend/src/modules/map/useMap.ts` | Multi-category filter for Landmarks (`historic \| tourism`) |
| `frontend/src/modules/map/FilterBar.tsx` | Add `categoryCounts` prop; `maxWidth` on scroll row |
| `frontend/src/modules/map/MapScreen.tsx` | Compute `categoryCounts`; pass `filteredPlaces.length`; gate corner spinner |
| `frontend/src/modules/map/useMap.test.ts` | New tests for multi-category filtering |
| `frontend/src/modules/map/FilterBar.test.tsx` | New tests for chip counts and scroll container |

---

### Task 1: Expand the Category type

**Files:**
- Modify: `frontend/src/shared/types.ts:175`

The current type `'restaurant' | 'cafe' | 'park' | 'museum' | 'historic' | 'tourism' | 'place' | 'event'` doesn't cover all categories the backend emits. `_NEARBY_TYPE_TO_CATEGORY` in `main.py` also produces `bar`, `nightlife`, `gallery`, `bakery`, `spa`, `spiritual`, `stadium`, `zoo`, `aquarium`, `library`, `cinema`, `amusement_park`, `viewpoint`, `beach`, `market`, `street_art`. These already have icons and labels in `frontend/src/modules/map/types.ts` — the type just needs to catch up.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/FilterBar.test.tsx` (new file):

```tsx
import { describe, it, expect } from 'vitest'
import type { Category } from '../../shared/types'

describe('Category type coverage', () => {
  it('includes all backend-emitted categories', () => {
    // This is a compile-time check — if Category doesn't include these,
    // TypeScript will error here.
    const cats: Category[] = [
      'restaurant', 'cafe', 'park', 'museum', 'historic', 'tourism',
      'place', 'event', 'bar', 'nightlife', 'gallery', 'bakery', 'spa',
      'spiritual', 'stadium', 'zoo', 'aquarium', 'library', 'cinema',
      'amusement_park', 'viewpoint', 'beach', 'market', 'street_art',
    ]
    expect(cats.length).toBe(25)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: TypeScript compile error — `'bar' is not assignable to type 'Category'`

- [ ] **Step 3: Expand the Category type**

In `frontend/src/shared/types.ts`, replace line 175:

```ts
export type Category =
  | 'restaurant' | 'cafe' | 'park' | 'museum' | 'historic' | 'tourism'
  | 'place' | 'event' | 'bar' | 'nightlife' | 'gallery' | 'bakery'
  | 'spa' | 'spiritual' | 'stadium' | 'zoo' | 'aquarium' | 'library'
  | 'cinema' | 'amusement_park' | 'viewpoint' | 'beach' | 'market'
  | 'street_art';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: PASS — 1 test, 0 failures

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/modules/map/FilterBar.test.tsx
git commit -m "fix: expand Category type to cover all backend-emitted categories"
```

---

### Task 2: Multi-category filter for Landmarks in useMap

**Files:**
- Modify: `frontend/src/modules/map/useMap.ts:21` (function signature)
- Modify: `frontend/src/modules/map/useMap.ts:134-139` (filteredPlaces logic)
- Test: `frontend/src/modules/map/useMap.test.ts`

Currently `useMap(activeCategory: string | null)` filters `p.category === activeCategory`. The Landmarks chip sets `activeCategory = 'historic'` but the backend also maps `tourist_attraction` → `'tourism'`. So tourism-type landmark pins are invisible when Landmarks is selected.

The fix: accept `activeCategories: string[]` instead of a single string, and filter with `.includes()`.

- [ ] **Step 1: Add failing tests to useMap.test.ts**

Append to `frontend/src/modules/map/useMap.test.ts`:

```ts
// ── filteredPlaces logic ──────────────────────────────────────────────────────

function applyFilter(
  places: { id: string; category: string }[],
  activeCategories: string[],
): { id: string; category: string }[] {
  if (activeCategories.length === 0) return places
  return places.filter(p => activeCategories.includes(p.category))
}

describe('filteredPlaces multi-category logic', () => {
  const places = [
    { id: '1', category: 'historic' },
    { id: '2', category: 'tourism' },
    { id: '3', category: 'cafe' },
    { id: '4', category: 'museum' },
  ]

  it('returns all places when activeCategories is empty', () => {
    expect(applyFilter(places, [])).toHaveLength(4)
  })

  it('filters to single category', () => {
    const result = applyFilter(places, ['cafe'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('filters to multiple categories (Landmarks = historic + tourism)', () => {
    const result = applyFilter(places, ['historic', 'tourism'])
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id).sort()).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: Run tests to verify they pass (logic is already correct)**

```bash
cd frontend && npx vitest run src/modules/map/useMap.test.ts
```

Expected: all existing tests PASS plus the 3 new ones — confirms the pure logic is correct before wiring it into the hook.

- [ ] **Step 3: Update useMap signature and filteredPlaces**

In `frontend/src/modules/map/useMap.ts`, change the function signature from:

```ts
export function useMap(activeCategory: string | null = null) {
```

to:

```ts
export function useMap(activeCategories: string[] = []) {
```

Then replace the `filteredPlaces` block (lines 134–139):

```ts
  const filteredPlaces: Place[] =
    activeFilter === 'saved'
      ? places.filter(p => favouritedPins.some(f => f.placeId === p.id))
      : activeFilter === 'all' && activeCategories.length > 0
      ? places.filter(p => activeCategories.includes(p.category))
      : places;
```

- [ ] **Step 4: Run full test suite**

```bash
cd frontend && npx vitest run src/modules/map/useMap.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/useMap.ts frontend/src/modules/map/useMap.test.ts
git commit -m "fix: multi-category filter in useMap — Landmarks now matches historic + tourism"
```

---

### Task 3: Update FilterBar to accept categoryCounts and fix scroll

**Files:**
- Modify: `frontend/src/modules/map/FilterBar.tsx`
- Test: `frontend/src/modules/map/FilterBar.test.tsx`

Two changes in one component:
1. Accept `categoryCounts: Record<string, number>` prop and show counts on each subcategory chip
2. The Landmarks chip needs `categories: string[]` instead of a single `key` so it can pass `['historic', 'tourism']` up to the parent
3. Add `maxWidth: 'calc(100vw - 32px)'` to the scroll row so overflow-x actually scrolls

The `SUB_CHIPS` array needs a new shape: `{ categories: string[]; label: string; icon: string }`. Single-category chips wrap their key in an array. Landmarks uses `['historic', 'tourism']`.

- [ ] **Step 1: Add tests to FilterBar.test.tsx**

Append to `frontend/src/modules/map/FilterBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from './FilterBar'

const noop = () => {}

const baseCounts: Record<string, number> = {
  historic: 8, tourism: 5, cafe: 14, park: 3, restaurant: 11,
  museum: 6, bar: 2, nightlife: 1, gallery: 4, viewpoint: 0,
  beach: 0, market: 7, spiritual: 2, spa: 0,
}

describe('FilterBar', () => {
  it('shows count on Landmarks chip', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} allCount={50}
        curatedCount={0} curatedLocked={false}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop} onLockedTap={noop}
      />
    )
    // Open subcategory row
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    // Landmarks chip = historic (8) + tourism (5) = 13
    expect(screen.getByText(/Landmarks/)).toBeTruthy()
    expect(screen.getByText(/· 13/)).toBeTruthy()
  })

  it('hides chips with 0 count', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} allCount={50}
        curatedCount={0} curatedLocked={false}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop} onLockedTap={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    // Spa has 0 count — should not render
    expect(screen.queryByText('Spa')).toBeNull()
  })

  it('calls onCategoriesSelect with correct array for Landmarks', () => {
    const onCategoriesSelect = vi.fn()
    render(
      <FilterBar
        active="all" activeCategories={[]} allCount={50}
        curatedCount={0} curatedLocked={false}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={onCategoriesSelect} onLockedTap={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    fireEvent.click(screen.getByText(/Landmarks/))
    expect(onCategoriesSelect).toHaveBeenCalledWith(['historic', 'tourism'])
  })

  it('scroll row has maxWidth set', () => {
    render(
      <FilterBar
        active="all" activeCategories={[]} allCount={50}
        curatedCount={0} curatedLocked={false}
        categoryCounts={baseCounts}
        onSelect={noop} onCategoriesSelect={noop} onLockedTap={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    const scrollRow = document.querySelector('[data-testid="subcategory-scroll"]')
    expect(scrollRow).not.toBeNull()
    expect((scrollRow as HTMLElement).style.maxWidth).toBe('calc(100vw - 32px)')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: FAIL — FilterBar doesn't accept `categoryCounts` or `onCategoriesSelect` yet

- [ ] **Step 3: Rewrite FilterBar.tsx**

Replace `frontend/src/modules/map/FilterBar.tsx` entirely:

```tsx
import { useState } from 'react'
import { vi } from 'vitest'
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

  // Chip count = sum of counts for all categories in the chip
  function chipCount(cats: string[]): number {
    return cats.reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0)
  }

  // Derive label for the All button when a category is active
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

  // Only show chips that have at least 1 place in the current viewport
  const visibleChips = SUB_CHIPS.filter(c => chipCount(c.categories) > 0)

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

      {/* Sub-category row — shown when All is expanded */}
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
          {/* Clear chip */}
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
```

**Important:** Remove the stray `import { vi } from 'vitest'` line — that was accidentally included above. The final FilterBar.tsx should have only:
```ts
import { useState } from 'react'
import type { MapFilter } from '../../shared/types'
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/FilterBar.tsx frontend/src/modules/map/FilterBar.test.tsx
git commit -m "fix: FilterBar counts per chip, Landmarks multi-category, scroll maxWidth"
```

---

### Task 4: Wire MapScreen to the new FilterBar and useMap API

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

Three changes:
1. `activeCategory: string | null` state → `activeCategories: string[]` state
2. Compute `categoryCounts` with `useMemo` from `places`
3. Pass `filteredPlaces.length` as `allCount`
4. Gate the corner spinner with `!initialLoading`

- [ ] **Step 1: Find the three change sites**

```bash
grep -n "activeCategory\|allCount={places\|loading && (" frontend/src/modules/map/MapScreen.tsx
```

You'll see:
- `const [activeCategory, setActiveCategory] = useState<string | null>(null)` — line ~52
- `} = useMap(activeCategory)` — line ~58
- `allCount={places.length}` — line ~479
- `{loading && (` — line ~556

- [ ] **Step 2: Update state and useMap call**

Replace:
```ts
const [activeCategory, setActiveCategory] = useState<string | null>(null);
```
with:
```ts
const [activeCategories, setActiveCategories] = useState<string[]>([]);
```

Replace:
```ts
} = useMap(activeCategory);
```
with:
```ts
} = useMap(activeCategories);
```

- [ ] **Step 3: Add categoryCounts memo**

After the `useMap` destructure, add (import `useMemo` from React if not already imported):

```ts
const categoryCounts = useMemo<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const p of places) {
    counts[p.category] = (counts[p.category] ?? 0) + 1
  }
  return counts
}, [places])
```

- [ ] **Step 4: Update FilterBar props**

In the `<FilterBar>` JSX, change:
```tsx
activeCategory={activeCategory}
allCount={places.length}
onCategorySelect={setActiveCategory}
```
to:
```tsx
activeCategories={activeCategories}
allCount={filteredPlaces.length}
categoryCounts={categoryCounts}
onCategoriesSelect={setActiveCategories}
```

- [ ] **Step 5: Gate the corner spinner**

Change:
```tsx
{loading && (
```
to:
```tsx
{!initialLoading && loading && (
```

- [ ] **Step 6: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "error|warning" | head -20
```

Expected: no errors related to the changed files. Fix any type errors before continuing.

- [ ] **Step 7: Run full test suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "fix: wire categoryCounts and activeCategories to FilterBar; fix corner spinner"
```

---

## Self-Review

**Spec coverage:**
- ✅ Category type expanded (Task 1)
- ✅ Landmarks multi-category filter (Task 2)
- ✅ Counts on chips (Task 3)
- ✅ Chips with 0 pins hidden (Task 3 — `visibleChips` filter)
- ✅ Scroll `maxWidth` (Task 3)
- ✅ `allCount` uses `filteredPlaces.length` (Task 4)
- ✅ Corner spinner gated behind `!initialLoading` (Task 4)

**Placeholder scan:** None found.

**Type consistency:**
- `onCategorySelect` → `onCategoriesSelect` throughout (FilterBar props + MapScreen call site)
- `activeCategory: string | null` → `activeCategories: string[]` throughout (state + useMap param)
- `chipCount(cats: string[]): number` used consistently in FilterBar
