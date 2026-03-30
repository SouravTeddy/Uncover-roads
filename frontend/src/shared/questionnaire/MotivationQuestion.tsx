import type { Sensory } from '../types';
import { BentoCard } from './BentoCard';

const OPTIONS: { value: Sensory; label: string; sub: string; imageUrl: string }[] = [
  { value: 'visual',   label: 'Visuals',   sub: 'Architecture & hidden vistas', imageUrl: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=75' },
  { value: 'taste',    label: 'Taste',     sub: 'Gastronomy & local spirits',   imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=75' },
  { value: 'history',  label: 'History',   sub: 'Forgotten lore & heritage',    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=400&q=75' },
  { value: 'movement', label: 'Movement',  sub: 'Pacing & urban exploration',   imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=75' },
];

interface Props {
  value: Sensory | null;
  onChange: (v: Sensory) => void;
}

export function MotivationQuestion({ value, onChange }: Props) {
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
