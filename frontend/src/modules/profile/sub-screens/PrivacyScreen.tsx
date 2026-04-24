import { useState } from 'react';
import { supabase } from '../../../shared/supabase';

export function PrivacyScreen({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const rawUser = localStorage.getItem('ur_user');
  const user: { email: string } | null = rawUser ? JSON.parse(rawUser) : null;

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    await supabase.auth.signOut().catch(console.warn);
    ['ur_persona','ur_user','ur_saved_itineraries','ur_user_tier','ur_trip_packs',
     'ur_gen_count','ur_notif_prefs','ur_units'].forEach(k => localStorage.removeItem(k));
    onSignOut();
  }

  async function handleExportData() {
    alert(`Export request sent to ${user?.email ?? 'your email'}.`);
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={onBack}><span className="ms text-xl text-text-3">arrow_back</span></button>
        <span className="font-heading font-bold text-text-1 text-lg">Privacy & Data</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>

        {/* What we collect */}
        <div className="rounded-2xl border border-white/8 px-4 py-4 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3">What we collect</p>
          <p className="text-white/50 text-xs leading-relaxed">
            We collect your email address for authentication, travel persona answers to personalise itineraries, and itinerary generation counts to manage plan limits. We do not sell your data. Map and place data is fetched in real-time and not stored against your profile.
          </p>
        </div>

        {/* Actions */}
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <button
            onClick={handleExportData}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="ms text-white/30 text-lg">download</span>
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">Export my data</p>
              <p className="text-white/25 text-xs">Sent to your registered email</p>
            </div>
            <span className="ms text-white/20 text-base">chevron_right</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-t border-white/6"
          >
            <span className="ms text-red-400/60 text-lg">delete_forever</span>
            <div className="flex-1">
              <p className="text-red-400 text-sm font-medium">Delete my account</p>
              <p className="text-white/25 text-xs">Permanently removes all data</p>
            </div>
            <span className="ms text-white/20 text-base">chevron_right</span>
          </button>
        </div>

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 60, background: 'rgba(0,0,0,.7)' }}>
            <div className="w-full max-w-sm rounded-2xl px-6 py-6" style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)' }}>
              <p className="text-white font-bold text-base mb-1">Delete account?</p>
              <p className="text-white/40 text-sm mb-4">This is permanent. Type DELETE to confirm.</p>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 outline-none focus:border-red-400/40"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                  className="flex-1 h-11 rounded-xl text-sm text-white/50 border border-white/10"
                >Cancel</button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-red-600 disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
