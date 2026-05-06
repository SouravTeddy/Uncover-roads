import { useState } from 'react'
import { useAppStore } from '../../shared/store'
import { useItinerary } from './useItinerary'
import { ItineraryDayView } from './ItineraryDayView'

const FREE_TIER_LIMIT = 5

export function RouteScreen() {
  const { state, dispatch } = useAppStore()
  const { city, tripContext, userTier } = state
  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const {
    engineItinerary,
    pendingRemoveStopId,
    pendingStopTitle,
    confirmationText,
    generationCount,
    canGenerate: _canGenerate,
    requestRemoveStop,
    confirmRemoveStop,
    cancelRemoveStop,
    dismissMessage,
    handleUndo,
  } = useItinerary()

  const days = engineItinerary?.days ?? []
  const activeDay = days[activeDayIndex] ?? null
  const nextCity = activeDayIndex < days.length - 1 ? days[activeDayIndex + 1]?.city ?? null : null

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col overflow-hidden">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
          className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          aria-label="Back"
        >
          <span className="ms text-[var(--color-text-2)]">arrow_back</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)] truncate">
            {city || 'Itinerary'}
          </div>
          <div className="text-[11px] text-[var(--color-text-3)]">
            {tripContext.days} {tripContext.days === 1 ? 'day' : 'days'}
          </div>
        </div>

        {engineItinerary && (
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
            className="text-[13px] font-semibold text-[var(--color-primary)] flex items-center gap-1"
          >
            <span className="ms text-[15px]">edit</span>
            Edit trip
          </button>
        )}
      </div>

      {/* Generation counter (free tier only) */}
      {userTier === 'free' && engineItinerary && (
        <div className="px-4 py-2 flex justify-end">
          <span className="text-[11px] text-[var(--color-text-3)]">
            {generationCount} of {FREE_TIER_LIMIT} free itineraries used
          </span>
        </div>
      )}

      {/* Day tab strip */}
      {days.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-b border-[var(--color-divider)]">
          {days.map((day, idx) => (
            <button
              key={day.day}
              onClick={() => setActiveDayIndex(idx)}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
                activeDayIndex === idx
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-2)] border border-[var(--color-border)]',
              ].join(' ')}
            >
              {day.isTravel ? '✈️ ' : ''}Day {day.day}
            </button>
          ))}
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto pb-8">

        {!engineItinerary ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-3)] px-8 text-center">
            <span className="ms text-[48px] text-[var(--color-border)]">route</span>
            <p className="text-[14px]">No itinerary yet — add places on the map and tap Build Itinerary</p>
            <button
              onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
              className="px-5 py-2.5 rounded-[12px] bg-[var(--color-primary)] text-white text-[14px] font-semibold"
            >
              Go to map
            </button>
          </div>
        ) : activeDay ? (
          <>
            <div className="pt-3" />
            <ItineraryDayView
              day={activeDay}
              nextCity={nextCity}
              onRemoveStop={requestRemoveStop}
              onDismissMessage={dismissMessage}
              onUndo={handleUndo}
            />
          </>
        ) : null}

        {/* Legal footer */}
        {engineItinerary && (
          <p className="text-[10px] text-[var(--color-text-3)] text-center px-6 mt-4 leading-relaxed">
            Uncover Roads helps you discover places — always check local conditions, official travel advisories, and your own comfort before visiting any location.
          </p>
        )}
      </div>

      {/* Remove confirmation snap */}
      {pendingRemoveStopId && (
        <div
          className="absolute inset-0 z-30 bg-black/50 flex items-end"
          onClick={cancelRemoveStop}
        >
          <div
            className="w-full bg-[var(--color-surface)] rounded-t-[20px] px-6 py-6"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold text-[var(--color-text-1)] text-center mb-4">
              {confirmationText ?? `Remove ${pendingStopTitle}?`}
            </p>
            <button
              onClick={confirmRemoveStop}
              className="w-full py-3 rounded-[14px] bg-red-500 text-white font-semibold text-[15px] mb-2"
            >
              Remove &amp; rebuild
            </button>
            <button
              onClick={cancelRemoveStop}
              className="w-full py-3 rounded-[14px] border border-[var(--color-border)] text-[var(--color-text-2)] font-semibold text-[15px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
