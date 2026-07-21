import type { FavouritedPin, SavedEvent } from '../../shared/types';
import { SavedPlaceCard } from './SavedPlaceCard';
import { SavedEventCard } from './SavedEventCard';

interface CityGroup {
  city: string;
  pins: FavouritedPin[];
  events: SavedEvent[];
}

function buildCityGroups(pins: FavouritedPin[], events: SavedEvent[]): CityGroup[] {
  const cityMap = new Map<string, CityGroup>();

  for (const pin of pins) {
    const c = pin.city || 'Other';
    if (!cityMap.has(c)) cityMap.set(c, { city: c, pins: [], events: [] });
    cityMap.get(c)!.pins.push(pin);
  }

  for (const event of events) {
    const c = event.city || 'Other';
    if (!cityMap.has(c)) cityMap.set(c, { city: c, pins: [], events: [] });
    cityMap.get(c)!.events.push(event);
  }

  return Array.from(cityMap.values());
}

interface Props {
  favouritedPins: FavouritedPin[];
  savedEvents: SavedEvent[];
  onOpenMap: (pin: FavouritedPin) => void;
  onRemovePin: (placeId: string) => void;
  onRemoveEvent: (id: string) => void;
}

export function SavedPlacesTab({ favouritedPins, savedEvents, onOpenMap, onRemovePin, onRemoveEvent }: Props) {
  const groups = buildCityGroups(favouritedPins, savedEvents);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
        <span className="ms text-[var(--color-text-4)]" style={{ fontSize: 44 }}>bookmark_border</span>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-2)] mb-1">No saved places yet</p>
          <p className="text-xs text-[var(--color-text-3)] leading-relaxed">
            Tap ❤️ on any pin on the map to save it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {groups.map(group => {
        const placeCount = group.pins.length;
        const eventCount = group.events.length;
        const countLabel = [
          placeCount > 0 ? `${placeCount} ${placeCount === 1 ? 'place' : 'places'}` : null,
          eventCount > 0 ? `${eventCount} ${eventCount === 1 ? 'event' : 'events'}` : null,
        ].filter(Boolean).join(' · ');

        return (
          <div key={group.city} className="mb-6">
            {/* City header */}
            <div className="flex items-center gap-2 px-4 mb-3 mt-4">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-[var(--color-text-1)]">{group.city}</span>
                {countLabel && (
                  <span className="text-xs text-[var(--color-text-3)] ml-2">{countLabel}</span>
                )}
              </div>
            </div>

            {/* Masonry grid — 2 columns */}
            {group.pins.length > 0 && (
              <div className="px-4 grid grid-cols-2 gap-2 mb-3">
                {group.pins.map((pin, i) => (
                  <SavedPlaceCard
                    key={pin.placeId}
                    pin={pin}
                    category={pin.category ?? 'place'}
                    tall={i === 0}
                    onRemove={onRemovePin}
                    onClick={() => onOpenMap(pin)}
                  />
                ))}
              </div>
            )}

            {/* Saved events */}
            {group.events.length > 0 && (
              <div className="px-4 flex flex-col gap-2 mb-3">
                {group.events.map(event => (
                  <SavedEventCard key={event.id} event={event} onRemove={onRemoveEvent} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
