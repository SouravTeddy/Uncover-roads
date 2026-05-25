import { useState } from 'react';
import type { SwapCard as SwapCardType } from '../../shared/types';

interface Props {
  card: SwapCardType;
  onResolve: (id: string, choice: 'new' | 'original') => void;
}

export function SwapCard({ card, onResolve }: Props) {
  const [flipped, setFlipped] = useState(false);

  if (card.resolved) return null;

  return (
    <div
      style={{
        perspective: 800,
        height: 180,
        marginBottom: 12,
        cursor: flipped ? 'default' : 'pointer',
      }}
      onClick={() => { if (!flipped) setFlipped(true); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front — current plan */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 16,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🔄</span>
            <span className="text-[var(--color-text-3)] text-[10px] uppercase tracking-widest font-bold">Stop {card.stopIdx + 1}</span>
          </div>
          <p className="text-[var(--color-text-1)] font-semibold text-sm leading-snug">{card.stopName}</p>
          <div
            style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'var(--color-surface2)',
            }}
          >
            <p className="text-[var(--color-text-3)] text-[9px] uppercase tracking-widest font-bold mb-1">Current</p>
            <p className="text-[var(--color-text-2)] text-xs">{card.currentSummary}</p>
            {card.currentNote && <p className="text-[var(--color-text-4)] text-[10px] mt-0.5">{card.currentNote}</p>}
          </div>
          <p className="text-[var(--color-text-4)] text-[10px] text-center mt-auto">tap to see suggestion ▼</p>
        </div>

        {/* Back — suggestion */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 16,
            background: 'var(--color-sky-bg)',
            border: '1px solid var(--color-sky-bdr)',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">✦</span>
            <span style={{ color: 'var(--color-sky)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Suggested</span>
          </div>
          <p className="text-[var(--color-text-1)] font-semibold text-sm leading-snug">{card.stopName}</p>
          <p className="text-[var(--color-text-2)] text-xs leading-snug flex-1">{card.suggestedNote}</p>
          <div className="flex gap-2 mt-auto">
            <button
              onClick={e => { e.stopPropagation(); onResolve(card.id, 'new'); }}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white"
              style={{ background: 'var(--color-sky-bg)', border: '1px solid var(--color-sky-bdr)' }}
            >
              Use this
            </button>
            <button
              onClick={e => { e.stopPropagation(); onResolve(card.id, 'original'); }}
              className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text-3)' }}
            >
              Keep original
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
