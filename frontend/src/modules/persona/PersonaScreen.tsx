import { useAppStore } from '../../shared/store';
import { ARCHETYPE_COLORS } from './types';

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

// ── Day open / evening labels ──────────────────────────────────
const DAY_OPEN_LABELS: Record<string, string> = {
  coffee:    'Coffee first',
  breakfast: 'Sit-down breakfast',
  straight:  'Straight to it',
  grab_go:   'Grab & go',
};
const DAY_OPEN_ICONS: Record<string, string> = {
  coffee: 'local_cafe', breakfast: 'egg_alt', straight: 'directions_run', grab_go: 'takeout_dining',
};

const EVENING_LABELS: Record<string, string> = {
  bars:        'Bar hop',
  dinner_wind: 'Dinner & wind down',
  markets:     'Night markets',
  early:       'Early night in',
};
const EVENING_ICONS: Record<string, string> = {
  bars: 'local_bar', dinner_wind: 'restaurant', markets: 'storefront', early: 'bedtime',
};

// ── Venue type display names ───────────────────────────────────
const VENUE_LABELS: Record<string, string> = {
  neighbourhood: 'Neighbourhoods', landmark: 'Landmarks', viewpoint: 'Viewpoints',
  park: 'Parks', spa: 'Spas', cafe: 'Cafés', restaurant: 'Restaurants',
  market: 'Markets', street_food: 'Street food', museum: 'Museums',
  heritage: 'Heritage sites', gallery: 'Galleries', romantic: 'Romantic spots',
  table_for_2: 'Intimate dining', family: 'Family spots', communal: 'Communal dining',
  social: 'Social venues', group_booking: 'Group spots',
};
const VENUE_ICONS: Record<string, string> = {
  neighbourhood: 'home_pin', landmark: 'account_balance', viewpoint: 'landscape',
  park: 'park', spa: 'spa', cafe: 'local_cafe', restaurant: 'restaurant',
  market: 'storefront', street_food: 'ramen_dining', museum: 'museum',
  heritage: 'account_balance', gallery: 'palette', romantic: 'favorite',
  table_for_2: 'dinner_dining', family: 'family_restroom', communal: 'groups',
  social: 'diversity_3', group_booking: 'groups',
};

// ── Social flag labels ─────────────────────────────────────────
const SOCIAL_LABELS: Record<string, string> = {
  solo: 'Solo', couple: 'Couple', family: 'Family', kids: 'Kid-friendly', group: 'Group',
};
const SOCIAL_ICONS: Record<string, string> = {
  solo: 'person', couple: 'people', family: 'family_restroom', kids: 'child_care', group: 'groups',
};

// ── Dietary flag labels ────────────────────────────────────────
const DIETARY_LABELS: Record<string, string> = {
  vegan_boost: 'Plant-based', meat_flag: 'Meat-friendly',
  halal_certified_only: 'Halal', kosher_certified_only: 'Kosher',
  allergy_warning: 'Allergy aware',
};
const DIETARY_ICONS: Record<string, string> = {
  vegan_boost: 'eco', meat_flag: 'set_meal',
  halal_certified_only: 'mosque', kosher_certified_only: 'synagogue',
  allergy_warning: 'warning',
};

// ── Price display ──────────────────────────────────────────────
function priceRange(min: number, max: number): string {
  const symbols = ['', '$', '$$', '$$$', '$$$$'];
  return min === max ? symbols[min] : `${symbols[min]} – ${symbols[max]}`;
}

function flexLabel(f: number): string {
  if (f >= 0.7) return 'Flexible';
  if (f >= 0.4) return 'Balanced';
  return 'Structured';
}

