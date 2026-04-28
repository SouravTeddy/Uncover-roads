import { useEffect, useState } from 'react';
import type { StoryCard } from '../../shared/types';

interface Props {
  fromCity: string;
  toCity: string;
  storyCards: StoryCard[];
  onDone: () => void;
}

export function CityHopOverlay({ fromCity, toCity, storyCards, onDone }: Props) {
  const [phase, setPhase] = useState<'arc' | 'story'>('arc');
  const [storyIdx, setStoryIdx] = useState(0);
  const [planePos, setPlanePos] = useState(0);

  // Phase 1: animate plane along arc (1.5s)
  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let raf: number;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setPlanePos(t);
      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setPhase('story');
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Phase 2: rotate story cards every 4.5s
  useEffect(() => {
    if (phase !== 'story') return;
    if (storyCards.length === 0) { onDone(); return; }
    const timeout = setTimeout(() => {
      if (storyIdx < storyCards.length - 1) {
        setStoryIdx(i => i + 1);
      } else {
        onDone();
      }
    }, 4500);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, storyIdx, storyCards.length]);

  // Parabolic arc: peak at t=0.5
  const arcX = planePos * 100;
  const arcY = -4 * planePos * (planePos - 1) * 40;

  const card = storyCards[storyIdx] ?? null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(5,8,15,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>

      {phase === 'arc' && (
        <div style={{ width: '80%', position: 'relative', height: 100 }}>
          <div style={{
            position: 'absolute', left: 0, bottom: 0,
            fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8',
          }}>
            {fromCity}
          </div>
          <div style={{
            position: 'absolute', right: 0, bottom: 0,
            fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8',
          }}>
            {toCity}
          </div>

          <svg
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <path
              d="M 0 50 Q 50 0 100 50"
              fill="none"
              stroke="rgba(148,163,184,.3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </svg>

          <div style={{
            position: 'absolute',
            left: `${arcX}%`,
            bottom: `${arcY}px`,
            transform: 'translate(-50%, 50%)',
            fontSize: 28,
          }}>
            ✈️
          </div>
        </div>
      )}

      {phase === 'story' && card && (
        <div style={{
          width: '85%', maxWidth: 360,
          borderRadius: 20,
          background: 'rgba(15,20,30,.9)',
          border: '1px solid rgba(255,255,255,.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            background: 'rgba(99,102,241,.15)',
            borderBottom: '1px solid rgba(99,102,241,.2)',
            fontSize: '0.7rem', fontWeight: 700, color: '#818cf8',
            letterSpacing: '0.5px',
          }}>
            {card.cityContext}
          </div>

          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{
              fontSize: '1.05rem', fontWeight: 800,
              color: '#f1f5f9', lineHeight: 1.3, marginBottom: 10,
            }}>
              {card.headline}
            </div>
            <div style={{
              fontSize: '0.85rem', color: 'rgba(193,198,215,.75)',
              lineHeight: 1.6,
            }}>
              {card.body}
            </div>
          </div>

          {storyCards.length > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 5,
              paddingBottom: 16,
            }}>
              {storyCards.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === storyIdx ? 18 : 6, height: 6,
                    borderRadius: 3,
                    background: i === storyIdx ? '#6366f1' : 'rgba(255,255,255,.2)',
                    transition: 'width 0.2s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onDone}
        style={{
          marginTop: 32,
          background: 'none', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 999, padding: '8px 20px',
          color: 'rgba(148,163,184,.7)', fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        Skip →
      </button>
    </div>
  );
}
