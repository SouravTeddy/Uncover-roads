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

const STEP_HERO: Partial<Record<ObStep, string>> = {
  ob1: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  ob2: 'https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800&q=80',
  ob3: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800&q=80',
  ob4: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
  ob5: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  ob6: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80',
  ob7: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  ob8: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80',
  ob9: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
};


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
        <div className="fixed inset-0 flex flex-col" style={{ zIndex: 20, background: 'rgba(12,12,14,.82)', backdropFilter: 'blur(0px)' }}>
          {/* Header */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-5 border-b border-white/6"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
              paddingBottom: '1rem',
              background: 'rgba(12,12,14,.88)',
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
            {/* Hero image */}
            {STEP_HERO[step] && (
              <div className="w-full h-44 overflow-hidden flex-shrink-0">
                <img
                  src={STEP_HERO[step]}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="px-5 pt-5">
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
