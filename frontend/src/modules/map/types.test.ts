import { describe, it, expect } from 'vitest'
import { FILTER_CHIPS } from './types'

describe('FILTER_CHIPS', () => {
  it('contains exactly the two current chips: all and curated', () => {
    const keys = FILTER_CHIPS.map(c => c.key)
    expect(keys).toContain('all')
    expect(keys).toContain('curated')
    expect(keys).toHaveLength(2)
  })

  it('does not contain removed chips', () => {
    const keys = FILTER_CHIPS.map(c => c.key)
    expect(keys).not.toContain('trending')
    expect(keys).not.toContain('hidden_gems')
    expect(keys).not.toContain('event')
    expect(keys).not.toContain('picks')
    expect(keys).not.toContain('museum')
    expect(keys).not.toContain('park')
    expect(keys).not.toContain('restaurant')
    expect(keys).not.toContain('historic')
    expect(keys).not.toContain('recommended')
  })
})
