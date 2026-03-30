export type ObStep = 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5';

export const OB_STEPS: ObStep[] = ['ob1', 'ob2', 'ob3', 'ob4', 'ob5'];

export const OB_STEP_INDEX: Record<ObStep, number> = {
  ob1: 0, ob2: 1, ob3: 2, ob4: 3, ob5: 4,
};

export const STEP_TITLES: Record<ObStep, string> = {
  ob1: 'Choose your ritual.',
  ob2: 'What drives your journey?',
  ob3: 'What is your travel style?',
  ob4: 'Hidden Gems or History?',
  ob5: 'How do you prefer to explore?',
};

export const STEP_SUBTITLES: Record<ObStep, string> = {
  ob1: 'How do you prefer to anchor your daily energy?',
  ob2: 'What motivates you to visit a new place?',
  ob3: 'Select how you love to plan your travel.',
  ob4: 'What do you look forward to the most? Pick all that apply.',
  ob5: 'Select your preferred mode of transport.',
};
