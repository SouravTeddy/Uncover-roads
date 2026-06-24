import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ObStep } from './types';
import { BASE_OB_STEPS, STEP_TITLES } from './types';
import { useOnboarding } from './useOnboarding';
import { useAppStore } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { OBBackground } from './OBBackground';
import { getLayerUpdatesForAnswer, resolveLayerState } from './ob-layers';
import type { OBLayerUpdate } from './ob-layers';

const SHELL_SECTION_LABEL = 'Travel Preferences';

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
  heroUrl?:   string;
}

export function OnboardingShell({ step, canAdvance, children, title, subtitle, heroUrl }: Props) {
  const { progress, currentIndex, totalSteps, goBack, goNext, finish, isLast } = useOnboarding(step);
  const { state } = useAppStore();

  const answers = state.rawOBAnswers ?? {};

  const layerState = useMemo(() => {
    const updates: OBLayerUpdate[] = [];
    for (const [question, answer] of Object.entries(answers)) {
      const ans = Array.isArray(answer) ? answer : [answer];
      for (const a of ans) {
        if (a != null) updates.push(...getLayerUpdatesForAnswer(question, String(a)));
      }
    }
    return resolveLayerState(updates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(answers)]);

  const displayTitle    = title    ?? STEP_TITLES[step] ?? '';
  const displaySubtitle = subtitle ?? '';
  const bgHeroUrl = heroUrl ?? STEP_HERO[step];

  return (
    <div data-theme="dark" className="fixed inset-0" style={{ zIndex: 20 }}>

      {/* ── Background stack ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* OBBackground — answer-driven gradient (deepest layer) */}
        <OBBackground layerState={layerState} />

        {/* Full-bleed hero — sits on top of OBBackground, crossfades on step change */}
        <AnimatePresence mode="wait">
          {bgHeroUrl && (
            <motion.img
              key={bgHeroUrl}
              src={bgHeroUrl}
              alt=""
              aria-hidden={true}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>

        {/* Gradient: transparent top → solid dark bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(to bottom,',
              'rgba(12,12,14,0.05)  0%,',
              'rgba(12,12,14,0.15)  22%,',
              'rgba(12,12,14,0.75)  50%,',
              'rgba(12,12,14,0.97)  68%,',
              'rgba(12,12,14,1.0)   80%,',
              'rgba(12,12,14,1.0)  100%)',
            ].join(' '),
          }}
        />

      </div>

      {/* ── Content stack ── */}
      <div className="absolute inset-0 flex flex-col" style={{ zIndex: 10 }}>

        {/* Floating header */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
            paddingBottom: '0.75rem',
          }}
        >
          <button
            onClick={goBack}
            aria-label="Go back"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid rgba(242,237,230,.12)',
              background: 'rgba(12,12,14,.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer',
            }}
          >
            <span className="ms text-[var(--color-text-1)] text-xl">arrow_back</span>
          </button>

          <div
            className="flex-1 text-center font-semibold"
            style={{
              background: 'rgba(12,12,14,.35)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              borderRadius: 20, padding: '4px 14px',
              fontSize: 13, color: '#f2ede6',
            }}
          >
            {SHELL_SECTION_LABEL}
          </div>

          <div style={{ width: 36 }} />
        </div>

        {/* Progress bar */}
        <div
          className="flex-shrink-0 w-full h-[2px]"
          style={{ background: 'rgba(255,255,255,.07)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'var(--color-primary)' }}
          />
        </div>

        {/* Spacer — background photo breathes here */}
        <div className="flex-1 min-h-0" />

        {/* Question content — anchored at bottom on dark gradient */}
        <div
          className="flex-shrink-0 overflow-y-auto px-5"
          style={{
            paddingBottom: '0.5rem', maxHeight: '62vh',
            background: 'rgba(12,12,14,.72)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderRadius: '20px 20px 0 0',
            paddingTop: '1rem',
            marginTop: 4,
          }}
        >
          <span
            className="block font-semibold tracking-widest uppercase mb-2"
            style={{ fontSize: 11, color: 'rgba(212,168,83,.65)' }}
          >
            Step {String(currentIndex + 1).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
          </span>

          <h1
            className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-1)] leading-snug mb-1"
            style={{ fontSize: 26 }}
          >
            {displayTitle}
          </h1>

          {displaySubtitle && (
            <p className="text-[var(--color-text-2)] text-sm mb-4">{displaySubtitle}</p>
          )}

          {children}
        </div>

        {/* Footer — dots + CTA */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="flex gap-2">
            {BASE_OB_STEPS.map((s, i) => (
              <div
                key={s}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-4 h-2 bg-primary'
                    : i < currentIndex
                    ? 'w-2 h-2 bg-primary/40'
                    : 'w-2 h-2 bg-white/10'
                }`}
              />
            ))}
          </div>

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
  );
}
