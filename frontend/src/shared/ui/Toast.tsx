import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  onDone: () => void;
  duration?: number;
}

export function Toast({ message, onDone, duration = 2500 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-5 py-3 rounded-2xl bg-surface border border-white/10 shadow-xl text-text-1 text-sm font-medium transition-all ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ maxWidth: 340, textAlign: 'center' }}
    >
      {message}
    </div>
  );
}
