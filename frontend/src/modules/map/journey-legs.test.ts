import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Place } from '../../shared/types';
import {
  calculateEstimatedDays,
  calculateTravelDays,
  calculateArrivalDates,
} from './journey-legs';

// ── calculateEstimatedDays ─────────────────────────────────────

describe('calculateEstimatedDays', () => {
  it('1 stop/day persona: 3 places = 3 days', () => {
    expect(calculateEstimatedDays(3, 1)).toBe(3);
  });

  it('3 stops/day persona: 7 places = 3 days (ceil)', () => {
    expect(calculateEstimatedDays(7, 3)).toBe(3);
  });

  it('adds 1 day for first city with long-haul arrival', () => {
    expect(calculateEstimatedDays(3, 3, true, true)).toBe(2); // ceil(3/3)+1
  });

  it('no extra day for non-long-haul first city', () => {
    expect(calculateEstimatedDays(3, 3, true, false)).toBe(1);
  });
});

// ── calculateTravelDays ────────────────────────────────────────

describe('calculateTravelDays', () => {
  it('returns 0 for no origin', () => {
    expect(calculateTravelDays(undefined, undefined)).toBe(0);
  });

  it('returns 0 for custom origin type', () => {
    expect(calculateTravelDays('custom', undefined)).toBe(0);
  });

  it('returns 0 for home with short flight (<240 min)', () => {
    expect(calculateTravelDays('home', 60)).toBe(0);
  });

  it('returns 2 for home with long flight (>240 min)', () => {
    expect(calculateTravelDays('home', 480)).toBe(2);
  });

  it('returns 2 for airport with long flight', () => {
    expect(calculateTravelDays('airport', 720)).toBe(2);
  });

  it('returns 0 for hotel origin', () => {
    expect(calculateTravelDays('hotel', 0)).toBe(0);
  });
});

// ── calculateArrivalDates ──────────────────────────────────────

describe('calculateArrivalDates', () => {
  const tokyo: Place = { id: 't1', title: 'Senso-ji', category: 'tourism', lat: 35.71, lon: 139.79, _city: 'Tokyo' };
  const kyoto: Place = { id: 'k1', title: 'Fushimi Inari', category: 'tourism', lat: 34.97, lon: 135.77, _city: 'Kyoto' };

  it('stamps arrivalDate on city legs starting from startDate', () => {
    const legs = [
      { type: 'city' as const, city: 'Tokyo', countryCode: 'JP', places: [tokyo], estimatedDays: 2 },
      { type: 'transit' as const, mode: 'train' as const, from: 'Tokyo', to: 'Kyoto', fromCoords: [35.71, 139.79] as [number, number], toCoords: [34.97, 135.77] as [number, number] },
      { type: 'city' as const, city: 'Kyoto', countryCode: 'JP', places: [kyoto], estimatedDays: 3 },
    ];
    const result = calculateArrivalDates(legs, '2026-05-01');
    const tokyoLeg = result.find(l => l.type === 'city' && (l as any).city === 'Tokyo') as any;
    const kyotoLeg = result.find(l => l.type === 'city' && (l as any).city === 'Kyoto') as any;
    expect(tokyoLeg.arrivalDate).toBe('2026-05-01');
    expect(kyotoLeg.arrivalDate).toBe('2026-05-03'); // 2 days after Tokyo start
  });

  it('skips origin legs', () => {
    const origin = { type: 'origin' as const, place: { placeId: 'p', name: 'Home', address: '', lat: 51.5, lon: -0.12, originType: 'home' as const } };
    const city = { type: 'city' as const, city: 'Tokyo', countryCode: 'JP', places: [tokyo], estimatedDays: 2 };
    const result = calculateArrivalDates([origin, city], '2026-05-01');
    const cityResult = result.find(l => l.type === 'city') as any;
    expect(cityResult.arrivalDate).toBe('2026-05-01');
  });
});
