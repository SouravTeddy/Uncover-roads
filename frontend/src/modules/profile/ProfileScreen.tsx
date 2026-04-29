import React, { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { useProfile } from './useProfile';
import { supabase } from '../../shared/supabase';
import type { UserTier } from '../../shared/types';
import { NotificationsScreen } from './sub-screens/NotificationsScreen';
import { UnitsSheet } from './sub-screens/UnitsSheet';
import { PrivacyScreen } from './sub-screens/PrivacyScreen';
import { SubscriptionDetailsScreen } from './sub-screens/SubscriptionDetailsScreen';
import { ARCHETYPE_COLORS } from '../persona/types';

type ProfileView = 'main' | 'notifications' | 'units' | 'privacy' | 'subscription-details';

// ── Archetype derivation from primary mood ─────────────────────
const MOOD_ARCHETYPE: Record<string, string> = {
  explore:   'explorer',
  relax:     'slowtraveller',
  eat_drink: 'epicurean',
  culture:   'historian',
};

const ARCHETYPE_META: Record<string, { name: string; tagline: string; emoji: string }> = {
  explorer:      { name: 'The Explorer',       emoji: '◆', tagline: 'You thrive on discovery — no plan survives contact with a great street.' },
  slowtraveller: { name: 'The Slow Traveller', emoji: '◇', tagline: 'One great café beats ten tourist spots. You\'re here to be, not to tick.' },
  epicurean:     { name: 'The Epicurean',      emoji: '◉', tagline: 'You travel stomach-first. Markets and hidden tables are your map.' },
  historian:     { name: 'The Scholar',        emoji: '◎', tagline: 'Every city has layers. You\'re the one who finds the story behind the sign.' },
};

export function ProfileScreen() {
  const { dispatch, state } = useAppStore();
  const { persona, userTier, generationCount, startOBRedo, goToSubscription } = useProfile();
  const [view, setView] = useState<ProfileView>('main');
  const [signingOut, setSigningOut] = useState(false);
  const [saved, setSaved] = React.useState(false);

  const theme = state.theme;

  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null; email: string } | null =
    rawUser ? JSON.parse(rawUser) : null;

  const name = user?.name ?? 'Explorer';
  const email = user?.email ?? '';
  const initial = name[0].toUpperCase();
  const isPro = userTier !== 'free';

  // Derive archetype from raw OB answers or persona
  const rawAnswers = state.rawOBAnswers;
  const primaryMood = rawAnswers?.mood?.[0] ?? 'explore';
  const archetypeKey = MOOD_ARCHETYPE[primaryMood] ?? (persona?.archetype ?? 'explorer');
  const archetypeMeta = ARCHETYPE_META[archetypeKey] ?? ARCHETYPE_META.explorer;
  const archetypeColor = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' };
  const hasArchetype = !!(state.personaProfile || persona);

  const archetypeData = hasArchetype ? {
    name: archetypeMeta.name,
    tagline: archetypeMeta.tagline,
    emoji: archetypeMeta.emoji,
    primary: archetypeColor.primary,
    glow: archetypeColor.glow,
  } : null;

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut().catch(console.warn);
    localStorage.removeItem('ur_persona');
    localStorage.removeItem('ur_user');
    localStorage.removeItem('ur_saved_itineraries');
    localStorage.removeItem('ur_user_tier');
    localStorage.removeItem('ur_trip_packs');
    localStorage.removeItem('ur_pack_count');
    localStorage.removeItem('ur_gen_count');
    localStorage.removeItem('ur_notif_prefs');
    localStorage.removeItem('ur_units');
    dispatch({ type: 'GO_TO', screen: 'login' });
  }

  function handleSave() {
    // Save logic placeholder — persists any pending settings
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Sub-screen routing
  if (view === 'notifications') return <NotificationsScreen onBack={() => setView('main')} />;
  if (view === 'units') return <UnitsSheet onClose={() => setView('main')} />;
  if (view === 'privacy') return <PrivacyScreen onBack={() => setView('main')} onSignOut={handleSignOut} />;
  if (view === 'subscription-details') return <SubscriptionDetailsScreen onBack={() => setView('main')} />;

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--color-text-1)]">
          Profile
        </h1>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-[var(--color-text-3)] text-[13px]"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >

        {/* User card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 mx-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[18px] flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[var(--color-text-1)] truncate">{name}</div>
            <div className="text-[11px] text-[var(--color-text-3)] truncate">{email}</div>
          </div>
          <div
            className="px-2 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0"
            style={isPro
              ? { borderColor: 'var(--color-amber)', color: 'var(--color-amber)', background: 'var(--color-amber-bg)' }
              : { borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
          >
            {isPro ? 'PRO' : 'FREE'}
          </div>
        </div>

        {/* Archetype hero card */}
        {archetypeData && (
          <div className="mx-4 mt-4">
            <div
              className="rounded-[20px] p-5 relative overflow-hidden"
              style={{
                background: `linear-gradient(150deg, ${archetypeData.glow}, rgba(255,255,255,.02))`,
                border: `1px solid ${archetypeData.primary}28`,
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at left, ${archetypeData.primary}18, transparent 70%)` }}
              />
              <span className="text-[42px] relative" style={{ filter: `drop-shadow(0 0 16px ${archetypeData.primary}70)` }}>
                {archetypeData.emoji}
              </span>
              <div className="font-[family-name:var(--font-heading)] text-[17px] font-semibold text-[var(--color-text-1)] mt-2">
                {archetypeData.name}
              </div>
              <div className="text-[12px] text-[var(--color-text-3)] mt-0.5">{archetypeData.tagline}</div>
            </div>
          </div>
        )}

        {/* OB persona retune button */}
        <button
          onClick={startOBRedo}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border mx-4 mt-4"
          style={{
            width: 'calc(100% - 2rem)',
            background: 'rgba(255,255,255,.03)',
            borderColor: userTier === 'free' ? 'rgba(249,115,22,.5)' : 'rgba(245,158,11,.5)',
          }}
        >
          <div className="flex-1 text-left min-w-0">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Travel Persona</p>
            <p className="text-[11px]" style={{ color: '#f97316' }}>Retune your persona →</p>
          </div>
        </button>

        {/* Itinerary attempts counter — free only */}
        {userTier === 'free' && (
          <div className="mx-4 mt-4">
            <AttemptsCounter count={generationCount} />
          </div>
        )}

        {/* Account section */}
        <div className="mt-5 px-4">
          <SectionLabel>Account</SectionLabel>
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4 mx-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          {userTier === 'free' ? (
            <SettingsRow
              label="Upgrade to Pro"
              labelClass="font-bold text-white"
              right={<span className="text-[11px] font-bold" style={{ color: '#f97316' }}>Unlock all →</span>}
              rowStyle={{ background: 'rgba(249,115,22,.06)' }}
              onTap={goToSubscription}
            />
          ) : (
            <SettingsRow
              label={userTier === 'pro' ? 'Pro Plan' : 'Unlimited Plan'}
              sublabel={`Renews ${formatRenewal()}`}
              right={<span className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>Active ›</span>}
              onTap={() => setView('subscription-details')}
            />
          )}
          <SettingsRow
            label="Notifications"
            divider
            onTap={() => setView('notifications')}
          />
        </div>

        {/* App section */}
        <div className="px-4">
          <SectionLabel>App</SectionLabel>
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4 mx-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <SettingsRow
            label="Units"
            sublabel={state.units === 'km' ? 'Kilometres' : 'Miles'}
            onTap={() => setView('units')}
          />
          <SettingsRow
            label="Privacy & Data"
            divider
            onTap={() => setView('privacy')}
          />

          {/* Appearance row */}
          <div className="flex items-center justify-between py-3 px-4 border-t border-white/6">
            <div className="flex items-center gap-3">
              <span className="ms text-[var(--color-text-2)] text-[20px]">
                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
              </span>
              <div>
                <div className="text-[14px] text-[var(--color-text-1)] font-medium">Appearance</div>
                <div className="text-[11px] text-[var(--color-text-3)]">
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </div>
              </div>
            </div>

            {/* 36×20px toggle pill */}
            <button
              onClick={() => dispatch({ type: 'SET_THEME', theme: theme === 'dark' ? 'light' : 'dark' })}
              className="w-9 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0"
              style={{ background: theme === 'dark' ? '#e07854' : 'rgba(255,255,255,.15)' }}
              aria-label="Toggle appearance"
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{ transform: theme === 'dark' ? 'translateX(17px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </div>

        {/* Save changes button */}
        <div className="px-4 mb-4">
          <button
            onClick={handleSave}
            className={`w-full h-[52px] rounded-[18px] font-bold text-[15px] text-white transition-all active:scale-[.97] ${
              saved
                ? 'bg-green-600'
                : 'bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)]'
            }`}
          >
            {saved
              ? <><span className="ms fill text-[20px] mr-2">check_circle</span>Saved</>
              : 'Save changes'
            }
          </button>
        </div>

        {/* Feedback */}
        <div className="flex justify-center mt-2 mb-6">
          <a
            href="mailto:sourav@uncoverroads.com?subject=Feedback on Uncover Roads"
            className="flex items-center gap-2 text-white/25 text-xs hover:text-white/45 transition-colors"
          >
            <span className="ms text-sm">mail</span>
            Send Feedback
          </a>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function AttemptsCounter({ count }: { count: number }) {
  const used = Math.min(count, 3);
  return (
    <div className="rounded-2xl border border-white/8 px-4 py-3" style={{ background: 'rgba(255,255,255,.03)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white text-sm font-semibold">Itinerary Attempts</span>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: i < used ? '#f97316' : 'rgba(255,255,255,.12)' }}
            />
          ))}
        </div>
      </div>
      <p className="text-white/30 text-[10px]">
        {used} of 3 used · 1st–2nd: full · 3rd: no curation · 4th+: upgrade
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-2 px-1">{children}</p>
  );
}

function SettingsRow({
  label,
  sublabel,
  labelClass = 'text-white/70',
  right,
  rowStyle,
  divider,
  onTap,
}: {
  label: string;
  sublabel?: string;
  labelClass?: string;
  right?: React.ReactNode;
  rowStyle?: React.CSSProperties;
  divider?: boolean;
  onTap?: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${divider ? 'border-t border-white/6' : ''}`}
      style={rowStyle}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${labelClass}`}>{label}</p>
        {sublabel && <p className="text-white/25 text-xs mt-0.5">{sublabel}</p>}
      </div>
      {right ?? <span className="ms text-white/20 text-base">chevron_right</span>}
    </button>
  );
}

function formatRenewal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
