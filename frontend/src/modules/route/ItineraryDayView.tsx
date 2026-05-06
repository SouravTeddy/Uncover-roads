import type { EngineItineraryDay } from '../../shared/types'
import { ItineraryStopCard } from './ItineraryStopCard'
import { EngineMessageBanner } from './EngineMessageBanner'
import { TravelDayCard } from './TravelDayCard'

interface Props {
  day: EngineItineraryDay
  nextCity?: string | null
  onRemoveStop: (stopId: string) => void
  onDismissMessage: (messageId: string) => void
  onUndo: (action: string) => void
}

export function ItineraryDayView({ day, nextCity, onRemoveStop, onDismissMessage, onUndo }: Props) {
  if (day.isTravel) {
    return (
      <TravelDayCard
        day={day.day}
        date={day.date}
        fromCity={day.city}
        toCity={nextCity ?? null}
      />
    )
  }

  return (
    <div>
      {day.messages.map(msg => (
        <EngineMessageBanner
          key={msg.id}
          message={msg}
          onDismiss={onDismissMessage}
          onUndo={onUndo}
        />
      ))}
      {day.stops.map((stop, idx) => (
        <ItineraryStopCard
          key={stop.id}
          stop={stop}
          stopNumber={idx + 1}
          onRemove={onRemoveStop}
        />
      ))}
    </div>
  )
}
