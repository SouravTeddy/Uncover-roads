import { useState } from 'react';
import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ7Evening } from './ob-context-resolvers';
import type { OBEvening } from '../../shared/types';

const OPTIONS = [
  { value: 'dinner_wind', label: 'Dinner & wind down',    sublabel: 'Restaurant + one drink, ~10pm',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
  { value: 'markets',     label: 'Night markets',          sublabel: 'Evening markets, street food',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
  { value: 'early',       label: 'Early dinner',           sublabel: 'Dinner at 6–7pm, no evening block',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80' },
  { value: 'bars',        label: 'Bars & nightlife',       sublabel: 'Bar crawl, rooftop, stays late',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80' },
];

export function OB7Evening() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.evening ?? null) as OBEvening | null;
  const ctx = resolveQ7Evening(state.rawOBAnswers ?? {});
  const [showHidden, setShowHidden] = useState(false);

  // Contextual filtering: hide bars for family or halal users
  const isFamily = state.rawOBAnswers?.group === 'family';
  const isHalal  = state.rawOBAnswers?.dietary?.includes('halal') ?? false;
  const hideBars = isFamily || isHalal;

  const visible = OPTIONS.filter(o => !(o.value === 'bars' && hideBars));
  const hidden  = OPTIONS.filter(o =>   o.value === 'bars' && hideBars);

  return (
    <OnboardingShell step="ob7" canAdvance={value !== null} title={ctx.title} subtitle={ctx.subtitle}>
      <PhotoGrid2x2
        options={visible}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'evening', value: v as OBEvening })}
      />

      {hidden.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowHidden(v => !v)}
            className="flex items-center justify-center gap-2 py-2.5 w-full mt-2"
          >
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-surf-hst to-transparent" />
            <span className="text-[12px] font-semibold text-text-3 whitespace-nowrap">
              These don't feel right? See all options {showHidden ? '▴' : '▾'}
            </span>
            <span className="flex-1 h-px bg-gradient-to-l from-transparent via-surf-hst to-transparent" />
          </button>

          {showHidden && (
            <PhotoGrid2x2
              options={hidden}
              selected={value}
              onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'evening', value: v as OBEvening })}
            />
          )}
        </>
      )}
    </OnboardingShell>
  );
}
