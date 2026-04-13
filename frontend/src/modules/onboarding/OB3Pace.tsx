import { useState } from 'react';
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard, ConflictPanel } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ3Pace } from './ob-context-resolvers';
import { detectHardConflict, scoreOptions, PACE_ALIGNMENT } from './ob-conflict-map';
import type { OBPace, ResolvedConflict, RawOBAnswers } from '../../shared/types';

const OPTIONS: { value: OBPace; label: string; description: string; imageUrl: string }[] = [
  { value: 'slow',        label: 'Slow & deep',    description: '2–3 stops/day · 90 min each · rest built in',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&q=80' },
  { value: 'balanced',    label: 'Balanced',        description: '4–5 stops/day · 45 min each',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=120&q=80' },
  { value: 'pack',        label: 'Pack it in',      description: '6–8 stops/day · 25 min each · efficient routing',
    imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=120&q=80' },
  { value: 'spontaneous', label: 'Spontaneous',     description: '3 anchor stops + open gaps · flexible order',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=120&q=80' },
];

const SUGGESTION_IMAGES: Record<string, string> = {
  slow:        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=80&q=80',
  balanced:    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=80&q=80',
  pack:        'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=80&q=80',
  spontaneous: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=80&q=80',
};

const MAX = 2;

export function OB3Pace() {
  const { state, dispatch } = useAppStore();
  const values: OBPace[] = state.rawOBAnswers?.pace ?? [];
  const ctx = resolveQ3Pace(state.rawOBAnswers ?? {});
  const [preResolved, setPreResolved] = useState<ResolvedConflict[]>([]);

  const conflict = values.length === 2 ? detectHardConflict(values[0], values[1]) : null;
  const conflictDismissed = conflict
    ? preResolved.some(r => r.conflict_id === conflict.id)
    : false;
  const showPanel = !!conflict && !conflictDismissed;

  // Compute suggestion using pace-value keys for alignment scoring
  const suggestion = (() => {
    if (!conflict) return null;
    const accum: Record<string, number> = {};
    const answers: Partial<RawOBAnswers> = state.rawOBAnswers ?? {};
    if (answers.mood?.includes('relax'))   accum['slow'] = 1.5;
    if (answers.mood?.includes('explore')) accum['spontaneous'] = 0.2;
    if (answers.group === 'solo')          accum['balanced'] = (accum['balanced'] ?? 0) + 0.1;
    const scores = scoreOptions(['slow', 'balanced', 'pack', 'spontaneous'], accum, PACE_ALIGNMENT);
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const opt = OPTIONS.find(o => o.value === winner[0]);
    return opt ? {
      key:      opt.value,
      label:    opt.label,
      imageUrl: SUGGESTION_IMAGES[opt.value] ?? '',
      whyLabel: `${Object.keys(accum).slice(0, 2).join(' · ')} → ${winner[1].toFixed(2)}`,
    } : null;
  })();

  function toggle(v: OBPace) {
    const next = values.includes(v)
      ? values.filter(x => x !== v)
      : values.length < MAX ? [...values, v] : values;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'pace', value: next });
    setPreResolved([]);
  }

  function useSuggestion() {
    if (!conflict || !suggestion) return;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'pace', value: [suggestion.key as OBPace] });
    setPreResolved(prev => [...prev, { conflict_id: conflict.id, method: 'user_pick', winner: suggestion.key }]);
  }

  function autoBlend() {
    if (!conflict) return;
    setPreResolved(prev => [...prev, { conflict_id: conflict.id, method: 'auto_blend' }]);
    dispatch({ type: 'SET_OB_PRE_RESOLVED', value: [{ conflict_id: conflict.id, method: 'auto_blend' }] });
  }

  return (
    <OnboardingShell step="ob3" canAdvance={values.length > 0} title={ctx.title} subtitle={ctx.subtitle}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((opt, idx) => {
          const isConflicting = showPanel && values.includes(opt.value);
          return (
            <div key={opt.value}>
              <ImageRowCard
                label={opt.label}
                description={opt.description}
                imageUrl={opt.imageUrl}
                selected={values.includes(opt.value)}
                onSelect={() => toggle(opt.value)}
                dimmed={isConflicting}
              />
              {idx === 0 && showPanel && suggestion && (
                <ConflictPanel
                  visible={showPanel}
                  suggestion={suggestion}
                  onUseSuggestion={useSuggestion}
                  onAutoBlend={autoBlend}
                />
              )}
            </div>
          );
        })}
      </div>
    </OnboardingShell>
  );
}
