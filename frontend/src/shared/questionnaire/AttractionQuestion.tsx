import type { Attraction } from '../types';
import { BentoCard } from './BentoCard';

const OPTIONS: { value: Attraction; label: string; sub: string; imageUrl: string; icon: string }[] = [
  { value: 'historic', label: 'Historic Places', sub: 'Cultural heritage',   imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=75', icon: 'museum' },
  { value: 'culture',  label: 'Local Culture',   sub: 'Traditions & rituals', imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=75', icon: 'groups' },
  { value: 'markets',  label: 'Busy Markets',    sub: 'Energy & street life', imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=75', icon: 'storefront' },
  { value: 'nature',   label: 'Quiet Nature',    sub: 'Parks & open air',     imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=75', icon: 'forest' },
];

interface Props {
  value: Attraction[];
  onChange: (v: Attraction[]) => void;
}

export function AttractionQuestion({ value, onChange }: Props) {
  function toggle(attr: Attraction) {
    onChange(
      value.includes(attr) ? value.filter(a => a !== attr) : [...value, attr]
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map(opt => (
        <BentoCard
          key={opt.value}
          label={opt.label}
          sub={opt.sub}
          imageUrl={opt.imageUrl}
          selected={value.includes(opt.value)}
          onSelect={() => toggle(opt.value)}
        />
      ))}
    </div>
  );
}
