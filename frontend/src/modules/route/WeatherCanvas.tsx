import type React from 'react';

interface Props {
  condition: string;
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

const RAIN_COUNT  = 55;
const SNOW_COUNT  = 40;

export function WeatherCanvas({ condition }: Props) {
  const type = classify(condition);

  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  };

  if (type === 'none') {
    return (
      <div style={base} aria-hidden>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(59,130,246,.07) 0%, transparent 55%)',
        }} />
      </div>
    );
  }

  if (type === 'sunny') {
    return (
      <div style={base} aria-hidden>
        {/* Warm sky wash */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(175deg, rgba(251,146,60,.13) 0%, rgba(251,191,36,.08) 35%, transparent 70%)',
        }} />
        {/* Sun glow rings */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: 180 + i * 110,
            height: 180 + i * 110,
            top: -(80 + i * 45),
            left: '50%',
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(251,191,36,${0.18 - i * 0.04}) 0%, transparent 70%)`,
            animation: `weather-pulse ${4 + i * 1.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.8}s`,
          }} />
        ))}
        {/* Light rays */}
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: 1.5,
            height: '55%',
            top: 0,
            left: '50%',
            transformOrigin: 'top center',
            transform: `translateX(-50%) rotate(${(i - 2) * 18}deg)`,
            background: 'linear-gradient(to bottom, rgba(251,191,36,.18), transparent)',
            animation: `weather-pulse ${5 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.6}s`,
          }} />
        ))}
        {/* Bottom warmth */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(251,146,60,.06) 0%, transparent 50%)',
        }} />
      </div>
    );
  }

  if (type === 'rain') {
    return (
      <div style={base} aria-hidden>
        {/* Storm wash */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(175deg, rgba(30,58,138,.25) 0%, rgba(15,23,42,.18) 60%, transparent 100%)',
        }} />
        {Array.from({ length: RAIN_COUNT }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 1 + (i % 2) * 0.5,
            height: 16 + (i % 6) * 5,
            left: `${(i / RAIN_COUNT) * 108 - 4}%`,
            top: `-${5 + (i % 8) * 3}%`,
            background: `rgba(147,197,253,${0.35 + (i % 3) * 0.1})`,
            borderRadius: 2,
            animation: `weather-fall-full ${0.8 + (i % 5) * 0.18}s linear infinite`,
            animationDelay: `${(i / RAIN_COUNT) * 1.5}s`,
            transform: 'rotate(-14deg)',
          }} />
        ))}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '15%',
          background: 'linear-gradient(to top, rgba(59,130,246,.08), transparent)',
        }} />
      </div>
    );
  }

  if (type === 'thunder') {
    return (
      <div style={base} aria-hidden>
        {/* Purple storm */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(175deg, rgba(67,20,120,.28) 0%, rgba(30,10,60,.18) 55%, transparent 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(200,180,255,.08)',
          animation: 'weather-flicker 3.5s ease-in-out infinite',
        }} />
        {Array.from({ length: RAIN_COUNT }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 1.5 + (i % 2) * 0.5,
            height: 18 + (i % 5) * 6,
            left: `${(i / RAIN_COUNT) * 110 - 5}%`,
            top: `-${5 + (i % 6) * 3}%`,
            background: `rgba(167,139,250,${0.3 + (i % 3) * 0.08})`,
            borderRadius: 2,
            animation: `weather-fall-full ${0.65 + (i % 4) * 0.15}s linear infinite`,
            animationDelay: `${(i / RAIN_COUNT) * 1.2}s`,
            transform: 'rotate(-16deg)',
          }} />
        ))}
        <svg
          style={{ position: 'absolute', top: '8%', left: '55%', opacity: 0.18, animation: 'weather-flicker 3.5s ease-in-out infinite', animationDelay: '0.3s' }}
          width="28" height="64" viewBox="0 0 28 64" fill="none"
        >
          <path d="M18 0L0 36h12L8 64l20-38H16L18 0Z" fill="#e9d5ff" />
        </svg>
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div style={base} aria-hidden>
        {/* Cold sky */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(175deg, rgba(186,230,253,.10) 0%, rgba(219,234,254,.06) 40%, transparent 75%)',
        }} />
        {Array.from({ length: SNOW_COUNT }, (_, i) => {
          const size = 3 + (i % 5);
          return (
            <div key={i} style={{
              position: 'absolute',
              width: size,
              height: size,
              left: `${(i / SNOW_COUNT) * 105 - 2}%`,
              top: `-${3 + (i % 6) * 2}%`,
              borderRadius: '50%',
              background: `rgba(255,255,255,${0.5 + (i % 3) * 0.15})`,
              animation: `weather-fall-full ${2.2 + (i % 6) * 0.45}s linear infinite`,
              animationDelay: `${(i / SNOW_COUNT) * 3.5}s`,
              filter: 'blur(0.4px)',
            }} />
          );
        })}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(186,230,253,.08) 0%, transparent 65%)',
        }} />
      </div>
    );
  }

  // cloud / overcast / fog / mist
  return (
    <div style={base} aria-hidden>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(175deg, rgba(71,85,105,.18) 0%, rgba(51,65,85,.10) 50%, transparent 80%)',
      }} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: '160%',
          height: `${22 + i * 12}%`,
          left: '-30%',
          top: `${i * 14}%`,
          background: `linear-gradient(to bottom, rgba(148,163,184,${0.07 + i * 0.025}) 0%, transparent 100%)`,
          animation: `weather-drift ${9 + i * 4}s ease-in-out infinite alternate`,
          animationDelay: `${i * 2.5}s`,
          borderRadius: '50%',
        }} />
      ))}
    </div>
  );
}
