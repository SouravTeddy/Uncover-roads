import type React from 'react';
import type { ReelDayDividerCard } from './types';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDate(isoDate: string): string {
  // Parse "YYYY-MM-DD" without Date constructor to avoid timezone drift
  const [year, month, dayOfMonth] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, dayOfMonth);
  const dayName = DAYS[d.getDay()];
  const monthName = MONTHS[d.getMonth()];
  return `${dayName}, ${String(dayOfMonth).padStart(2, '0')} ${monthName}`;
}

interface Props {
  card: ReelDayDividerCard;
  active: boolean;
}

export function ReelDayDividerCard({ card, active }: Props) {
  const anim = (delay: number): React.CSSProperties => ({
    animation: active ? `fadeUp .5s ${delay}s both` : 'none',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100svh',
        scrollSnapAlign: 'start',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #0c1018 0%, #141820 50%, #0e1410 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Radial glow overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'radial-gradient(ellipse 200px 300px at 50% 40%, rgba(79,143,171,.07), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Large background day number watermark */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 2,
          fontSize: 88,
          fontWeight: 800,
          color: 'rgba(255,255,255,.06)',
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        DAY {card.day}
      </div>

      {/* Content block */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '0 28px 100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {/* Divider line */}
        <div
          style={{
            width: 40,
            height: 1,
            background: 'rgba(56,189,248,.4)',
            marginBottom: 20,
            ...anim(0.05),
          }}
        />

        {/* Date label */}
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            color: '#38bdf8',
            marginBottom: 12,
            textTransform: 'uppercase',
            ...anim(0.12),
          }}
        >
          {formatDate(card.date)}
        </div>

        {/* City name */}
        <div
          style={{
            fontSize: 42,
            fontFamily: 'var(--font-heading)',
            color: '#ffffff',
            fontWeight: 600,
            lineHeight: 1.1,
            marginBottom: 14,
            ...anim(0.22),
          }}
        >
          {card.city}
        </div>

        {/* Stop count */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-3)',
            ...anim(0.34),
          }}
        >
          {card.stopCount} stops planned
        </div>

        {/* Swipe hint */}
        <div
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,.25)',
            marginTop: 20,
            ...anim(0.46),
          }}
        >
          Swipe to explore →
        </div>
      </div>
    </div>
  );
}
