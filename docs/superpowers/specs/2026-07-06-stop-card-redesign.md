# Stop Card Redesign — Implementation Spec

**Goal:** Redesign `ReelStopCard` with a 4-group content structure, provenance labels, correct data fields, and fixed layout issues. The proto at `stop-card-v3.html` is the visual reference.

**Pipeline dependency:** Stop cards are rendered after Phase 1 (scheduling) completes. `transitFromPrev`, visit times, crowd windows, and `timingAdjustment` fields are all Phase 1 outputs — the card must not render before they are available.

---

## Files to Change

- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx`
- Reference types: `frontend/src/modules/route/reel/types.ts` (read-only — no type changes needed)

---

## Current Problems to Fix

1. **Collapsed card hidden behind bottom nav** — bottom padding insufficient; the nav bar overlaps the last content row
2. **Expanded height too short** — panel opens to `68dvh`; needs to be taller so users scroll less
3. **No provenance label** — user can't tell if a stop was their pick or the engine's
4. **Google Maps CTA present** — must be removed; we cannot redirect users to Google Maps
5. **Directions section present** — must be removed; direction button exists at end of reel
6. **`localTip` not shown** — field exists on `EngineItineraryStop`, never rendered
7. **`transitFromPrev` not in Getting here** — field exists, not rendered
8. **No content grouping** — all fields are a flat list; needs 4 distinct groups
9. **"Why we picked this" shows for user-added stops** — should be engine-added only
10. **Hyphens in content** — must be removed; use plain prose

---

## Collapsed State Changes

**Current:** photo + topbar + panel with title, meta row, pills, quick facts
**New:** same structure, two changes:
1. **Bottom padding fix** — add `paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))'` to the scroll container so content never hides behind the nav bar
2. **Remove button position** — already exists in collapsed header (`sc-meta-row`), no change needed

---

## Expanded State Changes

Expanded panel currently opens to `top: 32%` (approx 68dvh). Change to `top: 14%` — gives roughly 86dvh of panel height. This is the single CSS change for panel height.

---

## Provenance Label

Add immediately below the stop title, above the location row. Render conditionally:

```tsx
{stop.isUserAdded && (
  <div className="sc-provenance prov-user">
    <span className="ms">bookmark</span>
    You added this
  </div>
)}
{stop.isEngineAdded && (
  <div className="sc-provenance prov-engine">
    <span className="ms">auto_awesome</span>
    We added this
  </div>
)}
```

CSS (add to stylesheet):
```css
.sc-provenance {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; margin-bottom: 4px;
}
.prov-user  { color: rgba(232,160,48,.72); }   /* amber */
.prov-engine { color: rgba(79,143,171,.72); }  /* blue */
```

---

## 4-Group Content Structure

Replace the current flat content inside `sc-scroll` with four groups. Each group is a `<div className="grp [color]">`.

### Group 1 — Getting here (sky)

Source: `stop.transitFromPrev` (`TransitInfo` type)

```tsx
<div className="grp sky">
  <div className="grp-label">Getting here</div>

  {/* Walk row — always shown if walk data exists */}
  {transitFromPrev?.walk_distance_m && (
    <div className="transit-row">
      <span className="ms">directions_walk</span>
      <span>
        {walkMins} min walk from {prevStopTitle},
        {formatDistance(transitFromPrev.walk_distance_m)}
        {transitFromPrev.walk_via?.length
          ? ` via ${transitFromPrev.walk_via.slice(0,2).join(' and ')}`
          : ''}
      </span>
    </div>
  )}

  {/* Transit row — only if city has transit between these stops */}
  {transitFromPrev?.has_transit && (
    <div className="transit-row">
      <span className="ms">subway</span>
      <span>
        {transitFromPrev.duration_min} min ·
        {transitLabel} · board at {transitFromPrev.departure_stop}
      </span>
    </div>
  )}

  {/* Off-route note — for engine-added stops that are off the direct path */}
  {stop.isEngineAdded && stop.detourKm > 0 && (
    <div className="transit-row">
      <span className="ms">fork_right</span>
      <span>{stop.detourKm} km off your direct route</span>
    </div>
  )}
</div>
```

If `transitFromPrev` is null (first stop of the day or no data yet), show a placeholder row: "Starting point for this day."

### Group 2 — At this stop (neutral)

Unchanged from current implementation: visit time window, crowd track bar with crowd labels, crowd note, hours row. Only change: remove the hyphens from `crowdNote` text (strip " — " patterns and rewrite as plain prose sentences).

### Group 3a — About this place (neutral)

```tsx
<div className="grp">
  <div className="grp-label">About this place</div>
  <p className="about-desc">{stop.description}</p>
  <div className="about-meta">
    <RatingPill rating={stop.rating} reviewCount={stop.reviewCount} />
    {stop.priceLevel && <PricePill level={stop.priceLevel} />}
    {stop.typicalDurationMin && <DurPill mins={stop.typicalDurationMin} />}
  </div>
  {/* Website only — no Google Maps CTA */}
  {stop.websiteUrl && (
    <a href={stop.websiteUrl} className="website-cta">
      <span className="ms">language</span>
      {extractDomain(stop.websiteUrl)}
      <span className="ms" style={{fontSize:11,opacity:.35}}>open_in_new</span>
    </a>
  )}
</div>
```

**Remove:** any `<a>` linking to `maps.google.com` or `maps.googleapis.com`. Remove the directions/navigate CTA entirely.

### Group 3b — Local insight (amber) — always shown if localTip exists

