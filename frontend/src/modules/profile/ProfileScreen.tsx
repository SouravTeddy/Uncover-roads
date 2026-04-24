import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { useProfile } from './useProfile';
import { supabase } from '../../shared/supabase';
import type { UserTier } from '../../shared/types';
import { NotificationsScreen } from './sub-screens/NotificationsScreen';
import { UnitsSheet } from './sub-screens/UnitsSheet';
import { PrivacyScreen } from './sub-screens/PrivacyScreen';
import { SubscriptionDetailsScreen } from './sub-screens/SubscriptionDetailsScreen';

type ProfileView = 'main' | 'notifications' | 'units' | 'privacy' | 'subscription-details';

export function ProfileScreen() {
  const { dispatch, state } = useAppStore();
  const { persona, userTier, generationCount, startOBRedo, goToSubscription } = useProfile();
  const [view, setView] = useState<ProfileView>('main');
  const [signingOut, setSigningOut] = useState(false);

  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null; email: string } | null =
    rawUser ? JSON.parse(rawUser) : null;

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut().catch(console.warn);
    localStorage.removeItem('ur_persona');
    localStorage.removeItem('ur_user');
    localStorage.removeItem('ur_saved_itineraries');
    localStorage.removeItem('ur_user_tier');
    localStorage.removeItem('ur_trip_packs');
    dispatch({ type: 'GO_TO', screen: 'login' });
  }

  // Sub-screen routing
  if (view === 'notifications') return <NotificationsScreen onBack={() => setView('main')} />;
  if (view === 'units') return <UnitsSheet onClose={() => setView('main')} />;
  if (view === 'privacy') return <PrivacyScreen onBack={() => setView('main')} onSignOut={handleSignOut} />;
  if (view === 'subscription-details') return <SubscriptionDetailsScreen onBack={() => setView('main')} />;

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <span className="font-heading font-bold text-text-1 text-lg flex-1">Profile</span>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto px-4"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >

        {/* User card */}
        <div className="mt-5 mb-4 flex items-center gap-3 px-4 py-4 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,.03)' }}>
          <AvatarCircle user={user} tier={userTier} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{user?.name ?? 'Explorer'}</p>
            <p className="text-white/40 text-xs truncate">{user?.email ?? ''}</p>
          </div>
          <TierBadge tier={userTier} />
        </div>

        {/* OB persona card */}
        <button
          onClick={startOBRedo}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border mb-4"
          style={{
            background: 'rgba(255,255,255,.03)',
            borderColor: userTier === 'free' ? 'rgba(249,115,22,.5)' : 'rgba(245,158,11,.5)',
          }}
        >
          <span className="text-3xl leading-none flex-shrink-0">
            {persona ? (getPersonaEmoji(persona.archetype)) : '🧭'}
          </span>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Your Travel Persona</p>
            <p className="text-white font-bold text-sm truncate">
              {persona?.archetype_name ?? 'Not set yet'}
            </p>
            <p className="text-[11px]" style={{ color: '#f97316' }}>Retune your persona →</p>
          </div>
        </button>

        {/* Itinerary attempts counter — free only */}
        {userTier === 'free' && (
          <AttemptsCounter count={generationCount} />
        )}

        {/* Account section */}
        <SectionLabel>Account</SectionLabel>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
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
        <SectionLabel>App</SectionLabel>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
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
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center px-4 py-3.5 border-t border-white/6"
          >
            {signingOut
              ? <span className="ms animate-spin text-red-400 mr-2">autorenew</span>
              : null}
            <span className="text-red-400 text-sm font-medium">{signingOut ? 'Signing out…' : 'Sign Out'}</span>
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

function AvatarCircle({ user, tier }: { user: { name: string; avatar: string | null } | null; tier: UserTier }) {
  const isPaid = tier === 'pro' || tier === 'unlimited';
  const initials = (user?.name ?? 'U')[0].toUpperCase();

  return (
    <div
      className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={isPaid
        ? { padding: '2px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }
        : { background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.2)' }
      }
    >
      {isPaid ? (
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: '#1e293b' }}>
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            : <span className="text-primary font-bold text-base">{initials}</span>}
        </div>
      ) : (
        user?.avatar
          ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          : <span className="text-primary font-bold text-base">{initials}</span>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: UserTier }) {
  if (tier === 'free') {
    return (
      <div className="px-2.5 py-1 rounded-lg flex-shrink-0 border border-white/20">
        <span className="text-white/40 text-[10px] font-bold">FREE</span>
      </div>
    );
  }
  return (
    <div
      className="px-2.5 py-1 rounded-lg flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}
    >
      <span className="text-[#0f172a] text-[10px] font-bold">{tier === 'pro' ? 'PRO' : 'UNLIMITED'}</span>
    </div>
  );
}

function AttemptsCounter({ count }: { count: number }) {
  const used = Math.min(count, 3);
  return (
    <div className="rounded-2xl border border-white/8 px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
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
        {used} of 3 used · 1st: full · 2nd–3rd: no curation · 4th+: upgrade
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

function getPersonaEmoji(archetype: string): string {
  const map: Record<string, string> = {
    historian: '🏛️', epicurean: '🍽️', wanderer: '🧭',
    voyager: '✈️', explorer: '🌿', slowtraveller: '☕', pulse: '🎶',
  };
  return map[archetype] ?? '🧭';
}

function formatRenewal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
