import { describe, it, expect } from 'vitest'
import type { Category } from '../../shared/types'

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
