interface Props {
  day: number
  date: string
  fromCity: string
  toCity: string | null
}

export function TravelDayCard({ day, date: _date, fromCity, toCity }: Props) {
  return (
    <div className="mx-4 my-3 rounded-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center flex-shrink-0">
        <span className="ms fill text-[var(--color-primary)] text-[22px]">flight</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
          <span>Day {day}</span>
          <span> · Travel Day</span>
        </p>
        <p className="text-[15px] font-bold text-[var(--color-text-1)] mt-0.5 truncate">
          {toCity ? `${fromCity} → ${toCity}` : fromCity}
        </p>
        <p className="text-[12px] text-[var(--color-text-3)] mt-0.5">
          No stops scheduled — travel day
        </p>
      </div>
    </div>
  )
}
