import { useState } from 'react';
import { useProfile } from './useProfile';
import { RitualQuestion, MotivationQuestion, StyleQuestion, AttractionQuestion, PaceQuestion } from '../../shared/questionnaire';
import type { Ritual, Sensory, TravelStyle, Attraction, Pace } from '../../shared/types';
import { ARCHETYPE_EMOJI } from '../persona/types';

type Section = 'ritual' | 'motivation' | 'style' | 'attractions' | 'pace' | null;

export function ProfileScreen() {
  const { persona, editAnswers, updateAnswer, saveProfile, saving, saved, error } = useProfile();
  const [openSection, setOpenSection] = useState<Section>(null);

  function toggleSection(s: Section) {
    setOpenSection(prev => (prev === s ? null : s));
  }

  const emoji = persona ? (ARCHETYPE_EMOJI[persona.archetype] ?? '◆') : '◆';

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
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        {/* Persona summary */}
        {persona && (
          <div className="mt-5 mb-6 bg-surface rounded-2xl p-5">
            <div className="font-heading font-bold text-text-1 text-xl mb-1">
              {emoji} {persona.archetype_name}
            </div>
            <p className="text-text-2 text-sm">{persona.archetype_desc}</p>
          </div>
        )}

        {/* Editable sections */}
        <div className="font-heading font-semibold text-text-3 text-xs uppercase tracking-wide mb-3">
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
