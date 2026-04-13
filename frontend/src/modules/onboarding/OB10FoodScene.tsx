import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBFoodScene } from '../../shared/types';

const OPTIONS: { value: OBFoodScene; label: string; description: string; imageUrl: string }[] = [
  { value: 'street',     label: 'Street food & markets',   description: 'Stalls, market lanes, casual eating',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
  { value: 'restaurant', label: 'Restaurant & chef culture', description: 'Sit-down dining, reservations',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'cafe',       label: 'Cafés & brunch spots',    description: 'Daytime food focus, coffee culture',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&q=80' },
  { value: 'bars',       label: 'Bars & drinking culture', description: 'Drink-led evening scene',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=120&q=80' },
];

export function OB10FoodScene() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.food_scene ?? null) as OBFoodScene | null;

  return (
    <OnboardingShell step="ob10" canAdvance={value !== null}
      title="What kind of food scene?"
      subtitle="Shapes which food venues anchor your itinerary.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'food_scene', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
