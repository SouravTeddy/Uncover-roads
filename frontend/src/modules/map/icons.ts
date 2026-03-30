import L from 'leaflet';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444',
  cafe: '#f97316',
  park: '#22c55e',
  museum: '#8b5cf6',
  historic: '#a16207',
  tourism: '#0ea5e9',
  place: '#64748b',
};

export function makeIcon(category: string): L.DivIcon {
  const color = CATEGORY_COLORS[category] ?? '#64748b';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};
      border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

export function makeSelectedIcon(category: string): L.DivIcon {
  const color = CATEGORY_COLORS[category] ?? '#64748b';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};
      border:3px solid #ffffff;
      box-shadow:0 0 0 3px ${color},0 0 12px 2px ${color}80,0 3px 8px rgba(0,0,0,.5);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

export function makeRecommendedIcon(_category: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:36px;height:36px;">
      <div style="
        width:36px;height:36px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:linear-gradient(135deg,#f59e0b,#d97706);
        border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);
      "></div>
      <div style="
        position:absolute;top:-4px;right:-4px;
        width:16px;height:16px;border-radius:50%;
        background:#fbbf24;border:1.5px solid white;
        display:flex;align-items:center;justify-content:center;
        font-size:9px;line-height:1;
      ">⭐</div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
}
