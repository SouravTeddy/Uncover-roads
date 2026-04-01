import { useEffect, useRef, useState } from 'react';

const MESSAGES = [
  'Sketching Roads...',
  'Cooking hotspots...',
  'Loading something...',
  'Finding hidden gems...',
  'Waking up the city...',
  'Sniffing out cafés...',
  'Mapping the vibes...',
  'Connecting the dots...',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MapLoadingOverlay({ visible }: { visible: boolean }) {
  const [msgOpacity, setMsgOpacity] = useState(1);
  const [msgText, setMsgText] = useState('');
  const messagesRef = useRef<string[]>([]);
  const idxRef = useRef(0);

  // Shuffle messages once on mount and set initial text
  useEffect(() => {
    messagesRef.current = shuffle(MESSAGES);
    setMsgText(messagesRef.current[0]);
  }, []);

  // Cycle messages while visible
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setMsgOpacity(0);
      setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % messagesRef.current.length;
        setMsgText(messagesRef.current[idxRef.current]);
        setMsgOpacity(1);
      }, 400);
    }, 1800);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 30, pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(15,20,30,0.93)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.11)',
          borderRadius: 22,
          padding: '24px 32px',
          textAlign: 'center',
          minWidth: 190,
          boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
        }}
      >
        {/* Spinner */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '3px solid rgba(59,130,246,0.18)',
            borderTopColor: '#3b82f6',
            margin: '0 auto 14px',
            animation: 'map-overlay-spin 1s linear infinite',
          }}
        />
        {/* Cycling message */}
        <p
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 4px',
            letterSpacing: '-0.2px',
            opacity: msgOpacity,
            transition: 'opacity 0.4s ease',
          }}
        >
          {msgText}
        </p>
        {/* Static sub-label */}
        <p
          style={{
            color: 'rgba(255,255,255,0.28)',
            fontSize: 11,
            margin: 0,
            fontWeight: 400,
          }}
        >
          hang tight
        </p>
      </div>

      <style>{`
        @keyframes map-overlay-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
