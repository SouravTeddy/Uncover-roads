import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reducer, initialState, getGenerationAccess } from './store';
import type { AppState } from './store';
import type { Itinerary } from './types';

const mockDay1: Itinerary = {
  itinerary: [{ day: 1, time: '9:00 AM', place: 'Museum', duration: '2h', category: 'museum', tip: 'Go early', transit_to_next: '10 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip', conflict_notes: '', suggested_start_time: '9:00 AM', day_narrative: 'Calm day' },
};
const mockDay2: Itinerary = {
  itinerary: [{ day: 2, time: '10:00 AM', place: 'Park', duration: '1h', category: 'park', tip: 'Bring water', transit_to_next: '5 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip2', conflict_notes: '', suggested_start_time: '10:00 AM', day_narrative: 'Outdoor day' },
};

describe('APPEND_ITINERARY_DAY reducer', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('appends a real day to empty array', () => {
    const state: AppState = { ...initialState, itineraryDays: [] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay1 });
    expect(next.itineraryDays).toEqual([mockDay1]);
  });

  it('appends a second real day', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay2 });
    expect(next.itineraryDays).toEqual([mockDay1, mockDay2]);
  });

  it('appends null (exhausted retry)', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: null });
    expect(next.itineraryDays).toEqual([mockDay1, null]);
  });

  it('calls localStorage.setItem with updated array', () => {
    const state: AppState = { ...initialState, itineraryDays: [] };
    reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay1 });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'ur_ss_itin_days',
      JSON.stringify([mockDay1]),
    );
  });

  it('SET_ITINERARY_DAYS still resets to provided array', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'SET_ITINERARY_DAYS', days: [] });
    expect(next.itineraryDays).toEqual([]);
  });
});

describe('journey reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', stubStorage);
    vi.stubGlobal('localStorage', stubStorage);
  });
  afterEach(() => vi.unstubAllGlobals());

  const mockOrigin: import('./types').OriginPlace = {
    placeId: 'p1', name: 'Home', address: '123 Main St',
    lat: 51.5, lon: -0.12, originType: 'home', departureTime: '09:00',
  };

  it('SET_JOURNEY_ORIGIN creates an origin leg', () => {
    const next = reducer(initialState, { type: 'SET_JOURNEY_ORIGIN', place: mockOrigin });
    expect(next.journey).toEqual([{ type: 'origin', place: mockOrigin }]);
  });

  it('SET_JOURNEY_BUDGET sets journeyBudgetDays', () => {
    const next = reducer(initialState, { type: 'SET_JOURNEY_BUDGET', days: 7 });
    expect(next.journeyBudgetDays).toBe(7);
  });

  it('ADD_ADVISOR_MESSAGE appends to advisorMessages', () => {
    const msg: import('./types').AdvisorMessage = {
      id: 'a1', message: 'Test message', trigger: 'long_haul_arrival', timestamp: 1000,
    };
    const next = reducer(initialState, { type: 'ADD_ADVISOR_MESSAGE', message: msg });
    expect(next.advisorMessages).toEqual([msg]);
  });

  it('CLEAR_ADVISOR_MESSAGES empties the list', () => {
    const msg: import('./types').AdvisorMessage = {
      id: 'a1', message: 'Test', trigger: 'test', timestamp: 1000,
    };
    const s1 = reducer(initialState, { type: 'ADD_ADVISOR_MESSAGE', message: msg });
    const s2 = reducer(s1, { type: 'CLEAR_ADVISOR_MESSAGES' });
    expect(s2.advisorMessages).toEqual([]);
  });

  it('UPDATE_JOURNEY_LEGS replaces legs array', () => {
    const legs: import('./types').JourneyLeg[] = [
      { type: 'origin', place: mockOrigin },
    ];
    const next = reducer(initialState, { type: 'UPDATE_JOURNEY_LEGS', legs });
    expect(next.journey).toEqual(legs);
  });
});

