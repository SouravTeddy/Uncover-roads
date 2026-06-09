export type ObStep = 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
                   | 'ob8' | 'ob9';

export const BASE_OB_STEPS: ObStep[] = ['ob1', 'ob2', 'ob3', 'ob7', 'ob4', 'ob5', 'ob6'];
export const CONDITIONAL_STEPS: Record<string, ObStep> = {
  family: 'ob8',
  budget: 'ob9',
};

export const OB_STEP_INDEX: Record<ObStep, number> = {
  ob1: 0, ob2: 1, ob3: 2, ob4: 3, ob5: 4, ob6: 5, ob7: 6,
  ob8: 7, ob9: 8,
};

export const STEP_TITLES: Record<ObStep, string> = {
  ob1: "Who's coming along?",
  ob2: "What kind of trip is this?",
  ob3: 'How do you move through a day?',
  ob4: 'How do you like to start the day?',
  ob5: 'Anything to keep in mind at the table?',
  ob6: "Last one — let's talk money.",
  ob7: 'What makes an evening worth it?',
  ob8: 'What matters most for the kids?',
  ob9: 'Where do you draw the line?',
};
