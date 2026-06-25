export interface HotelAnchorRow {
  text: string;
  isWarning: boolean; // amber treatment — >45 min or departure day
  isBlue: boolean;    // blue treatment — airport anchor
  icon: string;       // material icon name: 'hotel' | 'flight_takeoff' | 'nights_stay'
}

export interface HotelAnchorParams {
  stopTime: string | null;       // HH:MM — stop start time
  stopLat: number | null;
  stopLon: number | null;
  isFirstOfDay: boolean;
  isLastOfDay: boolean;
  isLastDayInCity: boolean;      // true when departure time is set for this city
  travelGroup: string;
  hotel: { name: string; lat: number | null; lon: number | null; checkInTime: string | null } | null;
  cityArrivalTime: string | null;  // HH:MM — when they arrived in this city
  cityArrivalVia: string | null;   // terminal name
  cityDepartureTime: string | null; // HH:MM — when they leave this city
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Urban driving: 30 km/h average → 2 min/km, minimum 2 min
export function driveMinutes(distKm: number): number {
  return Math.max(2, Math.floor(distKm * 2));
}

export function computeHotelAnchorRow(p: HotelAnchorParams): HotelAnchorRow | null {
  if (!p.hotel || p.hotel.lat == null || p.hotel.lon == null) return null;
  if (p.stopLat == null || p.stopLon == null) return null;
  if (!p.isLastOfDay) return null;

  const distKm = haversineKm(p.hotel.lat, p.hotel.lon, p.stopLat, p.stopLon);
  const travelMin = driveMinutes(distKm);

  // Last stop of the day: show how far back to hotel — user decides when to head back
  return {
    text: `Back to ${p.hotel.name} · ~${travelMin} min`,
    isWarning: travelMin >= 45,
    isBlue: false,
    icon: 'hotel',
  };
}
