import { useEffect, useRef, useState } from 'react';
import { timeGradient } from './sceneMap';

interface Props {
  src: string;        // video URL — empty string = gradient only
  timeMins?: number;  // for gradient colour fallback
}

export function AmbientVideo({ src, timeMins = 9 * 60 }: Props) {
  // Two persistent video slots — swap which is active for crossfade
  const [slot1, setSlot1] = useState(src);
  const [slot2, setSlot2] = useState('');
  const [active, setActive] = useState<1 | 2>(1);
  const pendingRef = useRef<string>('');
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = active === 1 ? slot1 : slot2;
    if (!src || src === current) return;
    // Prevent queuing the same src multiple times
    if (src === pendingRef.current) return;
    pendingRef.current = src;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Load into the inactive slot, then crossfade after a brief moment
    if (active === 1) {
      setSlot2(src);
      timerRef.current = setTimeout(() => { setActive(2); pendingRef.current = ''; }, 80);
    } else {
      setSlot1(src);
      timerRef.current = setTimeout(() => { setActive(1); pendingRef.current = ''; }, 80);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const base: React.CSSProperties = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'cover',
    transition: 'opacity 1.2s ease-in-out',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 14 }}>
      {/* Always-visible gradient — colour-matched to time of day */}
      <div style={{ position: 'absolute', inset: 0, background: timeGradient(timeMins) }} />

      {/* Slot 1 */}
      {slot1 && (
        <video
          key={slot1}
          src={slot1}
          autoPlay muted loop playsInline
          style={{ ...base, opacity: active === 1 ? 1 : 0 }}
        />
      )}

      {/* Slot 2 */}
      {slot2 && (
        <video
          key={slot2}
          src={slot2}
          autoPlay muted loop playsInline
          style={{ ...base, opacity: active === 2 ? 1 : 0 }}
        />
      )}

      {/* Minimal vignette — card gradient handles all content darkening */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.0) 20%, rgba(0,0,0,0.0) 70%, rgba(0,0,0,0.10) 100%)',
      }} />
    </div>
  );
}
