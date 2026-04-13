import { describe, it, expect, afterEach, vi } from 'vitest';
import { aiItineraryStream } from './api';
import type { ItineraryRequest } from './api';

const baseRequest: ItineraryRequest = {
  city: 'Tokyo',
  lat: 35.6762,
  lon: 139.6503,
  days: 2,
  day_number: 1,
  pace: 'moderate',
  persona: 'explorer',
  persona_archetype: 'Explorer',
  persona_context: '',
  trip_context: {
    start_type: 'hotel',
    arrival_time: '10:00',
    travel_date: '2026-05-01',
    total_days: 2,
    flight_time: null,
    is_long_haul: false,
    location_lat: null,
    location_lon: null,
    location_name: null,
  },
};

function makeStreamResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('aiItineraryStream', () => {
  it('yields two parsed objects from two NDJSON lines', async () => {
    const day1 = { day_number: 1, date: '2026-05-01', itinerary: [], summary: {} };
    const day2 = { day_number: 2, date: '2026-05-02', itinerary: [], summary: {} };
    const body = `${JSON.stringify(day1)}\n${JSON.stringify(day2)}\n`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(body)));

    const results: unknown[] = [];
    for await (const day of aiItineraryStream(baseRequest)) {
      results.push(day);
    }
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(day1);
    expect(results[1]).toEqual(day2);
  });

  it('yields incomplete last line without trailing newline', async () => {
    const day1 = { day_number: 1, date: '2026-05-01', itinerary: [], summary: {} };
    const body = JSON.stringify(day1); // no trailing \n
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(body)));

    const results: unknown[] = [];
    for await (const day of aiItineraryStream(baseRequest)) {
      results.push(day);
    }
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(day1);
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of aiItineraryStream(baseRequest)) { /* noop */ }
    }).rejects.toThrow('Stream 500');
  });

  it('skips blank lines between days', async () => {
    const day1 = { day_number: 1, date: '2026-05-01', itinerary: [], summary: {} };
    const body = `\n${JSON.stringify(day1)}\n\n`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(body)));

    const results: unknown[] = [];
    for await (const day of aiItineraryStream(baseRequest)) {
      results.push(day);
    }
    expect(results).toHaveLength(1);
  });
});
