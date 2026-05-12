import type { RawOBAnswers } from '../../shared/types';

export interface QuestionDisplay {
  title:    string;
  subtitle: string;
}

export function resolveQ1Group(_answers: Partial<RawOBAnswers>): QuestionDisplay {
  return {
    title:    "Who's travelling?",
    subtitle: "Sets your itinerary's social context and venue filters.",
  };
}

export function resolveQ2Mood(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "What does the family want from this trip?", subtitle: "Pick up to 3." };
  }
  return { title: "What's the trip mood?", subtitle: "Pick up to 3 — shapes what we prioritise." };
}

export function resolveQ3Pace(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "How do you pace a day with kids?", subtitle: "Affects stops per day — kid-friendly pacing built in." };
  }
  if (answers.mood?.includes('relax')) {
    return { title: "How slow do you want to go?", subtitle: "Affects stops per day and time at each place." };
  }
  return { title: "How do you pace a day?", subtitle: "Affects stops per day and time at each place." };
}

export function resolveQ4DayOpen(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "How does the family start the day?", subtitle: "Sets your morning block." };
  }
  if (answers.mood?.includes('relax')) {
    return { title: "How do you ease into a slow day?", subtitle: "Sets your morning block." };
  }
  if (answers.pace?.includes('pack')) {
    return { title: "How fast do you get going in the morning?", subtitle: "Sets your morning block." };
  }
  return { title: "How do you ease into the day?", subtitle: "Sets your morning block." };
}

export function resolveQ5Dietary(_answers: Partial<RawOBAnswers>): QuestionDisplay {
  return {
    title:    "Any food situation we should know?",
    subtitle: "Shapes restaurant filtering. Pick all that apply.",
  };
}

export function resolveQ6Budget(_answers: Partial<RawOBAnswers>): QuestionDisplay {
  return {
    title:    "How are you travelling budget-wise?",
    subtitle: "Sets your price range across venues.",
  };
}

export function resolveQ7Evening(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "What's a good end time for the day?", subtitle: "Sets your evening block." };
  }
  if (answers.mood?.includes('eat_drink')) {
    return { title: "Where does your evening usually end up?", subtitle: "Sets your evening block." };
  }
  if (answers.pace?.includes('slow') && answers.mood?.includes('relax')) {
    return { title: "How do you like to close out a slow day?", subtitle: "Sets your evening block." };
  }
  if (answers.pace?.includes('pack')) {
    return { title: "How late do you push before calling it?", subtitle: "Sets your evening block." };
  }
  if (answers.dietary?.includes('halal')) {
    return { title: "What's your kind of evening scene?", subtitle: "Sets your evening block." };
  }
  return { title: "What does a good evening look like?", subtitle: "Sets your evening block." };
}
