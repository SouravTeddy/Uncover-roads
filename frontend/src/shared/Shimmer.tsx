// frontend/src/shared/Shimmer.tsx
import React from 'react';

const shimmerKeyframes = `
@keyframes shimmer-sweep {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
`;

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('shimmer-kf')) return;
  const style = document.createElement('style');
  style.id = 'shimmer-kf';
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
}

const baseStyle: React.CSSProperties = {
  borderRadius: 6,
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%)',
  backgroundSize: '800px 100%',
  animation: 'shimmer-sweep 1.4s infinite linear',
};

export function ShimmerLine({
  width = '100%',
  height = 13,
}: {
  width?: string | number;
  height?: number;
}): React.ReactElement {
  injectKeyframes();
  return (
    <div style={{ ...baseStyle, width, height, flexShrink: 0 }} />
  );
}

export function ShimmerBlock({ lines = 2 }: { lines?: number }): React.ReactElement {
  injectKeyframes();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerLine key={i} width={i === lines - 1 ? '60%' : '100%'} height={13} />
      ))}
    </div>
  );
}
