import { describe, it, expect } from 'vitest'
import { FILTER_CHIPS } from './types'

describe('FILTER_CHIPS', () => {
  it('contains required Phase 11 chips', () => {
    const keys = FILTER_CHIPS.map(c => c.key)
    expect(keys).toContain('all')
    expect(keys).toContain('trending')
    expect(keys).toContain('hidden_gems')
    expect(keys).toContain('event')
    expect(keys).toContain('picks')
  })

  it('does not contain removed chips', () => {
    const keys = FILTER_CHIPS.map(c => c.key)
    expect(keys).not.toContain('museum')
    expect(keys).not.toContain('park')
    expect(keys).not.toContain('restaurant')
    expect(keys).not.toContain('historic')
    expect(keys).not.toContain('recommended')
  })
})
