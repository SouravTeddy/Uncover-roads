// explore-icons.jsx — inline-SVG icon set for the Explore map prototype.
// Renders reliably everywhere (live, screenshots, export). 24-grid, currentColor.
// <EIcon name="restaurant" size={16} color="#d4a853" fill />

function EIcon({ name, size = 18, color = 'currentColor', fill = false, style = {} }) {
  const s = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth: 1.7,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0, ...style },
  };
  const f = fill ? color : 'none';
  const P = {
    // ── chrome ──
    arrow_back: <path d="M14 6 L8 12 L14 18" />,
    close: <path d="M6 6 L18 18 M18 6 L6 18" />,
    add: <path d="M12 5 V19 M5 12 H19" />,
    remove: <path d="M5 12 H19" />,
    explore: <g><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 L10.5 10.5 L8.5 15.5 L13.5 13.5 Z" fill={f} stroke="none" /></g>,
    route: <g><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18 H14 A4 4 0 0 0 14 10 H10 A4 4 0 0 1 10 6 H16" /></g>,
    person: <g><circle cx="12" cy="7.5" r="3.4" fill={f} stroke={fill ? 'none' : color} /><path d="M5.5 20 A6.5 6.5 0 0 1 18.5 20" fill={f} stroke={fill ? 'none' : color} /></g>,
    layers: <g><path d="M12 3 L21 8 L12 13 L3 8 Z" fill={f} /><path d="M3 13 L12 18 L21 13" /></g>,
    my_location: <g><circle cx="12" cy="12" r="4" fill={f} /><circle cx="12" cy="12" r="8" /><path d="M12 1 V4 M12 20 V23 M1 12 H4 M20 12 H23" /></g>,
    // ── POI categories ──
    restaurant: <g><path d="M7 3 V10 M5 3 V6.2 A2 2 0 0 0 9 6.2 V3 M7 10 V21" /><path d="M16.5 3 C14.8 3 14 5.5 14 8 C14 10 15 10.5 16 10.7 L16 21 L17.5 21 L17.5 3 Z" fill={f} stroke={fill ? 'none' : color} /></g>,
    coffee: <g><path d="M4 8 H16 V13 A4 4 0 0 1 12 17 H8 A4 4 0 0 1 4 13 Z" fill={f} stroke={fill ? 'none' : color} /><path d="M16 9.5 H18 A2.5 2.5 0 0 1 18 14.5 H16" /><path d="M8 3 C7 4 9 5 8 6 M12 3 C11 4 13 5 12 6" /></g>,
    park: <g><path d="M12 3 L7 11 H10 L6 18 H18 L14 11 H17 Z" fill={f} stroke={fill ? 'none' : color} /><path d="M12 18 V21" /></g>,
    museum: <g><path d="M3 9 L12 4 L21 9 Z" fill={f} stroke={fill ? 'none' : color} /><path d="M5 9 V17 M9.5 9 V17 M14.5 9 V17 M19 9 V17 M3 20 H21" /></g>,
    viewpoint: <g><path d="M12 3 A6 6 0 0 1 18 9 C18 13 12 21 12 21 C12 21 6 13 6 9 A6 6 0 0 1 12 3 Z" fill={f} stroke={fill ? 'none' : color} /><circle cx="12" cy="9" r="2.4" fill={fill ? '#0c0c0e' : 'none'} stroke={fill ? 'none' : color} /></g>,
    // ── misc ──
    place: <g><path d="M12 21 C12 21 18.5 14.2 18.5 9 A6.5 6.5 0 1 0 5.5 9 C5.5 14.2 12 21 12 21 Z" fill={f} /><circle cx="12" cy="9" r="2.3" fill={fill ? '#0c0c0e' : 'none'} stroke={fill ? 'none' : color} /></g>,
    search: <g><circle cx="11" cy="11" r="6.5" /><path d="M16 16 L21 21" /></g>,
    near_me: <path d="M21 3 L3 10.5 L11 12.5 L13 20.5 Z" fill={f} stroke={fill ? 'none' : color} />,
    sun: <g><circle cx="12" cy="12" r="4.2" fill={f} /><path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.2 5.2 L6.8 6.8 M17.2 17.2 L18.8 18.8 M18.8 5.2 L17.2 6.8 M6.8 17.2 L5.2 18.8" /></g>,
  };
  return <svg {...s}>{P[name] || null}</svg>;
}

window.EIcon = EIcon;
