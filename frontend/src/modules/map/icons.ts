import L from 'leaflet';

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: 'restaurant',
  cafe:       'local_cafe',
  park:       'park',
  museum:     'museum',
  historic:   'account_balance',
  tourism:    'photo_camera',
  place:      'location_on',
};

function pinHtml(
  bg: string,
  iconName: string,
  iconColor: string,
  size: number,
  shadow: string,
  border = 'none',
): string {
  const fontSize = Math.round(size * 0.46);
  return `<div style="
    width:${size}px;height:${size}px;
    border-radius:50% 50% 50% 0;
    background:${bg};
    border:${border};
    transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
    box-shadow:${shadow};
  "><span class="ms fill" style="
    transform:rotate(45deg);
    font-size:${fontSize}px;
    color:${iconColor};
    line-height:1;
  ">${iconName}</span></div>`;
}

/** Default pin — neutral dark, no category color */
export function makeIcon(category: string): L.DivIcon {
  const icon = CATEGORY_ICONS[category] ?? 'location_on';
  return L.divIcon({
    className: '',
    html: pinHtml(
      '#1c2230',
      icon,
      'rgba(255,255,255,.45)',
      28,
      '0 1.5px 5px rgba(0,0,0,.45)',
      '1.5px solid rgba(255,255,255,.10)',
    ),
    iconSize:   [28, 28],
    iconAnchor: [14, 28],
  });
}

/** Selected pin — white, user added it to itinerary */
export function makeSelectedIcon(category: string): L.DivIcon {
  const icon = CATEGORY_ICONS[category] ?? 'location_on';
  return L.divIcon({
    className: '',
    html: pinHtml(
      '#ffffff',
      icon,
      '#0f141e',
      34,
      '0 0 0 3px rgba(255,255,255,.18), 0 3px 10px rgba(0,0,0,.55)',
    ),
    iconSize:   [34, 34],
    iconAnchor: [17, 34],
  });
}

/** Recommended pin (Our Picks) — orange, AI-surfaced */
export function makeRecommendedIcon(category: string): L.DivIcon {
  const icon = CATEGORY_ICONS[category] ?? 'location_on';
  return L.divIcon({
    className: '',
    html: pinHtml(
      '#f97316',
      icon,
      '#fff',
      34,
      '0 0 0 3px rgba(249,115,22,.25), 0 3px 10px rgba(0,0,0,.55)',
    ),
    iconSize:   [34, 34],
    iconAnchor: [17, 34],
  });
}