```tsx
{stop.localTip && (
  <div className="grp amber">
    <div className="tip-label">
      Local insight <span className="llm">✦</span>
    </div>
    <p className="tip-text">{stop.localTip}</p>
    {stop.hotelAnchor && (
      <div className="ctx-row">
        <span className="ms">hotel</span>
        <span>{stop.hotelAnchor}</span>
      </div>
    )}
    {stop.pairWith && (
      <div className="ctx-row">
        <span className="ms">link</span>
        <span>Pairs well with {stop.pairWith}</span>
      </div>
    )}
  </div>
)}
```

### Group 3c — Why we added this (sage) — engine-added stops only

```tsx
{stop.isEngineAdded && (
  <div className="grp sage">
    <div className="engine-label">Why we added this</div>
    <p className="insight-text">{reasonText}</p>
    {stop.timingAdjustment && (
      <div className="timing-note">
        <span className="ms">schedule</span>
        <span>{stop.timingAdjustment}</span>
      </div>
    )}
  </div>
)}
```

`reasonText` derivation (existing logic, keep unchanged):
- `isEngineAdded` + `orderReason` → use `orderConsequence` if present, else `whyForYou`
- `isUserAdded` → render nothing (whole group hidden)

### Group 4 — Next stop (sky)

```tsx
<div className="grp sky">
  <div className="grp-label">Next stop</div>
  <div className="next-row">
    <span className="ms" style={{fontSize:20, color:'rgba(79,143,171,.75)'}}>
      {nextStop.modeIcon}
    </span>
    <div>
      <div className="next-place">{nextStop.title}</div>
      <div className="next-meta">
        {nextTransit?.walk_duration_min} min walk,
        {formatDistance(nextTransit?.walk_distance_m)}
      </div>
    </div>
  </div>
</div>
```

For the last stop of the day: if `hotelAnchor` exists on this stop, show hotel check-in as the next destination instead. If no next stop and no hotel, omit Group 4.

---

## Explore Nearby CTA

Remains at the very bottom of the scroll area, after Group 4. No change to this element.

---

## When the Itinerary Updates

**Stop added or removed:**
- Phase 1 re-runs → new `visit_times` and `transitFromPrev` for all stops in that day
- All stop cards in the affected day re-render from the new Phase 1 output
- `stopIndex` ("Stop X of Y") updates across all cards automatically
- No special invalidation needed — cards are always derived from Phase 1 output

**Hotel added:**
- Hotel becomes the terminal stop for the day
- The last stop's Group 4 changes: "Next stop" points to hotel check-in with walk time
- `hotelAnchor` is populated on every stop within 1 km of the hotel: shown as a context row in Group 3b ("0.4 km from your hotel. Natural stopping point.")
- If no hotel was previously set, stops that lacked a Group 4 destination now get one

**Check-in time added or changed:**
- Phase 1 re-runs with check-in as a hard deadline
- Backward scheduling may push earlier stops earlier in the day
- `timingAdjustment` field on affected stops gets updated (e.g. "Moved to 3 PM to leave time for hotel check-in at 5 PM")
- Group 3c on affected engine-added stops will show the new `timingAdjustment` note

**Check-out time added or changed:**
- Phase 1 re-runs with check-out as the day's earliest start time
- Forward scheduling propagates → first stop of the day shifts later
- `transitFromPrev` on the first stop updates to reflect new departure timing

---

## Removed Elements

| Element | Where it was | Reason |
|---|---|---|
| Google Maps "Open in Maps" link | About this place | Cannot redirect to Google Maps |
| "Get directions" / navigate CTA | About this place | Directions button exists at reel end |
| Hyphens in crowd notes / tip text | Group 2, Group 3b | Content style — use plain prose |

---

## `TransitInfo` fields used

From `frontend/src/modules/route/reel/types.ts` (`TransitInfo` interface):

| Field | Used in |
|---|---|
| `walk_distance_m` | Group 1: walk distance display |
| `walk_duration_min` | Group 1: walk time display |
| `walk_via` | Group 1: street names |
| `has_transit` | Group 1: show/hide transit row |
| `transit_type` | Group 1: icon + label |
| `line_name` | Group 1: transit line label |
| `departure_stop` | Group 1: board at |
| `duration_min` | Group 1: transit duration |

---

## `EngineItineraryStop` fields used

All from `frontend/src/modules/route/reel/types.ts`:

| Field | Used in |
|---|---|
| `isUserAdded` / `isEngineAdded` | Provenance label, Group 3c visibility |
| `transitFromPrev` | Group 1 |
| `localTip` | Group 3b |
| `hotelAnchor` | Group 3b context row + Group 4 last-stop fallback |
| `pairWith` | Group 3b context row |
| `timingAdjustment` | Group 3c timing note |
| `orderReason` / `orderConsequence` / `whyForYou` | Group 3c reasonText |
| `description` | Group 3a |
| `rating`, `reviewCount` | Group 3a |
| `priceLevel` | Group 3a |
| `typicalDurationMin` | Group 3a |
| `websiteUrl` | Group 3a |
| `time` (visit time) | Group 2 |
| `signals` (crowd_ratio) | Group 2 crowd track |
| `detourKm` | Group 1 off-route note |

---

## Implementation Order

1. Fix collapsed bottom padding (2-line change)
2. Change expanded panel height (`top: 14%`)
3. Add provenance label CSS + JSX
4. Remove Maps CTA and directions button
5. Restructure content into 4 groups
6. Add `localTip` rendering (Group 3b)
7. Add `transitFromPrev` rendering (Group 1)
8. Add `timingAdjustment` / `pairWith` / `hotelAnchor` rendering
9. Hide Group 3c for `isUserAdded` stops
10. Test against proto: both "You added this" and "We added this" variants
