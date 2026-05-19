import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockerSheet } from './BlockerSheet'
import type { HardBlocker } from './useHardBlockers'

const blockers: HardBlocker[] = [
  { placeId: '1', placeTitle: 'Old Town Museum', reason: 'Closed on Thursdays · your trip includes Thursday 21 May' },
  { placeId: '2', placeTitle: 'Jazz Bar', reason: 'Permanently closed' },
]

describe('BlockerSheet', () => {
  it('renders header with "2 conflict" text (count line)', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    expect(screen.getByText(/2 conflicts before you build/i)).toBeTruthy()
  })

  it('renders place name "Old Town Museum"', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    expect(screen.getByText('Old Town Museum')).toBeTruthy()
  })

  it('renders place name "Jazz Bar"', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    expect(screen.getByText('Jazz Bar')).toBeTruthy()
  })

  it('renders reason "Closed on Thursdays"', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    expect(screen.getByText(/Closed on Thursdays/)).toBeTruthy()
  })

  it('renders reason "Permanently closed"', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    expect(screen.getByText('Permanently closed')).toBeTruthy()
  })

  it('clicking "I\'ll fix it" button calls onFix', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    const button = screen.getByLabelText(/I'll fix it/i)
    fireEvent.click(button)
    expect(onFix).toHaveBeenCalled()
  })

  it('clicking "Build anyway" button calls onBuildAnyway', () => {
    const onFix = vi.fn()
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={onBuildAnyway} />)
    const button = screen.getByLabelText(/Build anyway/i)
    fireEvent.click(button)
    expect(onBuildAnyway).toHaveBeenCalled()
  })
})
