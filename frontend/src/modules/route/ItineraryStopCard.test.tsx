import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { ItineraryStopCard } from './ItineraryStopCard'
import type { EngineItineraryStop } from '../../shared/types'

afterEach(() => cleanup())

const stop: EngineItineraryStop = {
  id: 'stop-1',
  placeId: 'ChIJ1',
  title: 'Senso-ji Temple',
  area: 'Asakusa',
  day: 1,
  time: '08:00',
  durationMin: 90,
  category: 'historic',
  lat: 35.71,
  lon: 139.79,
  priceLevel: 0,
  rating: 4.7,
  weekdayText: ['Monday: 6:00 AM – 5:00 PM'],
  whyForYou: 'Perfect for early risers who love quiet temples.',
  localTip: 'Arrive before the incense smoke fills the courtyard.',
  googleMapsUrl: 'https://maps.google.com/?q=senso-ji',
  website: null,
  photoRef: null,
}

describe('ItineraryStopCard', () => {
  it('renders stop number and time', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('Stop 1 · 8:00am')).toBeTruthy()
  })

  it('renders place title and area', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('Senso-ji Temple')).toBeTruthy()
    expect(screen.getByText('Asakusa')).toBeTruthy()
  })

  it('renders whyForYou with ✦ marker', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText(/Perfect for early risers/)).toBeTruthy()
    expect(screen.getByText('✦')).toBeTruthy()
  })

  it('renders rating when present', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('4.7')).toBeTruthy()
  })

  it('shows Free when priceLevel is 0', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('Free')).toBeTruthy()
  })

  it('calls onRemove when swipe handle is tapped', () => {
    const onRemove = vi.fn()
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={onRemove} />)
    fireEvent.click(screen.getByLabelText('Remove stop'))
    expect(onRemove).toHaveBeenCalledWith('stop-1')
  })

  it('renders Google Maps link when googleMapsUrl is present', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    const link = screen.getByText('Google Maps')
    expect(link.closest('a')?.href).toContain('maps.google.com')
  })

  it('does not render website link when website is null', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.queryByText('Website')).toBeNull()
  })

  it('renders duration label', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('90 min')).toBeTruthy()
  })

  it('renders localTip when present', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText(/Arrive before the incense smoke/)).toBeTruthy()
  })

  it('does not render localTip when null', () => {
    const noTip: EngineItineraryStop = { ...stop, localTip: null }
    render(<ItineraryStopCard stop={noTip} stopNumber={1} onRemove={() => {}} />)
    expect(screen.queryByText(/Arrive before/)).toBeNull()
  })
})
