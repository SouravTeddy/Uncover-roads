import type { MapFilter } from '../../shared/types'

interface Props {
  active: MapFilter
  allCount: number
  curatedCount: number
  curatedLocked: boolean
  onSelect: (filter: MapFilter) => void
  onLockedTap: () => void
}

export function FilterBar({ active, allCount, curatedCount, curatedLocked, onSelect, onLockedTap }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {/* All chip */}
      <button
        onClick={() => onSelect('all')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', height: 28, borderRadius: 999,
          background: active === 'all' ? 'var(--color-primary)' : 'rgba(15,20,30,.82)',
          border: active === 'all'
            ? '1px solid var(--color-primary)'
            : '1px solid rgba(255,255,255,.12)',
          color: active === 'all' ? '#fff' : 'rgba(255,255,255,.65)',
          fontSize: '0.72rem', fontWeight: 700,
          backdropFilter: 'blur(8px)',
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
      >
        All
        {allCount > 0 && (
          <span style={{ opacity: 0.7, fontSize: '0.68rem' }}>· {allCount}</span>
        )}
      </button>

      {/* Curated chip */}
      <button
        onClick={() => curatedLocked ? onLockedTap() : onSelect('curated')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', height: 28, borderRadius: 999,
          background: active === 'curated'
            ? 'var(--color-primary-bg)'
            : 'rgba(15,20,30,.82)',
          border: active === 'curated'
            ? '1px solid var(--color-primary)'
            : curatedLocked
            ? '1px solid rgba(255,255,255,.1)'
            : '1px solid rgba(224,120,84,.3)',
          color: active === 'curated'
            ? 'var(--color-primary)'
            : curatedLocked
            ? 'rgba(255,255,255,.35)'
            : 'rgba(224,120,84,.85)',
          fontSize: '0.72rem', fontWeight: 700,
          backdropFilter: 'blur(8px)',
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
          opacity: curatedLocked ? 0.75 : 1,
        }}
      >
        <span style={{ fontSize: 10 }}>✦</span>
        Curated
        {!curatedLocked && curatedCount > 0 && (
          <span style={{ opacity: 0.65, fontSize: '0.68rem' }}>· {curatedCount}</span>
        )}
        {curatedLocked && (
          <span className="ms" style={{ fontSize: 12, marginLeft: 1 }}>lock</span>
        )}
      </button>
    </div>
  )
}
