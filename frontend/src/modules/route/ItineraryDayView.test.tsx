import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { ItineraryDayView } from './ItineraryDayView'
import type { EngineItineraryDay, EngineMessage } from '../../shared/types'

afterEach(() => cleanup())

const banner: EngineMessage = {
  id: 'msg-1',
  type: 'resequence',
  what: 'Moved Senso-ji to 8am',
  why: 'It closes at 5pm',
  consequence: 'You reach Ueno with 3 hours spare',
  dismissable: true,
}

const day: EngineItineraryDay = {
  day: 1,
  date: '2026-06-01',
  city: 'Tokyo',
  isTravel: false,
  stops: [
    {
      id: 'stop-1',
      placeId: 'ChIJ1',
      title: 'Senso-ji',
      area: 'Asakusa',
      day: 1,
      time: '08:00',
      durationMin: 90,
      category: 'historic',
      lat: 35.71,
      lon: 139.79,
      priceLevel: 0,
      rating: 4.7,
      weekdayText: [],
      whyForYou: 'Great temple',
      localTip: null,
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    },
    {
      id: 'stop-2',
      placeId: 'ChIJ2',
      title: 'Ueno Park',
      area: 'Ueno',
      day: 1,
      time: '11:00',
      durationMin: 120,
      category: 'park',
      lat: 35.71,
      lon: 139.77,
      priceLevel: 0,
      rating: 4.5,
      weekdayText: [],
      whyForYou: 'Perfect park',
      localTip: null,
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    },
  ],
  messages: [banner],
}

const travelDay: EngineItineraryDay = {
  day: 3,
  date: '2026-06-03',
  city: 'Kyoto',
  isTravel: true,
  stops: [],
  messages: [],
}

describe('ItineraryDayView', () => {
  it('renders all stops', () => {
    render(<ItineraryDayView day={day} onRemoveStop={() => {}} onDismissMessage={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Senso-ji')).toBeTruthy()
    expect(screen.getByText('Ueno Park')).toBeTruthy()
  })

  it('renders engine message banner between stops', () => {
    render(<ItineraryDayView day={day} onRemoveStop={() => {}} onDismissMessage={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Moved Senso-ji to 8am')).toBeTruthy()
  })

  it('renders TravelDayCard for travel days', () => {
    render(<ItineraryDayView day={travelDay} onRemoveStop={() => {}} onDismissMessage={() => {}} onUndo={() => {}} />)
    expect(screen.getByText(/Travel Day/)).toBeTruthy()
  })

  it('calls onRemoveStop with stop id', () => {
    const onRemoveStop = vi.fn()
    render(<ItineraryDayView day={day} onRemoveStop={onRemoveStop} onDismissMessage={() => {}} onUndo={() => {}} />)
    const removeButtons = screen.getAllByLabelText('Remove stop')
    removeButtons[0].click()
    expect(onRemoveStop).toHaveBeenCalledWith('stop-1')
  })

  it('calls onDismissMessage with message id', () => {
    const onDismiss = vi.fn()
    render(<ItineraryDayView day={day} onRemoveStop={() => {}} onDismissMessage={onDismiss} onUndo={() => {}} />)
    screen.getByLabelText('Dismiss').click()
    expect(onDismiss).toHaveBeenCalledWith('msg-1')
  })
})
