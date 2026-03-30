import type { Pace } from '../types';
import { BentoCard } from './BentoCard';

const OPTIONS: { value: Pace; label: string; sub: string; imageUrl: string }[] = [
  { value: 'walking', label: 'Walking',          sub: 'Explore on foot',       imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=75' },
  { value: 'transit', label: 'Public Transport', sub: 'Metro & buses',         imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=75' },
  { value: 'self',    label: 'Self Transport',   sub: 'Car or bike',           imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&q=75' },
  { value: 'any',     label: 'No Preference',    sub: 'Whatever works',        imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=75' },
];

interface Props {
  value: Pace | null;
  onChange: (v: Pace) => void;
}

export function PaceQuestion({ value, onChange }: Props) {
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
