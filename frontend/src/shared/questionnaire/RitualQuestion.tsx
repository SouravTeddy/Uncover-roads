import type { Ritual } from '../types';
import { BentoCard } from './BentoCard';

const OPTIONS: { value: Ritual; label: string; sub: string; imageUrl: string }[] = [
  { value: 'coffee',  label: 'Coffee',  sub: 'Energizing brew',  imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=75' },
  { value: 'tea',     label: 'Tea',     sub: 'Calming leaf',     imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=75' },
  { value: 'alcohol', label: 'Alcohol', sub: 'Social spirits',   imageUrl: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=75' },
  { value: 'neither', label: 'None',    sub: 'Pure hydration',   imageUrl: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=400&q=75' },
];

interface Props {
  value: Ritual | null;
  onChange: (v: Ritual) => void;
}

export function RitualQuestion({ value, onChange }: Props) {
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
