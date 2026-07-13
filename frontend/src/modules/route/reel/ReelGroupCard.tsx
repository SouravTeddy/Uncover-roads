import { useRef, useState } from 'react';
import type { ReelGroupCard as ReelGroupCardType, ReelGroupMiniCard } from './types';

interface Props {
  card: ReelGroupCardType;
  active: boolean;
  onMapNavigate?: (lat: number, lon: number) => void;
}

function VisualPlaceholder({ item }: { item: ReelGroupMiniCard }) {
  const configs: Record<string, { bg: string; glow: string }> = {
    walk:     { bg: 'linear-gradient(160deg, #1a3d20 0%, #2d6035 50%, #0f2214 100%)', glow: '#4caf7044' },
    reco:     { bg: 'linear-gradient(160deg, #3d2210 0%, #6b3c18 50%, #2a1508 100%)', glow: '#e07b3044' },
    activity: { bg: 'linear-gradient(160deg, #12204a 0%, #1e3570 50%, #0b1530 100%)', glow: '#4f8fab44' },
    transit:  { bg: 'linear-gradient(160deg, #1a1a3d 0%, #25256a 50%, #0f0f28 100%)', glow: '#7070cc44' },
  };
  const cfg = configs[item.type] ?? configs.activity;

  return (
    <div style={{ width: '100%', height: '100%', background: cfg.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '20%', right: '20%', height: '70%',
        background: `radial-gradient(ellipse at 50% 30%, ${item.accent}28 0%, transparent 70%)`,
        filter: 'blur(32px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="ms fill" style={{ fontSize: 88, color: `${item.accent}44`, lineHeight: 1 }}>
          {item.icon}
        </span>
      </div>
      <div style={{
        position: 'absolute', bottom: '-10%', left: '5%', right: '5%', height: '55%',
        background: `radial-gradient(ellipse at 50% 100%, ${cfg.glow} 0%, transparent 70%)`,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
    </div>
  );
}

function MiniCard({ item, fullWidth }: { item: ReelGroupMiniCard; fullWidth?: boolean }) {
  return (
    <div style={{
      flexShrink: 0,
      width: fullWidth ? '100%' : 'min(82vw, 310px)',
      height: 'calc(100dvh - 330px)',
      borderRadius: 20,
      overflow: 'hidden',
      background: '#0f1014',
      border: '1px solid rgba(255,255,255,0.07)',
      position: 'relative',
      boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
    }}>
      {/* Full-card visual */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.1) saturate(1.15)' }} />
          : <VisualPlaceholder item={item} />
        }
      </div>

      {/* Scrim — stronger at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(10,10,14,0.98) 0%, rgba(10,10,14,0.7) 28%, rgba(10,10,14,0.15) 60%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Type chip */}
      <div style={{
        position: 'absolute', top: 14, left: 14,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)',
        border: `1px solid ${item.accent}50`,
      }}>
        <span className="ms fill" style={{ fontSize: 11, color: item.accent, lineHeight: 1 }}>{item.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: item.accent }}>
          {item.title}
        </span>
      </div>

      {/* Text overlay at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          fontSize: 21, fontFamily: "'Playfair Display', serif", fontWeight: 600,
          color: '#f5f0ea', lineHeight: 1.15, textShadow: '0 1px 10px rgba(0,0,0,0.9)',
        }}>
          {item.name}
        </div>

        {item.data ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ height: 2, width: 18, borderRadius: 99, background: item.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: item.accent, letterSpacing: '0.02em' }}>
              {item.data}
            </span>
          </div>
        ) : null}

        {item.footer ? (
          <span style={{
            fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.footer}
          </span>
        ) : null}

      </div>
    </div>
  );
}

export function ReelGroupCard({ card, active: _active, onMapNavigate }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSingle = card.cards.length === 1;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / card.cards.length;
    const idx = Math.round(el.scrollLeft / cardW);
    setActiveIdx(Math.max(0, Math.min(idx, card.cards.length - 1)));
  }

  return (
    <div style={{ width: '100%', height: '100dvh', background: '#09090d', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Route header */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.fromStop}
          </span>
          {card.fromArea ? (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.03em' }}>{card.fromArea}</span>
          ) : null}
        </div>

        <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', flexShrink: 0 }}>arrow_forward</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, color: '#f5f0ea', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.toStop}
          </span>
          {card.toArea ? (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.03em' }}>{card.toArea}</span>
          ) : null}
        </div>

        {!isSingle && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
            swipe →
          </div>
        )}
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        onScroll={isSingle ? undefined : handleScroll}
        style={{
          flex: 1, minHeight: 0, display: 'flex', gap: 12,
          overflowX: isSingle ? 'hidden' : 'scroll', overflowY: 'hidden',
          scrollSnapType: isSingle ? 'none' : 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          paddingLeft: 20, paddingRight: 20,
          alignItems: 'flex-start',
          justifyContent: isSingle ? 'center' : 'flex-start',
        }}
        className="no-scrollbar"
      >
        {card.cards.map((item, i) => (
          <div key={i} style={{ scrollSnapAlign: isSingle ? 'none' : 'start', flexShrink: 0, width: isSingle ? 'calc(100% - 40px)' : undefined }}>
            <MiniCard item={item} fullWidth={isSingle} />
          </div>
        ))}
        {!isSingle && <div style={{ flexShrink: 0, width: 4 }} />}
      </div>

      {/* Bottom bar — dots + CTA — sits in normal flow above the bottom nav */}
      <div style={{
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        paddingTop: 12,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
      }}>
        {!isSingle && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {card.cards.map((_, i) => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: 999, background: i === activeIdx ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)', transition: 'background .25s ease' }} />
            ))}
          </div>
        )}
        {card.anchorLat && onMapNavigate && (
          <button
            onClick={() => onMapNavigate(card.anchorLat!, card.anchorLon!)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 999,
              background: 'rgba(212,168,83,0.15)',
              border: '1px solid rgba(212,168,83,0.45)',
              backdropFilter: 'blur(10px)',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 14, color: '#d4a853' }}>add_location_alt</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#d4a853', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Add places nearby
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
