import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  onDone: () => void;
  duration?: number;
  variant?: 'success' | 'warning' | 'error';
}

const variantStyles: Record<string, { border: string; icon: string; iconClass: string }> = {
  success: {
    border: 'border border-[var(--color-sage-bdr)]',
    icon: 'check_circle',
    iconClass: 'ms fill text-[var(--color-sage)]',
  },
  warning: {
    border: 'border border-[var(--color-amber-bdr)]',
    icon: 'warning',
    iconClass: 'ms fill text-[var(--color-amber)]',
  },
  error: {
    border: 'border border-red-500/30',
    icon: 'error',
    iconClass: 'ms fill text-red-400',
  },
};

export function Toast({ message, onDone, duration = 2500, variant }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  const vs = variant ? variantStyles[variant] : null;

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-[var(--color-surface)] rounded-2xl px-4 py-3 flex items-center gap-3 [box-shadow:var(--shadow-md)] text-text-1 text-sm font-medium transition-all ${
        vs ? vs.border : 'border border-white/10'
      } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      style={{ maxWidth: 340, textAlign: 'center' }}
    >
      {vs && <span className={vs.iconClass}>{vs.icon}</span>}
      {message}
    </div>
  );
}
