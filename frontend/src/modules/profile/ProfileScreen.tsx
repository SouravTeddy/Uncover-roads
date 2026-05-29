import { useState, type ReactNode, type CSSProperties } from 'react';
import { useAppStore } from '../../shared/store';
import { useProfile } from './useProfile';
import { supabase } from '../../shared/supabase';
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

  const theme = state.theme;

  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null; email: string } | null =
    rawUser ? JSON.parse(rawUser) : null;

  const name = user?.name ?? 'Explorer';
  const email = user?.email ?? '';
  const initial = name[0].toUpperCase();
  const badgeLabel = userTier === 'pro' ? 'PRO' : userTier === 'pack' ? 'PACK' : 'FREE';
  const badgeIsPaid = userTier !== 'free';

  // Derive archetype from raw OB answers or persona
  const rawAnswers = state.rawOBAnswers;
  const primaryMood = rawAnswers?.mood?.[0] ?? 'explore';
  const archetypeKey = MOOD_ARCHETYPE[primaryMood] ?? (persona?.archetype ?? 'explorer');
  const archetypeMeta = ARCHETYPE_META[archetypeKey] ?? ARCHETYPE_META.explorer;
  const archetypeColor = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' };
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

  function openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Sub-screen routing
  if (view === 'notifications') return <NotificationsScreen onBack={() => setView('main')} />;
  if (view === 'units') return <UnitsSheet onClose={() => setView('main')} />;
  if (view === 'privacy') return <PrivacyScreen onBack={() => setView('main')} onSignOut={handleSignOut} />;
  if (view === 'subscription-details') return <SubscriptionDetailsScreen onBack={() => setView('main')} />;

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center">
        <h1 className="font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--color-text-1)]">
          Profile
        </h1>
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
            className="px-2 py-0.5 rounded-full border text-[11px] font-bold flex-shrink-0"
            style={badgeIsPaid
              ? { borderColor: 'var(--color-amber)', color: 'var(--color-amber)', background: 'var(--color-amber-bg)' }
              : { borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
          >
            {badgeLabel}
          </div>
        </div>

        {/* Archetype hero card */}
        {archetypeData && (
          <div className="mx-4 mt-4">
            <div
              className="rounded-[20px] p-5 relative overflow-hidden"
              style={{
                background: `linear-gradient(150deg, ${archetypeData.glow}, var(--color-surface))`,
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
              <div className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)] mt-2">
                {archetypeData.name}
              </div>
              <div className="text-[13px] text-[var(--color-text-3)] mt-0.5">{archetypeData.tagline}</div>
              <button
                onClick={startOBRedo}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 10, fontSize: 11, fontWeight: 600,
                  color: 'var(--color-primary)',
                  background: 'var(--color-primary-bg)',
                  border: '1px solid rgba(212,168,83,.22)',
                  padding: '4px 10px', borderRadius: 99,
                }}
              >
                <span className="ms" style={{ fontSize: 13, color: 'var(--color-primary)' }}>tune</span>
                Retune persona
              </button>
            </div>
          </div>
        )}

        {/* Plan row */}
        <div className="mt-5 px-4">
          <SectionLabel>Settings</SectionLabel>
        </div>
        <div className="mx-4 mb-2">
          <PlanRow
            userTier={userTier}
            generationCount={generationCount}
            onUpgrade={goToSubscription}
            onManage={() => setView('subscription-details')}
          />
        </div>
        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] mb-4 mx-4" style={{ background: 'var(--color-surface)' }}>
          <SettingsRow
            label="Notifications"
            onTap={() => setView('notifications')}
          />
        </div>

        {/* App section */}
        <div className="px-4">
          <SectionLabel>App</SectionLabel>
        </div>
        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] mb-4 mx-4" style={{ background: 'var(--color-surface)' }}>
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
          <div className="flex items-center justify-between py-3 px-4 border-t border-[var(--color-divider)]">
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
              style={{ background: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-border-m)' }}
              aria-label="Toggle appearance"
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{ transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(0px)' }}
              />
            </button>
          </div>
        </div>

        {/* Legal & Support */}
        <div className="mt-2 px-4">
          <SectionLabel>Legal & Support</SectionLabel>
        </div>
        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] mb-8 mx-4" style={{ background: 'var(--color-surface)' }}>
          <SettingsRow
            label="Privacy Policy"
            onTap={() => openUrl('https://uncoverroads.com/privacy')}
          />
          <SettingsRow
            label="Terms & Conditions"
            divider
            onTap={() => openUrl('https://uncoverroads.com/terms')}
          />
          <SettingsRow
            label="Send Feedback"
            divider
            onTap={() => window.open('mailto:sourav@uncoverroads.com?subject=Feedback on Uncover Roads', '_blank')}
          />
          <SettingsRow
            label="Sign Out"
            divider
            labelClass="text-[#f87171]"
            right={signingOut
              ? <span className="text-[11px] text-[var(--color-text-4)]">Signing out…</span>
              : <span className="ms" style={{ fontSize: 18, color: '#f87171' }}>logout</span>
            }
            onTap={handleSignOut}
          />
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function PlanRow({
  userTier,
  generationCount,
  onUpgrade,
  onManage,
}: {
  userTier: string;
  generationCount: number;
  onUpgrade: () => void;
  onManage: () => void;
}) {
  const usedDots = Math.min(generationCount, 3);
  const isPaywalled = userTier === 'free' && generationCount >= 3;

  if (userTier === 'pro') {
    return (
      <button
        onClick={onManage}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'rgba(212,168,83,.25)' }}
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-bg)' }}>
          <span aria-hidden="true" className="ms" style={{ fontSize: 18, color: 'var(--color-primary)' }}>star</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)] mb-0.5">Your Plan</p>
          <p className="text-[13px] font-semibold text-[var(--color-text-1)]">Pro · Unlimited trips</p>
          <p className="text-[11px] text-[var(--color-text-3)] mt-0.5">{`Renews ${formatRenewal()}`}</p>
        </div>
        <span className="text-[11px] font-bold text-[var(--color-primary)]">Manage →</span>
      </button>
    );
  }

  if (userTier === 'pack') {
    return (
      <button
        onClick={onManage}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-bg)' }}>
          <span aria-hidden="true" className="ms" style={{ fontSize: 18, color: 'var(--color-primary)' }}>confirmation_number</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)] mb-0.5">Your Plan</p>
          <p className="text-[13px] font-semibold text-[var(--color-text-1)]">Trip Pack</p>
        </div>
        <span className="text-[11px] font-bold text-[var(--color-primary)]">Manage →</span>
      </button>
    );
  }

  // Free tier
  return (
    <button
      onClick={onUpgrade}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border"
      style={{
        background: isPaywalled ? 'rgba(212,168,83,.06)' : 'var(--color-surface)',
        borderColor: isPaywalled ? 'rgba(212,168,83,.35)' : 'var(--color-border)',
      }}
    >
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-bg)' }}>
        <span aria-hidden="true" className="ms" style={{ fontSize: 18, color: 'var(--color-primary)' }}>auto_awesome</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)] mb-0.5">Your Plan</p>
        <p className="text-[13px] font-semibold text-[var(--color-text-1)]">
          {`Free · ${usedDots} of 3 trips used`}
        </p>
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i < usedDots ? 'var(--color-primary)' : 'rgba(255,255,255,.12)' }}
            />
          ))}
        </div>
      </div>
      <span className="text-[11px] font-bold text-[var(--color-primary)] flex-shrink-0">Upgrade →</span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>{children}</p>
  );
}

function SettingsRow({
  label,
  sublabel,
  labelClass = '',
  right,
  rowStyle,
  divider,
  onTap,
}: {
  label: string;
  sublabel?: string;
  labelClass?: string;
  right?: ReactNode;
  rowStyle?: CSSProperties;
  divider?: boolean;
  onTap?: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${divider ? 'border-t border-[var(--color-divider)]' : ''}`}
      style={rowStyle}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${labelClass}`} style={!labelClass ? { color: 'var(--color-text-2)' } : {}}>{label}</p>
        {sublabel && <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{sublabel}</p>}
      </div>
      {right ?? <span className="ms text-[var(--color-text-4)] text-base">chevron_right</span>}
    </button>
  );
}

function formatRenewal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
