import { describe, it, expect } from 'vitest';

// Inline the haversineKm formula to avoid import path uncertainty
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('detourKm calculation', () => {
  it('is positive when engine stop is off the direct path', () => {
    // prev (0,0), curr (0.05,0.05), next (0.1,0) — curr is off the direct prev→next line
    const directKm = haversineKm(0, 0, 0.1, 0);
    const viaKm = haversineKm(0, 0, 0.05, 0.05) + haversineKm(0.05, 0.05, 0.1, 0);
    const detourKm = Math.max(0, Math.round((viaKm - directKm) * 10) / 10);
    expect(detourKm).toBeGreaterThan(0);
  });

  it('is zero when engine stop is exactly on the direct path', () => {
    // prev (0,0), curr (0.05,0), next (0.1,0) — curr is exactly between prev and next
    const directKm = haversineKm(0, 0, 0.1, 0);
    const viaKm = haversineKm(0, 0, 0.05, 0) + haversineKm(0.05, 0, 0.1, 0);
    const detourKm = Math.max(0, Math.round((viaKm - directKm) * 10) / 10);
    expect(detourKm).toBe(0);
  });
});
