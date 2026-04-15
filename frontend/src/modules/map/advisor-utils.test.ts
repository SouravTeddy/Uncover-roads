import { describe, it, expect } from 'vitest';
import { generateAdvisorMessage } from './advisor-utils';

describe('generateAdvisorMessage', () => {
  it('long_haul_arrival includes city and hours', () => {
    const msg = generateAdvisorMessage('long_haul_arrival', { cityName: 'Tokyo', flightHours: 13 });
    expect(msg).toContain('13 hours');
    expect(msg).toContain('Tokyo');
    expect(msg).toMatch(/kept.+first day.+light/i);
  });

  it('hotel_checkout_squeeze mentions checkout time and packing', () => {
    const msg = generateAdvisorMessage('hotel_checkout_squeeze', { checkoutTime: '11:00' });
    expect(msg).toContain('pack');
    expect(msg).toContain('11:00');
  });

  it('thirtyMinBefore handles normal time', () => {
    const msg = generateAdvisorMessage('hotel_checkout_squeeze', { checkoutTime: '11:00' });
    expect(msg).toContain('10:30 AM');
    expect(msg).toContain('11:00');
  });

  it('thirtyMinBefore handles midnight edge case', () => {
    const msg = generateAdvisorMessage('hotel_checkout_squeeze', { checkoutTime: '00:00' });
    expect(msg).toContain('11:30 PM');
    expect(msg).toContain('00:00');
  });

  it('home_departure mentions departure time', () => {
    const msg = generateAdvisorMessage('home_departure', { departureTime: '8:30' });
    expect(msg).toContain('8:30');
    expect(msg).toMatch(/rushing/i);
  });

  it('transit_auto_flight mentions the city', () => {
    const msg = generateAdvisorMessage('transit_auto_flight', { cityName: 'Osaka' });
    expect(msg).toContain('Osaka');
    expect(msg).toMatch(/no road/i);
  });

  it('duration_exceeded mentions both place count and budget', () => {
    const msg = generateAdvisorMessage('duration_exceeded', { placeCount: 9, estimatedDays: 6, budgetDays: 4 });
    expect(msg).toContain('9');
    expect(msg).toContain('6');
    expect(msg).toContain('4');
  });

  it('short_flight_no_day_deducted mentions afternoon and duration', () => {
    const msg = generateAdvisorMessage('short_flight_no_day_deducted', { cityName: 'Osaka', flightDuration: '1 hour' });
    expect(msg).toContain('1 hour');
    expect(msg).toContain('Osaka');
    expect(msg).toMatch(/afternoon/i);
  });
});
