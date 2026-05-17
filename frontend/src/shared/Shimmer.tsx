// frontend/src/shared/Shimmer.tsx
import type { ReactElement } from 'react';

export function ShimmerLine({
  width = '100%',
  height = 13,
}: {
  width?: string | number;
  height?: number;
}): ReactElement {
  return (
    <div
      className="shimmer"
      style={{
        width,
        height,
        flexShrink: 0,
        borderRadius: 6,
        background: 'var(--color-surface2)',
      }}
    />
  );
}

export function ShimmerBlock({ lines = 2 }: { lines?: number }): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerLine key={i} width={i === lines - 1 ? '60%' : '100%'} height={13} />
      ))}
    </div>
  );
}
