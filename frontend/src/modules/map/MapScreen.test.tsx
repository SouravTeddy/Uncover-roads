import { describe, it, expect } from 'vitest'
import { cityFavsCount } from './MapScreen'
// Pure logic test — no component render needed

describe('cityFavsCount', () => {
  it('returns 0 when all saves are from other cities', () => {
    const pins = [{ city: 'Tokyo' }, { city: 'Tokyo' }]
    expect(cityFavsCount(pins, 'Sydney')).toBe(0)
  })

  it('returns only the count for the current city', () => {
    const pins = [{ city: 'Tokyo' }, { city: 'Sydney' }, { city: 'Sydney' }]
    expect(cityFavsCount(pins, 'Sydney')).toBe(2)
  })
})
