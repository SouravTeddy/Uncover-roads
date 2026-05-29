import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiDisclaimerSheet } from './AiDisclaimerSheet';

const LS_KEY = 'ur_ai_disclaimer_shown';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AiDisclaimerSheet', () => {
  it('renders when disclaimer has not been shown', () => {
    render(<AiDisclaimerSheet onContinue={() => {}} />);
    expect(screen.getByText('A heads up')).toBeInTheDocument();
  });

  it('does not render when disclaimer was already shown', () => {
    localStorage.setItem(LS_KEY, '1');
    const onContinue = vi.fn();
    render(<AiDisclaimerSheet onContinue={onContinue} />);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(screen.queryByText('A heads up')).toBeNull();
  });

  it('Continue button is disabled until checkbox is ticked', () => {
    render(<AiDisclaimerSheet onContinue={() => {}} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('Continue button enables after ticking checkbox', () => {
    render(<AiDisclaimerSheet onContinue={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toHaveProperty('disabled', false);
  });

  it('persists to localStorage and calls onContinue when submitted', () => {
    const onContinue = vi.fn();
    render(<AiDisclaimerSheet onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(localStorage.getItem(LS_KEY)).toBe('1');
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
