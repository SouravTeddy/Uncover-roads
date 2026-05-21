import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecentSessions } from './useRecentSessions'

beforeEach(() => {
  localStorage.clear()
})

describe('useRecentSessions', () => {
  it('returns empty sessions when storage is blank', () => {
    const { result } = renderHook(() => useRecentSessions())
    expect(result.current.sessions).toEqual([])
  })

  it('saveSession adds a new city entry', () => {
    const { result } = renderHook(() => useRecentSessions())
    const places = [{ id: '1', title: 'Opera House', _city: 'Sydney' } as never]
    act(() => result.current.saveSession(places, 'Sydney'))
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].city).toBe('Sydney')
    expect(result.current.sessions[0].places).toEqual(places)
  })

  it('saving same city (case-insensitive) replaces the existing entry', () => {
    const { result } = renderHook(() => useRecentSessions())
    const p1 = [{ id: '1', title: 'Opera House' } as never]
    const p2 = [{ id: '2', title: 'Bondi Beach' } as never]
    act(() => result.current.saveSession(p1, 'Sydney'))
    act(() => result.current.saveSession(p2, 'sydney'))
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].places).toEqual(p2)
  })

  it('caps at 3 cities, dropping the oldest when a 4th is added', () => {
    const { result } = renderHook(() => useRecentSessions())
    act(() => result.current.saveSession([], 'Paris'))
    act(() => result.current.saveSession([], 'Tokyo'))
    act(() => result.current.saveSession([], 'Rome'))
    act(() => result.current.saveSession([], 'Sydney'))
    expect(result.current.sessions).toHaveLength(3)
    expect(result.current.sessions.map(s => s.city)).toEqual(['Sydney', 'Rome', 'Tokyo'])
  })

  it('new city is prepended (most recent first)', () => {
    const { result } = renderHook(() => useRecentSessions())
    act(() => result.current.saveSession([], 'Paris'))
    act(() => result.current.saveSession([], 'Tokyo'))
    expect(result.current.sessions[0].city).toBe('Tokyo')
  })

  it('clearSessions wipes all entries', () => {
    const { result } = renderHook(() => useRecentSessions())
    act(() => result.current.saveSession([], 'Paris'))
    act(() => result.current.clearSessions())
    expect(result.current.sessions).toEqual([])
  })

  it('migrates a legacy uncover:lastSession entry on first load', () => {
    const legacy = {
      city: 'Rome',
      places: [{ id: '99', title: 'Colosseum' }],
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('uncover:lastSession', JSON.stringify(legacy))
    const { result } = renderHook(() => useRecentSessions())
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].city).toBe('Rome')
    expect(localStorage.getItem('uncover:lastSession')).toBeNull()
  })
})
