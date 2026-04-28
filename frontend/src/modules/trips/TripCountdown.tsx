/** Returns whole days until travelDate from today. Negative = past. Null = no date. */
export function getDaysUntilTravel(travelDate: string | null): number | null {
  if (!travelDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(travelDate + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

export function getCountdownColour(days: number): string {
  if (days === 0) return '#22c55e';   // green — travel day
  if (days <= 7)  return '#f59e0b';   // amber — within a week
  return '#6366f1';                    // indigo — further out
}

interface Props {
  travelDate: string | null;
}

export function TripCountdown({ travelDate }: Props) {
  const days = getDaysUntilTravel(travelDate);

  // Don't render if no date, already past, or more than 365 days away
  if (days === null || days < 0 || days > 365) return null;

  const colour = getCountdownColour(days);

  let label: string;
  if (days === 0) label = 'Today · Have you arrived?';
  else if (days === 1) label = 'Tomorrow';
  else label = `${days} days until your trip`;

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="ms fill text-sm flex-shrink-0" style={{ color: colour }}>schedule</span>
      <span className="text-xs font-medium" style={{ color: colour }}>{label}</span>
    </div>
  );
}
