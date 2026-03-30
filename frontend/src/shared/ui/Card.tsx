import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: Props) {
  return (
    <div className={`bg-surface rounded-2xl p-5 border border-white/6 ${className}`}>
      {children}
    </div>
  );
}
