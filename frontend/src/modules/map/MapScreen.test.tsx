import { describe, it, expect } from 'vitest'

// Pure logic test — no component render needed

function cityFavsCount(favouritedPins: Array<{ city: string }>, city: string): number {
  return favouritedPins.filter(p => p.city === city).length
}

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