describe('tier state', () => {
  it('defaults to free tier', () => {
    expect(initialState.userTier).toBe('free');
  });

  it('SET_USER_TIER updates tier and persists', () => {
    const next = reducer(initialState, { type: 'SET_USER_TIER', tier: 'pro' });
    expect(next.userTier).toBe('pro');
  });

  it('ADD_TRIP_PACK adds a pack and increments purchaseCount', () => {
    const pack = { id: 'p1', trips: 5, usedTrips: 0, expiresAt: '2027-01-01' };
    const next = reducer(initialState, { type: 'ADD_TRIP_PACK', pack });
    expect(next.tripPacks).toHaveLength(1);
    expect(next.packPurchaseCount).toBe(1);
  });

  it('USE_PACK_TRIP increments usedTrips on the matching pack', () => {
    const pack = { id: 'p1', trips: 5, usedTrips: 0, expiresAt: '2027-01-01' };
    const s1 = reducer(initialState, { type: 'ADD_TRIP_PACK', pack });
    const s2 = reducer(s1, { type: 'USE_PACK_TRIP', packId: 'p1' });
    expect(s2.tripPacks[0].usedTrips).toBe(1);
  });

  it('SET_UNITS persists units preference', () => {
    const next = reducer(initialState, { type: 'SET_UNITS', units: 'miles' });
    expect(next.units).toBe('miles');
  });

  it('defaults packTripsRemaining to 0', () => {
    expect(initialState.packTripsRemaining).toBe(0);
  });

  it('defaults autoReplenish to false', () => {
    expect(initialState.autoReplenish).toBe(false);
  });

  it('SET_TIER updates userTier', () => {
    const next = reducer(initialState, { type: 'SET_TIER', tier: 'pro' });
    expect(next.userTier).toBe('pro');
  });

  it('SET_PACK_TRIPS sets trip balance', () => {
    const next = reducer(initialState, { type: 'SET_PACK_TRIPS', count: 5 });
    expect(next.packTripsRemaining).toBe(5);
  });

  it('CONSUME_PACK_TRIP decrements by 1', () => {
    const state = { ...initialState, packTripsRemaining: 3 };
    const next = reducer(state, { type: 'CONSUME_PACK_TRIP' });
    expect(next.packTripsRemaining).toBe(2);
  });

  it('CONSUME_PACK_TRIP does not go below 0', () => {
    const state = { ...initialState, packTripsRemaining: 0 };
    const next = reducer(state, { type: 'CONSUME_PACK_TRIP' });
    expect(next.packTripsRemaining).toBe(0);
  });

  it('SET_AUTO_REPLENISH toggles the flag', () => {
    const next = reducer(initialState, { type: 'SET_AUTO_REPLENISH', enabled: true });
    expect(next.autoReplenish).toBe(true);
  });
});

describe('getGenerationAccess', () => {
  it('free tier, 0 generations: full access', () => {
    expect(getGenerationAccess('free', 0, 0)).toEqual({ allowed: true, degraded: false });
  });

  it('free tier, 1 generation used: full access', () => {
    expect(getGenerationAccess('free', 1, 0)).toEqual({ allowed: true, degraded: false });
  });

  it('free tier, 2 generations used: degraded access', () => {
    expect(getGenerationAccess('free', 2, 0)).toEqual({ allowed: true, degraded: true });
  });

  it('free tier, 3+ generations used: blocked', () => {
    expect(getGenerationAccess('free', 3, 0)).toEqual({ allowed: false, degraded: false });
  });

  it('pack tier, 1 trip remaining: full access', () => {
    expect(getGenerationAccess('pack', 99, 1)).toEqual({ allowed: true, degraded: false });
  });

  it('pack tier, 0 trips remaining: blocked', () => {
    expect(getGenerationAccess('pack', 99, 0)).toEqual({ allowed: false, degraded: false });
  });

  it('pro tier: always full access', () => {
    expect(getGenerationAccess('pro', 999, 0)).toEqual({ allowed: true, degraded: false });
  });
});

describe('Phase 3 types — EngineWeights and ArchetypeId', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('EngineWeights has all 10 dimensions', () => {
    const w: import('./types').EngineWeights = {
      w_walk_affinity: 0.9,
      w_scenic: 0.8,
      w_efficiency: 0.3,
      w_food_density: 0.5,
      w_culture_depth: 0.7,
      w_nightlife: 0.2,
      w_budget_sensitivity: 0.4,
      w_crowd_aversion: 0.6,
      w_spontaneity: 0.7,
      w_rest_need: 0.5,
    }
    expect(Object.keys(w)).toHaveLength(10)
    expect(w.w_walk_affinity).toBe(0.9)
  })

  it('ArchetypeId accepts all 7 valid values', () => {
    const ids: import('./types').ArchetypeId[] = [
      'wanderer', 'historian', 'epicurean',
      'pulse', 'slowtraveller', 'voyager', 'explorer',
    ]
    expect(ids).toHaveLength(7)
  })
})

