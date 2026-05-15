import React from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

const baseStyle: React.CSSProperties = {
  height: 52,
  borderRadius: 16,
  padding: '0 24px',
  fontFamily: 'var(--font-heading)',
  fontSize: 15,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  transition: 'transform 0.1s, box-shadow 0.1s',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
    color: '#ffffff',
    boxShadow: 'var(--shadow-primary)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-2)',
  },
  outline: {
    background: 'transparent',
    border: '1.5px solid var(--color-primary)',
    color: 'var(--color-primary)',
  },
  danger: {
    background: 'rgba(220,60,60,.12)',
    border: '1px solid rgba(239,68,68,.4)',
    color: '#f87171',
  },
};

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const [pressed, setPressed] = React.useState(false);

  const pressedStyle: React.CSSProperties =
    pressed && !disabled && !loading
      ? { transform: 'scale(0.97)', boxShadow: 'none' }
      : {};

  const disabledStyle: React.CSSProperties =
    disabled || loading ? { opacity: 0.5, cursor: 'not-allowed' } : {};

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      className={className}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...pressedStyle,
        ...disabledStyle,
        ...style,
      }}
    >
      {loading
        ? <span className="ms" style={{ fontSize: 20, animation: 'spin 0.8s linear infinite' }}>autorenew</span>
        : children}
    </button>
  );
}
