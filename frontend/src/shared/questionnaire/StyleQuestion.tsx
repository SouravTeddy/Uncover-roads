import type { TravelStyle } from '../types';
import { BentoCard } from './BentoCard';

const OPTIONS: { value: TravelStyle; label: string; sub: string; imageUrl: string }[] = [
  { value: 'planner',      label: 'Planned',      sub: 'Expected and pristine',  imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=75' },
  { value: 'spontaneous',  label: 'Spontaneous',  sub: 'Freedom and surprise',   imageUrl: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&q=75' },
  { value: 'balanced',     label: 'Balanced',     sub: 'Best of both worlds',    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&q=75' },
  { value: 'adventurous',  label: 'Adventurous',  sub: 'Bold and offbeat',       imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=75' },
];

interface Props {
  value: TravelStyle | null;
  onChange: (v: TravelStyle) => void;
}

export function StyleQuestion({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map(opt => (
        <BentoCard
          key={opt.value}
          label={opt.label}
          sub={opt.sub}
          imageUrl={opt.imageUrl}
          selected={value === opt.value}
          onSelect={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
}