describe('Phase 3 types — EngineMessage', () => {
  it('EngineMessage has required fields', () => {
    const msg: import('./types').EngineMessage = {
      id: 'msg-001',
      type: 'swap',
      what: 'Moved Senso-ji to 8am',
      why: 'It closes at 5pm — you\'d arrive at 4:30',
      consequence: 'You now reach Ueno with 3 hours to spare',
      dismissable: true,
    }
    expect(msg.type).toBe('swap')
    expect(msg.dismissable).toBe(true)
    expect(msg.undo_action).toBeUndefined()
  })

  it('EngineMessage with undo_action', () => {
    const msg: import('./types').EngineMessage = {
      id: 'msg-002',
      type: 'resequence',
      what: 'Reordered your afternoon',
      why: 'Ueno closes at 5pm',
      consequence: 'You arrive with 2 hours to spare',
      dismissable: true,
      undo_action: 'undo_resequence_day2',
    }
    expect(msg.undo_action).toBe('undo_resequence_day2')
  })

  it('EngineMessage accepts all valid type values', () => {
    const types: import('./types').EngineMessage['type'][] = [
      'swap', 'insert', 'resequence', 'weather', 'transit', 'advisory', 'event',
    ]
    expect(types).toHaveLength(7)
  })
})

describe('Phase 3 types — map exploration', () => {
  it('MapPin has all required fields', () => {
    const pin: import('./types').MapPin = {
      id: 'pin-001',
      placeId: 'ChIJ123',
      title: 'Senso-ji Temple',
      lat: 35.7148,
      lon: 139.7967,
      layer: 'famous',
      category: 'historic',
      saved: false,
      inItinerary: false,
    }
    expect(pin.layer).toBe('famous')
    expect(pin.saved).toBe(false)
    expect(pin.inItinerary).toBe(false)
  })

  it('MapPin layer accepts all 3 values', () => {
    const layers: import('./types').PinLayer[] = ['famous', 'reference', 'user']
    expect(layers).toHaveLength(3)
  })

  it('DiscoveryMode accepts anchor and deep', () => {
    const modes: import('./types').DiscoveryMode[] = ['anchor', 'deep']
    expect(modes).toHaveLength(2)
  })

  it('MapFilterChip accepts all valid values', () => {
    const chips: import('./types').MapFilterChip[] = [
      'all', 'famous', 'for_you', 'culture', 'food', 'parks', 'nightlife',
    ]
    expect(chips).toHaveLength(7)
  })
})

describe('Phase 3 types — CityContext', () => {
  it('CityContext has all required fields', () => {
    const ctx: import('./types').CityContext = {
      city: 'Tokyo',
      countryCode: 'JP',
      lat: 35.6762,
      lon: 139.6503,
      discoveryMode: 'deep',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      days: 5,
    }
    expect(ctx.city).toBe('Tokyo')
    expect(ctx.discoveryMode).toBe('deep')
    expect(ctx.days).toBe(5)
  })

  it('CityContext allows null dates', () => {
    const ctx: import('./types').CityContext = {
      city: 'Kyoto',
      countryCode: 'JP',
      lat: 35.0116,
      lon: 135.7681,
      discoveryMode: 'anchor',
      startDate: null,
      endDate: null,
      days: 0,
    }
    expect(ctx.startDate).toBeNull()
    expect(ctx.endDate).toBeNull()
  })
})

describe('Phase 3 types — EngineItinerary', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('EngineItineraryStop has all required fields', () => {
    const stop: import('./types').EngineItineraryStop = {
      id: 'stop-001',
      placeId: 'ChIJ123',
      title: 'Senso-ji',
      area: 'Asakusa',
      day: 1,
      time: '09:00',
      durationMin: 90,
      category: 'historic',
      lat: 35.7148,
      lon: 139.7967,
      priceLevel: 0,
      rating: 4.6,
      weekdayText: ['Monday: 6:00 AM – 5:00 PM'],
      whyForYou: 'Perfect for your love of ancient spaces.',
      localTip: 'The incense smoke is believed to bring good health.',
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    }
    expect(stop.day).toBe(1)
    expect(stop.time).toBe('09:00')
    expect(stop.durationMin).toBe(90)
  })

  it('EngineItineraryStop allows null optional fields', () => {
    const stop: import('./types').EngineItineraryStop = {
      id: 'stop-002',
      placeId: 'ChIJ456',
      title: 'Coffee Stop',
      area: 'Shinjuku',
      day: 1,
      time: '11:00',
      durationMin: 30,
      category: 'cafe',
      lat: 35.6896,
      lon: 139.7006,
      priceLevel: null,
      rating: null,
      weekdayText: [],
      whyForYou: 'A calm moment mid-morning.',
      localTip: null,
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    }
    expect(stop.priceLevel).toBeNull()
    expect(stop.localTip).toBeNull()
  })

  it('EngineItineraryDay has required fields', () => {
    const day: import('./types').EngineItineraryDay = {
      day: 1,
      date: '2026-06-01',
      city: 'Tokyo',
      isTravel: false,
      stops: [],
      messages: [],
    }
    expect(day.day).toBe(1)
    expect(day.isTravel).toBe(false)
  })

  it('EngineItineraryDay isTravel true has no stops', () => {
    const travelDay: import('./types').EngineItineraryDay = {
      day: 3,
      date: '2026-06-03',
      city: 'Tokyo',
      isTravel: true,
      stops: [],
      messages: [],
    }
    expect(travelDay.isTravel).toBe(true)
    expect(travelDay.stops).toHaveLength(0)
  })

  it('EngineItinerary has all required fields', () => {
    const weights: import('./types').EngineWeights = {
      w_walk_affinity: 0.9, w_scenic: 0.8, w_efficiency: 0.3,
      w_food_density: 0.5, w_culture_depth: 0.7, w_nightlife: 0.2,
      w_budget_sensitivity: 0.4, w_crowd_aversion: 0.6,
      w_spontaneity: 0.7, w_rest_need: 0.5,
    }
    const itin: import('./types').EngineItinerary = {
      id: 'itin-001',
      generatedAt: '2026-06-01T08:00:00Z',
      cities: ['Tokyo'],
      days: [],
      personaSnapshot: weights,
      archetypeSnapshot: 'wanderer',
    }
    expect(itin.cities).toEqual(['Tokyo'])
    expect(itin.archetypeSnapshot).toBe('wanderer')
  })
})

