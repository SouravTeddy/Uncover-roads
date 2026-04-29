import React from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-br from-[#e07854] to-[#c4613d]',
    'text-white font-bold',
    '[box-shadow:var(--shadow-primary)]',
    'border-0',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'border border-[var(--color-border)]',
    'text-[var(--color-text-2)]',
  ].join(' '),
  outline: [
    'bg-transparent',
    'border border-[var(--color-primary)]',
    'text-[var(--color-primary)]',
  ].join(' '),
  danger: [
    'bg-[rgba(220,60,60,.12)]',
    'border border-red-500/40',
    'text-red-400',
  ].join(' '),
};

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'h-[52px] px-6 rounded-2xl',
        'font-[family-name:var(--font-sans)] text-[15px] font-bold',
        'active:scale-[.97] transition-transform duration-100',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {loading
        ? <span className="ms text-[20px]" style={{ animation: 'spin 0.8s linear infinite' }}>autorenew</span>
        : children}
    </button>
  );
}
