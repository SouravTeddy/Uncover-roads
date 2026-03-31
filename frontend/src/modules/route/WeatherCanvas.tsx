import type React from 'react';

interface Props {
  condition: string;
  /** Pass a pixel number for a fixed-height strip, or omit for full-screen overlay */
  height?: number;
}

type WeatherType = 'sunny' | 'rain' | 'cloud' | 'snow' | 'thunder' | 'none';

function classify(condition: string): WeatherType {
  const c = condition.toLowerCase();
  if (/thunder|storm/.test(c)) return 'thunder';
  if (/rain|drizzle|shower/.test(c)) return 'rain';
  if (/snow|blizzard|sleet/.test(c)) return 'snow';
  if (/cloud|overcast|fog|mist|haze/.test(c)) return 'cloud';
  if (/sun|clear|fair|bright/.test(c)) return 'sunny';
  return 'none';
}

const DROP_COUNT = 18;
const SNOW_COUNT = 24;

export function WeatherCanvas({ condition, height }: Props) {
  const type = classify(condition);

  // When no height given, canvas stretches to fill parent (use absolute inset-0)
  const sizeStyle: React.CSSProperties = height != null
    ? { height }
    : { top: 0, left: 0, right: 0, bottom: 0 };

  if (type === 'none') {
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          ...sizeStyle,
          background: 'linear-gradient(to bottom, rgba(59,130,246,.06) 0%, transparent 50%)',
        }}
        aria-hidden
      />
    );
  }

  if (type === 'sunny') {
    return (
      <div
        className="absolute pointer-events-none overflow-hidden"
        style={sizeStyle}
        aria-hidden
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 220 + i * 70,
              height: 220 + i * 70,
              top: -90 - i * 30,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle, rgba(251,191,36,.16) 0%, transparent 70%)',
              animation: `weather-pulse ${4 + i}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(251,191,36,.06) 0%, transparent 60%)' }}
        />
      </div>
    );
  }

  if (type === 'rain' || type === 'thunder') {
    return (
      <div
        className="absolute pointer-events-none overflow-hidden"
        style={sizeStyle}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background: type === 'thunder'
              ? 'linear-gradient(to bottom, rgba(99,102,241,.1) 0%, transparent 70%)'
              : 'linear-gradient(to bottom, rgba(59,130,246,.08) 0%, transparent 70%)',
          }}
        />
        {type === 'thunder' && (
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(255,255,255,.12)',
              animation: 'weather-flicker 3s ease-in-out infinite',
            }}
          />
        )}
        {Array.from({ length: DROP_COUNT }, (_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: 1.5,
              height: 12 + (i % 5) * 4,
              left: `${(i / DROP_COUNT) * 105}%`,
              top: `-${(i % 3) * 10}%`,
              background: 'rgba(147,197,253,.45)',
              borderRadius: 2,
              animation: `weather-fall ${1.1 + (i % 4) * 0.25}s linear infinite`,
              animationDelay: `${(i / DROP_COUNT) * 2}s`,
              transform: 'rotate(-12deg)',
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div
        className="absolute pointer-events-none overflow-hidden"
        style={sizeStyle}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(226,232,240,.07) 0%, transparent 70%)' }}
        />
        {Array.from({ length: SNOW_COUNT }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3 + (i % 4),
              height: 3 + (i % 4),
              left: `${(i / SNOW_COUNT) * 100}%`,
              top: 0,
              background: 'rgba(255,255,255,.6)',
              animation: `weather-fall ${2.5 + (i % 5) * 0.4}s linear infinite`,
              animationDelay: `${(i / SNOW_COUNT) * 3}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // cloud / overcast / fog
  return (
    <div
      className="absolute pointer-events-none overflow-hidden"
      style={sizeStyle}
      aria-hidden
    >
      {[0, 1].map(i => (
        <div
          key={i}
          className="absolute"
          style={{
            width: '120%',
            height: '100%',
            left: '-10%',
            background: `linear-gradient(to bottom, rgba(148,163,184,${0.06 + i * 0.04}) 0%, transparent 70%)`,
            animation: `weather-drift ${8 + i * 3}s ease-in-out infinite alternate`,
            animationDelay: `${i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
