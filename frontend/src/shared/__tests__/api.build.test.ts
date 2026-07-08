import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual };
});

describe('api.engineItinerary shape', () => {
  it('has start and status methods', async () => {
    const { api } = await import('../api');
    expect(typeof (api.engineItinerary as { start?: unknown }).start).toBe('function');
    expect(typeof (api.engineItinerary as { status?: unknown }).status).toBe('function');
  });
});
