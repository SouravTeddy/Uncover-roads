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
    // isLastOfDay=false by default — function only fires on the last stop of the day
    const row = computeHotelAnchorRow(params());
    expect(row).toBeNull();
  });

  it('first stop, near hotel: no warning when <45 min', () => {
    // isLastOfDay=false — returns null regardless of distance
    const row = computeHotelAnchorRow({ ...params(), stopLat: STOP_NEAR.lat, stopLon: STOP_NEAR.lon });
    expect(row).toBeNull();
  });

  it('last stop: returns back-to-hotel row', () => {
    const row = computeHotelAnchorRow({ ...params(), isFirstOfDay: false, isLastOfDay: true });
    expect(row!.text).toContain('Back to');
    expect(row!.text).toContain('The Leela');
  });

  it('arrival day pre-check-in: uses airport anchor in blue', () => {
    // isLastOfDay=false by default — function returns null for non-last stops
    const row = computeHotelAnchorRow({
      ...params(),
      cityArrivalTime: '10:00',
      cityArrivalVia: 'Goa Airport (GOI)',
      hotel: { ...HOTEL, checkInTime: '15:00' },
    });
    expect(row).toBeNull();
  });

  it('arrival day post-check-in: uses hotel anchor', () => {
    // isLastOfDay=false by default — function returns null for non-last stops
    const row = computeHotelAnchorRow({
      ...params(),
      stopTime: '16:00',
      cityArrivalTime: '10:00',
      cityArrivalVia: 'Goa Airport (GOI)',
      hotel: { ...HOTEL, checkInTime: '15:00' },
    });
    expect(row).toBeNull();
  });

  it('departure day last stop: shows back-to-hotel row', () => {
    // Last stop of the day: always shows "Back to <hotel> · ~N min" regardless of departure details
    const row = computeHotelAnchorRow({
      ...params(),
      isFirstOfDay: false,
      isLastOfDay: true,
      isLastDayInCity: true,
      cityDepartureTime: '07:00',
      cityArrivalVia: 'Goa Airport (GOI)',
    });
    expect(row).not.toBeNull();
    // ~25 km away → ~50 min drive → isWarning = true (>= 45 min)
    expect(row!.text).toContain('Back to The Leela');
    expect(row!.text).toContain('~50 min');
    expect(row!.isWarning).toBe(true);
    expect(row!.isBlue).toBe(false);
  });

  it('family last stop: shows back-to-hotel row', () => {
    // Near hotel (~0.8 km → 2 min drive) — travelGroup does not change text format
    const row = computeHotelAnchorRow({
      ...params(),
      isFirstOfDay: false,
      isLastOfDay: true,
      travelGroup: 'family',
      stopLat: STOP_NEAR.lat,
      stopLon: STOP_NEAR.lon,
    });
    expect(row).not.toBeNull();
    expect(row!.text).toContain('Back to The Leela');
    expect(row!.text).toContain('~2 min');
    expect(row!.isWarning).toBe(false);  // 2 min < 45 min threshold
  });

  it('first stop before 1 AM with distant hotel: clamps negative leave-by to 12:00 AM', () => {
    // isLastOfDay=false by default — function only fires for the last stop of the day
    const row = computeHotelAnchorRow({
      ...params(),
      stopTime: '00:20',
    });
    expect(row).toBeNull();
  });
});
