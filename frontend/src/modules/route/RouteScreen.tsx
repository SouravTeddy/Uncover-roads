import { useState } from 'react'
import { useAppStore } from '../../shared/store'
import { useItinerary } from './useItinerary'
import { ItineraryDayView } from './ItineraryDayView'

export function computeExtraDays(
  totalDays: number,
  startDate: string | null,
  endDate: string | null,
): number {
  if (!startDate || !endDate) return 0;
  const budgetDays =
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1;
  return Math.max(0, totalDays - budgetDays);
}

const FREE_TIER_LIMIT = 5

export function RouteScreen() {
  const { state, dispatch } = useAppStore()
  const { city, tripContext, userTier, travelStartDate, travelEndDate } = state
  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const {
    engineItinerary,
    pendingRemoveStopId,
    pendingStopTitle,
    confirmationText,
    generationCount,
    requestRemoveStop,
    confirmRemoveStop,
    cancelRemoveStop,
    dismissMessage,
    handleUndo,
  } = useItinerary()

  const days = engineItinerary?.days ?? []
  const extraDays = computeExtraDays(days.length, travelStartDate, travelEndDate)
  const activeDay = days[activeDayIndex] ?? null
  const nextCity = activeDayIndex < days.length - 1 ? days[activeDayIndex + 1]?.city ?? null : null

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col overflow-hidden">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
          className="flex items-center justify-center flex-shrink-0"
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--color-surface)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border-m)',
          }}
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

      {/* Date conflict info bar */}
      {extraDays > 0 && travelStartDate && travelEndDate && (
        <div
          className="mx-4 mt-2 px-4 py-3 rounded-2xl flex items-start gap-3"
          style={{
            background: 'rgba(79,143,171,.08)',
            border: '1px solid rgba(79,143,171,.2)',
          }}
        >
          <span className="ms fill text-[var(--color-sky)] flex-shrink-0 mt-0.5" style={{ fontSize: 16 }}>calendar_today</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-[var(--color-text-2)]">
                Travel dates: {new Date(travelStartDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(travelEndDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(79,143,171,.15)', color: 'var(--color-sky)' }}
              >
                +{extraDays} {extraDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-3)] leading-relaxed">
              Added a travel day for the city hop. Remove places to shorten the trip.
            </p>
          </div>
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
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>

        {!engineItinerary ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-3)] px-8 text-center">
            <span className="ms text-[48px] text-[var(--color-border)]">route</span>
            <p className="text-[14px]">No itinerary yet — add places on the map and tap Build Itinerary</p>
            <button
              onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
              className="px-5 py-2.5 rounded-[12px] bg-[var(--color-primary)] text-white text-[14px] font-heading font-bold"
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
              className="w-full py-3 rounded-[14px] bg-red-500 text-white font-heading font-bold text-[15px] mb-2"
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
