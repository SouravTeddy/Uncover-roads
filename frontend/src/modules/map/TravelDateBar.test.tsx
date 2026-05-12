import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TravelDateBar } from './TravelDateBar'

describe('TravelDateBar', () => {
  it('renders null when no dates set', () => {
    const { container } = render(
      <TravelDateBar startDate={null} endDate={null} cities={[]} onTap={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('formats date range correctly', () => {
    render(
      <TravelDateBar startDate="2026-06-01" endDate="2026-06-08" cities={['Tokyo']} onTap={() => {}} />
    )
    expect(screen.getByText(/Jun 1/)).toBeTruthy()
    expect(screen.getByText(/Jun 8/)).toBeTruthy()
  })

  it('shows day count', () => {
    render(
      <TravelDateBar startDate="2026-06-01" endDate="2026-06-08" cities={['Tokyo']} onTap={() => {}} />
    )
    expect(screen.getByText(/8 days/)).toBeTruthy()
  })

  it('shows city count for multi-city', () => {
    render(
      <TravelDateBar startDate="2026-06-01" endDate="2026-06-08" cities={['Tokyo', 'Kyoto']} onTap={() => {}} />
    )
    expect(screen.getByText(/2 cities/)).toBeTruthy()
  })
})
