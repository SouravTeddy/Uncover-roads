import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuideBulb } from './GuideBulb'
import type { GuideMessage } from './useGuideMessages'

function makeMsg(overrides: Partial<GuideMessage> = {}): GuideMessage {
  return { id: 'area-1', kind: 'area', text: 'Explore Tokyo', timestamp: 1000, ...overrides }
}

describe('GuideBulb', () => {
  it('renders the Guide button', () => {
    render(<GuideBulb messages={[]} hasUnread={false} onRead={() => {}} />)
    expect(screen.getByRole('button', { name: /Guide/i })).toBeTruthy()
  })

  it('does not render dot when no unread messages', () => {
    render(<GuideBulb messages={[]} hasUnread={false} onRead={() => {}} />)
    expect(screen.queryByTestId('guide-dot')).toBeNull()
  })

  it('renders dot when hasUnread is true', () => {
    const msg = makeMsg()
    render(<GuideBulb messages={[msg]} hasUnread={true} onRead={() => {}} />)
    expect(screen.getByTestId('guide-dot')).toBeTruthy()
  })

  it('opens panel and shows message text when bulb clicked', () => {
    const msg = makeMsg()
    render(<GuideBulb messages={[msg]} hasUnread={true} onRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Guide/i }))
    expect(screen.getByText(msg.text)).toBeTruthy()
  })

  it('hides dot when panel is open', () => {
    const msg = makeMsg()
    render(<GuideBulb messages={[msg]} hasUnread={true} onRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Guide/i }))
    expect(screen.queryByTestId('guide-dot')).toBeNull()
  })

  it('calls onRead when panel opens', () => {
    const onRead = vi.fn()
    const msg = makeMsg()
    render(<GuideBulb messages={[msg]} hasUnread={true} onRead={onRead} />)
    fireEvent.click(screen.getByRole('button', { name: /Guide/i }))
    expect(onRead).toHaveBeenCalled()
  })

  it('closes panel when "Close panel" button clicked', () => {
    const msg = makeMsg()
    render(<GuideBulb messages={[msg]} hasUnread={true} onRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Guide/i }))
    expect(screen.getByText(msg.text)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Close panel/i }))
    expect(screen.queryByText(msg.text)).toBeNull()
  })

  it('shows all messages in history — newest first', () => {
    const msgs: GuideMessage[] = [
      makeMsg({ id: 'm1', text: 'First message', timestamp: 1000 }),
      makeMsg({ id: 'm2', kind: 'exploring', text: 'Second message', timestamp: 2000 }),
    ]
    render(<GuideBulb messages={msgs} hasUnread={true} onRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Guide/i }))
    const body = document.body.textContent ?? ''
    const firstIdx = body.indexOf('First message')
    const secondIdx = body.indexOf('Second message')
    // Newer (timestamp 2000) should appear before older (timestamp 1000)
    expect(secondIdx).toBeLessThan(firstIdx)
  })

  it('shows "No suggestions yet" when panel opened with no messages', () => {
    render(<GuideBulb messages={[]} hasUnread={false} onRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Guide/i }))
    expect(screen.getByText(/No suggestions yet/i)).toBeTruthy()
  })
})
