import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOriginInput } from './useOriginInput';

vi.mock('../../shared/api', () => ({
  placesAutocomplete: vi.fn(),
  geocodePlace: vi.fn(),
  fetchPlaceDetails: vi.fn(),
}));

import { placesAutocomplete, geocodePlace, fetchPlaceDetails } from '../../shared/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useOriginInput', () => {
  it('starts in opening state', () => {
    const { result } = renderHook(() => useOriginInput());
    expect(result.current.step).toBe('opening');
  });

  it('chooseNotDecided sets step to not_decided', () => {
    const { result } = renderHook(() => useOriginInput());
    act(() => result.current.chooseNotDecided());
    expect(result.current.step).toBe('not_decided');
  });

  it('reset returns to opening state', () => {
    const { result } = renderHook(() => useOriginInput());
    act(() => result.current.chooseNotDecided());
    act(() => result.current.reset());
    expect(result.current.step).toBe('opening');
  });

  it('handleSearchInput with < 2 chars does not call API', async () => {
    const { result } = renderHook(() => useOriginInput());
    await act(async () => result.current.handleSearchInput('a'));
    expect(placesAutocomplete).not.toHaveBeenCalled();
  });

  it('selecting a hotel place moves to selected step with hotel time field', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 12.9, lon: 77.5, name: 'Marriott Bangalore', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p1', types: ['lodging'], weekday_text: [] } as any);

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p1', main_text: 'Marriott', secondary_text: 'Bangalore' } as any);
    });

    expect(result.current.step).toBe('selected');
    expect(result.current.selectedOrigin?.originType).toBe('hotel');
    expect(result.current.timeFieldLabel).toBe('When do you check in?');
  });

  it('selecting an airport place moves to selected step with airport time field', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 13.1, lon: 77.7, name: 'Kempegowda Airport', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p2', types: ['airport'], weekday_text: [] } as any);

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p2', main_text: 'Kempegowda Airport', secondary_text: 'Bangalore' } as any);
    });

    expect(result.current.step).toBe('selected');
    expect(result.current.selectedOrigin?.originType).toBe('airport');
    expect(result.current.timeFieldLabel).toBe('When do you land?');
  });

  it('selecting a street address moves to selected step with no time field', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 12.8, lon: 77.6, name: '42 MG Road', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p3', types: ['street_address'], weekday_text: [] } as any);

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p3', main_text: '42 MG Road', secondary_text: 'Bangalore' } as any);
    });

    expect(result.current.step).toBe('selected');
    expect(result.current.selectedOrigin?.originType).toBe('custom');
    expect(result.current.timeFieldLabel).toBeNull();
  });

  it('buildOrigin returns null in not_decided state', () => {
    const { result } = renderHook(() => useOriginInput());
    act(() => result.current.chooseNotDecided());
    expect(result.current.buildOrigin()).toBeNull();
  });

  it('buildOrigin returns selectedOrigin without time when timeValue is empty', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 12.8, lon: 77.6, name: '42 MG Road', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p3', types: ['street_address'], weekday_text: [] } as any);

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p3', main_text: '42 MG Road', secondary_text: 'Bangalore' } as any);
    });

    const origin = result.current.buildOrigin();
    expect(origin?.originType).toBe('custom');
    expect(origin?.checkInTime).toBeUndefined();
  });

  it('buildOrigin applies checkInTime for hotel when timeValue is set', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 12.9, lon: 77.5, name: 'Marriott', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p1', types: ['lodging'], weekday_text: [] } as any);

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p1', main_text: 'Marriott', secondary_text: 'Bangalore' } as any);
    });
    act(() => result.current.handleTimeChange('15:00'));

    const origin = result.current.buildOrigin();
    expect(origin?.checkInTime).toBe('15:00');
  });

  it('buildOrigin applies departureTime for airport when timeValue is set', async () => {
    vi.mocked(geocodePlace).mockResolvedValue({ lat: 13.1, lon: 77.7, name: 'Airport', address: 'Bangalore' });
    vi.mocked(fetchPlaceDetails).mockResolvedValue({ place_id: 'p2', types: ['airport'], weekday_text: [] } as any);

    const { result } = renderHook(() => useOriginInput());
    await act(async () => {
      await result.current.handleSelectResult({ place_id: 'p2', main_text: 'Airport', secondary_text: 'Bangalore' } as any);
    });
    act(() => result.current.handleTimeChange('18:30'));

    const origin = result.current.buildOrigin();
    expect(origin?.departureTime).toBe('18:30');
  });
});
