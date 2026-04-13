export type ObStep = 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
                   | 'ob8' | 'ob9' | 'ob10';

export const BASE_OB_STEPS: ObStep[] = ['ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7'];
export const CONDITIONAL_STEPS: Record<string, ObStep> = {
  family:    'ob8',
  budget:    'ob9',
  eat_drink: 'ob10',
};

export const OB_STEP_INDEX: Record<ObStep, number> = {
  ob1: 0, ob2: 1, ob3: 2, ob4: 3, ob5: 4, ob6: 5, ob7: 6,
  ob8: 7, ob9: 8, ob10: 9,
};

export const STEP_TITLES: Record<ObStep, string> = {
  ob1:  "Who's travelling?",
  ob2:  "What's the trip mood?",
  ob3:  'How do you pace a day?',
  ob4:  'How do you ease into the day?',
  ob5:  'Any food situation we should know?',
  ob6:  'How are you travelling budget-wise?',
  ob7:  'What does a good evening look like?',
  ob8:  'What matters most for the kids?',
  ob9:  'What do you protect?',
  ob10: 'What kind of food scene?',
};
