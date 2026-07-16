import { useState, useCallback } from 'react'
import { useAppStore, getGenerationAccess } from '../../shared/store'

/** Pure helper — exported for testing */
export function parseRemoveConfirmationText(placeName: string): string {
  return `Remove ${placeName}? This will rebuild your itinerary.`
}

export function useItinerary() {
  const { state, dispatch } = useAppStore()
  const { engineItinerary, engineMessages, generationCount, userTier, packTripsRemaining } = state
  const [pendingRemoveStopId, setPendingRemoveStopId] = useState<string | null>(null)

  const access = getGenerationAccess(userTier, generationCount, packTripsRemaining)

  const requestRemoveStop = useCallback((stopId: string) => {
    setPendingRemoveStopId(stopId)
  }, [])

  const confirmRemoveStop = useCallback(() => {
    if (!pendingRemoveStopId || !engineItinerary) {
      setPendingRemoveStopId(null)
      return
    }
    const allStops = engineItinerary.days.flatMap(d => d.stops)
    const stop = allStops.find(s => s.id === pendingRemoveStopId)
    if (!stop) {
      setPendingRemoveStopId(null)
      return
    }
    const updatedPlaces = state.selectedPlaces.filter(p => p.id !== stop.placeId)
    dispatch({ type: 'SET_SELECTED_PLACES', places: updatedPlaces })
    dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: null })
    dispatch({ type: 'CLEAR_ENGINE_MESSAGES' })
    setPendingRemoveStopId(null)
  }, [pendingRemoveStopId, engineItinerary, state.selectedPlaces, dispatch])

  const cancelRemoveStop = useCallback(() => {
    setPendingRemoveStopId(null)
  }, [])

  const dismissMessage = useCallback((messageId: string) => {
    dispatch({ type: 'DISMISS_ENGINE_MESSAGE', id: messageId })
  }, [dispatch])

  const handleUndo = useCallback((undoAction: string) => {
    console.info('[engine] undo requested:', undoAction)
  }, [])

  const pendingStopTitle = pendingRemoveStopId
    ? engineItinerary?.days.flatMap(d => d.stops).find(s => s.id === pendingRemoveStopId)?.title ?? null
    : null

  return {
    engineItinerary,
    engineMessages,
    pendingRemoveStopId,
    pendingStopTitle,
    confirmationText: pendingStopTitle ? parseRemoveConfirmationText(pendingStopTitle) : null,
    generationCount,
    canGenerate: access.allowed,
    requestRemoveStop,
    confirmRemoveStop,
    cancelRemoveStop,
    dismissMessage,
    handleUndo,
  }
}
