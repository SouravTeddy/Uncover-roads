import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        'rounded-[20px]',
        '[box-shadow:var(--shadow-md)]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
