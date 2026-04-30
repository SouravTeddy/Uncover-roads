import { useCallback } from 'react'
import { supabase } from '../shared/supabase'

// Stable session ID for this browser session — survives re-renders
const SESSION_ID = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

export function useTrack() {
  const track = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (!token) return

        fetch(`${import.meta.env.VITE_API_URL}/api/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event_type: eventType,
            session_id: SESSION_ID,
            payload,
          }),
        }).catch(() => {}) // fire and forget — never block the UI
      })
    },
    []
  )

  return { track }
}
