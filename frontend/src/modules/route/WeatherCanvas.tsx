interface Props {
  condition: string;
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

const DROP_COUNT = 14;
const SNOW_COUNT = 20;

export function WeatherCanvas({ condition, height = 220 }: Props) {
  const type = classify(condition);

  if (type === 'none') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height,
          background: 'linear-gradient(to bottom, rgba(59,130,246,.08) 0%, transparent 100%)',
        }}
        aria-hidden
      />
    );
  }

  if (type === 'sunny') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
        style={{ height }}
        aria-hidden
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 200 + i * 60,
              height: 200 + i * 60,
              top: -80 - i * 30,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle, rgba(251,191,36,.18) 0%, transparent 70%)',
              animation: `weather-pulse ${4 + i}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(251,191,36,.07) 0%, transparent 100%)' }}
        />
      </div>
    );
  }

  if (type === 'rain' || type === 'thunder') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
        style={{ height }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background: type === 'thunder'
              ? 'linear-gradient(to bottom, rgba(99,102,241,.12) 0%, transparent 100%)'
              : 'linear-gradient(to bottom, rgba(59,130,246,.1) 0%, transparent 100%)',
          }}
        />
        {type === 'thunder' && (
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(255,255,255,.15)',
              animation: 'weather-flicker 3s ease-in-out infinite',
            }}
          />
        )}
        {Array.from({ length: DROP_COUNT }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 1.5,
              height: 10 + Math.random() * 8,
              left: `${(i / DROP_COUNT) * 100 + Math.random() * 5}%`,
              top: 0,
              background: 'rgba(147,197,253,.55)',
              animation: `weather-fall ${1.2 + Math.random() * 0.8}s linear infinite`,
              animationDelay: `${(i / DROP_COUNT) * 1.5}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
        style={{ height }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(226,232,240,.08) 0%, transparent 100%)' }}
        />
        {Array.from({ length: SNOW_COUNT }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 3,
              height: 4 + Math.random() * 3,
              left: `${Math.random() * 100}%`,
              top: 0,
              background: 'rgba(255,255,255,.65)',
              animation: `weather-fall ${2.5 + Math.random() * 1.5}s linear infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // cloud / overcast / fog
  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
      style={{ height }}
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
            background: `linear-gradient(to bottom, rgba(148,163,184,${0.07 + i * 0.04}) 0%, transparent 100%)`,
            animation: `weather-drift ${8 + i * 3}s ease-in-out infinite alternate`,
            animationDelay: `${i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
