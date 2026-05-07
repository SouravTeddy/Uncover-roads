import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './store';
import type { SavedEvent } from './types';

const mockEvent: SavedEvent = {
  id: 'evt-1',
  title: 'Sumida River Fireworks',
  city: 'Tokyo',
  date: '2026-07-26',
  isAnnual: true,
  venue: 'Asakusa',
  category: 'festival',
  savedAt: '2026-05-06T12:00:00Z',
};

describe('SAVE_EVENT / REMOVE_EVENT', () => {
  it('adds event to savedEvents', () => {
    const state = reducer(initialState, { type: 'SAVE_EVENT', event: mockEvent });
    expect(state.savedEvents).toHaveLength(1);
    expect(state.savedEvents[0].id).toBe('evt-1');
  });

  it('does not duplicate events', () => {
    const s1 = reducer(initialState, { type: 'SAVE_EVENT', event: mockEvent });
    const s2 = reducer(s1, { type: 'SAVE_EVENT', event: mockEvent });
    expect(s2.savedEvents).toHaveLength(1);
  });

  it('removes event by id', () => {
    const s1 = reducer(initialState, { type: 'SAVE_EVENT', event: mockEvent });
    const s2 = reducer(s1, { type: 'REMOVE_EVENT', id: 'evt-1' });
    expect(s2.savedEvents).toHaveLength(0);
  });
});
