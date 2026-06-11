import type { ReelSummaryCard } from './types';

interface Props {
  card: ReelSummaryCard;
  active: boolean;
}

const STYLE_TAG: Record<string, string> = {
  gastronaut:          'Food & local flavour',
  flaneur:             'Open-ended wandering',
  slowscholar:         'Culture & depth',
  neighbourhoodlocal:  'Off the tourist trail',
  efficientexplorer:   'Maximum coverage',
  aesthete:            'Design & beauty',
  nightcreature:       'Evening-first',
  ritualseeker:        'Slow & intentional',
};

const PERSONA_SUMMARY_LINE: Record<string, string> = {
  explorer:          'Built around your explorer instincts.',
  wanderer:          'Shaped for wanderers who move slow and notice more.',
  foodie:            'Woven around the places worth eating at.',
  gastronaut:        'Every stop chosen with your palate in mind.',
  flaneur:           'A route made for drifting — no agenda, just good places.',
  slowscholar:       'Depth over distance — each stop earns its place.',
  neighbourhoodlocal:'Off the tourist circuit, entirely on purpose.',
  efficientexplorer: 'Maximum ground covered, minimum wasted time.',
  aesthete:          'Curated for the eye — beauty at every turn.',
  nightcreature:     'Front-loaded rest, back-loaded life. Your kind of day.',
  ritualseeker:      'Slow, intentional, unhurried — built for your pace.',
  culture:           'Rich in heritage and meaning — your kind of journey.',
  adventure:         'High-energy stops, your kind of momentum.',
};

function travelStyleTag(persona: string): string {
  const key = persona.toLowerCase().replace(/[\s_-]/g, '');
  return STYLE_TAG[key] ?? persona.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function BokehBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      {/* Gold bloom — bottom centre */}
      <div style={{
        position: 'absolute', bottom: '-5%', left: '15%', right: '15%', height: '55%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(212,168,83,0.28) 0%, rgba(194,124,74,0.12) 45%, transparent 70%)',
        filter: 'blur(40px)',
      }} />
      {/* Blue accent — top right */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-10%', width: '60%', height: '50%',
        background: 'radial-gradient(ellipse at 80% 20%, rgba(79,143,171,0.22) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
      {/* Sage mid-left accent */}
      <div style={{
        position: 'absolute', top: '30%', left: '-5%', width: '40%', height: '40%',
        background: 'radial-gradient(ellipse at 10% 50%, rgba(139,158,106,0.14) 0%, transparent 65%)',
        filter: 'blur(35px)',
      }} />
    </div>
  );
}

export function ReelSummaryCard({ card }: Props) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: 'linear-gradient(160deg, #0d1a2e 0%, #0e1520 50%, #141008 100%)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '40px 28px',
    }}>
      <BokehBackground />

      {/* Top + bottom content fades */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to bottom, #0d1a2e, transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, #141008, transparent)', pointerEvents: 'none' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999, marginBottom: 16,
            background: 'rgba(79,143,171,0.12)', border: '1px solid rgba(79,143,171,0.25)',
          }}>
            <span className="ms fill" style={{ fontSize: 11, color: '#4f8fab', lineHeight: 1 }}>flight</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4f8fab' }}>Trip Summary</span>
          </div>

          <div style={{ color: '#f5f0ea', fontSize: 40, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, lineHeight: 1.05, marginBottom: 10 }}>
            {card.totalDays} Day{card.totalDays !== 1 ? 's' : ''} Planned
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: '#a09880', fontSize: 14 }}>
              {card.totalStops} stop{card.totalStops !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>·</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
              background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)',
              color: '#d4a853',
            }}>
              {travelStyleTag(card.persona)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 28 }} />

        {/* Intelligence items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {card.intelItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}>
                {item.icon}
              </div>
              <div style={{ paddingTop: 5 }}>
                <span style={{ color: '#f5f0ea', fontSize: 14, lineHeight: 1.45 }}>
                  <span style={{ color: '#d4a853', fontWeight: 700 }}>{item.count} {item.label}</span>
                  {' '}{item.detail}
                </span>
              </div>
            </div>
          ))}
          {card.intelItems.length === 0 && (
            <div style={{ color: '#a09880', fontSize: 14, fontStyle: 'italic' }}>
              {PERSONA_SUMMARY_LINE[card.persona?.toLowerCase().replace(/[\s_-]/g, '') ?? '']
                ?? 'Route optimised for your travel style.'}
            </div>
          )}
        </div>

        {/* Neighborhood pills */}
        {card.neighborhoods?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 24 }}>
            {card.neighborhoods.slice(0, 4).map((n, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.45)',
              }}>
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
