import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ObStep } from './types';
import { BASE_OB_STEPS, STEP_TITLES } from './types';
import { useOnboarding } from './useOnboarding';
import { useAppStore } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { OBBackground } from './OBBackground';
import { PersonaSilhouette } from './PersonaSilhouette';
import { getLayerUpdatesForAnswer, resolveLayerState } from './ob-layers';
import type { OBLayerUpdate } from './ob-layers';
import type { RawOBAnswers } from '../../shared/types';

// 3-act onboarding sequence
const OB_STEPS = [
  'group',        // OB1 — who's coming
  'mood',         // OB2 — what pulls you to travel (emotional hook)
  'pace',         // OB3 — pace in a new city
  'movement',     // OB4 — how you move
  'crowd',        // OB5 — crowds (was OB2 sub-question, now standalone)
  'spontaneity',  // OB6 — planning vs winging it
  'evening',      // OB7 — how your evening ends
  'budget',       // OB8 — money mindset
  'dietary',      // OB9 — needs (now last)
] as const

function getActiveSteps(answers: Partial<RawOBAnswers>): typeof OB_STEPS[number][] {
  const steps = [...OB_STEPS]
  if (answers.group === 'family') {
    const groupIdx = steps.indexOf('group')
    steps.splice(groupIdx + 1, 0, 'kid_focus' as any)
  }
  return steps as any
}

interface Props {
  step:       ObStep;
  canAdvance: boolean;
  children:   ReactNode;
  title?:     string;
  subtitle?:  string;
}

export function OnboardingShell({ step, canAdvance, children, title, subtitle }: Props) {
  const { progress, currentIndex, totalSteps, goBack, goNext, finish, isLast } = useOnboarding(step);
  const { state } = useAppStore();

  const answers = state.rawOBAnswers ?? {};

  const layerState = useMemo(() => {
    const updates: OBLayerUpdate[] = []
    for (const [question, answer] of Object.entries(answers)) {
      const ans = Array.isArray(answer) ? answer : [answer]
      for (const a of ans) {
        if (a != null) {
          updates.push(...getLayerUpdatesForAnswer(question, String(a)))
        }
      }
    }
    return resolveLayerState(updates)
  }, [answers])

  const answeredCount = Object.keys(answers).length

  const displayTitle    = title    ?? STEP_TITLES[step] ?? '';
  const displaySubtitle = subtitle ?? '';

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Visual layers — behind everything */}
      <OBBackground layerState={layerState} />
      <PersonaSilhouette layerState={layerState} answeredCount={answeredCount} />

      {/* Existing question content — above layers */}
      <div className="relative z-10">
        <div className="fixed inset-0 flex flex-col bg-[var(--color-bg)]" style={{ zIndex: 20 }}>
          {/* Header */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-5 border-b border-white/6"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
              paddingBottom: '1rem',
              background: 'rgba(15,23,42,.95)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-full border border-[var(--color-border)] text-[var(--color-text-2)] flex items-center justify-center"
            >
              <span className="ms text-primary text-xl">arrow_back</span>
            </button>
            <span className="text-text-1 font-semibold text-base">Travel Preferences</span>
            <div className="w-10" />
          </div>

          {/* Progress bar */}
          <div className="flex-shrink-0 w-full h-[2px] bg-[var(--color-surface2)]">
            <div className="bg-[var(--color-primary)] h-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: '9rem' }}>
            <div className="px-5 pt-6">
              <span className="text-text-3 text-xs font-medium tracking-wide uppercase">
                Step {String(currentIndex + 1).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
              </span>
              <h1 className="font-[family-name:var(--font-heading)] text-[22px] font-bold text-[var(--color-text-1)] mt-2 mb-1">
                {displayTitle}
              </h1>
              {displaySubtitle && (
                <p className="text-text-2 text-sm mb-5">{displaySubtitle}</p>
              )}
              {children}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex-shrink-0 bg-bg border-t border-white/6 px-5 py-4 flex items-center justify-between"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            {/* Step dots — base steps only */}
            <div className="flex gap-2">
              {BASE_OB_STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`rounded-full transition-all ${
                    i === currentIndex
                      ? 'w-4 h-2 bg-primary'
                      : i < currentIndex
                      ? 'w-2 h-2 bg-primary/40'
                      : 'w-2 h-2 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Next / Finish */}
            <Button
              variant="primary"
              disabled={!canAdvance}
              onClick={isLast ? finish : goNext}
              className="flex items-center gap-2"
            >
              {isLast ? (
                <><span>Finish</span><span className="ms">auto_fix</span></>
              ) : (
                <><span>Next</span><span className="ms">chevron_right</span></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
