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
import { supabase } from '../../shared/supabase';
import { useAppStore } from '../../shared/store';

type Section = 'ritual' | 'motivation' | 'style' | 'attractions' | 'pace' | null;

export function ProfileScreen() {
  const { dispatch } = useAppStore();
  const { persona, editAnswers, updateAnswer, saveProfile, saving, saved, error } = useProfile();
  const [openSection, setOpenSection] = useState<Section>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Load stored user info
  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null; email: string } | null =
    rawUser ? JSON.parse(rawUser) : null;

  function toggleSection(s: Section) {
    setOpenSection(prev => (prev === s ? null : s));
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut().catch(console.warn);
    localStorage.removeItem('ur_persona');
    localStorage.removeItem('ur_user');
    localStorage.removeItem('ur_saved_itineraries');
    dispatch({ type: 'GO_TO', screen: 'login' });
  }

  const color    = persona ? (ARCHETYPE_COLORS[persona.archetype] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' }) : null;
  const emoji    = persona ? (ARCHETYPE_EMOJI[persona.archetype] ?? '◆') : '◆';

  const topMatches = persona?.top_matches ?? [];

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <span className="font-heading font-bold text-text-1 text-lg">Profile</span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(239,68,68,.10)' }}
        >
          {signingOut
            ? <span className="ms animate-spin text-red-400 text-base">autorenew</span>
            : <span className="ms fill text-red-400 text-base">logout</span>
          }
        </button>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >

        {/* ── Account section ── */}
        <div className="mt-5 mb-1">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3">Account</p>

          {/* User card */}
          <div
            className="flex items-center gap-4 px-4 py-4 rounded-2xl border border-white/8 mb-3"
            style={{ background: 'rgba(255,255,255,.03)' }}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.2)' }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary font-bold text-lg">
                  {(user?.name ?? 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{user?.name ?? 'Explorer'}</p>
              <p className="text-white/40 text-xs truncate">{user?.email ?? ''}</p>
            </div>
            {/* Free badge */}
            <div
              className="px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.2)' }}
            >
              <span className="text-amber-400 text-[10px] font-bold">FREE</span>
            </div>
          </div>

          {/* Account options */}
          <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,.03)' }}>
            <AccountRow icon="card_membership" label="Subscription" sublabel="Free plan · Upgrade for unlimited trips" />
            <AccountRow icon="notifications" label="Notifications" sublabel="Coming soon" divider />
            <AccountRow icon="lock" label="Privacy" sublabel="Data & permissions" divider />
          </div>
        </div>

        {/* ── Persona breakdown ── */}
        {persona && color && (
          <>
            <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mt-6 mb-3">Travel Persona</p>

            {/* Archetype hero card */}
            <div
              className="relative rounded-2xl overflow-hidden mb-3"
              style={{
                background: `linear-gradient(150deg, ${color.glow}, rgba(255,255,255,.02))`,
                border: `1px solid ${color.primary}28`,
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 70% 60% at 0% 50%, ${color.glow} 0%, transparent 65%)` }}
              />
              <div className="relative flex items-center gap-4 px-5 py-4">
                <div className="text-4xl leading-none flex-shrink-0" style={{ filter: `drop-shadow(0 0 16px ${color.primary}70)` }}>
                  {emoji}
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-bold text-white text-base leading-tight">{persona.archetype_name}</div>
                  <p className="text-white/55 text-xs mt-0.5 leading-relaxed line-clamp-2">{persona.archetype_desc}</p>
                </div>
              </div>
            </div>

            {/* Archetype match bars */}
            {topMatches.length > 0 && (
              <div className="mb-3 bg-surface rounded-2xl px-4 py-4">
                <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">Archetype Match</p>
                <div className="flex flex-col gap-3">
                  {topMatches.map(({ arch, pct }, i) => {
                    const c = ARCHETYPE_COLORS[arch] ?? { primary: '#3b82f6', glow: '' };
                    return (
                      <div key={arch} className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                          style={{ background: i === 0 ? c.primary : `${c.primary}40`, color: i === 0 ? '#fff' : c.primary }}
                        >
                          {i + 1}
                        </div>
                        <span className="text-text-2 text-xs w-24 flex-shrink-0">{ARCHETYPE_SHORT[arch] ?? arch}</span>
                        <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: c.primary }} />
                        </div>
                        <span className="text-text-3 text-[10px] w-7 text-right flex-shrink-0">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trip focus + venues */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {persona.itinerary_bias && persona.itinerary_bias.length > 0 && (
                <div className="bg-surface rounded-2xl px-4 py-4">
                  <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">Trip Focus</p>
                  <div className="flex flex-col gap-2">
                    {persona.itinerary_bias.map(bias => (
                      <div key={bias} className="flex items-center gap-2">
                        <span className="ms fill text-sm flex-shrink-0" style={{ color: color.primary }}>{BIAS_ICONS[bias] ?? 'label'}</span>
                        <span className="text-text-2 text-xs capitalize">{bias}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {persona.venue_filters && persona.venue_filters.length > 0 && (
                <div className="bg-surface rounded-2xl px-4 py-4">
                  <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">Venues</p>
                  <div className="flex flex-col gap-2">
                    {persona.venue_filters.map(v => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="ms text-sm text-text-3 flex-shrink-0">{VENUE_ICONS[v] ?? 'place'}</span>
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
        <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mt-6 mb-3">Preferences</p>

        <ProfileSection title="Morning Ritual" summary={editAnswers.ritual ?? 'Not set'} open={openSection === 'ritual'} onToggle={() => toggleSection('ritual')}>
          <RitualQuestion value={editAnswers.ritual} onChange={v => updateAnswer('ritual', v as Ritual)} />
        </ProfileSection>
        <ProfileSection title="Travel Motivation" summary={editAnswers.sensory ?? 'Not set'} open={openSection === 'motivation'} onToggle={() => toggleSection('motivation')}>
          <MotivationQuestion value={editAnswers.sensory} onChange={v => updateAnswer('sensory', v as Sensory)} />
        </ProfileSection>
        <ProfileSection title="Travel Style" summary={editAnswers.style ?? 'Not set'} open={openSection === 'style'} onToggle={() => toggleSection('style')}>
          <StyleQuestion value={editAnswers.style} onChange={v => updateAnswer('style', v as TravelStyle)} />
        </ProfileSection>
        <ProfileSection title="Interests" summary={editAnswers.attractions.length > 0 ? editAnswers.attractions.join(', ') : 'Not set'} open={openSection === 'attractions'} onToggle={() => toggleSection('attractions')}>
          <AttractionQuestion value={editAnswers.attractions} onChange={v => updateAnswer('attractions', v as Attraction[])} />
        </ProfileSection>
        <ProfileSection title="Preferred Pace" summary={editAnswers.pace ?? 'Not set'} open={openSection === 'pace'} onToggle={() => toggleSection('pace')}>
          <PaceQuestion value={editAnswers.pace} onChange={v => updateAnswer('pace', v as Pace)} />
        </ProfileSection>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        {/* ── Save ── */}
        <div className="mt-6 mb-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className={`w-full h-14 rounded-2xl font-heading font-bold text-base transition-all ${
              saved ? 'bg-green-600 text-white' : saving ? 'bg-surface text-text-3 cursor-not-allowed' : 'bg-primary text-white'
            }`}
          >
            {saved ? (
              <span className="flex items-center justify-center gap-2">
                <span className="ms fill text-base">check_circle</span>Saved!
              </span>
            ) : saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>

        {/* ── Contact ── */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <p className="text-white/20 text-xs text-center">Feedback or business enquiry?</p>
          <a
            href="mailto:sourav.bis93@gmail.com"
            className="text-white/35 text-xs text-center hover:text-white/55 transition-colors"
          >
            sourav.bis93@gmail.com · Sourav
          </a>
        </div>
      </div>
    </div>
  );
}

function AccountRow({ icon, label, sublabel, divider }: { icon: string; label: string; sublabel: string; divider?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-white/6' : ''}`}>
      <span className="ms fill text-white/30 text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/70 text-sm font-medium">{label}</p>
        <p className="text-white/25 text-xs">{sublabel}</p>
      </div>
      <span className="ms text-white/20 text-base flex-shrink-0">chevron_right</span>
    </div>
  );
}

function ProfileSection({ title, summary, open, onToggle, children }: {
  title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl mb-3 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-4">
        <div className="text-left">
          <div className="font-semibold text-text-1 text-sm">{title}</div>
          <div className="text-text-3 text-xs mt-0.5 capitalize">{summary}</div>
        </div>
        <span className={`ms text-text-3 text-base transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/6 pt-4">{children}</div>
      )}
    </div>
  );
}
