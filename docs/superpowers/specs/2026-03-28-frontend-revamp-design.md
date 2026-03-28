# Frontend Revamp: React Migration Design

**Date:** 2026-03-28
**Status:** Approved

## Overview

Migrate the entire frontend from a single 5,738-line `index.html` (CSS + HTML + JS monolith) to a Vite + React + TypeScript + Tailwind CSS application. The goal is maintainability: every screen, feature, and API call has a clear, isolated home.

## Tech Stack

| Concern | Choice |
|---|---|
| Bundler | Vite |
| UI Library | React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS (replaces all inline `<style>` blocks) |
| Map | react-leaflet (wraps existing Leaflet dependency) |
| State | React built-ins: `useContext` + `useReducer` |
| Routing | State-driven (no URL routing — mobile linear flow) |
| Persistence | `localStorage` (auth + backend sync deferred to future iteration) |

No React Router. Screen transitions are controlled by a `currentScreen` field in the global store, matching the current `goTo()` behaviour.

## Project Structure

Module-based: each feature owns its components, hooks, and types internally. Cross-module primitives live in `shared/`.

```
src/
  modules/
    login/
      LoginScreen.tsx
      index.ts
    onboarding/
      OB1Ritual.tsx
      OB2Motivation.tsx
      OB3Style.tsx
      OB4LocationType.tsx
      OB5Pace.tsx
      OnboardingShell.tsx     # progress bar, back/next buttons
      useOnboarding.ts        # step state + answer accumulation
      types.ts
      index.ts
    profile/
      ProfileScreen.tsx       # edit mode for returning users
      useProfile.ts
      index.ts
    persona/
      PersonaScreen.tsx
      PersonaModal.tsx
      usePersona.ts
      types.ts
      index.ts
    destination/
      DestinationScreen.tsx
      CitySearch.tsx
      useCitySearch.ts
      types.ts
      index.ts
    map/
      MapScreen.tsx
      PinCard.tsx
      FilterBar.tsx
      useMap.ts
      types.ts
      index.ts
    route/
      RouteScreen.tsx
      ItineraryView.tsx
      RecSheet.tsx
      useRoute.ts
      types.ts
      index.ts
    navigation/
      NavScreen.tsx
      index.ts
  shared/
    questionnaire/            # question components shared by onboarding + profile
      RitualQuestion.tsx
      PaceQuestion.tsx
      AttractionQuestion.tsx
      types.ts
    ui/                       # reusable primitives
      Button.tsx
      Card.tsx
      BottomNav.tsx
      Toast.tsx
    api.ts                    # all backend calls, typed
    store.tsx                 # AppContext + useReducer
    types.ts                  # cross-module types: Place, TripContext, etc.
  App.tsx                     # entry logic + screen switcher
  main.tsx
```

## App Entry Logic

On every load, `App.tsx` checks `localStorage` for an existing persona:

```
persona in localStorage?
  yes → currentScreen = 'destination'   (skip onboarding)
  no  → currentScreen = 'login'         (full onboarding flow)
```

Returning users land on the destination/map screen. Profile editing is always accessible via the bottom nav.

## Screen Flow

```
login → ob1 → ob2 → ob3 → ob4 → ob5 → persona → destination → map → route → nav
                                                      ↑
                                          (returning users start here)

Bottom nav (visible post-onboarding):
  map  |  profile  |  saved itineraries
```

## Global State (`shared/store.tsx`)

Single `AppContext` with `useReducer`. Only cross-module data lives here; UI-only state (modal open, dropdown open, loading spinners) stays local with `useState`.

```ts
interface AppState {
  // Navigation
  currentScreen: Screen;

  // Onboarding
  obAnswers: OnboardingAnswers;

  // Persona (computed server-side, persisted to localStorage)
  persona: Persona | null;

  // City + map
  city: string;
  cityGeo: GeoData | null;
  places: Place[];
  selectedPlaces: Place[];
  activeFilter: Category | 'all';

  // Trip planning
  tripContext: TripContext | null;
  itinerary: Itinerary | null;
  weather: WeatherData | null;
  route: RouteData | null;

  // Saved
  savedItineraries: SavedItinerary[];
}
```

## API Layer (`shared/api.ts`)

All backend calls extracted into one typed module. The base URL moves to `.env` as `VITE_API_URL`.

```ts
export const api = {
  geocode:      (city: string)                        => Promise<GeoData>,
  mapData:      (params: MapParams)                   => Promise<Place[]>,
  citySearch:   (q: string)                           => Promise<CityResult[]>,
  route:        (points: LatLon[])                    => Promise<RouteData>,
  aiItinerary:  (body: ItineraryRequest)              => Promise<Itinerary>,
  weather:      (city: string)                        => Promise<WeatherData>,
  placeImage:   (name: string, city: string)          => Promise<string | null>,
  persona:      (answers: OnboardingAnswers, city: string) => Promise<Persona>,
}
```

## Onboarding vs Profile (Persona Editing)

**First-time users** go through `modules/onboarding/` — a linear wizard (OB1→OB5) with a progress bar, back/next buttons, and a final `/persona` API call. On completion, persona is saved to `localStorage` and the user lands on the destination screen.

**Returning users** access `modules/profile/` from the bottom nav. The Profile screen shows the same five question groups but in edit mode — pre-filled with existing answers, non-linear (any section can be opened independently). Saving any change re-calls `/persona` and updates `localStorage`.

Both modules consume the same components from `shared/questionnaire/` — no duplication of question UI.

## Tailwind CSS

The existing CSS custom properties (`--bg`, `--primary`, `--orange`, etc.) map to Tailwind theme tokens in `tailwind.config.ts`. Existing class names (`.ritual-card`, `.pace-card`, etc.) are replaced by Tailwind utility classes directly on JSX elements. No separate `.css` files except for Leaflet's stylesheet (third-party, imported once in `main.tsx`).

## Migration Order (Screen by Screen)

1. Scaffold Vite + React + TypeScript + Tailwind project
2. Set up `shared/store.tsx`, `shared/api.ts`, `shared/types.ts`
3. `modules/login/`
4. `shared/questionnaire/` + `modules/onboarding/` (OB1–OB5)
5. `modules/persona/`
6. `modules/destination/`
7. `modules/map/` (react-leaflet integration)
8. `modules/route/` (ItineraryView + RecSheet)
9. `modules/navigation/`
10. `modules/profile/` (persona edit mode)
11. `shared/ui/` (BottomNav, Toast — built incrementally alongside screens)
12. Vercel deployment config

## Out of Scope

- Authentication (Google/Apple sign-in) — placeholder UI retained, implementation deferred
- Backend changes (`main.py`, `ip_engine.py`) — unchanged
- New features — this is a migration, not a feature build
