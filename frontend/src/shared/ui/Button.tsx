import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  const base = 'h-12 px-5 rounded-2xl font-heading font-bold text-sm transition-all flex items-center justify-center gap-2';
  const variants = {
    primary:   'bg-primary text-white',
    secondary: 'bg-surface text-text-2 border border-white/10',
    ghost:     'bg-transparent text-text-2',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
