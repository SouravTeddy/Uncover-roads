import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuideBulb } from './GuideBulb'
import type { GuideMessage } from './useGuideMessages'

const areaMessage: GuideMessage = { id: 'area', kind: 'area', text: 'Explore the best of Tokyo' }
const conflictMessage: GuideMessage = { id: 'conflict', kind: 'conflict', text: 'We found a conflict' }

describe('GuideBulb', () => {
  it('renders a button with aria-label "Guide"', () => {
    render(<GuideBulb message={null} onConflictTap={() => {}} />)
    const button = screen.getByRole('button', { name: /Guide/i })
    expect(button).toBeTruthy()
  })

  it('does not render dot when message is null', () => {
    render(<GuideBulb message={null} onConflictTap={() => {}} />)
    const dot = screen.queryByTestId('guide-dot')
    expect(dot).toBeNull()
  })

  it('renders dot with data-testid="guide-dot" when message is provided', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    const dot = screen.getByTestId('guide-dot')
    expect(dot).toBeTruthy()
  })

  it('opens panel and shows message text when bulb button is clicked', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    const button = screen.getByRole('button', { name: /Guide/i })
    fireEvent.click(button)
    expect(screen.getByText(areaMessage.text)).toBeTruthy()
  })

  it('hides dot when panel is open', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    const button = screen.getByRole('button', { name: /Guide/i })
    fireEvent.click(button)
    const dot = screen.queryByTestId('guide-dot')
    expect(dot).toBeNull()
  })

  it('calls onConflictTap when "View conflict details" button is clicked', () => {
    const onConflictTap = vi.fn()
    render(<GuideBulb message={conflictMessage} onConflictTap={onConflictTap} />)
    const button = screen.getByRole('button', { name: /Guide/i })
    fireEvent.click(button)
    const detailsButton = screen.getByRole('button', { name: /View conflict details/i })
    fireEvent.click(detailsButton)
    expect(onConflictTap).toHaveBeenCalled()
  })

  it('closes panel when "Close panel" button is clicked', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    const button = screen.getByRole('button', { name: /Guide/i })
    fireEvent.click(button)
    expect(screen.getByText(areaMessage.text)).toBeTruthy()
    const closeButton = screen.getByRole('button', { name: /Close panel/i })
    fireEvent.click(closeButton)
    expect(screen.queryByText(areaMessage.text)).toBeNull()
  })
})
