import { render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { TravelDayCard } from './TravelDayCard'

afterEach(() => cleanup())

describe('TravelDayCard', () => {
  it('renders travel day with from/to cities', () => {
    render(<TravelDayCard day={3} date="2026-06-03" fromCity="Tokyo" toCity="Kyoto" />)
    expect(screen.getByText('Tokyo → Kyoto')).toBeTruthy()
    expect(screen.getByText(/Travel Day/)).toBeTruthy()
  })

  it('renders date label', () => {
    render(<TravelDayCard day={3} date="2026-06-03" fromCity="Tokyo" toCity="Kyoto" />)
    expect(screen.getByText('Day 3')).toBeTruthy()
  })

  it('renders without toCity (single-city leg)', () => {
    render(<TravelDayCard day={2} date="2026-06-02" fromCity="Tokyo" toCity={null} />)
    expect(screen.getByText('Tokyo')).toBeTruthy()
  })
})
