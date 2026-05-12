import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => cleanup())
import { EngineMessageBanner } from './EngineMessageBanner'
import type { EngineMessage } from '../../shared/types'

const msg: EngineMessage = {
  id: 'msg-1',
  type: 'resequence',
  what: 'Moved Senso-ji to 8am',
  why: 'It closes at 5pm — you\'d arrive at 4:30',
  consequence: 'You now reach Ueno with 3 hours to spare',
  dismissable: true,
}

describe('EngineMessageBanner', () => {
  it('renders all three message lines', () => {
    render(<EngineMessageBanner message={msg} onDismiss={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Moved Senso-ji to 8am')).toBeTruthy()
    expect(screen.getByText(/It closes at 5pm/)).toBeTruthy()
    expect(screen.getByText(/You now reach Ueno/)).toBeTruthy()
  })

  it('calls onDismiss when × is tapped', () => {
    const onDismiss = vi.fn()
    render(<EngineMessageBanner message={msg} onDismiss={onDismiss} onUndo={() => {}} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledWith('msg-1')
  })

  it('shows Undo button when undo_action is present', () => {
    const withUndo: EngineMessage = { ...msg, undo_action: 'swap_back_senso_ji' }
    const onUndo = vi.fn()
    render(<EngineMessageBanner message={withUndo} onDismiss={() => {}} onUndo={onUndo} />)
    fireEvent.click(screen.getByText('Undo'))
    expect(onUndo).toHaveBeenCalledWith('swap_back_senso_ji')
  })

  it('hides Undo button when no undo_action', () => {
    render(<EngineMessageBanner message={msg} onDismiss={() => {}} onUndo={() => {}} />)
    expect(screen.queryByText('Undo')).toBeNull()
  })

  it('does not render dismiss button when dismissable is false', () => {
    const nonDismissable: EngineMessage = { ...msg, dismissable: false }
    render(<EngineMessageBanner message={nonDismissable} onDismiss={() => {}} onUndo={() => {}} />)
    expect(screen.queryByLabelText('Dismiss')).toBeNull()
  })
})
