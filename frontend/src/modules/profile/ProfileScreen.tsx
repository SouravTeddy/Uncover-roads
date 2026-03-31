import { useState } from 'react';
import { useProfile } from './useProfile';
import { RitualQuestion, MotivationQuestion, StyleQuestion, AttractionQuestion, PaceQuestion } from '../../shared/questionnaire';
import type { Ritual, Sensory, TravelStyle, Attraction, Pace } from '../../shared/types';
import {
  ARCHETYPE_EMOJI,
  ARCHETYPE_COLORS,
  ARCHETYPE_SHORT,
  VENUE_ICONS,
  BIAS_ICONS,
} from '../persona/types';

type Section = 'ritual' | 'motivation' | 'style' | 'attractions' | 'pace' | null;

export function ProfileScreen() {
  const { persona, editAnswers, updateAnswer, saveProfile, saving, saved, error } = useProfile();
  const [openSection, setOpenSection] = useState<Section>(null);

  function toggleSection(s: Section) {
    setOpenSection(prev => (prev === s ? null : s));
  }

  const color  = persona ? (ARCHETYPE_COLORS[persona.archetype] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' }) : null;
  const emoji  = persona ? (ARCHETYPE_EMOJI[persona.archetype] ?? '◆') : '◆';

  // Top 3 archetype scores, normalised to 100
  const topScores = persona?.scores
    ? Object.entries(persona.scores)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];
  const maxScore = topScores[0]?.[1] ?? 1;

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <span className="font-heading font-bold text-text-1 text-lg">Your Profile</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-36">

        {/* ── Persona breakdown ── */}
        {persona && color && (
          <>
            {/* Archetype hero card */}
            <div
              className="relative mt-5 rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(150deg, ${color.glow}, rgba(255,255,255,.02))`,
                border: `1px solid ${color.primary}28`,
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 70% 60% at 0% 50%, ${color.glow} 0%, transparent 65%)`,
                }}
              />
              <div className="relative flex items-center gap-4 px-5 py-4">
                <div
                  className="text-4xl leading-none flex-shrink-0"
                  style={{ filter: `drop-shadow(0 0 16px ${color.primary}70)` }}
                >
                  {emoji}
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-bold text-white text-base leading-tight">
                    {persona.archetype_name}
                  </div>
                  <p className="text-white/55 text-xs mt-0.5 leading-relaxed line-clamp-2">
                    {persona.archetype_desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Archetype match bars */}
            {topScores.length > 0 && (
              <div className="mt-4 bg-surface rounded-2xl px-4 py-4">
                <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">
                  Archetype Match
                </p>
                <div className="flex flex-col gap-3">
                  {topScores.map(([arch, score], i) => {
                    const c = ARCHETYPE_COLORS[arch] ?? { primary: '#3b82f6', glow: '' };
                    const pct = Math.round((score / maxScore) * 100);
                    return (
                      <div key={arch} className="flex items-center gap-3">
                        {/* Rank dot */}
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                          style={{ background: i === 0 ? c.primary : `${c.primary}40`, color: i === 0 ? '#fff' : c.primary }}
                        >
                          {i + 1}
                        </div>
                        {/* Label */}
                        <span className="text-text-2 text-xs w-24 flex-shrink-0">
                          {ARCHETYPE_SHORT[arch] ?? arch}
                        </span>
                        {/* Bar */}
                        <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: c.primary }}
                          />
                        </div>
                        {/* Score */}
                        <span className="text-text-3 text-[10px] w-7 text-right flex-shrink-0">{score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trip focus + venues — side by side on wider screens, stacked on small */}
            <div className="mt-3 grid grid-cols-2 gap-3">

              {/* Itinerary biases */}
              {persona.itinerary_bias && persona.itinerary_bias.length > 0 && (
                <div className="bg-surface rounded-2xl px-4 py-4">
                  <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">
                    Trip Focus
                  </p>
                  <div className="flex flex-col gap-2">
                    {persona.itinerary_bias.map(bias => (
                      <div key={bias} className="flex items-center gap-2">
                        <span
                          className="ms fill text-sm flex-shrink-0"
                          style={{ color: color.primary }}
                        >
                          {BIAS_ICONS[bias] ?? 'label'}
                        </span>
                        <span className="text-text-2 text-xs capitalize">{bias}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Venue priorities */}
              {persona.venue_filters && persona.venue_filters.length > 0 && (
                <div className="bg-surface rounded-2xl px-4 py-4">
                  <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">
                    Venues
                  </p>
                  <div className="flex flex-col gap-2">
                    {persona.venue_filters.map(v => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="ms text-sm text-text-3 flex-shrink-0">
                          {VENUE_ICONS[v] ?? 'place'}
                        </span>
                        <span className="text-text-2 text-xs capitalize">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Edit Preferences ── */}
        <div className="font-heading font-semibold text-text-3 text-xs uppercase tracking-wide mt-6 mb-3">
          Edit Preferences
        </div>

        <ProfileSection
          title="Morning Ritual"
          summary={editAnswers.ritual ?? 'Not set'}
          open={openSection === 'ritual'}
          onToggle={() => toggleSection('ritual')}
        >
          <RitualQuestion
            value={editAnswers.ritual}
            onChange={v => updateAnswer('ritual', v as Ritual)}
          />
        </ProfileSection>

        <ProfileSection
          title="Travel Motivation"
          summary={editAnswers.sensory ?? 'Not set'}
          open={openSection === 'motivation'}
          onToggle={() => toggleSection('motivation')}
        >
          <MotivationQuestion
            value={editAnswers.sensory}
            onChange={v => updateAnswer('sensory', v as Sensory)}
          />
        </ProfileSection>

        <ProfileSection
          title="Travel Style"
          summary={editAnswers.style ?? 'Not set'}
          open={openSection === 'style'}
          onToggle={() => toggleSection('style')}
        >
          <StyleQuestion
            value={editAnswers.style}
            onChange={v => updateAnswer('style', v as TravelStyle)}
          />
        </ProfileSection>

        <ProfileSection
          title="Interests"
          summary={editAnswers.attractions.length > 0 ? editAnswers.attractions.join(', ') : 'Not set'}
          open={openSection === 'attractions'}
          onToggle={() => toggleSection('attractions')}
        >
          <AttractionQuestion
            value={editAnswers.attractions}
            onChange={v => updateAnswer('attractions', v as Attraction[])}
          />
        </ProfileSection>

        <ProfileSection
          title="Preferred Pace"
          summary={editAnswers.pace ?? 'Not set'}
          open={openSection === 'pace'}
          onToggle={() => toggleSection('pace')}
        >
          <PaceQuestion
            value={editAnswers.pace}
            onChange={v => updateAnswer('pace', v as Pace)}
          />
        </ProfileSection>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>

      {/* Save footer */}
      <div
        className="absolute inset-x-0 bottom-0 bg-bg border-t border-white/8 px-5 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <button
          onClick={saveProfile}
          disabled={saving}
          className={`w-full h-14 rounded-2xl font-heading font-bold text-base transition-all ${
            saved
              ? 'bg-green-600 text-white'
              : saving
              ? 'bg-surface text-text-3 cursor-not-allowed'
              : 'bg-primary text-white'
          }`}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <span className="ms fill text-base">check_circle</span>
              Saved!
            </span>
          ) : saving ? (
            'Saving…'
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  );
}

function ProfileSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4"
      >
        <div className="text-left">
          <div className="font-semibold text-text-1 text-sm">{title}</div>
          <div className="text-text-3 text-xs mt-0.5 capitalize">{summary}</div>
        </div>
        <span className={`ms text-text-3 text-base transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/6 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
