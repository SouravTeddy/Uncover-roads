import { describe, it, expect } from 'vitest';
import { haversineKm, driveMinutes, computeHotelAnchorRow } from './hotel-anchor';
import type { HotelAnchorParams } from './hotel-anchor';

const HOTEL = { name: 'The Leela', lat: 15.174, lon: 73.948, checkInTime: null };
const STOP_NEAR = { time: '09:00', lat: 15.180, lon: 73.952 };  // ~0.8 km away
const STOP_FAR =  { time: '09:00', lat: 15.350, lon: 74.100 };  // ~25 km away

describe('haversineKm', () => {
  it('returns ~0.8 for nearby coords', () => {
    expect(haversineKm(15.174, 73.948, 15.180, 73.952)).toBeCloseTo(0.8, 0);
  });
  it('returns 0 for identical coords', () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });
});

describe('driveMinutes', () => {
  it('estimates 2 min for 1 km', () => {
    expect(driveMinutes(1)).toBe(2);
  });
  it('estimates 30 min for 15 km', () => {
    expect(driveMinutes(15)).toBe(30);
  });
});

describe('computeHotelAnchorRow', () => {
  function params(overrides: Partial<HotelAnchorParams> = {}): HotelAnchorParams {
    return {
      stopTime: '09:00',
      stopLat: STOP_FAR.lat,
      stopLon: STOP_FAR.lon,
      isFirstOfDay: true,
      isLastOfDay: false,
      isLastDayInCity: false,
      travelGroup: 'solo',
      hotel: HOTEL,
      cityArrivalTime: null,
      cityArrivalVia: null,
      cityDepartureTime: null,
      ...overrides,
    };
  }

  it('returns null when hotel is null', () => {
    expect(computeHotelAnchorRow({ ...params(), hotel: null })).toBeNull();
  });

  it('returns null when hotel has no coordinates', () => {
    expect(computeHotelAnchorRow({ ...params(), hotel: { name: 'X', lat: null, lon: null, checkInTime: null } })).toBeNull();
  });

  it('returns null when stop has no coordinates', () => {
    expect(computeHotelAnchorRow({ ...params(), stopLat: null, stopLon: null })).toBeNull();
  });

  it('first stop: returns leave-by row with correct time', () => {
    // ~25 km → ~50 min → leave by 08:10
    const row = computeHotelAnchorRow(params());
    expect(row).not.toBeNull();
    expect(row!.isBlue).toBe(false);
    expect(row!.isWarning).toBe(true);  // >45 min
    expect(row!.text).toContain('Leave hotel by');
    expect(row!.text).toContain('8:10 AM');
  });

  it('first stop, near hotel: no warning when <45 min', () => {
    const row = computeHotelAnchorRow({ ...params(), stopLat: STOP_NEAR.lat, stopLon: STOP_NEAR.lon });
    expect(row!.isWarning).toBe(false);
  });

  it('last stop: returns back-to-hotel row', () => {
    const row = computeHotelAnchorRow({ ...params(), isFirstOfDay: false, isLastOfDay: true });
    expect(row!.text).toContain('Back to');
    expect(row!.text).toContain('The Leela');
  });

  it('arrival day pre-check-in: uses airport anchor in blue', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      cityArrivalTime: '10:00',
      cityArrivalVia: 'Goa Airport (GOI)',
      hotel: { ...HOTEL, checkInTime: '15:00' },
      // stop time 09:00 < checkIn 15:00 → airport anchor
    });
    expect(row!.isBlue).toBe(true);
    expect(row!.text).toContain('Leave airport');
    expect(row!.text).toContain('Goa Airport');
  });

  it('arrival day post-check-in: uses hotel anchor', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      stopTime: '16:00',
      cityArrivalTime: '10:00',
      cityArrivalVia: 'Goa Airport (GOI)',
      hotel: { ...HOTEL, checkInTime: '15:00' },
    });
    expect(row!.isBlue).toBe(false);
    expect(row!.text).toContain('Leave hotel by');
  });

  it('departure day last stop: shows airport close-out', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      isFirstOfDay: false,
      isLastOfDay: true,
      isLastDayInCity: true,
      cityDepartureTime: '07:00',
      cityArrivalVia: 'Goa Airport (GOI)',
    });
    expect(row!.text).toContain('Airport by');
    expect(row!.isWarning).toBe(true);
  });

  it('family last stop: shows wrap-up nudge', () => {
    const row = computeHotelAnchorRow({
      ...params(),
      isFirstOfDay: false,
      isLastOfDay: true,
      travelGroup: 'family',
      stopLat: STOP_NEAR.lat,
      stopLon: STOP_NEAR.lon,
    });
    expect(row!.text).toContain('Leave by');
    expect(row!.text).toContain('back to hotel by 9 PM');
  });
});