export function PersonaScreen() {
  const { state, dispatch } = useAppStore();
  const profile = state.personaProfile;
  const rawAnswers = state.rawOBAnswers;

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center gap-5 px-8" style={{ zIndex: 20 }}>
        <span className="ms text-text-3 text-4xl">sentiment_dissatisfied</span>
        <p className="text-text-2 text-sm text-center">No persona data found.</p>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'ob1' })}
          className="px-6 py-3 bg-primary text-white rounded-xl font-heading font-bold text-sm"
        >
          Take the Assessment
        </button>
      </div>
    );
  }

  // Derive archetype from primary mood
  const primaryMood = rawAnswers?.mood?.[0] ?? 'explore';
  const archetypeKey = MOOD_ARCHETYPE[primaryMood] ?? 'explorer';
  const meta = ARCHETYPE_META[archetypeKey] ?? ARCHETYPE_META.explorer;
  const color = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' };

  // Top venues: sort by weight, take top 5, filter weight > 0.1
  const topVenues = Object.entries(profile.venue_weights)
    .filter(([, w]) => (w ?? 0) > 0.1)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 5)
    .map(([k]) => k);

  function startPlanning() {
    // Persist so App knows onboarding is done on next load
    try {
      localStorage.setItem('ur_persona', JSON.stringify({ archetype: archetypeKey }));
    } catch { /* ignore */ }
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  return (
    <div className="fixed inset-0 bg-bg overflow-y-auto" style={{ zIndex: 20 }}>

      {/* Top bar */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
        <span className="ms text-text-2 text-xl">explore</span>
        <span className="font-heading font-semibold text-text-1 text-sm">Uncover Roads</span>
      </div>

      {/* Hero card */}
      <div
        className="relative mx-4 mt-5 rounded-3xl overflow-hidden text-center"
        style={{
          background: `linear-gradient(160deg, ${color.glow}, rgba(255,255,255,.02))`,
          border: `1px solid ${color.primary}28`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${color.glow} 0%, transparent 70%)`,
          }}
        />
        <div className="relative px-6 pt-8 pb-7">
          <div
            className="text-7xl leading-none mb-4"
            style={{ filter: `drop-shadow(0 0 28px ${color.primary}80)` }}
          >
            {meta.emoji}
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight mb-2">
            {meta.name}
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-[260px] mx-auto">
            {meta.tagline}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 mt-5 grid grid-cols-3 gap-2">
        {[
          { icon: 'place', label: 'Stops / day', value: String(profile.stops_per_day) },
          { icon: 'payments', label: 'Budget range', value: priceRange(profile.price_min, profile.price_max) },
          { icon: 'tune', label: 'Pacing', value: flexLabel(profile.flexibility) },
        ].map(stat => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 py-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}
          >
            <span className="ms text-text-3 text-lg">{stat.icon}</span>
            <span className="text-white font-heading font-bold text-base leading-none">{stat.value}</span>
            <span className="text-text-3 text-[10px]">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Day preview */}
      <div className="px-5 mt-6">
        <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">Your Day</p>
        <div className="flex items-center gap-2">
          {/* Morning */}
          <div
            className="flex items-center gap-1.5 px-3 h-9 rounded-full flex-shrink-0"
            style={{ background: `${color.primary}18`, border: `1px solid ${color.primary}35` }}
          >
            <span className="ms fill text-xs" style={{ color: color.primary }}>
              {DAY_OPEN_ICONS[profile.day_open] ?? 'wb_sunny'}
            </span>
            <span className="text-white text-xs font-semibold">
              {DAY_OPEN_LABELS[profile.day_open] ?? profile.day_open}
            </span>
          </div>

          {/* Arrow + stops */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="ms text-text-3 text-sm">arrow_forward</span>
            <span className="text-text-3 text-xs whitespace-nowrap">
              {profile.stops_per_day} stops ~{profile.time_per_stop}min each
            </span>
            <span className="ms text-text-3 text-sm">arrow_forward</span>
          </div>

          {/* Evening */}
          <div
            className="flex items-center gap-1.5 px-3 h-9 rounded-full flex-shrink-0"
            style={{ background: `${color.primary}18`, border: `1px solid ${color.primary}35` }}
          >
            <span className="ms fill text-xs" style={{ color: color.primary }}>
              {EVENING_ICONS[profile.evening_type] ?? 'nightlife'}
            </span>
            <span className="text-white text-xs font-semibold">
              {EVENING_LABELS[profile.evening_type] ?? profile.evening_type}
            </span>
          </div>
        </div>
      </div>

      {/* Top venues */}
      {topVenues.length > 0 && (
        <div className="px-5 mt-5">
          <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">
            Places we'll surface
          </p>
          <div className="flex flex-wrap gap-2">
            {topVenues.map(v => (
              <div
                key={v}
                className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-surface border border-white/10"
              >
                <span className="ms text-xs text-text-3">{VENUE_ICONS[v] ?? 'place'}</span>
                <span className="text-text-2 text-xs font-medium">{VENUE_LABELS[v] ?? v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social flags */}
      {profile.social_flags.length > 0 && (
        <div className="px-5 mt-5 flex flex-wrap gap-2">
          {profile.social_flags.map(f => (
            <div
              key={f}
              className="flex items-center gap-1.5 px-3 h-7 rounded-full bg-surface border border-white/8"
            >
              <span className="ms fill text-xs text-text-3">{SOCIAL_ICONS[f] ?? 'person'}</span>
              <span className="text-text-2 text-xs">{SOCIAL_LABELS[f] ?? f}</span>
            </div>
          ))}
          {profile.dietary.map(f => (
            <div
              key={f}
              className="flex items-center gap-1.5 px-3 h-7 rounded-full bg-surface border border-white/8"
            >
              <span className="ms fill text-xs text-text-3">{DIETARY_ICONS[f] ?? 'info'}</span>
              <span className="text-text-2 text-xs">{DIETARY_LABELS[f] ?? f}</span>
            </div>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="px-5 mt-8 pb-14">
        <button
          onClick={startPlanning}
          className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2 mb-3"
          style={{ background: `linear-gradient(135deg, ${color.primary}, ${color.primary}bb)` }}
        >
          Start Planning
          <span className="ms text-sm">arrow_forward</span>
        </button>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'ob1' })}
          className="w-full h-11 rounded-2xl bg-transparent text-text-3 text-sm flex items-center justify-center gap-1.5 border border-white/8"
        >
          <span className="ms text-sm">refresh</span>
          Retake Assessment
        </button>
      </div>
    </div>
  );
}
