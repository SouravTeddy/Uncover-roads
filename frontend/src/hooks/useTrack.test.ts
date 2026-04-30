import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTrack } from './useTrack'

// Mock supabase
vi.mock('../shared/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
  },
}))

describe('useTrack', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    )
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('calls POST /api/events with correct shape', async () => {
    const { result } = renderHook(() => useTrack())
    await act(async () => {
      result.current.track('pin_saved', { place_id: 'abc' })
      await new Promise(r => setTimeout(r, 10))
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8000/api/events')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body.event_type).toBe('pin_saved')
    expect(body.payload).toEqual({ place_id: 'abc' })
    expect(typeof body.session_id).toBe('string')
  })

  it('does not throw when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useTrack())
    await expect(
      act(async () => {
        result.current.track('pin_saved', {})
        await new Promise(r => setTimeout(r, 10))
      })
    ).resolves.not.toThrow()
  })

  it('does nothing when no session', async () => {
    const { supabase } = await import('../shared/supabase')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })
    const { result } = renderHook(() => useTrack())
    await act(async () => {
      result.current.track('pin_saved', {})
      await new Promise(r => setTimeout(r, 10))
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
