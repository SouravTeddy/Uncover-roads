import type { TransitMode } from '../../shared/types';

const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';

interface Props {
  mode: TransitMode;
  from: string;
  to: string;
  durationMinutes?: number;
  distanceKm?: number;
  advisorMessage?: string;
}

const MODE_CONFIG: Record<TransitMode, { icon: string; label: string; bgGradient: string; accentColor: string; deepLinkLabel: string }> = {
  flight: {
    icon: 'flight',
    label: 'Flight',
    bgGradient: 'linear-gradient(160deg, #0c1445 0%, #1a3a7e 50%, #2563eb 100%)',
    accentColor: '#93c5fd',
    deepLinkLabel: 'Find flights →',
  },
  train: {
    icon: 'train',
    label: 'Train',
    bgGradient: 'linear-gradient(160deg, #0f2117 0%, #14532d 50%, #166534 100%)',
    accentColor: '#86efac',
    deepLinkLabel: 'Open in Maps →',
  },
  drive: {
    icon: 'directions_car',
    label: 'Drive',
    bgGradient: 'linear-gradient(160deg, #1c1207 0%, #431407 50%, #7c2d12 100%)',
    accentColor: '#fdba74',
    deepLinkLabel: 'Open in Maps →',
  },
  bus: {
    icon: 'directions_bus',
    label: 'Bus',
    bgGradient: 'linear-gradient(160deg, #1c1207 0%, #431407 50%, #7c2d12 100%)',
    accentColor: '#fdba74',
    deepLinkLabel: 'Open in Maps →',
  },
};

function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

function googleFlightsUrl(from: string, to: string): string {
  return `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(from)}+to+${encodeURIComponent(to)}`;
}

function googleMapsUrl(from: string, to: string): string {
  return `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

export function JourneyTransitCard({ mode, from, to, durationMinutes, distanceKm, advisorMessage }: Props) {
  const cfg = MODE_CONFIG[mode];
  const deepLink = mode === 'flight' ? googleFlightsUrl(from, to) : googleMapsUrl(from, to);

  return (
    <div style={{ height: '100%', background: cfg.bgGradient, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 20px' }}>
      {/* Mode badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="ms fill" style={{ fontSize: 18, color: cfg.accentColor }}>{cfg.icon}</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: cfg.accentColor }}>{cfg.label}</span>
      </div>

      {/* Route */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>from</div>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 26, fontWeight: 800, color: TEXT1 }}>{from}</div>
        <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.15)' }} />
          <span className="ms fill" style={{ fontSize: 22, color: cfg.accentColor }}>{cfg.icon}</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.15)' }} />
        </div>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>to</div>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 26, fontWeight: 800, color: TEXT1 }}>{to}</div>

        {/* Duration + distance */}
        {(durationMinutes !== undefined || distanceKm !== undefined) && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
            {durationMinutes !== undefined && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: cfg.accentColor }}>{formatDuration(durationMinutes)}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>duration</div>
              </div>
            )}
            {distanceKm !== undefined && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: cfg.accentColor }}>{Math.round(distanceKm)} km</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>distance</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {advisorMessage && (
          <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: cfg.accentColor, lineHeight: 1.5, margin: 0 }}>{advisorMessage}</p>
          </div>
        )}
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 16, textDecoration: 'none',
            fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, color: TEXT1,
          }}
        >
          {cfg.deepLinkLabel}
        </a>
      </div>
    </div>
  );
}
