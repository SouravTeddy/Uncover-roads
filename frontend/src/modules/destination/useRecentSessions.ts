import { useState } from 'react'
import type { Place } from '../../shared/types'

export interface RecentSession {
  city: string
  places: Place[]
  savedAt: string
}

const KEY = 'uncover:recentSessions'
const LEGACY_KEY = 'uncover:lastSession'
const MAX_SESSIONS = 3

function readSessions(): RecentSession[] {
  try {
    // One-time migration from old single-session key
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const old = JSON.parse(legacy) as { city: string; places: Place[]; savedAt: string }
      localStorage.removeItem(LEGACY_KEY)
      if (old.city && Array.isArray(old.places)) {
        const migrated: RecentSession[] = [{ city: old.city, places: old.places, savedAt: old.savedAt }]
        localStorage.setItem(KEY, JSON.stringify(migrated))
        return migrated
      }
    }
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentSession[]
  } catch {
    return []
  }
}

function writeSessions(sessions: RecentSession[]): void {
  localStorage.setItem(KEY, JSON.stringify(sessions))
}

export function saveSessionMulti(places: Place[], city: string): void {
  const current = readSessions().filter(s => s.city.toLowerCase() !== city.toLowerCase())
  const updated: RecentSession[] = [
    { city, places, savedAt: new Date().toISOString() },
    ...current,
  ].slice(0, MAX_SESSIONS)
  writeSessions(updated)
}

export function useRecentSessions() {
  const [sessions, setSessions] = useState<RecentSession[]>(() => readSessions())

  function saveSession(places: Place[], city: string): void {
    saveSessionMulti(places, city)
    setSessions(readSessions())
  }

  function clearSessions(): void {
    localStorage.removeItem(KEY)
    setSessions([])
  }

  return { sessions, saveSession, clearSessions }
}
