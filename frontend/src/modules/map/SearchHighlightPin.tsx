import { Marker } from 'react-map-gl/maplibre';

interface Props {
  lat: number;
  lon: number;
}

export function SearchHighlightPin({ lat, lon }: Props) {
  return (
    <Marker latitude={lat} longitude={lon} anchor="center">
      <div style={dotStyle} />
    </Marker>
  );
}

const dotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  background: '#d4a853',
  animation: 'searchPinPulse 2.2s ease infinite',
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('search-pin-pulse')) {
  const style = document.createElement('style');
  style.id = 'search-pin-pulse';
  style.textContent = `
    @keyframes searchPinPulse {
      0%,100% { box-shadow: 0 0 0 4px rgba(212,168,83,.32), 0 0 0 10px rgba(212,168,83,.1), 0 0 22px rgba(212,168,83,.18); }
      50%      { box-shadow: 0 0 0 8px rgba(212,168,83,.16), 0 0 0 18px rgba(212,168,83,.05), 0 0 30px rgba(212,168,83,.1); }
    }
  `;
  document.head.appendChild(style);
}