describe('Phase 3 — initialState new fields', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('initialState has cityContexts as empty array', () => {
    expect(initialState.cityContexts).toEqual([])
  })

  it('initialState has activeCityIndex as 0', () => {
    expect(initialState.activeCityIndex).toBe(0)
  })

  it('initialState has engineMessages as empty array', () => {
    expect(initialState.engineMessages).toEqual([])
  })

  it('initialState has engineItinerary as null', () => {
    expect(initialState.engineItinerary).toBeNull()
  })

  it('initialState has itineraryHistory as empty array', () => {
    expect(initialState.itineraryHistory).toEqual([])
  })

  it('initialState has activePinId as null', () => {
    expect(initialState.activePinId).toBeNull()
  })

  it('initialState has mapFilter as "all"', () => {
    expect(initialState.mapFilter).toBe('all')
  })
})

describe('Phase 3 — city context reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  const tokyoCtx: import('./types').CityContext = {
    city: 'Tokyo', countryCode: 'JP', lat: 35.67, lon: 139.65,
    discoveryMode: 'anchor', startDate: '2026-06-01', endDate: '2026-06-05', days: 5,
  }
  const kyotoCtx: import('./types').CityContext = {
    city: 'Kyoto', countryCode: 'JP', lat: 35.01, lon: 135.76,
    discoveryMode: 'deep', startDate: '2026-06-06', endDate: '2026-06-08', days: 3,
  }

  it('SET_CITY_CONTEXTS replaces all contexts', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'SET_CITY_CONTEXTS', contexts: [kyotoCtx] })
    expect(next.cityContexts).toEqual([kyotoCtx])
  })

  it('ADD_CITY_CONTEXT appends a new city', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'ADD_CITY_CONTEXT', context: kyotoCtx })
    expect(next.cityContexts).toHaveLength(2)
    expect(next.cityContexts[1].city).toBe('Kyoto')
  })

  it('ADD_CITY_CONTEXT is a no-op if city already exists', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'ADD_CITY_CONTEXT', context: tokyoCtx })
    expect(next.cityContexts).toHaveLength(1)
  })

  it('SET_ACTIVE_CITY_INDEX updates the index', () => {
    const state = { ...initialState, activeCityIndex: 0 }
    const next = reducer(state, { type: 'SET_ACTIVE_CITY_INDEX', index: 1 })
    expect(next.activeCityIndex).toBe(1)
  })

  it('SET_DISCOVERY_MODE updates discovery mode for the correct city', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx, kyotoCtx] }
    const next = reducer(state, { type: 'SET_DISCOVERY_MODE', cityIndex: 0, mode: 'deep' })
    expect(next.cityContexts[0].discoveryMode).toBe('deep')
    expect(next.cityContexts[1].discoveryMode).toBe('deep') // kyoto unchanged
  })

  it('SET_DISCOVERY_MODE does not mutate other cities', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx, kyotoCtx] }
    const next = reducer(state, { type: 'SET_DISCOVERY_MODE', cityIndex: 0, mode: 'deep' })
    expect(next.cityContexts[1].city).toBe('Kyoto')
    expect(next.cityContexts[1].discoveryMode).toBe('deep') // kyoto was already 'deep'
  })

  it('SET_DISCOVERY_MODE returns state unchanged if index out of range', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'SET_DISCOVERY_MODE', cityIndex: 5, mode: 'deep' })
    expect(next.cityContexts).toEqual([tokyoCtx])
  })
})
