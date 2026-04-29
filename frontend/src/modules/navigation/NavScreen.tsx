import { useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useAppStore } from '../../shared/store';
import type { ItineraryStop, Place, TripContext } from '../../shared/types';
import { CATEGORY_ICONS } from '../map/types';

// ── Time helpers (local, minimal) ─────────────────────────────

function parseTimeLabel(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${(h % 12) || 12}:${m < 10 ? '0' : ''}${m} ${ap}`;
}

function parseDurationMins(s?: string): number {
  if (!s) return 60;
  const hm = s.match(/(\d+\.?\d*)\s*h/i);
  const mm = s.match(/(\d+)\s*min/i);
  return (hm ? parseFloat(hm[1]) * 60 : 0) + (mm ? parseInt(mm[1]) : 0) || 60;
}

function parseTransitMins(s?: string): number {
  if (!s) return 10;
  const mm = s.match(/(\d+)\s*min/i);
  const hh = s.match(/(\d+)\s*h/i);
  return (mm ? parseInt(mm[1]) : 0) + (hh ? parseInt(hh[1]) * 60 : 0) || 10;
}

function calcStartMins(tripContext: TripContext, aiStartTime?: string): number {
  const [hh, mm] = (tripContext.arrivalTime ?? '09:00').split(':').map(Number);
  const arrivalMins = hh * 60 + (mm || 0);

  if (aiStartTime) {
    const m12 = aiStartTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m12) {
      let h = parseInt(m12[1]);
      const mn = parseInt(m12[2]);
      if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return h * 60 + mn;
    }
    const m24 = aiStartTime.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
  }

  const isOvernight = arrivalMins < 6 * 60;
  const isEarly = arrivalMins >= 6 * 60 && arrivalMins < 9 * 60;
  const hasBase = tripContext.startType === 'hotel' || tripContext.startType === 'airport';
  if (isOvernight && hasBase) return 8 * 60;
  if (isEarly && hasBase) return arrivalMins + 60;
  if (hasBase) return arrivalMins + 30;
  return arrivalMins;
}

function parseStopTimeMins(t?: string): number | null {
  if (!t) return null;
  const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let h = parseInt(m12[1]); const mn = parseInt(m12[2]);
    if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + mn;
  }
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
  return null;
}

// ── Category styling ──────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  restaurant: { bg: 'rgba(251,146,60,.15)',  text: '#fb923c' },
  cafe:       { bg: 'rgba(250,204,21,.15)',  text: '#fbbf24' },
  park:       { bg: 'rgba(74,222,128,.15)',  text: '#4ade80' },
  museum:     { bg: 'rgba(129,140,248,.15)', text: '#818cf8' },
  historic:   { bg: 'rgba(196,181,253,.15)', text: '#c4b5fd' },
  tourism:    { bg: 'rgba(56,189,248,.15)',  text: '#38bdf8' },
  place:      { bg: 'rgba(148,163,184,.15)', text: '#94a3b8' },
};

function personaMatchNote(archetype: string | undefined, category: string | null): string | null {
  const a = (archetype ?? '').toLowerCase();
  if (!category) return null;
  if (a === 'historian'     && (category === 'historic' || category === 'museum'))  return 'Matched to your love of history';
  if (a === 'epicurean'     && (category === 'restaurant' || category === 'cafe'))  return 'Matched to your love of food';
  if (a === 'wanderer'      && (category === 'place' || category === 'park'))       return 'Perfect for your wandering spirit';
  if (a === 'voyager'       && (category === 'museum' || category === 'tourism'))   return 'Curated for your travel style';
  if (a === 'explorer'      && (category === 'park' || category === 'tourism'))     return 'Fuels your explorer spirit';
  if (a === 'slowtraveller' && (category === 'cafe' || category === 'park'))        return 'Perfect for slow travel';
  if (a === 'pulse'         && (category === 'restaurant' || category === 'place')) return "Right in the city's pulse";
  return null;
}

// OpenFreeMap style — same as main map
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// ── Mini map component ────────────────────────────────────────

function MiniMap({ coords }: { coords: [number, number][] }) {
  const mapRef = useRef<MapRef>(null);

  // Fit bounds after map loads
  const handleLoad = () => {
    if (!mapRef.current || coords.length < 2) return;
    const lats = coords.map(c => c[0]);
    const lons = coords.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    try {
      mapRef.current.fitBounds(
        [[minLon, minLat], [maxLon, maxLat]],
        { padding: 24, animate: false }
      );
    } catch { /* ignore */ }
  };

  // Build GeoJSON line
  const lineGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      // MapLibre uses [lon, lat]
      coordinates: coords.map(([lat, lon]) => [lon, lat]),
    },
    properties: {},
  };

  const center = coords[0];

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        latitude: center[0],
        longitude: center[1],
        zoom: 13,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={STYLE_URL}
      interactive={false}
      onLoad={handleLoad}
    >
      <Source id="route" type="geojson" data={lineGeoJSON}>
        <Layer
          id="route-line"
          type="line"
          paint={{
            'line-color': '#f97316',
            'line-width': 2.5,
            'line-opacity': 0.7,
            'line-dasharray': [2, 2],
          }}
        />
      </Source>
      {coords.map((c, i) => {
        const isFirst = i === 0;
        const isLast = i === coords.length - 1;
        const color = isFirst ? '#4ade80' : isLast ? '#f97316' : '#ffffff';
        const size = isFirst || isLast ? 12 : 8;
        return (
          <Marker key={i} latitude={c[0]} longitude={c[1]}>
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: color,
                border: '2px solid rgba(10,14,20,.8)',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </Marker>
        );
      })}
    </Map>
  );
}

// ── Main screen ───────────────────────────────────────────────

export function NavScreen() {
  const { state, dispatch } = useAppStore();
  const { city, itinerary, tripContext, selectedPlaces, persona, weather } = state;

  const stops = itinerary?.itinerary ?? [];
  const summary = itinerary?.summary;
  const archetype = persona?.archetype;

  // Calculate per-stop timings
  const startMins = calcStartMins(tripContext, summary?.suggested_start_time);
  interface StopTimed { stop: ItineraryStop; startMins: number; endMins: number; category: string | null; matched: Place | null }
  const timed: StopTimed[] = [];
  let running = startMins;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (i === 0) {
      // Use AI-assigned time for first stop so source→first gap is realistic
      const aiMins = parseStopTimeMins(stop.time);
      if (aiMins !== null && aiMins > startMins) running = aiMins;
      else running = startMins + 20;
    } else {
      const prev = stops[i - 1];
      running += Math.max(30, parseDurationMins(prev.duration));
      running += parseTransitMins(prev.transit_to_next);
    }
    const endMins = running + parseDurationMins(stop.duration);
    const nameLower = (stop.place ?? '').toLowerCase();
    const matched = selectedPlaces.find(p => {
      const t = p.title.toLowerCase();
      return t === nameLower || nameLower.includes(t.slice(0, 8)) || t.includes(nameLower.slice(0, 8));
    }) ?? null;
    timed.push({ stop, startMins: running, endMins, category: matched?.category ?? null, matched });
  }

  // Coords for polyline + map bounds
  const coords: [number, number][] = timed
    .map(t => {
      const lat = t.stop.lat ?? t.matched?.lat;
      const lon = t.stop.lon ?? t.matched?.lon;
      return lat != null && lon != null ? [lat, lon] as [number, number] : null;
    })
    .filter((c): c is [number, number] => c !== null);

  const hasMap = coords.length >= 2;

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col" style={{ zIndex: 20 }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b border-[var(--color-divider)]"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: '1rem',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'route' })}
            className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          >
            <span className="ms text-[var(--color-text-2)] text-base">arrow_back</span>
          </button>
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-1)] text-base truncate">
              {city ? `${city} Journey` : 'Your Journey'}
            </h1>
            <p className="text-[var(--color-text-3)] text-xs">{timed.length} stops · starts {parseTimeLabel(startMins)}</p>
          </div>
        </div>
        {weather && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[var(--color-border)] flex-shrink-0 bg-[var(--color-surface)]"
          >
            <span className="text-[var(--color-text-1)] text-xs font-bold">{weather.temp}°</span>
            <span className="text-[var(--color-text-3)] text-xs">{weather.condition}</span>
          </div>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Mini map */}
        {hasMap && (
          <div className="mx-4 mt-4 rounded-[20px] overflow-hidden border border-[var(--color-border)] [box-shadow:var(--shadow-md)]" style={{ height: 180 }}>
            <MiniMap coords={coords} />
          </div>
        )}

        {/* Pro tip banner */}
        {summary?.pro_tip && (
          <div
            className="mx-4 mt-3 flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-amber-400/20"
            style={{ background: 'rgba(251,191,36,.08)' }}
          >
            <span className="ms fill text-amber-400 text-base flex-shrink-0 mt-px">lightbulb</span>
            <p className="text-amber-200/80 text-xs leading-relaxed">{summary.pro_tip}</p>
          </div>
        )}

        {/* Stop cards */}
        <div className="px-4 pt-4 pb-32 flex flex-col gap-3">
          {timed.map((t, i) => (
            <StopCard
              key={i}
              index={i}
              total={timed.length}
              stop={t.stop}
              startMins={t.startMins}
              endMins={t.endMins}
              category={t.category}
              archetype={archetype}
              city={city}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="absolute inset-x-0 bottom-0 px-4 py-3 border-t border-[var(--color-divider)]"
        style={{
          background: 'rgba(10,14,20,.95)',
          backdropFilter: 'blur(12px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
        }}
      >
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
          className="w-full h-12 rounded-2xl font-bold text-sm border border-[var(--color-border)] text-[var(--color-text-2)] bg-[var(--color-surface)]"
        >
          End Journey
        </button>
      </div>
    </div>
  );
}

// ── Stop card ─────────────────────────────────────────────────

interface StopCardProps {
  index: number;
  total: number;
  stop: ItineraryStop;
  startMins: number;
  endMins: number;
  category: string | null;
  archetype: string | undefined;
  city: string;
}

function StopCard({ index, total: _total, stop, startMins, endMins, category, archetype, city }: StopCardProps) {
  const catStyle = CATEGORY_COLORS[category ?? ''] ?? CATEGORY_COLORS.place;
  const icon = CATEGORY_ICONS[category ?? ''] ?? 'location_on';
  const durationMins = endMins - startMins;
  const durationLabel = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
    : `${durationMins}m`;
  const personaNote = personaMatchNote(archetype, category);

  const mapsUrl = stop.lat != null && stop.lon != null
    ? `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.place + ' ' + city)}`;

  return (
    <div
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 [box-shadow:var(--shadow-md)] overflow-hidden"
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-0 py-0 pb-3 border-b border-[var(--color-divider)]"
      >
        <div className="flex items-center gap-2.5">
          {/* Stop number */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: catStyle.bg, border: `1px solid ${catStyle.text}30` }}
            >
              <span style={{ color: catStyle.text, fontSize: 10, fontWeight: 700, fontFamily: 'system-ui,sans-serif' }}>
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
          </div>
          {/* Category */}
          <div className="flex items-center gap-1.5">
            <span className="ms fill text-sm" style={{ color: catStyle.text }}>{icon}</span>
            <span className="text-xs capitalize" style={{ color: catStyle.text }}>
              {category ?? 'place'}
            </span>
          </div>
        </div>
        {/* Time */}
        <div className="flex items-center gap-1.5">
          <span className="ms text-[var(--color-text-3)] text-xs">schedule</span>
          <span className="text-[var(--color-text-2)] text-xs font-semibold">{parseTimeLabel(startMins)}</span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-0 py-3.5 flex flex-col gap-3">
        {/* Place name */}
        <h2 className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[var(--color-text-1)] leading-tight">{stop.place}</h2>

        {/* Tip / what to expect */}
        {stop.tip && (
          <p className="text-[var(--color-text-2)] text-sm leading-relaxed">{stop.tip}</p>
        )}

        {/* Persona match */}
        {personaNote && (
          <div className="flex items-center gap-1.5">
            <span className="ms fill text-xs" style={{ color: catStyle.text }}>auto_awesome</span>
            <span className="text-xs" style={{ color: catStyle.text }}>{personaNote}</span>
          </div>
        )}

        {/* Tags */}
        {(stop.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(stop.tags ?? []).map(tag => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}

        {/* Duration + Open in Maps row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="ms text-[var(--color-text-3)] text-xs">timer</span>
            <span className="text-[var(--color-text-3)] text-xs">~{durationLabel}</span>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-surface)] text-[var(--color-text-2)] border border-[var(--color-border)]"
          >
            <span className="ms text-xs">open_in_new</span>
            Open in Maps
          </a>
        </div>
      </div>

      {/* Transit connector to next stop */}
      {stop.transit_to_next && (
        <div
          className="flex items-center gap-2 px-0 py-2.5 border-t border-[var(--color-divider)]"
        >
          <span className="ms fill text-[var(--color-text-3)] text-sm">arrow_downward</span>
          <span className="text-[var(--color-text-3)] text-xs leading-relaxed flex-1">{stop.transit_to_next}</span>
        </div>
      )}
    </div>
  );
}

// ── Tag chip ──────────────────────────────────────────────────

const TAG_STYLES: Record<string, { bg: string; color: string; icon: string; label: string }> = {
  heat:     { bg: 'rgba(245,158,11,.12)',  color: '#fbbf24', icon: 'thermometer',  label: 'Heat' },
  jetlag:   { bg: 'rgba(99,102,241,.12)',  color: '#818cf8', icon: 'flight',       label: 'Jet lag' },
  ramadan:  { bg: 'rgba(168,85,247,.12)',  color: '#c084fc', icon: 'nights_stay',  label: 'Ramadan' },
  altitude: { bg: 'rgba(20,184,166,.12)',  color: '#2dd4bf', icon: 'landscape',    label: 'Altitude' },
};

function TagChip({ tag }: { tag: string }) {
  const s = TAG_STYLES[tag] ?? { bg: 'rgba(255,255,255,.06)', color: '#9ca3af', icon: 'label', label: tag };
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-full"
      style={{ background: s.bg }}
    >
      <span className="ms fill text-xs" style={{ color: s.color }}>{s.icon}</span>
      <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}
