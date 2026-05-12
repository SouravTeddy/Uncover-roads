import { describe, it, expect } from 'vitest'
import { parseRemoveConfirmationText } from './useItinerary'

describe('parseRemoveConfirmationText', () => {
  it('returns place name in confirmation message', () => {
    const text = parseRemoveConfirmationText('Senso-ji Temple')
    expect(text).toBe('Remove Senso-ji Temple? This will rebuild your itinerary.')
  })

  it('handles long names without truncation', () => {
    const text = parseRemoveConfirmationText('The Metropolitan Museum of Art')
    expect(text).toBe('Remove The Metropolitan Museum of Art? This will rebuild your itinerary.')
  })
})
