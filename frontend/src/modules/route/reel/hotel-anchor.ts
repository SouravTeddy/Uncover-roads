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

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime12(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function computeHotelAnchorRow(p: HotelAnchorParams): HotelAnchorRow | null {
  if (!p.hotel || p.hotel.lat == null || p.hotel.lon == null) return null;
  if (p.stopLat == null || p.stopLon == null) return null;

  const distKm = haversineKm(p.hotel.lat, p.hotel.lon, p.stopLat, p.stopLon);
  const travelMin = driveMinutes(distKm);

  // Departure day: last stop's closing anchor is the departure terminal, not hotel return
  if (p.isLastOfDay && p.isLastDayInCity && p.cityDepartureTime) {
    const depMin = timeToMinutes(p.cityDepartureTime);
    const bufferMin = 90; // time needed at terminal before departure
    const leaveByMin = depMin - bufferMin - travelMin;
    const terminalName = p.cityArrivalVia ?? 'airport';
    return {
      text: `Leave by ${minutesToTime12(leaveByMin)} · ${terminalName} by ${minutesToTime12(depMin - bufferMin)}`,
      isWarning: true,
      isBlue: false,
      icon: 'flight_takeoff',
    };
  }

  // Arrival day anchor split: if stop time < check-in time → airport anchor
  const checkInMin = p.hotel.checkInTime ? timeToMinutes(p.hotel.checkInTime) : null;
  const stopMin = p.stopTime ? timeToMinutes(p.stopTime) : null;
  const isPreCheckIn = checkInMin != null && stopMin != null && stopMin < checkInMin;
  const hasArrivalInfo = !!p.cityArrivalTime && !!p.cityArrivalVia;

  if (p.isFirstOfDay && isPreCheckIn && hasArrivalInfo) {
    // Airport anchor
    const leaveByMin = stopMin! - travelMin;
    return {
      text: `Leave airport (${p.cityArrivalVia}) by ${minutesToTime12(leaveByMin)} · ${travelMin} min`,
      isWarning: travelMin >= 45,
      isBlue: true,
      icon: 'flight_land',
    };
  }

  // Family last stop: time-based wrap-up nudge (target 9 PM hotel return)
  if (p.isLastOfDay && p.travelGroup === 'family') {
    const targetReturnMin = 21 * 60; // 9 PM
    const leaveByMin = targetReturnMin - travelMin;
    return {
      text: `Leave by ${minutesToTime12(leaveByMin)} · back to hotel by 9 PM`,
      isWarning: true,
      isBlue: false,
      icon: 'nights_stay',
    };
  }

  // Normal last stop: back to hotel distance
  if (p.isLastOfDay) {
    return {
      text: `Back to ${p.hotel.name} · ${travelMin} min`,
      isWarning: travelMin >= 45,
      isBlue: false,
      icon: 'hotel',
    };
  }

  // Normal first stop: leave-by time
  if (p.isFirstOfDay && stopMin != null) {
    const leaveByMin = stopMin - travelMin;
    return {
      text: `Leave hotel by ${minutesToTime12(leaveByMin)} · ${travelMin} min drive`,
      isWarning: travelMin >= 45,
      isBlue: false,
      icon: 'hotel',
    };
  }

  return null;
}
