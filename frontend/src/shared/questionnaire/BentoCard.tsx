interface Props {
  label: string;
  sub: string;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
}

export function BentoCard({ label, sub, imageUrl, selected, onSelect }: Props) {
  return (
    <div
      onClick={onSelect}
      className={`relative overflow-hidden rounded-2xl cursor-pointer aspect-square transition-all ${
        selected ? 'ring-2 ring-primary' : 'ring-1 ring-white/8'
      }`}
    >
      <img
        src={imageUrl}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Check */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <span className="ms fill text-white text-sm">check</span>
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="text-white font-heading font-semibold text-sm">{label}</div>
        <div className="text-white/60 text-xs">{sub}</div>
      </div>
    </div>
  );
}
