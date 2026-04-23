import type { Place } from '../../shared/types';
import { CityHeroCard } from './CityHeroCard';
import { PlaceChips } from './PlaceChips';
import { DraftBanner } from './DraftBanner';
import { PlacePhotoScroll } from './PlacePhotoScroll';

interface Props {
  city: string;
  selectedPlaces: Place[];
  startDate: string | null;
  endDate: string | null;
  onResume: () => void;
  onChipTap: (place: Place) => void;
  onPlaceTap: (place: Place) => void;
  onAddTap: () => void;
}

export function InProgressSection({
  city,
  selectedPlaces,
  startDate,
  endDate,
  onResume,
  onChipTap,
  onPlaceTap,
  onAddTap,
}: Props) {
  return (
    <div
      className="mx-4 mt-3 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(20,16,36,0.9)',
        border: '1px solid rgba(176,108,255,0.12)',
      }}
    >
      {/* Section header */}
      <div
        className="px-3.5 py-2.5"
        style={{ borderBottom: '1px solid rgba(176,108,255,0.08)' }}
      >
        <p
          className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color: '#b06cff' }}
        >
          In Progress
        </p>
      </div>

      {/* City hero */}
      <div className="pt-2.5">
        <CityHeroCard
          city={city}
          selectedPlaces={selectedPlaces}
          startDate={startDate}
          endDate={endDate}
          onResume={onResume}
        />
      </div>

      {/* Place chips */}
      <PlaceChips places={selectedPlaces} onChipTap={onChipTap} />

      {/* Hairline divider */}
      <div className="mx-3 mb-2.5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Draft banner */}
      <DraftBanner
        city={city}
        selectedPlaces={selectedPlaces}
        startDate={startDate}
        endDate={endDate}
        onTap={onResume}
      />

      {/* Hairline divider */}
      <div className="mx-3 mb-2.5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Place photo scroll */}
      <PlacePhotoScroll
        places={selectedPlaces}
        onPlaceTap={onPlaceTap}
        onAddTap={onAddTap}
      />
    </div>
  );
}
